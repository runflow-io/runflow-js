"use client";

// Top-level Runflow Studio shell — owns all state, composes Header /
// LeftRail / Canvas / WorkflowsPanel.
//
// State shape:
//   assets    Map<assetId, AssetState>   each photo + its version history
//   activeId  string                      which asset is open
//   selected  string | null               which workflow card is selected
//   inputs    Record<string, string>      generic input values (color/select/text/textarea)
//   pin       { x, y } | null             AI-Edit pin location
//   editText  string                      AI-Edit / prompt text
//   reference File | null                 mask-ref reference image
//   brushSize, maskCoverage               mask-related state
//   running, progress, error              dispatch state
//
// Brush mask logic is set up via useEffect when a mask-* workflow is
// selected. Two canvases sync (visible coral + hidden B&W) just like
// the retaillabs version, but scoped to this shell.

import JSZip from "jszip";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  PackageCreativeDirection,
  PackageRecipeStep,
  PackageVariant,
  Workflow,
} from "../data/workflows";
import type { CustomWorkflow } from "../lib/custom-workflows";
import { type GenerationResolution, dispatchGeneration } from "../lib/generation";
import { createMaskController } from "../lib/mask";
import {
  type ResBucket,
  TOPAZ_MAX_OUTPUT_MP,
  displayBucket,
  isUpscale,
  probeImageDims,
  resBucket,
  topazExceedsCap,
  topazOutputMP,
} from "../lib/resolution";
import { type RunProgress, runWorkflow, uploadFile } from "../lib/runflow";
import { type SentinelResult, evaluate as sentinelEvaluate } from "../lib/sentinel";
import {
  ShellConfigProvider,
  type StudioShellProps,
  resolveShellConfig,
  useShellConfig,
} from "../lib/shell-config";
import type { PartialStudioHandle } from "../lib/studio-handle";
import { getStudioSettings } from "../lib/studio-settings";
import { compactSummary } from "../lib/version-summary";
import { type Pin, StudioCanvas } from "./Canvas";
import { ComparePanel } from "./ComparePanel";
import { GeneratePanel } from "./GeneratePanel";
import { ReferenceGallery } from "./ReferenceGallery";
import { SentinelBadge, SentinelChip } from "./SentinelBadge";
import { SettingsMenu } from "./SettingsMenu";
import { StepParamsForm, StepPicker, defaultStepValues } from "./StepEditor";
import { type StudioToast, Toasts } from "./Toasts";
import { type Version, type VersionRequest, WorkflowsPanel } from "./WorkflowsPanel";
import { Icon } from "./icons";

type AssetState = {
  id: string;
  title: string;
  baseUrl: string;
  tags: string[];
  versions: Version[];
  currentVersionId: string;
  /** Editorial picks: which workflow cards should highlight when this
   * asset is active. Comes from samples.generated.json; uploads have
   * none. */
  recommendedWorkflows?: string[];
};

function assetFromSample(s: {
  id: string;
  title: string;
  url: string;
  tags: string[];
  width?: number;
  height?: number;
  recommendedWorkflows?: string[];
}): AssetState {
  return {
    id: s.id,
    title: s.title,
    baseUrl: s.url,
    tags: s.tags,
    versions: [
      {
        id: "v0",
        url: s.url,
        label: "Original",
        ts: 0,
        width: s.width,
        height: s.height,
      },
    ],
    currentVersionId: "v0",
    recommendedWorkflows: s.recommendedWorkflows,
  };
}

export function StudioShell(props: StudioShellProps) {
  // Resolve the customization props once per change; zero props ⇒ the
  // built-in catalogue/samples/sentinel/copy (original behavior).
  // Deps are field-level (not object identity) so idiomatic inline
  // objects — copy={{...}} / sentinel={{...}} — don't re-mint the
  // context value every parent render. `tools`/`source` arrays and the
  // taskDescription function still compare by reference: pass stable
  // values for those.
  // biome-ignore lint/correctness/useExhaustiveDependencies: field-level deps are deliberate (see above)
  const config = useMemo(
    () => resolveShellConfig(props),
    [
      props.tools,
      props.source,
      props.sentinel?.enabled,
      props.sentinel?.taskDescription,
      JSON.stringify(props.copy ?? null),
    ],
  );
  // Ref mirror for the stable-memo studioHandle closures below.
  const configRef = useRef(config);
  configRef.current = config;

  const [assets, setAssets] = useState<Record<string, AssetState>>(() => {
    const m: Record<string, AssetState> = {};
    for (const s of config.samples) m[s.id] = assetFromSample(s);
    return m;
  });
  const [order, setOrder] = useState<string[]>(() => config.samples.map((s) => s.id));
  const [activeId, setActiveId] = useState<string | null>(config.samples[0]?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  // Per-run edits to a package workflow. Initialised from the workflow's
  // preset on selection; user reordering/deleting/toggling in the action
  // panel mutates these local copies. Never written back to the workflow
  // definition. Reset whenever the user picks a different workflow card
  // or switches assets (resetSelection clears them).
  //
  //  - editedPackagePrep: the linear prep chain (drag-handle + delete UI)
  //  - editedPackageVariants: the fan-out variants with their per-run
  //    enabled flag (checkbox UI). Empty array for single-output packages
  //    like zalando-package.
  const [editedPackagePrep, setEditedPackagePrep] = useState<PackageRecipeStep[]>([]);
  const [editedPackageVariants, setEditedPackageVariants] = useState<
    Array<{ variant: PackageVariant; enabled: boolean }>
  >([]);
  // Creative-direction picker state for packages that declare one
  // (e.g. campaign-pack). `pickId` is the selected quick-pick chip id
  // ("custom" when the user typed their own); `value` is the actual
  // prompt that gets injected into the matching prep step at apply
  // time. Both reset when the user switches workflows.
  const [editedPackageCreativePickId, setEditedPackageCreativePickId] = useState<string | null>(
    null,
  );
  const [editedPackageCreativeValue, setEditedPackageCreativeValue] = useState<string>("");
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [pin, setPin] = useState<Pin | null>(null);
  const [editText, setEditText] = useState("");
  const [reference, setReference] = useState<File | null>(null);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  // Additional reference slots — primary `reference` is slot 0, extras
  // fill slots 1..3 (cap of 4 total per workflow run to avoid Runflow
  // upstream rejecting on cheaper models). Kept separate so existing
  // single-ref code paths (chat agent, logo workflow) stay untouched.
  const [extraReferences, setExtraReferences] = useState<File[]>([]);
  const [extraReferencePreviews, setExtraReferencePreviews] = useState<string[]>([]);
  const [referencePrompt, setReferencePrompt] = useState("");
  // Unmount-only blob-URL cleanup (ref mirror — never revoke while rendered).
  const previewUrlsRef = useRef<{ primary: string | null; extras: string[] }>({
    primary: null,
    extras: [],
  });
  previewUrlsRef.current = { primary: referencePreview, extras: extraReferencePreviews };
  useEffect(
    () => () => {
      const p = previewUrlsRef.current;
      if (p.primary) URL.revokeObjectURL(p.primary);
      for (const u of p.extras) URL.revokeObjectURL(u);
    },
    [],
  );
  const [brushSize, setBrushSize] = useState(45);
  const [maskCoverage, setMaskCoverage] = useState(0);
  useEffect(() => {
    maskCtl.setBrushSize(brushSize);
  }, [brushSize]);
  const [error, setError] = useState<string | null>(null);
  // Non-blocking edit UX:
  //   - Each Apply synchronously adds a *pending* Version to the asset's
  //     stripe; the user is auto-switched to it but free to navigate.
  //   - The actual run dispatches in the background; on completion the
  //     pending Version's URL is swapped in and a toast surfaces.
  //   - There's no global "running" flag — multiple Applies can be in
  //     flight at once.
  const [toasts, setToasts] = useState<StudioToast[]>([]);
  // On phones (<= 768px) the asset rail and workflows panel act as
  // overlays rather than grid columns. `leftCollapsed=true` on mobile
  // hides the slide-over drawer (matches the desktop semantics of the
  // same flag — column-width 0). `rightOpenMobile` is the bottom-sheet
  // toggle; desktop ignores it because the panel always lives in the grid.
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightOpenMobile, setRightOpenMobile] = useState(false);
  const isMobileRef = useRef(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const sync = (e: { matches: boolean }) => {
      isMobileRef.current = e.matches;
      if (e.matches) {
        setLeftCollapsed(true);
        setRightOpenMobile(false);
      } else {
        setLeftCollapsed(false);
        setRightOpenMobile(false);
      }
    };
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  const [sentinelOpen, setSentinelOpen] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  // Tracks per-version Sentinel retry-in-flight so the badge can
  // disable its Retry button while a re-eval is mid-flight. Lives at
  // the shell level (not inside the badge) because the eval can
  // outlive the user navigating away from the version. Cleared when
  // the retry resolves and patches the new sentinel state in.
  const [sentinelRetrying, setSentinelRetrying] = useState<Record<string, boolean>>({});

  // Chat-driven canvas takeover. When the chat agent calls request_pin
  // or request_mask, we flip these flags so the existing canvas
  // pin/paint UI lights up — but the resolver writes back to the chat
  // instead of the card-flow's local pin/mask state.
  const [chatPinMode, setChatPinMode] = useState(false);
  const [chatMaskMode, setChatMaskMode] = useState(false);
  const [chatStageHint, setChatStageHint] = useState<string | null>(null);
  const pinResolverRef = useRef<((p: Pin | null) => void) | null>(null);
  const maskResolverRef = useRef<((b: Blob | null) => void) | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const visibleMaskRef = useRef<HTMLCanvasElement>(null);
  // Brush engine — the same controller exported from ./headless, so the
  // shell is itself a consumer of the public mask primitive. Lazy init:
  // the factory allocates closures, no need to redo that per render.
  const maskCtlRef = useRef<ReturnType<typeof createMaskController> | null>(null);
  if (maskCtlRef.current === null) {
    maskCtlRef.current = createMaskController({ brushSize: 45 });
  }
  const maskCtl = maskCtlRef.current;

  // Always-fresh refs for the studioHandle. The chat agent can dispatch
  // multiple run_workflow calls in sequence, and each subsequent call
  // needs to read the LATEST asset state (so step 2 picks up step 1's
  // output as its source). Without these, the closure inside
  // studioHandle captures the assets at memo time, and chained workflows
  // both run on the original image.
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;

  const active = activeId ? assets[activeId] : null;
  const currentVersion = active
    ? active.versions.find((v) => v.id === active.currentVersionId) || active.versions[0]
    : null;
  const selectedWf = useMemo(
    () => config.workflows.find((w) => w.id === selected) ?? null,
    [selected, config.workflows],
  );
  const isPinning = selectedWf?.kind === "pin" || chatPinMode;
  const isPainting =
    selectedWf?.kind === "mask-only" || selectedWf?.kind === "mask-ref" || chatMaskMode;

  // Close the Sentinel judges panel only when the user switches ASSETS,
  // not just versions within an asset. Switching versions keeps the
  // panel open — the panel content auto-updates to the new version's
  // sentinel result, AND the toast-driven View action can open the
  // panel without our reset effect immediately closing it again.
  useEffect(() => {
    setSentinelOpen(false);
  }, [active?.id]);

  // ---------- URL ↔ state sync ----------
  // The studio is single-page but encodes the active asset + version in
  // the query string so a link captures *what you're looking at right
  // now*. Uploaded blobs aren't shareable across browsers — we still
  // sync them so the URL is consistent locally; the Share toast warns
  // the user when they share an upload.
  //
  // On mount: parse ?asset=&v= and restore state if the asset/version
  // exist. Skipped if the URL has no asset param so first-time visitors
  // land on the default sample.
  const urlHydrated = useRef(false);
  useEffect(() => {
    if (urlHydrated.current) return;
    urlHydrated.current = true;
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const wantAsset = params.get("asset");
    const wantVersion = params.get("v");
    if (!wantAsset) return;
    setAssets((s) => {
      const a = s[wantAsset];
      if (!a) return s;
      if (wantVersion && a.versions.some((v) => v.id === wantVersion)) {
        return { ...s, [wantAsset]: { ...a, currentVersionId: wantVersion } };
      }
      return s;
    });
    if (assets[wantAsset]) setActiveId(wantAsset);
    // We only run this once on mount — `assets` is captured for the
    // membership check; running it again on `assets` change would clobber
    // user navigation back into the URL on every state update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // On change: write asset + version into the URL via replaceState so
  // back/forward isn't polluted. We only sync once hydration has run to
  // avoid racing with the mount-time read.
  useEffect(() => {
    if (!urlHydrated.current) return;
    if (typeof window === "undefined" || !activeId || !active) return;
    const params = new URLSearchParams(window.location.search);
    params.set("asset", activeId);
    params.set("v", active.currentVersionId);
    const search = params.toString();
    const next = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
    if (next !== window.location.pathname + window.location.search + window.location.hash) {
      window.history.replaceState(null, "", next);
    }
  }, [activeId, active?.currentVersionId]);

  // ---------- Brush mask sync ----------
  useEffect(() => {
    if (!isPainting) return;
    const img = imgRef.current;
    const visible = visibleMaskRef.current;
    if (!img || !visible) return;
    const sync = () => {
      if (!img.naturalWidth || !img.naturalHeight) return;
      const rect = img.getBoundingClientRect();
      const w = Math.round(rect.width);
      const h = Math.round(rect.height);
      if (w === 0 || h === 0) return;
      maskCtl.attach(visible);
      maskCtl.syncToDisplay(w, h, window.devicePixelRatio || 1);
      setMaskCoverage(0);
    };
    if (img.complete) sync();
    else img.addEventListener("load", sync, { once: true });
    const ro = new ResizeObserver(sync);
    ro.observe(img);
    return () => ro.disconnect();
  }, [isPainting, currentVersion?.url]);

  const onMaskDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPainting) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    maskCtl.beginStroke(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onMaskMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!maskCtl.isStroking()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    maskCtl.strokeTo(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onMaskUp = () => {
    if (maskCtl.isStroking()) {
      maskCtl.endStroke();
      setMaskCoverage(maskCtl.coverage());
    }
  };

  const clearMask = () => {
    maskCtl.clear();
    setMaskCoverage(0);
  };

  const generateMaskBlob = async (): Promise<Blob | null> => {
    const img = imgRef.current;
    if (!img || !img.naturalWidth) return null;
    return maskCtl.toMaskBlob(img.naturalWidth, img.naturalHeight);
  };

  // ---------- Image click for AI-Edit pin (and chat-driven pin) ----------
  const onImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!isPinning) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    // Chat takeover wins over card flow if both happen to be active.
    if (chatPinMode && pinResolverRef.current) {
      const resolve = pinResolverRef.current;
      pinResolverRef.current = null;
      setChatPinMode(false);
      setChatStageHint(null);
      resolve({ x, y });
      return;
    }
    setPin({ x, y });
  };

  // ---------- Reference image upload ----------
  // Max references per run. The Runflow upstream model schemas vary;
  // 4 is a safe ceiling across the providers Runflow fans into.
  const MAX_REFERENCES = 4;
  const onReferenceFile = (file: File | null) => {
    if (referencePreview) URL.revokeObjectURL(referencePreview);
    if (!file) {
      setReference(null);
      setReferencePreview(null);
      return;
    }
    setReference(file);
    setReferencePreview(URL.createObjectURL(file));
  };
  // Append additional reference files (e.g. the user picks multiple at
  // once or drops a second image). Caps at MAX_REFERENCES total —
  // primary slot + extras. Files beyond the cap are dropped silently
  // since the multi-slot UI already shows the limit. Computes the
  // new files / object URLs synchronously *outside* the React state
  // updaters so React 19 strict-mode double-renders don't end up
  // creating duplicate object URLs or duplicate entries.
  const onAddReferenceFiles = (files: File[]) => {
    if (files.length === 0) return;
    const remaining = files.slice();
    if (!reference) {
      const head = remaining.shift();
      if (head) {
        setReference(head);
        setReferencePreview(URL.createObjectURL(head));
      }
    }
    if (remaining.length === 0) return;
    const room = MAX_REFERENCES - 1 - extraReferences.length;
    if (room <= 0) return;
    const accepted = remaining.slice(0, room);
    const acceptedPreviews = accepted.map((f) => URL.createObjectURL(f));
    setExtraReferences((prev) => [...prev, ...accepted]);
    setExtraReferencePreviews((prev) => [...prev, ...acceptedPreviews]);
  };
  const onRemoveExtraReference = (index: number) => {
    setExtraReferences((prev) => prev.filter((_, i) => i !== index));
    setExtraReferencePreviews((prev) => {
      const url = prev[index];
      if (url) URL.revokeObjectURL(url);
      return prev.filter((_, i) => i !== index);
    });
  };
  const clearAllReferences = () => {
    onReferenceFile(null);
    for (const u of extraReferencePreviews) URL.revokeObjectURL(u);
    setExtraReferences([]);
    setExtraReferencePreviews([]);
  };

  // ---------- Asset management ----------
  const onSelectAsset = (id: string) => {
    setActiveId(id);
    resetSelection();
    // Auto-close the assets drawer on phones after a pick — the user
    // tapped to switch images, they want the canvas back.
    if (isMobileRef.current) setLeftCollapsed(true);
  };

  // ---------- Generate panel ----------
  // When `generateOpen` is true, the left rail swaps the asset list
  // for the inline GeneratePanel. The panel is a controlled form:
  // hitting Generate calls dispatchGenerationSession below, which
  // creates a real asset with N pending versions and switches the
  // canvas to it. The panel itself is stateless beyond its form
  // inputs — all generation lifecycle lives here so an in-flight
  // session survives the user flipping back to the asset list.
  const [generateOpen, setGenerateOpen] = useState(false);

  // Generate N variations as a single session. Each variation
  // becomes one pending Version on a freshly-created asset, dispatched
  // in parallel. The first resolved variation auto-promotes to the
  // current version so the canvas swaps from the skeleton to a real
  // image as soon as anything lands. Sentinel evaluates each variation
  // on success — same per-version path the workflow runs use.
  const dispatchGenerationSession = (params: {
    prompt: string;
    aspectRatio: string;
    resolution: GenerationResolution;
    count: number;
    /** Reference images for image-to-image generation. Uploaded once
     * up front, then the same URL list is reused across every
     * variation's dispatch so we don't pay the upload cost N times. */
    references?: File[];
  }) => {
    const trimmedPrompt = params.prompt.trim();
    if (!trimmedPrompt) return;
    const assetId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title =
      trimmedPrompt.length > 50 ? `${trimmedPrompt.slice(0, 50).trim()}…` : trimmedPrompt;

    // Build N pending versions up front — the version stripe + canvas
    // skeleton render off these immediately so the user sees "we're
    // working on 4 things" the instant they click Generate.
    const versionRequest: VersionRequest = {
      workflowId: "generate",
      prompt: trimmedPrompt,
      values: {
        aspect_ratio: params.aspectRatio,
        resolution: params.resolution,
      },
    };
    const baseTs = Date.now();
    const initialVersions: Version[] = Array.from({ length: params.count }, (_, i) => ({
      id: `v${i}`,
      url: "",
      label: `Variation ${i + 1}`,
      ts: baseTs + i,
      pending: true,
      pendingKind: "generation",
      progressMessage: "Drafting…",
      request: versionRequest,
    }));

    const asset: AssetState = {
      id: assetId,
      title,
      baseUrl: "",
      tags: ["generated"],
      versions: initialVersions,
      currentVersionId: "v0",
    };
    setAssets((s) => ({ ...s, [assetId]: asset }));
    setOrder((o) => [assetId, ...o]);
    setActiveId(assetId);
    resetSelection();

    // Track which variation index resolves first so we can auto-swap
    // the canvas from the skeleton onto the first finished image.
    // Subsequent resolves don't change the current version — the user
    // can navigate via the version stripe.
    let firstResolvedIndex: number | null = null;

    // Dispatch all N runs in parallel, each with a different seed so
    // the variations are visually distinct. Reference images (if any)
    // are uploaded ONCE up front and reused — paying the upload cost
    // per variation would be wasteful since the same URLs feed every
    // run.
    const refsPromise: Promise<string[]> =
      params.references && params.references.length > 0
        ? Promise.all(
            params.references.map((f, i) =>
              uploadFile(`generate-ref-${i + 1}.png`, f, f.type || "image/png"),
            ),
          )
        : Promise.resolve([]);

    initialVersions.forEach((_, idx) => {
      const seed = Math.floor(Math.random() * 1_000_000);
      void (async () => {
        const referenceUrls = await refsPromise;
        const result = await dispatchGeneration({
          prompt: trimmedPrompt,
          aspectRatio: params.aspectRatio,
          resolution: params.resolution,
          seed,
          ...(referenceUrls.length > 0 ? { referenceUrls } : {}),
        });

        if (!result.ok) {
          setAssets((s) => {
            const a = s[assetId];
            if (!a) return s;
            return {
              ...s,
              [assetId]: {
                ...a,
                versions: a.versions.map((v, i) =>
                  i === idx ? { ...v, pending: false, error: result.error } : v,
                ),
              },
            };
          });
          return;
        }

        // Success — patch the version with the URL + dims, drop
        // pending. Auto-promote the first resolved variation as the
        // canvas's current version so the user sees real pixels asap.
        setAssets((s) => {
          const a = s[assetId];
          if (!a) return s;
          const nextVersions = a.versions.map((v, i) =>
            i === idx
              ? {
                  ...v,
                  url: result.outputUrl,
                  width: result.width,
                  height: result.height,
                  pending: false,
                  pendingKind: undefined,
                  progressMessage: undefined,
                }
              : v,
          );
          let nextCurrent = a.currentVersionId;
          if (firstResolvedIndex === null) {
            firstResolvedIndex = idx;
            nextCurrent = nextVersions[idx].id;
          }
          return {
            ...s,
            [assetId]: {
              ...a,
              versions: nextVersions,
              currentVersionId: nextCurrent,
            },
          };
        });

        // Sentinel evaluation — same per-version pattern the workflow
        // runs use. Task description is the user's prompt verbatim,
        // exactly what the judges should be scoring against.
        if (!configRef.current.sentinel.enabled) return;
        const sentinelResult = await sentinelEvaluate(result.outputUrl, trimmedPrompt);
        setAssets((s) => {
          const a = s[assetId];
          if (!a) return s;
          return {
            ...s,
            [assetId]: {
              ...a,
              versions: a.versions.map((v, i) =>
                i === idx ? { ...v, sentinel: sentinelResult } : v,
              ),
            },
          };
        });
      })();
    });

    addToast({
      kind: "success",
      title: `Generating ${params.count} variation${params.count === 1 ? "" : "s"}`,
      body: "Watch the canvas — each one will fill in as the model finishes.",
    });
  };

  const onUploadAsset = (file: File) => {
    const url = URL.createObjectURL(file);
    const id = `up-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const title = file.name.replace(/\.[^.]+$/, "");
    const asset: AssetState = {
      id,
      title,
      baseUrl: url,
      tags: [],
      versions: [{ id: "v0", url, label: "Original", ts: 0 }],
      currentVersionId: "v0",
    };
    setAssets((s) => ({ ...s, [id]: asset }));
    setOrder((o) => [id, ...o]);
    setActiveId(id);
    resetSelection();
    // Probe natural dims off the blob URL — patch the v0 version once
    // they're known. Fire-and-forget; failure is fine, we just don't
    // surface a resolution pill for this asset.
    void probeImageDims(url).then((dims) => {
      if (!dims) return;
      setAssets((s) => {
        const a = s[id];
        if (!a) return s;
        return {
          ...s,
          [id]: {
            ...a,
            versions: a.versions.map((v) =>
              v.id === "v0" ? { ...v, width: dims.width, height: dims.height } : v,
            ),
          },
        };
      });
    });
  };

  // ---------- Workflow selection / dispatch ----------
  const resetSelection = () => {
    setSelected(null);
    setError(null);
    setPin(null);
    setEditText("");
    setReferencePrompt("");
    clearAllReferences();
    clearMask();
    setEditedPackagePrep([]);
    setEditedPackageVariants([]);
    setEditedPackageCreativePickId(null);
    setEditedPackageCreativeValue("");
  };

  const onSelectWorkflow = (wf: Workflow) => {
    if (wf.kind === "soon") return;
    setSelected(wf.id);
    setError(null);
    setPin(null);
    setEditText("");
    setReferencePrompt("");
    clearAllReferences();
    const defaults: Record<string, string> = {};
    for (const inp of wf.inputs ?? []) {
      if ("default" in inp && inp.default) defaults[inp.key] = inp.default;
    }
    setInputs(defaults);
    // Seed the editable chain copies from the package's preset. Cloning
    // so up/down/delete/toggle in the action panel doesn't mutate the
    // workflow definition.
    if (wf.kind === "package" && wf.package) {
      setEditedPackagePrep(wf.package.prep.map((s) => ({ ...s, params: { ...s.params } })));
      setEditedPackageVariants(
        (wf.package.variants ?? []).map((v) => ({
          variant: {
            ...v,
            steps: v.steps.map((s) => ({ ...s, params: { ...s.params } })),
          },
          enabled: v.defaultEnabled !== false,
        })),
      );
      setEditedPackageCreativePickId(null);
      setEditedPackageCreativeValue("");
    } else {
      setEditedPackagePrep([]);
      setEditedPackageVariants([]);
      setEditedPackageCreativePickId(null);
      setEditedPackageCreativeValue("");
    }
    // Mobile: workflows that need a canvas interaction (place a pin or
    // paint a mask) need the canvas, not the sheet. Drop the bottom
    // sheet so the user can see the image. The Edits FAB shows a
    // "Configure" label so they're one tap away from coming back.
    // For pin workflows we reopen the sheet automatically once a pin
    // is placed (see effect below); for mask workflows the user comes
    // back via the FAB after painting.
    if (
      isMobileRef.current &&
      (wf.kind === "pin" || wf.kind === "mask-only" || wf.kind === "mask-ref")
    ) {
      setRightOpenMobile(false);
    }
  };

  // Mobile: when the user places a pin for a pin-style workflow, slide
  // the sheet back up so they can describe the change and tap Apply.
  useEffect(() => {
    if (!isMobileRef.current) return;
    if (selectedWf?.kind === "pin" && pin) setRightOpenMobile(true);
  }, [pin, selectedWf]);

  // Single workflow-execution path used by both card flow (onApply) and
  // chat flow (studioHandle.runWorkflow). Synchronously creates a
  // pending Version + auto-switches the user onto it, then dispatches
  // the run in the background. Returns a Promise that resolves when the
  // run completes — the chat awaits this; the card flow doesn't.
  //
  // Concurrent executeWorkflow calls are safe: each generates a unique
  // version id, each setAssets update uses functional form so they
  // can't clobber each other's pending versions.
  const executeWorkflow = (
    wf: Workflow,
    sourceUrl: string,
    targetAssetId: string,
    dispatch: {
      prompt?: string;
      pin?: Pin;
      maskBlob?: Blob;
      maskCoverage?: number;
      referenceFile?: File;
      referenceFiles?: File[];
      values: Record<string, string>;
      /** True when this is a non-final step in a chain (chat plan,
       * package chain, custom workflow replay). Default behaviour
       * is to skip the per-output Sentinel for intermediates so the
       * chain runs fast. If the global "gateBetweenSteps" setting is
       * on, the dispatcher instead AWAITS Sentinel for intermediates
       * and rejects the run if the verdict is red, so a bad
       * intermediate halts the chain before more compute is spent. */
      intermediate?: boolean;
      /** When set, the per-step error toast is suppressed because the
       * caller (e.g. the package chain) is going to surface a more
       * descriptive named-step toast on top. */
      suppressErrorToast?: boolean;
    },
  ): Promise<
    { ok: true; versionId: string; outputUrl: string; label: string } | { ok: false; error: string }
  > => {
    // Unique version id generated up front so concurrent runs can't
    // collide on `v${versions.length}`.
    const newVid = `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();

    // Snapshot the request — what the user asked for. Surfaced in the
    // History tab so the user can answer "did I really ask for that?"
    // without having to remember.
    const request: VersionRequest = {
      workflowId: wf.id,
      ...(dispatch.prompt?.trim() ? { prompt: dispatch.prompt.trim() } : {}),
      ...(dispatch.values && Object.keys(dispatch.values).length
        ? { values: { ...dispatch.values } }
        : {}),
      ...(dispatch.pin ? { pin: dispatch.pin } : {}),
      ...(typeof dispatch.maskCoverage === "number" ? { maskCoverage: dispatch.maskCoverage } : {}),
      ...(dispatch.referenceFile ? { referenceFileName: dispatch.referenceFile.name } : {}),
      sourceUrl,
    };

    // Synchronously add the pending version + switch the user onto it.
    setAssets((s) => {
      const a = s[targetAssetId];
      if (!a) return s;
      const v: Version = {
        id: newVid,
        url: sourceUrl, // show source while waiting
        label: wf.name,
        ts: startedAt,
        pending: true,
        progressMessage: "Preparing…",
        request,
      };
      return {
        ...s,
        [targetAssetId]: {
          ...a,
          versions: [...a.versions, v],
          currentVersionId: newVid,
        },
      };
    });

    // Per-version progress updates — patches the pending Version's
    // progressMessage as the run moves through phases.
    const onProgress = (p: RunProgress) => {
      setAssets((s) => {
        const a = s[targetAssetId];
        if (!a) return s;
        return {
          ...s,
          [targetAssetId]: {
            ...a,
            versions: a.versions.map((ver) =>
              ver.id === newVid ? { ...ver, progressMessage: p.message } : ver,
            ),
          },
        };
      });
    };

    return (async () => {
      const result = await runWorkflow(wf, sourceUrl, dispatch, onProgress);

      if (result.status !== "succeeded" || !result.outputUrl) {
        const errMsg = result.error || "Workflow failed";
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) =>
                ver.id === newVid
                  ? { ...ver, pending: false, error: errMsg, progressMessage: undefined }
                  : ver,
              ),
            },
          };
        });
        if (!dispatch.suppressErrorToast) {
          addToast({
            kind: "error",
            title: `${wf.name} failed`,
            body: errMsg,
          });
        }
        return { ok: false, error: errMsg };
      }

      const outputUrl = result.outputUrl;

      // Patch the pending Version with the real output URL + drop pending.
      setAssets((s) => {
        const a = s[targetAssetId];
        if (!a) return s;
        return {
          ...s,
          [targetAssetId]: {
            ...a,
            versions: a.versions.map((ver) =>
              ver.id === newVid
                ? {
                    ...ver,
                    url: outputUrl,
                    pending: false,
                    progressMessage: undefined,
                    sentinel: { state: "pending" },
                  }
                : ver,
            ),
          },
        };
      });

      // Probe dims on the output URL — runs in parallel with the
      // browser's <img> fetch, so the second-pass patch lands shortly
      // after. Failure is silent; we just don't get a resolution pill.
      void probeImageDims(outputUrl).then((dims) => {
        if (!dims) return;
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) =>
                ver.id === newVid ? { ...ver, width: dims.width, height: dims.height } : ver,
              ),
            },
          };
        });
      });

      // Helper — used by BOTH the workflow toast and the sentinel toast
      // to navigate to this specific version regardless of which asset
      // the user is currently on. Set active asset first, then switch
      // version inside it. The sentinel-side caller can also open the
      // judges panel immediately so the user lands on the explanation.
      const navigateToVersion = (openSentinel: boolean) => {
        setActiveId(targetAssetId);
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          if (!a.versions.some((v) => v.id === newVid)) return s;
          return { ...s, [targetAssetId]: { ...a, currentVersionId: newVid } };
        });
        if (openSentinel) setSentinelOpen(true);
        else setSentinelOpen(false);
      };

      // Toast 1 — the edit itself completed. Click View → land on it.
      // Suppressed for intermediates so a 4-step chain doesn't spawn
      // 4 toasts; only the final step (the one the user is actually
      // waiting for) announces itself.
      if (!dispatch.intermediate) {
        addToast({
          kind: "success",
          title: `${wf.name} ready`,
          body: "Click View to see the result.",
          thumbUrl: outputUrl,
          actionLabel: "View",
          onView: () => navigateToVersion(false),
        });
      }

      // Sentinel eval. Three flavours depending on `intermediate` and
      // the global gateBetweenSteps setting:
      //
      //   final step (intermediate=false):
      //     fire-and-forget, toast 2 lands later with verdict.
      //   intermediate, gating off (default):
      //     skip entirely. Throwaway intermediates don't deserve 2-4
      //     min of judge compute and the user only sees the final.
      //   intermediate, gating on:
      //     RUN Sentinel and AWAIT before resolving the Promise. If
      //     the verdict is red we halt the chain by returning ok=false;
      //     the chat agent's tool_result becomes is_error=true and the
      //     model stops kicking off subsequent steps. Amber and green
      //     both pass through; toast still surfaces verdict either way.
      // Host disabled Sentinel entirely — clear the pending placeholder
      // so no quality badge renders, and resolve.
      if (!config.sentinel.enabled) {
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) =>
                ver.id === newVid ? { ...ver, sentinel: undefined } : ver,
              ),
            },
          };
        });
        return { ok: true, versionId: newVid, outputUrl, label: wf.name };
      }

      const settings = getStudioSettings();
      const isIntermediate = !!dispatch.intermediate;
      const gateThis = isIntermediate && settings.gateBetweenSteps;

      if (isIntermediate && !settings.gateBetweenSteps) {
        // Skip Sentinel for this throwaway intermediate. Clear the
        // sentinel placeholder so the version thumb settles into a
        // neutral border instead of the amber pulse.
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) =>
                ver.id === newVid ? { ...ver, sentinel: undefined } : ver,
              ),
            },
          };
        });
        return { ok: true, versionId: newVid, outputUrl, label: wf.name };
      }

      const taskDesc = config.sentinel.taskDescription(wf.id, dispatch.values, dispatch.prompt);
      const sentinelPromise = sentinelEvaluate(outputUrl, taskDesc, sourceUrl);

      // Gating mode: await the verdict so we can halt the chain on red.
      // We still fire the same per-version state update + toast as
      // fire-and-forget mode (just inside the awaited callback).
      if (gateThis) {
        const sentinel = await sentinelPromise;
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) => (ver.id === newVid ? { ...ver, sentinel } : ver)),
            },
          };
        });
        if (sentinel.state === "red") {
          addToast({
            kind: "error",
            title: `Chain halted: ${wf.name} failed quality check`,
            body: "Sentinel flagged this intermediate, so we stopped before running the rest of the chain. Toggle the setting off if you'd rather power through.",
            thumbUrl: outputUrl,
            actionLabel: "View checks",
            onView: () => navigateToVersion(true),
          });
          return { ok: false, error: "Intermediate step failed quality check (Sentinel red)" };
        }
        if (sentinel.state === "failed") {
          // Eval crashed — different from a `red` verdict. Don't halt
          // on an infra problem (that'd punish a perfect image), but
          // do surface it so the user knows the gate didn't actually
          // run on this step.
          addToast({
            kind: "warning",
            title: `${wf.name}: quality check error, continuing`,
            body: sentinel.error
              ? `${sentinel.error} · the chain continues without a quality gate on this step.`
              : "Sentinel couldn't finish the eval. The chain continues without a quality gate on this step.",
            thumbUrl: outputUrl,
          });
          return { ok: true, versionId: newVid, outputUrl, label: wf.name };
        }
        // Green or amber: continue, with a toast surfacing the verdict.
        addToast({
          kind: sentinel.state === "amber" ? "warning" : "success",
          title:
            sentinel.state === "amber"
              ? `${wf.name}: minor issue, continuing`
              : `${wf.name}: passed`,
          body:
            sentinel.state === "amber"
              ? "Sentinel raised one flag but it's not blocking. The chain continues."
              : "All checks pass. Moving to the next step.",
          thumbUrl: outputUrl,
          actionLabel: "View checks",
          onView: () => navigateToVersion(true),
        });
        return { ok: true, versionId: newVid, outputUrl, label: wf.name };
      }

      // Final step (or chain run with gating off): fire-and-forget
      // toast as before.
      sentinelPromise.then((sentinel) => {
        setAssets((s) => {
          const a = s[targetAssetId];
          if (!a) return s;
          return {
            ...s,
            [targetAssetId]: {
              ...a,
              versions: a.versions.map((ver) => (ver.id === newVid ? { ...ver, sentinel } : ver)),
            },
          };
        });

        // Per-state toast copy — verdict is in the body so the user
        // doesn't need to click to know what happened.
        const passes = sentinel.judges?.filter((j) => j.pass).length ?? 0;
        const total = sentinel.judges?.length ?? 0;
        const fails = total - passes;
        const score = typeof sentinel.score === "number" ? Math.round(sentinel.score * 100) : null;
        const scoreSuffix = score !== null ? ` · ${score}%` : "";

        let toastKind: "success" | "warning" | "error" = "success";
        let title = "Quality check ready";
        let body: string | undefined;

        if (sentinel.state === "green") {
          toastKind = "success";
          title = `${wf.name} — quality check passed`;
          body = `All ${total} of ${total} checks pass${scoreSuffix}`;
        } else if (sentinel.state === "amber") {
          toastKind = "warning";
          title = `${wf.name} — minor issue found`;
          body = `${passes}/${total} checks pass${scoreSuffix} · click View for the breakdown`;
        } else if (sentinel.state === "red") {
          // Real verdict — the judges voted this image out. Use the
          // "failed" wording so it's distinguishable from the eval-
          // crashed `failed` state below (which uses "error").
          toastKind = "error";
          title = `${wf.name} — quality check failed`;
          body = `${fails} ${fails === 1 ? "issue" : "issues"} found${scoreSuffix} · click View for the breakdown`;
        } else {
          // sentinel.state === "failed" — Sentinel itself errored
          // (Vertex blip, judge crash, timeout). The image is fine;
          // only the score is missing. Use a neutral "warning" kind so
          // a perfect image doesn't get a danger-coloured toast that
          // makes it read as a real failure.
          toastKind = "warning";
          title = `${wf.name} — quality check error`;
          body = sentinel.error
            ? `${sentinel.error} · the image still works, only the quality score is missing. Ping Ziad if it keeps happening.`
            : "The image still works — only the quality score is missing. Ping Ziad if it keeps happening.";
        }

        addToast({
          kind: toastKind,
          title,
          body,
          thumbUrl: outputUrl,
          // Only offer the View action if there's something to show —
          // a panel-with-judges or at least the failure reason.
          ...(sentinel.state !== "failed" || sentinel.error
            ? {
                actionLabel: "View checks",
                onView: () => navigateToVersion(true),
              }
            : {}),
        });
      });

      return { ok: true, versionId: newVid, outputUrl, label: wf.name };
    })();
  };

  // Toast helpers — slide in top-right, auto-dismiss, optional View action.
  const addToast = (t: Omit<StudioToast, "id" | "ts">) => {
    const id = `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const toast: StudioToast = { ...t, id, ts: Date.now() };
    setToasts((s) => [...s, toast]);
    // Auto-dismiss after 8s. User can still click View / dismiss
    // manually before that. setTimeout reference is kept lightweight.
    setTimeout(() => {
      setToasts((s) => s.filter((x) => x.id !== id));
    }, 8000);
  };
  const dismissToast = (id: string) => {
    setToasts((s) => s.filter((x) => x.id !== id));
  };

  // ---------- Sentinel retry ----------
  // Re-runs Sentinel against an existing version's image when the
  // first eval crashed/timed out. The workflow output is fine — only
  // the QA step missed — so re-firing the eval is much cheaper than
  // re-running the workflow itself.
  //
  // Resolves the version off the latest asset state (refs, not
  // closure captures) so that the retry survives the user navigating
  // between assets and versions. Idempotency guard: if a retry is
  // already in flight for this version, the second click no-ops.
  const onRetrySentinel = (versionId: string) => {
    if (!config.sentinel.enabled) return;
    if (sentinelRetrying[versionId]) return;
    // Locate the version + asset once up front; if either's gone we
    // can't retry. (Covers the edge case of a deleted asset between
    // toast click and handler call.)
    let foundAssetId: string | null = null;
    let foundVersion: Version | null = null;
    for (const aId of Object.keys(assetsRef.current)) {
      const a = assetsRef.current[aId];
      const v = a.versions.find((ver) => ver.id === versionId);
      if (v) {
        foundAssetId = aId;
        foundVersion = v;
        break;
      }
    }
    if (!foundAssetId || !foundVersion || !foundVersion.request) {
      addToast({
        kind: "error",
        title: "Can't retry quality check",
        body: "Lost the version's request context — refresh and try again.",
      });
      return;
    }
    const targetAssetId = foundAssetId;
    const ver = foundVersion;
    const req = ver.request;
    if (!req) return;

    // Flip badge back to pending + mark in-flight. Both updates fire
    // synchronously so the user sees immediate feedback (the spinner
    // pulse + the disabled button) before the network call goes out.
    setSentinelRetrying((s) => ({ ...s, [versionId]: true }));
    setAssets((s) => {
      const a = s[targetAssetId];
      if (!a) return s;
      return {
        ...s,
        [targetAssetId]: {
          ...a,
          versions: a.versions.map((v) =>
            v.id === versionId ? { ...v, sentinel: { state: "pending" } } : v,
          ),
        },
      };
    });

    const taskDesc = config.sentinel.taskDescription(req.workflowId, req.values ?? {}, req.prompt);
    void sentinelEvaluate(ver.url, taskDesc, req.sourceUrl).then((sentinel) => {
      setAssets((s) => {
        const a = s[targetAssetId];
        if (!a) return s;
        return {
          ...s,
          [targetAssetId]: {
            ...a,
            versions: a.versions.map((v) => (v.id === versionId ? { ...v, sentinel } : v)),
          },
        };
      });
      setSentinelRetrying((s) => {
        const next = { ...s };
        delete next[versionId];
        return next;
      });

      // Surface a toast so the user knows the retry landed even if
      // they navigated away from the badge panel. Same per-state
      // copy logic as the original eval, condensed.
      if (sentinel.state === "failed") {
        addToast({
          kind: "warning",
          title: "Quality check still erroring",
          body: sentinel.error
            ? `${sentinel.error} · the image still works, only the score is missing.`
            : "Sentinel couldn't finish the eval again. The image is fine, only the score is missing.",
          thumbUrl: ver.url,
        });
      } else if (sentinel.state === "red") {
        addToast({
          kind: "error",
          title: "Quality check failed",
          body: "Retry landed — judges flagged this image. Click View for the breakdown.",
          thumbUrl: ver.url,
        });
      } else {
        addToast({
          kind: sentinel.state === "amber" ? "warning" : "success",
          title: sentinel.state === "amber" ? "Quality check: minor issue" : "Quality check passed",
          body: "Retry landed.",
          thumbUrl: ver.url,
        });
      }
    });
  };

  // ---------- Custom workflow replay ----------
  // Walks a saved chain step-by-step against the active asset. Each
  // step's source URL is read fresh from assetsRef AFTER the previous
  // step's executeWorkflow Promise resolves, so step N+1 picks up
  // step N's output (same trick as the chat agent uses). All steps
  // except the last get intermediate=true; the dispatcher reads the
  // global gateBetweenSteps setting to decide whether to skip
  // Sentinel or await it and halt on red.
  //
  // Halts on the first failed step. Surfaces a toast either way.
  const runCustomWorkflow = async (
    custom: CustomWorkflow,
    overrides: Record<string, string> = {},
  ) => {
    const targetAssetId = activeIdRef.current;
    if (!targetAssetId) {
      addToast({
        kind: "error",
        title: "Pick a photo first",
        body: "No active asset to replay onto.",
      });
      return;
    }
    if (isMobileRef.current) setRightOpenMobile(false);
    if (custom.steps.length === 0) {
      addToast({ kind: "error", title: "Empty custom edit", body: "Nothing to run." });
      return;
    }
    addToast({
      kind: "success",
      title: `Running ${custom.name}`,
      body: `${custom.steps.length} step${custom.steps.length === 1 ? "" : "s"} on the current image.`,
    });
    for (let i = 0; i < custom.steps.length; i += 1) {
      const step = custom.steps[i];
      const isLast = i === custom.steps.length - 1;
      const wf = config.workflows.find((w) => w.id === step.workflowId);
      if (!wf || wf.kind === "soon") {
        addToast({
          kind: "error",
          title: `${custom.name} halted`,
          body: `Step ${i + 1}: workflow "${step.workflowId}" is no longer available.`,
        });
        return;
      }
      const asset = assetsRef.current[targetAssetId];
      const sourceUrl = asset?.versions.find((v) => v.id === asset.currentVersionId)?.url;
      if (!sourceUrl) {
        addToast({
          kind: "error",
          title: `${custom.name} halted`,
          body: "Lost the current version URL between steps.",
        });
        return;
      }
      // Apply overrides only to the final step (per UX spec). Other
      // steps replay their saved values verbatim.
      const mergedValues = isLast
        ? { ...(step.values ?? {}), ...overrides }
        : { ...(step.values ?? {}) };
      const result = await executeWorkflowRef.current(wf, sourceUrl, targetAssetId, {
        prompt: step.prompt,
        pin: step.pin,
        values: mergedValues,
        intermediate: !isLast,
      });
      if (!result.ok) {
        // executeWorkflow already surfaced the per-step error toast.
        // We just stop walking the chain.
        addToast({
          kind: "error",
          title: `${custom.name} halted at step ${i + 1}`,
          body: result.error,
        });
        return;
      }
    }
    // Final success toast is the per-step Sentinel toast (final
    // step's intermediate=false runs Sentinel as fire-and-forget).
    // No additional summary toast to avoid double-notifying.
  };

  // ---------- Package chain dispatch ----------
  // Runs a marketplace-bundle workflow. Two shapes:
  //
  //  - Single-output (e.g. zalando-package): only `prep` declared. Walks
  //    prep head-to-tail with intermediate=true on all but the last —
  //    Sentinel scores the last step as the final deliverable. One
  //    new version lands on the asset.
  //
  //  - Fan-out (e.g. omnichannel-pack): `prep` runs once (every step
  //    intermediate=true), then each enabled variant runs its own
  //    mini-chain in parallel from the prep output. Each variant's
  //    LAST step is intermediate=false so Sentinel scores it; each
  //    lands as its own version on the asset.
  //
  // The user can pass EDITED prep + variants that differ from the
  // workflow's preset (reorder, delete, toggle) — that's why they're
  // function params instead of being read off pkg.package.* inside.
  // Per-run edits don't mutate the workflow definition.
  const executePackage = async (
    pkg: Workflow,
    sourceUrl: string,
    targetAssetId: string,
    prep: PackageRecipeStep[],
    variants: Array<{ variant: PackageVariant; enabled: boolean }>,
  ): Promise<
    | {
        ok: true;
        // Populated only for single-output packages (no enabled variants).
        // The chat path needs this to chain subsequent steps; fan-out
        // packages have N finals and so leave this undefined.
        final?: { versionId: string; outputUrl: string; label: string };
      }
    | { ok: false; error: string }
  > => {
    if (pkg.kind !== "package") {
      return { ok: false, error: `${pkg.name} is not a package workflow` };
    }
    const enabledVariants = variants.filter((v) => v.enabled);
    const hasFanOut = enabledVariants.length > 0;
    if (prep.length === 0 && !hasFanOut) {
      return { ok: false, error: "Nothing to run" };
    }

    // Prep — head-to-tail. When there are no variants, the last prep
    // step is the package's final (Sentinel-scored). When variants are
    // enabled, all prep steps run intermediate=true since the actual
    // Sentinel-scored outputs are the variants downstream.
    let prepUrl = sourceUrl;
    let prepFinal: { versionId: string; outputUrl: string; label: string } | null = null;
    for (let i = 0; i < prep.length; i++) {
      const step = prep[i];
      const stepWf = config.workflows.find((w) => w.id === step.workflowId);
      if (!stepWf) {
        const err = `Prep step ${i + 1}: unknown workflow ${step.workflowId}`;
        addToast({
          kind: "error",
          title: `${pkg.name} — prep step ${i + 1} failed`,
          body: err,
        });
        return { ok: false, error: err };
      }
      const isLastPrep = i === prep.length - 1;
      const isFinal = isLastPrep && !hasFanOut;
      const result = await executeWorkflowRef.current(stepWf, prepUrl, targetAssetId, {
        values: step.params,
        intermediate: !isFinal,
        suppressErrorToast: true,
      });
      if (!result.ok) {
        const namedError = `Prep step ${i + 1} (${stepWf.name}): ${result.error}`;
        addToast({
          kind: "error",
          title: `${pkg.name} — prep step ${i + 1} failed`,
          body: result.error,
        });
        return { ok: false, error: namedError };
      }
      prepUrl = result.outputUrl;
      if (isFinal) {
        prepFinal = {
          versionId: result.versionId,
          outputUrl: result.outputUrl,
          label: result.label,
        };
      }
    }

    if (!hasFanOut) {
      return { ok: true, ...(prepFinal ? { final: prepFinal } : {}) };
    }

    // Fan-out — every enabled variant's mini-chain runs in parallel from
    // the prep output. A failing variant doesn't block the others
    // (they each surface their own toast), so the user gets whatever
    // the model could produce instead of all-or-nothing.
    await Promise.all(
      enabledVariants.map(async ({ variant }) => {
        let vUrl = prepUrl;
        for (let i = 0; i < variant.steps.length; i++) {
          const step = variant.steps[i];
          const stepWf = config.workflows.find((w) => w.id === step.workflowId);
          if (!stepWf) {
            addToast({
              kind: "error",
              title: `${pkg.name} — ${variant.label} step ${i + 1} failed`,
              body: `unknown workflow ${step.workflowId}`,
            });
            return;
          }
          const isLast = i === variant.steps.length - 1;
          const result = await executeWorkflowRef.current(stepWf, vUrl, targetAssetId, {
            values: step.params,
            intermediate: !isLast,
            suppressErrorToast: true,
          });
          if (!result.ok) {
            addToast({
              kind: "error",
              title: `${pkg.name} — ${variant.label} step ${i + 1} failed`,
              body: result.error,
            });
            return;
          }
          vUrl = result.outputUrl;
        }
      }),
    );
    return { ok: true };
  };

  const onApply = async () => {
    if (!selectedWf || !active || !currentVersion) return;
    // Mobile: tapping Apply means "go" — drop the sheet so the user
    // sees the canvas where the new version is spinning up. The sheet
    // would otherwise stay open hiding the result of their action.
    if (isMobileRef.current) setRightOpenMobile(false);
    // Packages run a chain of existing workflows. Pass the user's
    // (possibly reordered/trimmed) edited steps; if for some reason
    // they're empty fall back to the preset.
    if (selectedWf.kind === "package") {
      // If the package declares a creative-direction picker, inject
      // the user's chosen value into the matching prep step before
      // dispatch. This keeps the workflow definition stateless and
      // avoids special-casing the dispatcher.
      const direction = selectedWf.package?.creativeDirection;
      const prepWithInjection = direction
        ? editedPackagePrep.map((step) => {
            if (step.workflowId !== direction.injectAt.workflowIdMatch) return step;
            return {
              ...step,
              params: {
                ...step.params,
                [direction.injectAt.paramKey]: editedPackageCreativeValue,
              },
            };
          })
        : editedPackagePrep;
      void executePackage(
        selectedWf,
        currentVersion.url,
        active.id,
        prepWithInjection,
        editedPackageVariants,
      );
      resetSelection();
      return;
    }
    let maskBlob: Blob | undefined;
    if (selectedWf.kind === "mask-only" || selectedWf.kind === "mask-ref") {
      const b = await generateMaskBlob();
      maskBlob = b ?? undefined;
    }
    const promptText =
      selectedWf.kind === "pin"
        ? editText
        : selectedWf.kind === "mask-ref"
          ? referencePrompt
          : inputs.prompt;
    // Snapshot dispatch inputs so resetSelection (which clears pin /
    // editText / mask / reference state) can run immediately — the
    // background run uses the snapshot, not the live state.
    const dispatchInputs = {
      prompt: promptText,
      pin: pin ?? undefined,
      maskBlob,
      // Only snapshot coverage when the workflow actually used the mask
      // — coverage from a no-op brush state would be misleading.
      maskCoverage:
        (selectedWf.kind === "mask-only" || selectedWf.kind === "mask-ref") && maskCoverage > 0
          ? maskCoverage
          : undefined,
      referenceFile: reference ?? undefined,
      referenceFiles: reference ? [reference, ...extraReferences] : extraReferences,
      values: { ...inputs },
    };
    // Fire-and-forget: kicks off the run in the background, returns a
    // pending version immediately. The user can pick another card right
    // away. The run resolves the Promise later but we don't await — the
    // toast handles completion UI.
    void executeWorkflow(selectedWf, currentVersion.url, active.id, dispatchInputs);
    resetSelection();
  };

  const onPickVersion = (id: string) => {
    if (!active) return;
    setAssets((s) => ({
      ...s,
      [active.id]: { ...s[active.id], currentVersionId: id },
    }));
  };

  // Undo/Redo step through the active asset's version list — each edit
  // lands as a new version, so prev/next maps naturally onto these.
  // Pending versions are skipped: landing on one shows the source image
  // until the run completes, which is confusing.
  const versionList = active?.versions ?? [];
  const versionIndex =
    active && currentVersion ? versionList.findIndex((v) => v.id === currentVersion.id) : -1;
  const stepVersion = (dir: -1 | 1): Version | null => {
    if (versionIndex < 0) return null;
    let i = versionIndex + dir;
    while (i >= 0 && i < versionList.length) {
      if (!versionList[i].pending) return versionList[i];
      i += dir;
    }
    return null;
  };
  const undoTarget = stepVersion(-1);
  const redoTarget = stepVersion(1);
  const onUndo = () => {
    if (undoTarget) onPickVersion(undoTarget.id);
  };
  const onRedo = () => {
    if (redoTarget) onPickVersion(redoTarget.id);
  };

  // Share — copy the current URL (which already encodes asset + version
  // via the sync effect below). For uploaded assets the blob URL won't
  // be visible to recipients, so we warn instead of pretending it works.
  const onShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (!url) return;
    const isSample = activeId ? config.samples.some((s) => s.id === activeId) : false;
    try {
      await navigator.clipboard.writeText(url);
      addToast({
        kind: isSample ? "success" : "warning",
        title: "Link copied",
        body: isSample
          ? "Anyone with this link will land on the same asset and version."
          : "Note: uploaded images aren't visible to others — share a sample asset instead.",
      });
    } catch {
      addToast({
        kind: "error",
        title: "Couldn't copy link",
        body: "Your browser blocked clipboard access. Copy from the address bar instead.",
      });
    }
  };

  // Export current version. Routes through /demos/api/image so the
  // <a download> attribute works even on cross-origin sources (FAL CDN,
  // R2-presigned, runflow output). Filename composed from asset title +
  // version label so users can keep multiple exports straight.
  const onExport = () => {
    if (!active || !currentVersion) return;
    const safeName = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "export";
    const filename = `${safeName(active.title)}-${safeName(currentVersion.label)}.png`;
    const proxyUrl = `/demos/api/image?url=${encodeURIComponent(currentVersion.url)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  // Bundle every non-pending, non-errored version of the active asset
  // into a single zip the user can grab in one click. Useful right after
  // a fan-out package run (omnichannel-pack / lifestyle-pack /
  // campaign-pack) where multiple variant versions land together.
  //
  // Each version is pulled through /demos/api/image so cross-origin
  // sources (FAL CDN, R2-presigned, runflow output) come back with a
  // sniffed image/* content-type, which lets us pick a correct file
  // extension inside the zip.
  const downloadableVersions = active
    ? active.versions.filter((v) => !v.pending && !v.error && v.url)
    : [];
  const canDownloadAll = downloadableVersions.length >= 2;
  const onDownloadAll = async () => {
    if (!active) return;
    if (downloadableVersions.length === 0) {
      addToast({
        kind: "warning",
        title: "Nothing to download",
        body: "All versions are still pending or errored.",
      });
      return;
    }
    const safeName = (s: string) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 64) || "export";
    const assetSlug = safeName(active.title);
    const extFor = (contentType: string | null) => {
      if (!contentType) return "jpg";
      const m = contentType.toLowerCase().match(/image\/(jpeg|jpg|png|webp|gif|avif)/);
      if (!m) return "jpg";
      return m[1] === "jpeg" ? "jpg" : m[1];
    };
    const zip = new JSZip();
    // Disambiguate identical labels (e.g. two "Smart-resize 1:1" runs)
    // by appending a counter to the second and later occurrences.
    const labelCounts = new Map<string, number>();
    let added = 0;
    const failures: string[] = [];
    for (const v of downloadableVersions) {
      try {
        const proxyUrl = `/demos/api/image?url=${encodeURIComponent(v.url)}`;
        const res = await fetch(proxyUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const labelSlug = safeName(v.label);
        const n = (labelCounts.get(labelSlug) ?? 0) + 1;
        labelCounts.set(labelSlug, n);
        const suffix = n > 1 ? `-${n}` : "";
        const filename = `${assetSlug}-${labelSlug}${suffix}.${extFor(blob.type || res.headers.get("content-type"))}`;
        zip.file(filename, blob);
        added++;
      } catch (err) {
        failures.push(`${v.label} (${err instanceof Error ? err.message : "fetch failed"})`);
      }
    }
    if (added === 0) {
      addToast({
        kind: "error",
        title: "Couldn't build the zip",
        body: failures.length > 0 ? failures[0] : "All versions failed to fetch.",
      });
      return;
    }
    const zipBlob = await zip.generateAsync({ type: "blob" });
    const blobUrl = URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `${assetSlug}-versions.zip`;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 0);
    if (failures.length > 0) {
      addToast({
        kind: "warning",
        title: `Bundled ${added} of ${downloadableVersions.length}`,
        body: `Couldn't fetch: ${failures.slice(0, 2).join("; ")}${failures.length > 2 ? "…" : ""}`,
      });
    }
  };

  // ---------- Selected action UI ----------
  const canApply = (() => {
    if (!selectedWf || !active) return false;
    // Block apply when the current version is itself still pending —
    // most commonly a generation variation that hasn't returned yet.
    // The dispatcher would otherwise try to fetch an empty URL and
    // fail mid-flight; better to disable the button so the user
    // waits for a real source image.
    if (currentVersion?.pending) return false;
    if (selectedWf.kind === "soon") return false;
    if (selectedWf.kind === "pin") return !!pin && !!editText.trim();
    if (selectedWf.kind === "prompt") return !!(inputs.prompt || "").trim();
    if (selectedWf.kind === "prompt-zip") return !!(inputs.prompt || "").trim();
    if (selectedWf.kind === "mask-only") return maskCoverage >= 0.08;
    if (selectedWf.kind === "mask-ref") return maskCoverage >= 0.08 && !!reference;
    if (selectedWf.kind === "prompt-ref") return !!reference && !!(inputs.prompt || "").trim();
    // Package: at least one prep step OR at least one enabled variant.
    // A prep-only package (zalando-package) runs prep head-to-tail; a
    // fan-out can run with empty prep if the user just wants variants
    // straight from the source. Additionally, packages with a
    // creative-direction picker require the user to have picked or
    // typed a value (campaign-pack today).
    if (selectedWf.kind === "package") {
      const hasSteps = editedPackagePrep.length > 0 || editedPackageVariants.some((v) => v.enabled);
      if (!hasSteps) return false;
      if (selectedWf.package?.creativeDirection) {
        return editedPackageCreativeValue.trim().length > 0;
      }
      return true;
    }
    // Topaz Upscale: block apply if the chosen factor would push output
    // past the 24 MP provider cap. The select itself surfaces the
    // warning and per-option cap suffix.
    if (selectedWf.id === "topaz-upscale") {
      const w = currentVersion?.width;
      const h = currentVersion?.height;
      const factor = Number.parseFloat(inputs.upscale_factor || "2");
      if (w && h && topazExceedsCap(w, h, factor)) return false;
    }
    return true;
  })();

  const stageHint: React.ReactNode = (() => {
    // Chat-driven hint takes precedence — it carries an explicit ask
    // from the agent ("brush over the logo"). It is rendered as plain
    // React children (NOT raw HTML) so prompt-injected markup can't
    // escape into the host page's DOM.
    if (chatStageHint) return chatStageHint;
    if (isPinning && !pin)
      return (
        <>
          Click anywhere on the image to <b>pin</b> the spot you want to edit.
        </>
      );
    if (isPainting && maskCoverage < 0.08)
      return selectedWf?.kind === "mask-ref" ? (
        <>
          Brush over the area to <b>replace</b>, then drop a reference image on the right.
        </>
      ) : (
        <>
          Brush over the area you want <b>removed</b>.
        </>
      );
    return null;
  })();

  // True while the version currently shown in the canvas is still
  // generating. Drives the small bottom-center "Generating…" pill.
  const currentPending = !!currentVersion?.pending;

  // Confirm-mask handler — only meaningful while chat is awaiting a
  // brush mask. Generates the B&W blob from the hidden canvas, resolves
  // the chat's promise, and clears the takeover state.
  const onConfirmChatMask = async () => {
    if (!chatMaskMode || !maskResolverRef.current) return;
    const blob = await generateMaskBlob();
    const resolver = maskResolverRef.current;
    maskResolverRef.current = null;
    setChatMaskMode(false);
    setChatStageHint(null);
    clearMask();
    resolver(blob);
  };
  const onCancelChatMask = () => {
    if (!chatMaskMode || !maskResolverRef.current) return;
    const resolver = maskResolverRef.current;
    maskResolverRef.current = null;
    setChatMaskMode(false);
    setChatStageHint(null);
    clearMask();
    resolver(null);
  };
  const onCancelChatPin = () => {
    if (!chatPinMode || !pinResolverRef.current) return;
    const resolver = pinResolverRef.current;
    pinResolverRef.current = null;
    setChatPinMode(false);
    setChatStageHint(null);
    resolver(null);
  };

  // Always-fresh refs for the closures inside studioHandle. The
  // handle itself is memoized stably (deps: []) so the chat panel
  // memo doesn't rebuild on every render, but each method reads
  // these refs at call time so chained workflows see the latest
  // version state, the latest selection, and the latest function
  // bodies.
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const executeWorkflowRef = useRef(executeWorkflow);
  executeWorkflowRef.current = executeWorkflow;
  const executePackageRef = useRef(executePackage);
  executePackageRef.current = executePackage;
  const resetSelectionRef = useRef(resetSelection);
  resetSelectionRef.current = resetSelection;

  // The slice of StudioShell the chat panel needs to drive the canvas
  // and run workflows. Reference + text + plan-confirm live inside the
  // chat panel itself (it owns the bubble state).
  const studioHandle = useMemo<PartialStudioHandle>(
    () => ({
      getActiveAssetId: () => activeIdRef.current,
      getCurrentVersionUrl: () => {
        const id = activeIdRef.current;
        const a = id ? assetsRef.current[id] : null;
        if (!a) return null;
        return a.versions.find((v) => v.id === a.currentVersionId)?.url ?? null;
      },
      getCurrentVersionDims: () => {
        const id = activeIdRef.current;
        const a = id ? assetsRef.current[id] : null;
        if (!a) return null;
        const v = a.versions.find((x) => x.id === a.currentVersionId);
        if (!v?.width || !v?.height) return null;
        return { width: v.width, height: v.height };
      },
      requestPin: (hint) =>
        new Promise<Pin | null>((resolve) => {
          // If a card flow is active, abort it so chat owns the canvas.
          if (selectedRef.current) {
            resetSelectionRef.current();
          }
          pinResolverRef.current = resolve;
          setChatPinMode(true);
          setChatStageHint(hint || "Click on the image where you want the change.");
        }),
      requestMask: (hint) =>
        new Promise<Blob | null>((resolve) => {
          if (selectedRef.current) {
            resetSelectionRef.current();
          }
          maskResolverRef.current = resolve;
          setChatMaskMode(true);
          setChatStageHint(hint || "Brush over the area, then click Confirm mask.");
        }),
      runWorkflow: async (workflowId, params, captured, opts) => {
        const wf = configRef.current.workflows.find((w) => w.id === workflowId);
        if (!wf) return { ok: false, error: `Unknown workflow: ${workflowId}` };
        if (wf.kind === "soon") return { ok: false, error: `${wf.name} isn't shipped yet.` };
        const targetAssetId = activeIdRef.current;
        if (!targetAssetId) return { ok: false, error: "No active asset" };
        const asset = assetsRef.current[targetAssetId];
        if (!asset) return { ok: false, error: "Asset not found" };
        // Pull the current version URL from the LATEST asset state.
        // For chained chat workflows (step 2 dispatching after step 1
        // completes), this is the freshly saved output of step 1, not
        // the original — that's the whole point of the ref pattern.
        const sourceUrl = asset.versions.find((v) => v.id === asset.currentVersionId)?.url;
        if (!sourceUrl) return { ok: false, error: "No current version" };
        // Packages: run prep serially (and variants in parallel, if
        // present) and return the final step's result so the chat sees
        // the whole package as one tool call. The chat path always uses
        // the workflow's preset (no user-side reordering happens
        // through chat). Fan-out packages don't have a single final
        // output, so chat-driven fan-out isn't supported yet — until
        // chat learns to pick a variant or summarise N outputs.
        if (wf.kind === "package") {
          // Packages with a creative-direction picker need a prompt
          // value at dispatch time. The chat passes it as `prompt`
          // (or via captured text); we inject it into the matching
          // prep step. If neither is present, return a structured
          // error the agent can recover from by calling request_text.
          const direction = wf.package?.creativeDirection;
          const directionPrompt = direction ? (params.prompt || captured.text || "").trim() : "";
          if (direction && !directionPrompt) {
            return {
              ok: false,
              error: `${wf.name} needs a creative direction. Call request_text({ label: "What creative direction?", placeholder: "e.g. on a windswept rooftop at golden hour" }), then call run_workflow again with the user's answer as the prompt parameter.`,
            };
          }
          const presetPrep = (wf.package?.prep ?? []).map((step) => {
            if (direction && step.workflowId === direction.injectAt.workflowIdMatch) {
              return {
                ...step,
                params: {
                  ...step.params,
                  [direction.injectAt.paramKey]: directionPrompt,
                },
              };
            }
            return { ...step, params: { ...step.params } };
          });
          const presetVariants = (wf.package?.variants ?? []).map((v) => ({
            variant: { ...v, steps: v.steps.map((s) => ({ ...s, params: { ...s.params } })) },
            enabled: v.defaultEnabled !== false,
          }));
          if (presetPrep.length === 0 && presetVariants.length === 0) {
            return { ok: false, error: `${wf.name} has no steps` };
          }
          const result = await executePackageRef.current(
            wf,
            sourceUrl,
            targetAssetId,
            presetPrep,
            presetVariants,
          );
          if (!result.ok) return result;
          if (!result.final) {
            return {
              ok: false,
              error: `${wf.name} is a fan-out package — chat-driven dispatch needs to pick a variant first.`,
            };
          }
          return {
            ok: true,
            versionId: result.final.versionId,
            outputUrl: result.final.outputUrl,
            label: result.final.label,
          };
        }
        const mergedParams = { ...params };
        if (!mergedParams.color && captured.color) mergedParams.color = captured.color;
        if (!mergedParams.aspect_ratio && captured.aspectRatio)
          mergedParams.aspect_ratio = captured.aspectRatio;
        if (!mergedParams.resolution && captured.resolution)
          mergedParams.resolution = captured.resolution;
        return executeWorkflowRef.current(wf, sourceUrl, targetAssetId, {
          prompt: mergedParams.prompt || captured.text || undefined,
          pin: captured.pin ?? undefined,
          maskBlob: captured.mask ?? undefined,
          referenceFile: captured.reference ?? undefined,
          referenceFiles: captured.reference ? [captured.reference] : [],
          values: mergedParams,
          intermediate: !!opts?.intermediate,
        });
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const selectedActionContent = renderSelectedActionContent({
    wf: selectedWf,
    pin,
    editText,
    onEditText: setEditText,
    onClearPin: () => setPin(null),
    inputs,
    onInputChange: (k, v) => setInputs((s) => ({ ...s, [k]: v })),
    referencePreview,
    onReferenceFile,
    extraReferencePreviews,
    onAddReferenceFiles,
    onRemoveExtraReference,
    maxReferences: MAX_REFERENCES,
    referencePrompt,
    onReferencePrompt: setReferencePrompt,
    maskCoverage,
    onClearMask: clearMask,
    sourceWidth: currentVersion?.width,
    sourceHeight: currentVersion?.height,
    editedPackagePrep,
    setEditedPackagePrep,
    editedPackageVariants,
    setEditedPackageVariants,
    editedPackageCreativePickId,
    setEditedPackageCreativePickId,
    editedPackageCreativeValue,
    setEditedPackageCreativeValue,
  });

  const selectedActionFooter = selectedWf ? (
    <>
      <button type="button" className="rfs-btn" onClick={resetSelection}>
        Cancel
      </button>
      <button
        type="button"
        className="rfs-btn rfs-btn-primary"
        onClick={onApply}
        disabled={!canApply}
      >
        Apply
      </button>
    </>
  ) : null;

  return (
    <ShellConfigProvider value={config}>
      <div
        className={`rfs-root${leftCollapsed ? " is-rail-collapsed" : ""}${rightOpenMobile ? " is-right-open" : ""}`}
      >
        <header className="rfs-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              type="button"
              className="rfs-iconbtn"
              onClick={() => setLeftCollapsed((v) => !v)}
              title={leftCollapsed ? "Show assets" : "Hide assets"}
              aria-label={leftCollapsed ? "Show assets" : "Hide assets"}
            >
              {leftCollapsed ? Icon.sidebarShow : Icon.sidebarHide}
            </button>
            <div className="rfs-brand">
              <span className="rfs-brand-mark" aria-hidden />
              <span className="rfs-brand-name">
                {config.copy.brandName === "Runflow" ? (
                  <>
                    Run<span>flow</span>
                  </>
                ) : (
                  config.copy.brandName
                )}
              </span>
              {config.copy.brandTag ? (
                <span className="rfs-brand-tag">{config.copy.brandTag}</span>
              ) : null}
            </div>
            <div className="rfs-project">
              <span style={{ color: "var(--rfs-bg-3)" }}>/</span>
              {editingName && active ? (
                <input
                  className="rfs-project-name-input"
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => {
                    const next = nameDraft.trim();
                    if (active && next && next !== active.title) {
                      setAssets((s) => ({
                        ...s,
                        [active.id]: { ...s[active.id], title: next },
                      }));
                    }
                    setEditingName(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setEditingName(false);
                      setNameDraft(active?.title ?? "");
                    }
                  }}
                  maxLength={80}
                />
              ) : (
                <button
                  type="button"
                  className="rfs-project-name"
                  onClick={() => {
                    if (!active) return;
                    setNameDraft(active.title);
                    setEditingName(true);
                  }}
                  disabled={!active}
                  title="Click to rename"
                >
                  {active?.title ?? "Untitled"}
                </button>
              )}
            </div>
          </div>
          <div className="rfs-header-right">
            <button
              type="button"
              className="rfs-iconbtn"
              onClick={onUndo}
              disabled={!undoTarget}
              title={undoTarget ? `Undo to ${undoTarget.label}` : "Nothing to undo"}
              aria-label="Step to previous version"
            >
              {Icon.undo}
            </button>
            <button
              type="button"
              className="rfs-iconbtn"
              onClick={onRedo}
              disabled={!redoTarget}
              title={redoTarget ? `Redo to ${redoTarget.label}` : "Nothing to redo"}
              aria-label="Step to next version"
            >
              {Icon.redo}
            </button>
            <SettingsMenu />
            <button
              type="button"
              className="rfs-btn"
              onClick={onShare}
              disabled={!active}
              title="Copy link to this view"
            >
              {Icon.share}
              Share
            </button>
            <button
              type="button"
              className="rfs-btn rfs-btn-primary"
              disabled={!currentVersion}
              onClick={onExport}
            >
              {Icon.download}
              Export
            </button>
            {config.copy.avatarInitials ? (
              <span className="rfs-avatar">{config.copy.avatarInitials}</span>
            ) : null}
          </div>
        </header>

        <aside className="rfs-left">
          {generateOpen ? (
            (() => {
              // Derive the "in-flight" summary from the active asset
              // when it's a generation session — we just look at the
              // current asset's pending versions. If the user navigated
              // away (e.g. picked a sample) we treat the panel as idle
              // again. Surface count + prompt so the GeneratePanel's
              // summary can show "Generating 4 variations: <prompt>".
              const generatingActive = !!(
                active?.tags?.includes("generated") && active.versions.some((v) => v.pending)
              );
              const inFlightCount =
                generatingActive && active ? active.versions.filter((v) => v.pending).length : 0;
              const inFlightPrompt =
                generatingActive && active ? (active.versions[0]?.request?.prompt ?? "") : "";
              return (
                <GeneratePanel
                  onClose={() => setGenerateOpen(false)}
                  onGenerate={dispatchGenerationSession}
                  inFlight={generatingActive}
                  inFlightCount={inFlightCount}
                  inFlightPrompt={inFlightPrompt}
                />
              );
            })()
          ) : (
            <>
              <div className="rfs-left-header">
                <span className="rfs-left-title">{config.copy.assetsTitle}</span>
                <span
                  className="rfs-left-title"
                  style={{ letterSpacing: 0, textTransform: "none", fontWeight: 500 }}
                >
                  {order.length}
                </span>
              </div>
              {/* "+ New asset" splits two ways. Upload accepts a local
                file (the existing path); Generate flips the rail into
                the GeneratePanel for text-to-image. The user never
                picks a model — the gateway maps resolution → tier. */}
              <div className="rfs-left-newasset">
                <label className="rfs-left-newasset-btn">
                  {Icon.upload}
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onUploadAsset(f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="rfs-left-newasset-btn rfs-left-newasset-generate"
                  onClick={() => setGenerateOpen(true)}
                  title="Generate new images from a prompt"
                >
                  {Icon.generate}
                  Generate
                </button>
              </div>
              <div className="rfs-asset-list">
                {order.map((id) => {
                  const a = assets[id];
                  if (!a) return null;
                  // Pick the freshest URL we have. For a generation
                  // session where v0 is still pending, the FIRST resolved
                  // version (anywhere in the array) is what we want — so
                  // walk back-to-front and grab the first non-empty url.
                  // Falls back to baseUrl, then empty.
                  const thumbUrl =
                    [...a.versions].reverse().find((v) => v.url)?.url ?? a.baseUrl ?? "";
                  const allPending = a.versions.every((v) => v.pending);
                  return (
                    <button
                      type="button"
                      key={id}
                      className={`rfs-asset${id === activeId ? " is-current" : ""}${allPending ? " is-pending" : ""}`}
                      onClick={() => onSelectAsset(id)}
                      title={a.title}
                    >
                      {thumbUrl ? (
                        <img src={thumbUrl} alt={a.title} />
                      ) : (
                        <span className="rfs-asset-skeleton" aria-hidden />
                      )}
                      {a.versions.length > 1 ? (
                        <span
                          className="rfs-asset-count"
                          aria-label={`${a.versions.length} versions`}
                        >
                          {a.versions.length}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <main className="rfs-center">
          <StudioCanvas
            emptyTitle={config.copy.emptyTitle}
            emptySubtitle={config.copy.emptySubtitle}
            imageUrl={currentVersion?.url ?? null}
            imageTitle={active?.title ?? "Untitled"}
            imageWidth={currentVersion?.width}
            imageHeight={currentVersion?.height}
            requestedResolution={currentVersion?.request?.values?.resolution}
            imgRef={imgRef}
            isPinning={isPinning}
            isPainting={isPainting}
            pin={pin}
            onImageClick={onImageClick}
            brushCanvasRef={visibleMaskRef}
            onMaskDown={onMaskDown}
            onMaskMove={onMaskMove}
            onMaskUp={onMaskUp}
            brushSize={brushSize}
            onBrushSize={setBrushSize}
            maskCoverage={maskCoverage}
            onClearMask={clearMask}
            hint={stageHint}
            pending={currentPending}
            pendingLabel={currentVersion?.label ?? null}
            pendingWorkflowId={currentVersion?.request?.workflowId ?? null}
            pendingKind={currentVersion?.pendingKind}
            pendingPrompt={currentVersion?.request?.prompt ?? null}
            error={
              // Two error sources land in the canvas:
              //   1. A workflow run error (`error` state, set by the
              //      action panel's apply path)
              //   2. A version-level error (e.g. a failed generation
              //      variation — the version has `error` set and an
              //      empty url, so the canvas needs to show "couldn't
              //      generate" instead of falling through to the cold
              //      empty state)
              error ?? currentVersion?.error ?? null
            }
            sentinelBadge={
              currentVersion?.sentinel ? (
                <SentinelBadge
                  result={currentVersion.sentinel}
                  open={sentinelOpen}
                  onToggle={() => setSentinelOpen((v) => !v)}
                  versionId={currentVersion.id}
                  onRetry={
                    currentVersion.request ? () => onRetrySentinel(currentVersion.id) : undefined
                  }
                  retryInFlight={!!sentinelRetrying[currentVersion.id]}
                />
              ) : config.sentinel.enabled &&
                currentVersion?.request &&
                !currentVersion.error &&
                !currentVersion.pending ? (
                // Intermediate step that bypassed Sentinel — surface a
                // muted badge so the user knows quality wasn't checked
                // (rather than the badge silently disappearing).
                <div
                  className="rfs-sentinel-badge is-skipped"
                  title="Sentinel skipped on this intermediate step. Toggle “Run Sentinel between steps” in Settings to gate every step."
                >
                  <span className="rfs-sentinel-dot is-failed" />
                  <span>Sentinel skipped</span>
                </div>
              ) : null
            }
            chatMaskMode={chatMaskMode}
            chatPinMode={chatPinMode}
            onConfirmChatMask={onConfirmChatMask}
            onCancelChatMask={onCancelChatMask}
            onCancelChatPin={onCancelChatPin}
            onOpenCompare={() => setCompareOpen(true)}
            compareEnabled={(active?.versions.length ?? 0) >= 2}
            onDownloadAll={onDownloadAll}
            canDownloadAll={canDownloadAll}
          />
          {active ? (
            <div className="rfs-version-stripe">
              <span className="rfs-version-stripe-label">Versions</span>
              {active.versions.map((v) => {
                const bucket =
                  !v.pending && v.width && v.height
                    ? displayBucket(v.width, v.height, v.request?.values?.resolution)
                    : null;
                const dimSuffix =
                  !v.pending && v.width && v.height ? ` · ${v.width}×${v.height}` : "";
                // Intermediate steps that bypassed Sentinel (gating off,
                // not the final step) end up with no sentinel + no error.
                // Original v0 has no `request` and shouldn't get a chip.
                const isIntermediateSkipped = !v.pending && !v.error && !v.sentinel && !!v.request;
                return (
                  <button
                    type="button"
                    key={v.id}
                    className={`rfs-version-thumb${v.id === active.currentVersionId ? " is-current" : ""}${v.pending ? " is-pending" : ""}${v.error ? " is-error" : ""}${v.sentinel && !v.pending ? ` sentinel-${v.sentinel.state}` : ""}`}
                    onClick={() => onPickVersion(v.id)}
                    title={
                      v.error
                        ? `${v.label} — ${v.error}`
                        : `${compactSummary(v.label, v.request)}${dimSuffix}`
                    }
                  >
                    {v.url ? (
                      <img src={v.url} alt={v.label} />
                    ) : (
                      // Generation pending versions have no URL until the
                      // model returns. Skeleton block instead of a broken
                      // <img> while the spinner overlay (below) carries
                      // the "still working" signal.
                      <span className="rfs-version-thumb-skeleton" aria-hidden />
                    )}
                    <span className="rfs-version-thumb-label">{v.label}</span>
                    {bucket ? (
                      <span
                        className={`rfs-version-thumb-res rfs-version-thumb-res-${bucket.toLowerCase()}`}
                        aria-label={`${v.width}×${v.height} pixels`}
                      >
                        {bucket}
                      </span>
                    ) : null}
                    {v.sentinel || isIntermediateSkipped ? (
                      <span className="rfs-version-thumb-sentinel">
                        <SentinelChip
                          result={v.sentinel}
                          skipped={isIntermediateSkipped}
                          size="xs"
                        />
                      </span>
                    ) : null}
                    {v.pending ? (
                      <span className="rfs-version-thumb-spinner" aria-hidden>
                        <span className="rfs-version-thumb-spinner-ring" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </main>

        <WorkflowsPanel
          selectedWorkflowId={selected}
          onSelectWorkflow={onSelectWorkflow}
          onClearWorkflowSelection={resetSelection}
          photoTags={active?.tags ?? []}
          recommendedWorkflowIds={active?.recommendedWorkflows ?? []}
          versions={active?.versions ?? []}
          currentVersionId={active?.currentVersionId ?? "v0"}
          onPickVersion={onPickVersion}
          selectedActionContent={selectedActionContent}
          selectedActionFooter={selectedActionFooter}
          selectedActionMeta={
            selectedWf
              ? { name: selectedWf.name, desc: selectedWf.desc, iconKey: selectedWf.id }
              : null
          }
          studioHandle={studioHandle}
          activeAssetId={activeId}
          onRunCustom={runCustomWorkflow}
          onSelectAsset={onSelectAsset}
        />

        {/* Mobile-only floating CTA: opens the workflows/chat bottom sheet.
          Sits on the canvas so the user can reach Edits with one thumb.
          Hidden by CSS on desktop and while the sheet itself is open. */}
        <button
          type="button"
          className="rfs-mobile-fab rfs-mobile-fab-tools"
          onClick={() => setRightOpenMobile(true)}
          aria-label="Open edits panel"
        >
          {Icon.workflows}
          <span>{selected ? "Configure" : "Edits"}</span>
        </button>

        {/* Backdrops + close affordances for the mobile overlays. The
          left drawer and bottom sheet share the same dismiss pattern:
          tap outside to close. */}
        {!leftCollapsed ? (
          <button
            type="button"
            className="rfs-mobile-backdrop rfs-mobile-backdrop-left"
            aria-label="Close assets"
            onClick={() => setLeftCollapsed(true)}
          />
        ) : null}
        {rightOpenMobile ? (
          <>
            <button
              type="button"
              className="rfs-mobile-backdrop rfs-mobile-backdrop-right"
              aria-label="Close edits panel"
              onClick={() => setRightOpenMobile(false)}
            />
            <button
              type="button"
              className="rfs-sheet-close"
              aria-label="Close edits panel"
              onClick={() => setRightOpenMobile(false)}
            >
              <svg
                aria-hidden="true"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </>
        ) : null}

        <Toasts toasts={toasts} onDismiss={dismissToast} />

        {compareOpen && active && active.versions.length >= 2 ? (
          <ComparePanel
            versions={active.versions}
            // 2 versions: left = first (original), right = latest.
            // 3+ versions: same defaults; user can switch via per-pane
            // dropdowns inside the modal.
            initialLeftId={active.versions[0].id}
            initialRightId={
              active.currentVersionId !== active.versions[0].id
                ? active.currentVersionId
                : active.versions[active.versions.length - 1].id
            }
            onClose={() => setCompareOpen(false)}
          />
        ) : null}
      </div>
    </ShellConfigProvider>
  );
}

function renderSelectedActionContent({
  wf,
  pin,
  editText,
  onEditText,
  onClearPin,
  inputs,
  onInputChange,
  referencePreview,
  onReferenceFile,
  extraReferencePreviews,
  onAddReferenceFiles,
  onRemoveExtraReference,
  maxReferences,
  referencePrompt,
  onReferencePrompt,
  maskCoverage,
  onClearMask,
  sourceWidth,
  sourceHeight,
  editedPackagePrep,
  setEditedPackagePrep,
  editedPackageVariants,
  setEditedPackageVariants,
  editedPackageCreativePickId,
  setEditedPackageCreativePickId,
  editedPackageCreativeValue,
  setEditedPackageCreativeValue,
}: {
  wf: Workflow | null;
  pin: Pin | null;
  editText: string;
  onEditText: (v: string) => void;
  onClearPin: () => void;
  inputs: Record<string, string>;
  onInputChange: (key: string, value: string) => void;
  referencePreview: string | null;
  onReferenceFile: (file: File | null) => void;
  extraReferencePreviews: string[];
  onAddReferenceFiles: (files: File[]) => void;
  onRemoveExtraReference: (index: number) => void;
  maxReferences: number;
  referencePrompt: string;
  onReferencePrompt: (v: string) => void;
  maskCoverage: number;
  onClearMask: () => void;
  sourceWidth?: number;
  sourceHeight?: number;
  editedPackagePrep: PackageRecipeStep[];
  setEditedPackagePrep: React.Dispatch<React.SetStateAction<PackageRecipeStep[]>>;
  editedPackageVariants: Array<{ variant: PackageVariant; enabled: boolean }>;
  setEditedPackageVariants: React.Dispatch<
    React.SetStateAction<Array<{ variant: PackageVariant; enabled: boolean }>>
  >;
  editedPackageCreativePickId: string | null;
  setEditedPackageCreativePickId: React.Dispatch<React.SetStateAction<string | null>>;
  editedPackageCreativeValue: string;
  setEditedPackageCreativeValue: React.Dispatch<React.SetStateAction<string>>;
}): React.ReactNode {
  if (!wf) return null;
  if (wf.kind === "package" && wf.package) {
    return (
      <PackageEditor
        prepPreset={wf.package.prep}
        prep={editedPackagePrep}
        setPrep={setEditedPackagePrep}
        variantsPreset={wf.package.variants ?? []}
        variants={editedPackageVariants}
        setVariants={setEditedPackageVariants}
        creativeDirection={wf.package.creativeDirection ?? null}
        creativePickId={editedPackageCreativePickId}
        setCreativePickId={setEditedPackageCreativePickId}
        creativeValue={editedPackageCreativeValue}
        setCreativeValue={setEditedPackageCreativeValue}
      />
    );
  }
  if (wf.kind === "pin") {
    return (
      <>
        <Step
          n="1"
          done={!!pin}
          title={pin ? "Spot pinned" : "Click the spot you want to edit"}
          sub={
            pin ? (
              <button type="button" className="rfs-link" onClick={onClearPin}>
                Click again on the image to move the pin
              </button>
            ) : (
              "The pin tells the model where to focus the change."
            )
          }
        />
        <div className="rfs-input-group">
          <label className="rfs-label">Describe the change</label>
          <textarea
            className="rfs-textarea"
            placeholder="e.g. change the print to vertical navy stripes"
            value={editText}
            onChange={(e) => onEditText(e.target.value)}
            maxLength={400}
            disabled={!pin}
          />
        </div>
      </>
    );
  }
  if (wf.kind === "mask-only") {
    return (
      <>
        <Step
          n="1"
          done={maskCoverage >= 0.08}
          active={maskCoverage < 0.08}
          title={
            maskCoverage >= 0.08
              ? `Mask painted — ${maskCoverage.toFixed(1)}% covered`
              : "Brush over the area to remove"
          }
          sub={
            maskCoverage >= 0.08 ? (
              <button type="button" className="rfs-link" onClick={onClearMask}>
                Clear and start over
              </button>
            ) : (
              "Paint over price tags, props, anything you want gone."
            )
          }
        />
      </>
    );
  }
  if (wf.kind === "mask-ref") {
    const hasMask = maskCoverage >= 0.08;
    const hasReference = !!referencePreview;
    return (
      <>
        <Step
          n="1"
          done={hasMask}
          active={!hasMask}
          title={
            hasMask
              ? `Mask painted — ${maskCoverage.toFixed(1)}% covered`
              : "Brush the area to inpaint"
          }
          sub={
            hasMask ? (
              <button type="button" className="rfs-link" onClick={onClearMask}>
                Clear and start over
              </button>
            ) : (
              "Brush over the part of the image you want replaced."
            )
          }
        />
        <Step
          n="2"
          done={hasReference}
          active={hasMask && !hasReference}
          title={`Reference image${maxReferences > 1 ? "s" : ""}`}
          sub={
            maxReferences > 1
              ? `Drop in up to ${maxReferences} references — the model blends them into the masked area.`
              : "The model copies content/style from this image into the masked area."
          }
        />
        <ReferenceGallery
          referencePreview={referencePreview}
          extraReferencePreviews={extraReferencePreviews}
          onReferenceFile={onReferenceFile}
          onAddReferenceFiles={onAddReferenceFiles}
          onRemoveExtraReference={onRemoveExtraReference}
          maxReferences={maxReferences}
        />
        {/* Optional prompt — third step, only "active" once mask + ref
            are both in place. Apply works without it; the prompt just
            steers the model further if you want a specific direction. */}
        <Step
          n="3"
          active={hasMask && hasReference}
          title={
            <>
              Direction{" "}
              <span style={{ color: "var(--rfs-ink-3)", fontWeight: 500 }}>(optional)</span>
            </>
          }
          sub="Tell the model what to emphasize or how to apply the reference."
        />
        <textarea
          className="rfs-textarea"
          placeholder="e.g. apply the print at the same scale, keep the original sweater colour"
          value={referencePrompt}
          onChange={(e) => onReferencePrompt(e.target.value)}
          maxLength={400}
        />
      </>
    );
  }
  if (wf.kind === "prompt-ref") {
    // logo-fix today: upload a logo image + describe placement. No
    // brush; the model places the logo based on the prompt + image
    // content. Three steps so the user has a clear progress sense.
    const hasReference = !!referencePreview;
    const promptValue = inputs.prompt ?? "";
    const promptInput = wf.inputs?.find(
      (inp) => inp.key === "prompt" && (inp.type === "text" || inp.type === "textarea"),
    );
    const resolutionInput = wf.inputs?.find(
      (inp) => inp.key === "resolution" && inp.type === "select",
    );
    return (
      <>
        <Step
          n="1"
          done={hasReference}
          active={!hasReference}
          title="Logo image"
          sub="Upload the logo as a transparent or clean-background image — the model copies it onto the photo."
        />
        {referencePreview ? (
          <div className="rfs-ref-preview">
            <img src={referencePreview} alt="Logo" />
            <button type="button" className="rfs-link" onClick={() => onReferenceFile(null)}>
              Remove
            </button>
          </div>
        ) : (
          <label className="rfs-drop">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onReferenceFile(f);
                e.currentTarget.value = "";
              }}
            />
            <span>Click to upload a logo (PNG, JPG, &lt; 5MB)</span>
          </label>
        )}
        <Step
          n="2"
          done={!!promptValue.trim()}
          active={hasReference && !promptValue.trim()}
          title="Where + how"
          sub="A short instruction telling the model where to put the logo."
        />
        {promptInput && (promptInput.type === "text" || promptInput.type === "textarea") ? (
          <input
            className="rfs-text"
            placeholder={promptInput.placeholder ?? "e.g. Small embroidery logo above the pocket"}
            value={promptValue}
            maxLength={promptInput.maxlength ?? 200}
            onChange={(e) => onInputChange("prompt", e.target.value)}
          />
        ) : null}
        {resolutionInput && resolutionInput.type === "select" ? (
          <div className="rfs-input-group">
            <label className="rfs-label">{resolutionInput.label}</label>
            <select
              className="rfs-select"
              value={
                inputs.resolution ?? resolutionInput.default ?? resolutionInput.options[0].value
              }
              onChange={(e) => onInputChange("resolution", e.target.value)}
            >
              {resolutionInput.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {resolutionInput.help ? <div className="rfs-help">{resolutionInput.help}</div> : null}
          </div>
        ) : null}
      </>
    );
  }
  // simple / prompt — render generic inputs from wf.inputs
  if (!wf.inputs?.length) {
    return (
      <div className="rfs-help">
        No parameters needed. Click <b>Apply</b> to run.
      </div>
    );
  }
  return (
    <>
      {wf.inputs.map((inp) => {
        if (inp.type === "color") {
          const value = inputs[inp.key] ?? inp.default ?? "#FFFFFF";
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <div className="rfs-color-row">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => onInputChange(inp.key, e.target.value)}
                />
                <span className="rfs-color-hex">{value.toUpperCase()}</span>
              </div>
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "text") {
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <input
                className="rfs-text"
                placeholder={inp.placeholder}
                maxLength={inp.maxlength}
                value={inputs[inp.key] ?? ""}
                onChange={(e) => onInputChange(inp.key, e.target.value)}
              />
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "textarea") {
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">{inp.label}</label>
              <textarea
                className="rfs-textarea"
                placeholder={inp.placeholder}
                maxLength={inp.maxlength}
                value={inputs[inp.key] ?? ""}
                onChange={(e) => onInputChange(inp.key, e.target.value)}
              />
              {inp.help ? <div className="rfs-help">{inp.help}</div> : null}
            </div>
          );
        }
        if (inp.type === "select") {
          // Detect resolution-bucket selects (1K/2K/4K). When the source's
          // own resolution is known, annotate the label with the source's
          // bucket and warn if the chosen option would force an upscale —
          // models can't truly invent detail beyond what's in the source.
          const isResolutionSelect = inp.options.every((o) => ["1K", "2K", "4K"].includes(o.value));
          const sourceBucket: ResBucket | null =
            isResolutionSelect && sourceWidth && sourceHeight
              ? resBucket(sourceWidth, sourceHeight)
              : null;
          const currentValue = inputs[inp.key] ?? inp.default ?? inp.options[0].value;
          const showUpscaleWarn =
            sourceBucket && isUpscale(sourceBucket, currentValue as ResBucket);
          // Topaz upscale_factor — annotate options/warning with the
          // 24 MP output cap. Source × factor² has to stay under 24 MP
          // or the API rejects.
          const isTopazFactor = wf.id === "topaz-upscale" && inp.key === "upscale_factor";
          const topazExceeds =
            isTopazFactor && sourceWidth && sourceHeight
              ? topazExceedsCap(sourceWidth, sourceHeight, Number.parseFloat(currentValue))
              : false;
          const topazProjectedMP =
            isTopazFactor && sourceWidth && sourceHeight
              ? topazOutputMP(sourceWidth, sourceHeight, Number.parseFloat(currentValue))
              : 0;
          return (
            <div key={inp.key} className="rfs-input-group">
              <label className="rfs-label">
                {inp.label}
                {sourceBucket ? (
                  <span className="rfs-label-meta">
                    source is {sourceBucket}
                    {sourceWidth && sourceHeight ? ` · ${sourceWidth}×${sourceHeight}` : ""}
                  </span>
                ) : null}
                {isTopazFactor && sourceWidth && sourceHeight ? (
                  <span className="rfs-label-meta">
                    source · {((sourceWidth * sourceHeight) / 1_000_000).toFixed(1)} MP
                  </span>
                ) : null}
              </label>
              <select
                className="rfs-select"
                value={currentValue}
                onChange={(e) => onInputChange(inp.key, e.target.value)}
              >
                {inp.options.map((o) => {
                  const isUp = sourceBucket && isUpscale(sourceBucket, o.value as ResBucket);
                  const exceedsTopaz =
                    isTopazFactor && sourceWidth && sourceHeight
                      ? topazExceedsCap(sourceWidth, sourceHeight, Number.parseFloat(o.value))
                      : false;
                  return (
                    <option key={o.value} value={o.value}>
                      {o.label}
                      {isUp ? " — upscale" : ""}
                      {exceedsTopaz ? " — over 24 MP cap" : ""}
                    </option>
                  );
                })}
              </select>
              {showUpscaleWarn ? (
                <div className="rfs-help rfs-help-warn">
                  Heads up — your source is {sourceBucket}. Generating at {currentValue} means
                  upscaling; the model can't add detail that isn't there.
                </div>
              ) : topazExceeds ? (
                <div className="rfs-help rfs-help-warn">
                  At {currentValue}× this source would output {topazProjectedMP.toFixed(1)} MP —
                  over the {TOPAZ_MAX_OUTPUT_MP} MP output cap. Pick a smaller factor to apply.
                </div>
              ) : inp.help ? (
                <div className="rfs-help">{inp.help}</div>
              ) : null}
            </div>
          );
        }
        return null;
      })}
      {wf.id === "outpaint" && sourceWidth && sourceHeight ? (
        <OutpaintTargetPreview
          sourceWidth={sourceWidth}
          sourceHeight={sourceHeight}
          aspectRatio={inputs.aspect_ratio ?? "9:16"}
        />
      ) : null}
    </>
  );
}

// One-line summary of a package recipe step for the action panel:
// shows the target workflow's display name plus any baked-in params
// the user might want to confirm at a glance ("Apply Zalando grey ·
// background-color · #F1F1F1"). Falls back to just the workflow id if
// the workflow isn't found in the catalog (shouldn't happen in
// practice, but cheap to guard).
function packageStepSummary(step: PackageRecipeStep, workflows: ReadonlyArray<Workflow>): string {
  const wf = workflows.find((w) => w.id === step.workflowId);
  const name = wf?.name ?? step.workflowId;
  const paramBits: string[] = [];
  if (step.params.color) paramBits.push(step.params.color);
  if (step.params.aspect_ratio) paramBits.push(step.params.aspect_ratio);
  if (step.params.resolution) paramBits.push(step.params.resolution);
  if (step.params.upscale_factor) paramBits.push(`${step.params.upscale_factor}×`);
  if (step.params.prompt)
    paramBits.push(
      `"${step.params.prompt.slice(0, 30)}${step.params.prompt.length > 30 ? "…" : ""}"`,
    );
  return paramBits.length > 0 ? `${name} · ${paramBits.join(" · ")}` : name;
}

// Outpaint runtime expansion percentages (mirror of staticBody in
// _data/workflows.ts). Multiplied against the source dim so the user
// can see the canvas they'll get back before hitting Apply.
const OUTPAINT_EXPAND: Record<
  string,
  { top: number; bottom: number; left: number; right: number }
> = {
  "4:5": { top: 13, bottom: 12, left: 0, right: 0 },
  "9:16": { top: 39, bottom: 39, left: 0, right: 0 },
  "16:9": { top: 0, bottom: 0, left: 39, right: 39 },
  "21:9": { top: 0, bottom: 0, left: 67, right: 66 },
};

function OutpaintTargetPreview({
  sourceWidth,
  sourceHeight,
  aspectRatio,
}: {
  sourceWidth: number;
  sourceHeight: number;
  aspectRatio: string;
}) {
  const e = OUTPAINT_EXPAND[aspectRatio] ?? OUTPAINT_EXPAND["9:16"];
  const targetW = Math.round(sourceWidth * (1 + (e.left + e.right) / 100));
  const targetH = Math.round(sourceHeight * (1 + (e.top + e.bottom) / 100));
  return (
    <div className="rfs-help">
      Target canvas:{" "}
      <strong style={{ color: "var(--rfs-ink-1)" }}>
        {targetW}×{targetH}
      </strong>{" "}
      <span style={{ color: "var(--rfs-ink-3)" }}>
        ({resBucket(targetW, targetH)} · from {sourceWidth}×{sourceHeight})
      </span>
    </div>
  );
}

function Step({
  n,
  done,
  active,
  title,
  sub,
}: {
  n: string;
  done?: boolean;
  active?: boolean;
  title: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div className="rfs-step">
      <div className={`rfs-step-num${done ? " is-done" : active ? " is-active" : ""}`}>
        {done ? "" : n}
      </div>
      <div className="rfs-step-text">
        <div className="rfs-step-title">{title}</div>
        {sub ? <div className="rfs-step-sub">{sub}</div> : null}
      </div>
    </div>
  );
}

// Per-run editor for a marketplace package. Renders two sections:
//
//  - "Clean up the shot" — the ordered prep chain. Drag-handle reorder
//    + delete + add. Same row UX as the recipe editor.
//  - "Where it ships" — the fan-out variants. Checkbox grid; only
//    shown when the workflow declares variants (omnichannel-pack today,
//    not Zalando). Channel names lead, ratio chips trail. Read-only
//    composition — the user picks which channels to ship, not how
//    each variant's mini-chain is built.
//
// Edits live in the caller's state and never mutate the workflow
// definition. "Reset" rolls both sections back to the preset.
function PackageEditor({
  prepPreset,
  prep,
  setPrep,
  variantsPreset,
  variants,
  setVariants,
  creativeDirection,
  creativePickId,
  setCreativePickId,
  creativeValue,
  setCreativeValue,
}: {
  prepPreset: PackageRecipeStep[];
  prep: PackageRecipeStep[];
  setPrep: React.Dispatch<React.SetStateAction<PackageRecipeStep[]>>;
  variantsPreset: PackageVariant[];
  variants: Array<{ variant: PackageVariant; enabled: boolean }>;
  setVariants: React.Dispatch<
    React.SetStateAction<Array<{ variant: PackageVariant; enabled: boolean }>>
  >;
  /** When set, renders a chip + textarea picker above the prep section
   * and gates Apply on the user picking or typing a value. */
  creativeDirection: PackageCreativeDirection | null;
  creativePickId: string | null;
  setCreativePickId: React.Dispatch<React.SetStateAction<string | null>>;
  creativeValue: string;
  setCreativeValue: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { workflows } = useShellConfig();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasVariants = variantsPreset.length > 0;
  const enabledVariantCount = variants.filter((v) => v.enabled).length;
  const prepHeader = hasVariants ? "Clean up the shot" : "Steps";

  // Creative-direction picker handlers. Clicking a chip both records
  // the pick id (so the chip stays visually selected) and writes its
  // baked prompt into the textarea. Typing into the textarea flips
  // the pick id to "custom" so the chip selection clears.
  const onPickChip = (pick: { id: string; prompt: string }) => {
    setCreativePickId(pick.id);
    setCreativeValue(pick.prompt);
  };
  const onCustomChange = (v: string) => {
    setCreativeValue(v);
    setCreativePickId(v.trim().length > 0 ? "custom" : null);
  };

  const presetIds = prepPreset.map((s) => s.workflowId).join("|");
  const editedIds = prep.map((s) => s.workflowId).join("|");
  const prepModified =
    presetIds !== editedIds ||
    prepPreset.length !== prep.length ||
    prepPreset.some((p, i) => {
      const s = prep[i];
      if (!s) return true;
      const pk = Object.keys(p.params).sort().join(",");
      const sk = Object.keys(s.params).sort().join(",");
      if (pk !== sk) return true;
      return Object.keys(p.params).some((k) => p.params[k] !== s.params[k]);
    });

  const variantsModified = variants.some(
    (v, i) => v.enabled !== (variantsPreset[i]?.defaultEnabled !== false),
  );

  const isModified = prepModified || variantsModified;

  const moveStep = (i: number, dir: -1 | 1) => {
    setPrep((prev) => {
      const target = i + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[target]] = [next[target], next[i]];
      return next;
    });
    if (expanded === i) setExpanded(i + dir);
    else if (expanded === i + dir) setExpanded(i);
  };

  const deleteStep = (i: number) => {
    setPrep((prev) => prev.filter((_, idx) => idx !== i));
    if (expanded === i) setExpanded(null);
    else if (expanded !== null && expanded > i) setExpanded(expanded - 1);
  };

  const updateStepParam = (i: number, key: string, value: string) => {
    setPrep((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, params: { ...s.params, [key]: value } } : s)),
    );
  };

  const addStep = (wf: Workflow) => {
    const params = defaultStepValues(wf);
    const next: PackageRecipeStep = {
      workflowId: wf.id,
      params,
      // Use the workflow's display name as the step's user-facing
      // label. The preset steps in workflows.ts use snappier labels
      // ("Apply Zalando grey") but those are hand-curated copy; for
      // ad-hoc additions the workflow name is the honest default.
      label: wf.name,
    };
    setPrep((prev) => [...prev, next]);
    setExpanded(prep.length);
    setPickerOpen(false);
  };

  const toggleVariant = (variantId: string) => {
    setVariants((prev) =>
      prev.map((v) => (v.variant.id === variantId ? { ...v, enabled: !v.enabled } : v)),
    );
  };

  const onReset = () => {
    setPrep(prepPreset.map((s) => ({ ...s, params: { ...s.params } })));
    setVariants(
      variantsPreset.map((v) => ({
        variant: { ...v, steps: v.steps.map((s) => ({ ...s, params: { ...s.params } })) },
        enabled: v.defaultEnabled !== false,
      })),
    );
    setExpanded(null);
    setPickerOpen(false);
  };

  return (
    <>
      {/* Creative direction picker — only rendered when the package
          declares one (campaign-pack today). Sits above prep + variants
          so it's the first thing the user touches: pick a vibe, then
          everything else cascades. Chip + textarea share state via the
          handlers above so clicking a chip writes its prompt and
          typing custom text deselects the chip. */}
      {creativeDirection ? (
        <div className="rfs-package-creative" style={{ marginBottom: "0.875rem" }}>
          <div className="rfs-package-section-header">
            <span className="rfs-package-section-title">{creativeDirection.label}</span>
            {creativeValue.trim().length > 0 ? (
              <span className="rfs-package-section-meta">
                {creativePickId === "custom" ? "Custom" : "Picked"}
              </span>
            ) : (
              <span className="rfs-package-section-meta">Required</span>
            )}
          </div>
          {creativeDirection.description ? (
            <div className="rfs-help" style={{ marginBottom: "0.5rem" }}>
              {creativeDirection.description}
            </div>
          ) : null}
          <div className="rfs-package-creative-chips">
            {creativeDirection.quickPicks.map((pick) => (
              <button
                key={pick.id}
                type="button"
                className={`rfs-package-creative-chip${creativePickId === pick.id ? " is-on" : ""}`}
                onClick={() => onPickChip(pick)}
                aria-pressed={creativePickId === pick.id}
              >
                {pick.label}
              </button>
            ))}
          </div>
          <textarea
            className="rfs-package-creative-textarea"
            value={creativeValue}
            onChange={(e) => onCustomChange(e.target.value)}
            placeholder={creativeDirection.placeholder ?? "Describe the scene"}
            rows={3}
            maxLength={400}
          />
        </div>
      ) : null}

      <div className="rfs-help" style={{ marginBottom: "0.75rem" }}>
        {hasVariants ? (
          <>
            {creativeDirection
              ? "The product gets cleaned, dropped into your scene, then sized for each channel."
              : "Prep runs once, then each enabled channel runs its own smart-resize in parallel."}
            {isModified ? (
              <>
                {" "}
                You've edited this run —{" "}
                <button type="button" className="rfs-link" onClick={onReset}>
                  reset
                </button>{" "}
                to defaults.
              </>
            ) : null}
          </>
        ) : prep.length === 0 ? (
          <>
            No steps remaining.{" "}
            <button type="button" className="rfs-link" onClick={onReset}>
              Reset
            </button>{" "}
            to bring back the default chain.
          </>
        ) : (
          <>
            {prep.length} step{prep.length === 1 ? "" : "s"} will run head-to-tail on this image.
            Reorder, edit, or remove anything you don't need.
            {isModified ? (
              <>
                {" "}
                You've edited the chain —{" "}
                <button type="button" className="rfs-link" onClick={onReset}>
                  reset
                </button>{" "}
                to defaults.
              </>
            ) : null}
          </>
        )}
      </div>

      {/* Prep section header — only shown when there's a variants
          section below it (so the user knows what each chunk is). For
          single-output packages, the prep IS the chain, no header
          needed. */}
      {hasVariants ? (
        <div className="rfs-package-section-header">
          <span className="rfs-package-section-title">{prepHeader}</span>
          <span className="rfs-package-section-meta">
            {prep.length} step{prep.length === 1 ? "" : "s"}
          </span>
        </div>
      ) : null}

      <div className="rfs-package-list">
        {prep.map((step, i) => {
          const wf = workflows.find((w) => w.id === step.workflowId);
          const isExpanded = expanded === i;
          return (
            <div key={`${step.workflowId}-${i}`} className="rfs-custom-editor-row">
              <div className="rfs-package-row">
                <span className="rfs-package-row-num">{i + 1}</span>
                <button
                  type="button"
                  className="rfs-custom-editor-row-text"
                  onClick={() => setExpanded(isExpanded ? null : i)}
                  aria-expanded={isExpanded}
                >
                  <div className="rfs-package-row-name">{step.label}</div>
                  <div className="rfs-package-row-file">{packageStepSummary(step, workflows)}</div>
                </button>
                <div className="rfs-package-row-actions">
                  <button
                    type="button"
                    className="rfs-package-row-btn"
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                    aria-label={`Move ${step.label} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rfs-package-row-btn"
                    onClick={() => moveStep(i, 1)}
                    disabled={i === prep.length - 1}
                    title="Move down"
                    aria-label={`Move ${step.label} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="rfs-package-row-btn rfs-package-row-btn-danger"
                    onClick={() => deleteStep(i)}
                    title="Remove this step"
                    aria-label={`Remove ${step.label}`}
                  >
                    ×
                  </button>
                </div>
              </div>
              {isExpanded && wf ? (
                <div className="rfs-custom-editor-step-params">
                  <StepParamsForm
                    wf={wf}
                    values={step.params}
                    onValueChange={(k, v) => updateStepParam(i, k, v)}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: "0.625rem" }}>
        <StepPicker
          open={pickerOpen}
          onOpen={() => setPickerOpen(true)}
          onCancel={() => setPickerOpen(false)}
          onPick={addStep}
        />
      </div>

      {/* Variants section — only when the workflow declares any.
          Read-only composition (the user toggles channels on/off, but
          doesn't edit each variant's internal mini-chain). */}
      {hasVariants ? (
        <>
          <div className="rfs-package-section-header" style={{ marginTop: "1rem" }}>
            <span className="rfs-package-section-title">Where it ships</span>
            <span className="rfs-package-section-meta">
              {enabledVariantCount} of {variants.length} selected
            </span>
          </div>
          <div className="rfs-package-variant-list">
            {variants.map(({ variant, enabled }) => (
              <label
                key={variant.id}
                className={`rfs-package-variant-row${enabled ? " is-on" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={() => toggleVariant(variant.id)}
                  aria-label={`Ship to ${variant.label}`}
                />
                <span className="rfs-package-variant-name">{variant.label}</span>
                <span className="rfs-package-variant-ratio">{variant.ratio}</span>
              </label>
            ))}
          </div>
          <div className="rfs-help" style={{ marginTop: "0.625rem" }}>
            Each variant runs smart-resize to its channel ratio, scored by Sentinel. Prep stays
            unscored.
          </div>
        </>
      ) : (
        <div className="rfs-help" style={{ marginTop: "0.75rem" }}>
          The final step's output is what Sentinel grades. Intermediate steps are skipped (or gated,
          if you've turned that on in settings).
        </div>
      )}
    </>
  );
}
