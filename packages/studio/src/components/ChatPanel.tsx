"use client";

// ChatPanel — the agent-driven editing interface.
//
// Owns:
//   - per-asset transcript state (loaded from localStorage on mount)
//   - captured inputs (pin/mask/reference/text) threaded across the
//     agent's tool-use loop until a run_workflow consumes them
//   - bubble-side resolvers for inputs the agent asks for inline
//     (reference upload, text, plan confirmation). Pin + mask are
//     handled via the canvas-driven studioHandle.
//
// The agent loop:
//   1. user types → append user message
//   2. POST /demos/api/chat → SSE stream assistant message
//   3. extract tool_use blocks → dispatch each via runTool, accumulating
//      tool_result blocks
//   4. append the tool_result block as a single user message; loop
//   5. when assistant returns no tool_use → stop

import { useEffect, useMemo, useRef, useState } from "react";
import {
  emptyCaptured,
  extractToolUses,
  getSessionId,
  runTool,
  streamChatTurn,
  type CapturedInputs,
  type ChatMessage,
  type ChoiceOption,
  type ContentBlock,
  type StudioHandle,
  type ToolResultBlock,
  type ToolUseBlock,
} from "../lib/chat";
import type { PartialStudioHandle } from "../lib/studio-handle";
import { WORKFLOWS } from "../data/workflows";
import { isUpscale, resBucket, type ResBucket } from "../lib/resolution";
import { Icon } from "./icons";

function workflowDisplayName(workflowId: string): string {
  return WORKFLOWS.find((w) => w.id === workflowId)?.name ?? workflowId;
}

type PlanStep = { workflow_id: string; description: string };

type PlanState =
  | null
  | {
      steps: PlanStep[];
      rationale: string;
      resolved: boolean;
      confirmed: boolean;
    };

type RefRequestState =
  | null
  | {
      hint: string;
      resolved: boolean;
      file: File | null;
    };

type TextRequestState =
  | null
  | {
      label: string;
      placeholder?: string;
      optional: boolean;
      resolved: boolean;
      value: string | null;
    };

type ColorRequestState =
  | null
  | {
      hint: string;
      defaultHex: string;
      resolved: boolean;
      value: string | null;
    };

type AspectRequestState =
  | null
  | {
      hint: string;
      options: string[];
      allowCustom: boolean;
      defaultValue?: string;
      resolved: boolean;
      value: string | null;
    };

type ResolutionRequestState =
  | null
  | {
      hint: string;
      defaultValue?: string;
      sourceDims: { width: number; height: number } | null;
      resolved: boolean;
      value: string | null;
    };

type ChoiceRequestState =
  | null
  | {
      hint: string;
      options: ChoiceOption[];
      defaultValue?: string;
      resolved: boolean;
      value: string | null;
    };

// Inline retry-or-skip state shown when run_workflow returns an error
// inside an agent plan. Survives across attempts so the user can keep
// hitting Retry until the upstream comes back, or hit Skip to let the
// model adapt around the failure. `attempt` increments on every retry
// so the bubble can show "Attempt 3 of 4 failed" instead of swallowing
// repeated failures.
type RetryState =
  | null
  | {
      workflowId: string;
      error: string;
      attempt: number;
      resolved: boolean;
    };

type RetryDecision = "retry" | "skip";

// Common ecommerce backdrops. Click → instant submit. Reorder by what
// fashion brands actually shoot on most often.
const COLOR_PRESETS: { hex: string; label: string }[] = [
  { hex: "#FFFFFF", label: "Pure white" },
  { hex: "#F5F5F0", label: "Soft white" },
  { hex: "#E5E5E5", label: "Light grey" },
  { hex: "#2A2A2A", label: "Charcoal" },
  { hex: "#000000", label: "Pure black" },
  { hex: "#E8DCC4", label: "Beige" },
  { hex: "#1A2B4A", label: "Navy" },
  { hex: "#C5654E", label: "Terracotta" },
];

function isValidHex(s: string): boolean {
  return /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(s.trim());
}
function normaliseHex(s: string): string {
  let v = s.trim();
  if (!v.startsWith("#")) v = "#" + v;
  if (v.length === 4) {
    // #RGB → #RRGGBB
    v = `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  }
  return v.toUpperCase();
}

const STORAGE_PREFIX = "rfs-chat:";

function loadMessages(assetId: string | null): ChatMessage[] {
  if (!assetId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + assetId);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return healStuckTranscript(parsed as ChatMessage[]);
  } catch {
    /* ignore */
  }
  return [];
}

// Heal the most common stuck-state shape: the user closed the bubble
// or refreshed while the agent was waiting for a tool_result, leaving
// a trailing assistant message whose tool_use blocks were never
// answered. Anthropic's API rejects the next turn with
// "tool_use without tool_result" so the conversation is dead until
// reset.
//
// Recovery: if the last assistant message has unresolved tool_use
// blocks, drop it AND its preceding user message (which triggered
// the unresolved chain) so the transcript is back at a known-good
// alternation point. Logs a console.warn so the team sees this is
// happening if it recurs.
function healStuckTranscript(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length === 0) return messages;
  const last = messages[messages.length - 1];
  if (last.role !== "assistant" || !Array.isArray(last.content)) return messages;
  const hasOrphanToolUse = last.content.some((b) => b.type === "tool_use");
  if (!hasOrphanToolUse) return messages;
  console.warn(
    "[chat] dropping trailing assistant message with unresolved tool_use blocks",
    last,
  );
  // Walk back past the orphan AND the user message that triggered it.
  let i = messages.length - 2;
  while (i >= 0 && messages[i].role !== "user") i -= 1;
  return messages.slice(0, Math.max(0, i));
}

function saveMessages(assetId: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    // Don't persist tool_result content with non-serializable refs;
    // ChatMessage shapes are already JSON-safe by design.
    window.localStorage.setItem(STORAGE_PREFIX + assetId, JSON.stringify(messages));
  } catch {
    /* quota/private mode — best effort */
  }
}

export function ChatPanel({
  studioHandle,
  activeAssetId,
}: {
  studioHandle: PartialStudioHandle;
  activeAssetId: string | null;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessages(activeAssetId));
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bubble-side resolvers — chat owns these because they live in the
  // transcript, not on the canvas.
  const [planState, setPlanState] = useState<PlanState>(null);
  const planResolverRef = useRef<((ok: boolean) => void) | null>(null);
  const [refState, setRefState] = useState<RefRequestState>(null);
  const refResolverRef = useRef<((f: File | null) => void) | null>(null);
  const [textState, setTextState] = useState<TextRequestState>(null);
  const textResolverRef = useRef<((s: string | null) => void) | null>(null);
  const [colorState, setColorState] = useState<ColorRequestState>(null);
  const colorResolverRef = useRef<((hex: string | null) => void) | null>(null);
  const [aspectState, setAspectState] = useState<AspectRequestState>(null);
  const aspectResolverRef = useRef<((s: string | null) => void) | null>(null);
  const [resolutionState, setResolutionState] = useState<ResolutionRequestState>(null);
  const resolutionResolverRef = useRef<((s: string | null) => void) | null>(null);
  const [choiceState, setChoiceState] = useState<ChoiceRequestState>(null);
  const choiceResolverRef = useRef<((s: string | null) => void) | null>(null);
  const [retryState, setRetryState] = useState<RetryState>(null);
  const retryResolverRef = useRef<((d: RetryDecision) => void) | null>(null);

  // Captured inputs survive across tool calls within a turn loop. They
  // RESET each new user message, so a fresh task starts clean. They
  // also reset whenever a run_workflow consumes them (handled in
  // chat.ts runTool).
  const capturedRef = useRef<CapturedInputs>({ ...emptyCaptured });

  // Reload transcript when active asset changes.
  useEffect(() => {
    setMessages(loadMessages(activeAssetId));
    // Cancel any inline state when the asset switches.
    setPlanState(null);
    setRefState(null);
    setTextState(null);
    setColorState(null);
    setAspectState(null);
    setResolutionState(null);
    setChoiceState(null);
    setRetryState(null);
    capturedRef.current = { ...emptyCaptured };
  }, [activeAssetId]);

  // Persist whenever messages change.
  useEffect(() => {
    if (activeAssetId) saveMessages(activeAssetId, messages);
  }, [activeAssetId, messages]);

  // Auto-scroll to bottom on new messages.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, planState, refState, textState, colorState, aspectState, resolutionState, choiceState, retryState]);

  const sessionId = useMemo(() => getSessionId(), []);

  // Compose the full StudioHandle by adding chat-managed resolvers on
  // top of the partial handle StudioShell exposed.
  const fullHandle = useMemo<StudioHandle>(
    () => ({
      ...studioHandle,
      requestReference: (hint) =>
        new Promise<File | null>((resolve) => {
          refResolverRef.current = resolve;
          setRefState({ hint, resolved: false, file: null });
        }),
      requestText: (label, placeholder, optional) =>
        new Promise<string | null>((resolve) => {
          textResolverRef.current = resolve;
          setTextState({ label, placeholder, optional: !!optional, resolved: false, value: null });
        }),
      requestColor: (hint, defaultHex) =>
        new Promise<string | null>((resolve) => {
          colorResolverRef.current = resolve;
          setColorState({
            hint,
            defaultHex: defaultHex && isValidHex(defaultHex) ? normaliseHex(defaultHex) : "#FFFFFF",
            resolved: false,
            value: null,
          });
        }),
      requestAspect: (hint, options, allowCustom, defaultValue) =>
        new Promise<string | null>((resolve) => {
          aspectResolverRef.current = resolve;
          setAspectState({
            hint,
            options,
            allowCustom,
            defaultValue,
            resolved: false,
            value: null,
          });
        }),
      requestResolution: (hint, defaultValue) =>
        new Promise<string | null>((resolve) => {
          resolutionResolverRef.current = resolve;
          setResolutionState({
            hint,
            defaultValue,
            sourceDims: studioHandle.getCurrentVersionDims(),
            resolved: false,
            value: null,
          });
        }),
      requestChoice: (hint, options, defaultValue) =>
        new Promise<string | null>((resolve) => {
          choiceResolverRef.current = resolve;
          setChoiceState({
            hint,
            options,
            defaultValue,
            resolved: false,
            value: null,
          });
        }),
      confirmPlan: (steps, rationale) =>
        new Promise<boolean>((resolve) => {
          planResolverRef.current = resolve;
          setPlanState({ steps, rationale, resolved: false, confirmed: false });
        }),
    }),
    [studioHandle],
  );

  const addAssetContextMessage = (msgs: ChatMessage[]): ChatMessage[] => {
    // First user turn gets the active image attached so the model can
    // reason visually. We use a URL-source content block (no base64 round
    // trip) — Anthropic's vision accepts both.
    if (msgs.length === 0) return msgs;
    const first = msgs[0];
    if (first.role !== "user") return msgs;
    if (typeof first.content !== "string") return msgs;
    const url = studioHandle.getCurrentVersionUrl();
    if (!url) return msgs;
    const augmented: ChatMessage = {
      role: "user",
      content: [
        { type: "image", source: { type: "url", url } },
        { type: "text", text: first.content },
      ],
    };
    return [augmented, ...msgs.slice(1)];
  };

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setError(null);
    setInput("");
    capturedRef.current = { ...emptyCaptured };

    const userMsg: ChatMessage = { role: "user", content: text };
    let convo: ChatMessage[] = [...messages, userMsg];
    setMessages(convo);

    setIsStreaming(true);
    try {
      // Loop: stream assistant → handle tool_uses → repeat until no tool_use.
      // Hard loop cap (matches server-side per-session cap).
      for (let safety = 0; safety < 12; safety++) {
        const apiMessages = addAssetContextMessage(convo);
        const result = await streamChatTurn(apiMessages, sessionId, {
          onTextDelta: () => {
            /* could surface streaming text in a draft bubble; for MVP
               we re-render after the message completes. */
          },
        });
        if (!result.ok) {
          setError(result.error);
          break;
        }
        convo = [...convo, result.message];
        setMessages(convo);

        const toolUses = extractToolUses(result.message);
        if (toolUses.length === 0) break;

        // Run each tool sequentially, accumulating results.
        const toolResults: ToolResultBlock[] = [];
        for (const tu of toolUses) {
          try {
            let dispatch = await runTool(tu, fullHandle, capturedRef.current);
            capturedRef.current = dispatch.captured;
            // run_workflow inside a plan can fail mid-stream (Vertex
            // hiccup, payload too big, Sentinel red gate, etc.). Pause
            // the loop and offer Retry / Skip — Retry re-fires the same
            // tool_use against the same captured inputs, Skip lets the
            // model adapt around the failure with the existing error
            // tool_result. Loops until the user picks Skip or the run
            // finally succeeds.
            let attempt = 1;
            while (
              dispatch.uiEffect?.kind === "workflow_failed" &&
              tu.name === "run_workflow"
            ) {
              const failed = dispatch.uiEffect;
              const decision = await new Promise<RetryDecision>((resolve) => {
                retryResolverRef.current = resolve;
                setRetryState({
                  workflowId: failed.workflowId,
                  error: failed.error,
                  attempt,
                  resolved: false,
                });
              });
              if (decision === "skip") break;
              attempt += 1;
              dispatch = await runTool(tu, fullHandle, capturedRef.current);
              capturedRef.current = dispatch.captured;
            }
            toolResults.push(dispatch.toolResult);
          } catch (err) {
            const msg = err instanceof Error ? err.message : "Tool dispatch failed";
            toolResults.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: msg,
              is_error: true,
            });
          }
        }
        const toolResultMsg: ChatMessage = {
          role: "user",
          content: toolResults as ContentBlock[],
        };
        convo = [...convo, toolResultMsg];
        setMessages(convo);
      }
    } finally {
      setIsStreaming(false);
    }
  };

  // ---------- Bubble interactions ----------
  const confirmPlan = () => {
    if (!planState || planState.resolved || !planResolverRef.current) return;
    setPlanState({ ...planState, resolved: true, confirmed: true });
    planResolverRef.current(true);
    planResolverRef.current = null;
  };
  const rejectPlan = () => {
    if (!planState || planState.resolved || !planResolverRef.current) return;
    setPlanState({ ...planState, resolved: true, confirmed: false });
    planResolverRef.current(false);
    planResolverRef.current = null;
  };
  const submitReference = (file: File) => {
    if (!refState || refState.resolved || !refResolverRef.current) return;
    setRefState({ ...refState, resolved: true, file });
    refResolverRef.current(file);
    refResolverRef.current = null;
  };
  const cancelReference = () => {
    if (!refState || refState.resolved || !refResolverRef.current) return;
    setRefState({ ...refState, resolved: true, file: null });
    refResolverRef.current(null);
    refResolverRef.current = null;
  };
  const submitText = (value: string) => {
    if (!textState || textState.resolved || !textResolverRef.current) return;
    setTextState({ ...textState, resolved: true, value });
    textResolverRef.current(value);
    textResolverRef.current = null;
  };
  const cancelText = () => {
    if (!textState || textState.resolved || !textResolverRef.current) return;
    setTextState({ ...textState, resolved: true, value: null });
    textResolverRef.current(null);
    textResolverRef.current = null;
  };
  const submitColor = (hex: string) => {
    if (!colorState || colorState.resolved || !colorResolverRef.current) return;
    const normalised = normaliseHex(hex);
    setColorState({ ...colorState, resolved: true, value: normalised });
    colorResolverRef.current(normalised);
    colorResolverRef.current = null;
  };
  const cancelColor = () => {
    if (!colorState || colorState.resolved || !colorResolverRef.current) return;
    setColorState({ ...colorState, resolved: true, value: null });
    colorResolverRef.current(null);
    colorResolverRef.current = null;
  };
  const submitAspect = (value: string) => {
    if (!aspectState || aspectState.resolved || !aspectResolverRef.current) return;
    setAspectState({ ...aspectState, resolved: true, value });
    aspectResolverRef.current(value);
    aspectResolverRef.current = null;
  };
  const cancelAspect = () => {
    if (!aspectState || aspectState.resolved || !aspectResolverRef.current) return;
    setAspectState({ ...aspectState, resolved: true, value: null });
    aspectResolverRef.current(null);
    aspectResolverRef.current = null;
  };
  const submitResolution = (value: string) => {
    if (!resolutionState || resolutionState.resolved || !resolutionResolverRef.current) return;
    setResolutionState({ ...resolutionState, resolved: true, value });
    resolutionResolverRef.current(value);
    resolutionResolverRef.current = null;
  };
  const cancelResolution = () => {
    if (!resolutionState || resolutionState.resolved || !resolutionResolverRef.current) return;
    setResolutionState({ ...resolutionState, resolved: true, value: null });
    resolutionResolverRef.current(null);
    resolutionResolverRef.current = null;
  };
  const submitChoice = (value: string) => {
    if (!choiceState || choiceState.resolved || !choiceResolverRef.current) return;
    setChoiceState({ ...choiceState, resolved: true, value });
    choiceResolverRef.current(value);
    choiceResolverRef.current = null;
  };
  const cancelChoice = () => {
    if (!choiceState || choiceState.resolved || !choiceResolverRef.current) return;
    setChoiceState({ ...choiceState, resolved: true, value: null });
    choiceResolverRef.current(null);
    choiceResolverRef.current = null;
  };
  const decideRetry = (decision: RetryDecision) => {
    if (!retryState || retryState.resolved || !retryResolverRef.current) return;
    setRetryState({ ...retryState, resolved: true });
    retryResolverRef.current(decision);
    retryResolverRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const clearChat = () => {
    if (isStreaming) return;
    setMessages([]);
    setPlanState(null);
    setRefState(null);
    setTextState(null);
    setColorState(null);
    setAspectState(null);
    setResolutionState(null);
    setChoiceState(null);
    setRetryState(null);
    capturedRef.current = { ...emptyCaptured };
    if (activeAssetId) saveMessages(activeAssetId, []);
  };

  const hasTranscript =
    messages.length > 0 ||
    !!planState ||
    !!refState ||
    !!textState ||
    !!colorState ||
    !!aspectState ||
    !!resolutionState ||
    !!choiceState ||
    !!retryState;

  return (
    <div className="rfs-chat">
      <header className="rfs-chat-header">
        <span className="rfs-chat-header-title">
          {hasTranscript ? "Conversation" : "New chat"}
        </span>
        <button
          className="rfs-chat-reset"
          onClick={clearChat}
          disabled={isStreaming || !hasTranscript}
          title={
            isStreaming
              ? "Wait for the current turn to finish, or refresh the page"
              : "Reset the conversation and start fresh"
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3.5-7.1" />
            <path d="M3 4v6h6" />
          </svg>
          <span>Reset</span>
        </button>
      </header>
      <div className="rfs-chat-transcript" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="rfs-empty" style={{ flex: "0 0 auto", padding: "1.5rem 1rem" }}>
            <div className="rfs-empty-icon">{Icon.chat}</div>
            <h3>Chat with the studio</h3>
            <p>
              Describe what you want done — &ldquo;remove the price tag&rdquo;, &ldquo;put this on a Mediterranean rooftop&rdquo;, &ldquo;swap the print on the sleeve&rdquo;. The agent picks the workflow, asks for what it needs, and runs it.
            </p>
          </div>
        ) : (
          messages.map((m, i) => <MessageBubble key={i} message={m} />)
        )}
        {planState && !planState.resolved ? (
          <PlanBubble
            steps={planState.steps}
            rationale={planState.rationale}
            onConfirm={confirmPlan}
            onReject={rejectPlan}
          />
        ) : null}
        {refState && !refState.resolved ? (
          <ReferenceBubble hint={refState.hint} onSubmit={submitReference} onCancel={cancelReference} />
        ) : null}
        {textState && !textState.resolved ? (
          <TextBubble
            label={textState.label}
            placeholder={textState.placeholder}
            optional={textState.optional}
            onSubmit={submitText}
            onCancel={cancelText}
          />
        ) : null}
        {colorState && !colorState.resolved ? (
          <ColorBubble
            hint={colorState.hint}
            defaultHex={colorState.defaultHex}
            onSubmit={submitColor}
            onCancel={cancelColor}
          />
        ) : null}
        {aspectState && !aspectState.resolved ? (
          <AspectBubble
            hint={aspectState.hint}
            options={aspectState.options}
            allowCustom={aspectState.allowCustom}
            defaultValue={aspectState.defaultValue}
            onSubmit={submitAspect}
            onCancel={cancelAspect}
          />
        ) : null}
        {resolutionState && !resolutionState.resolved ? (
          <ResolutionBubble
            hint={resolutionState.hint}
            defaultValue={resolutionState.defaultValue}
            sourceDims={resolutionState.sourceDims}
            onSubmit={submitResolution}
            onCancel={cancelResolution}
          />
        ) : null}
        {choiceState && !choiceState.resolved ? (
          <ChoiceBubble
            hint={choiceState.hint}
            options={choiceState.options}
            defaultValue={choiceState.defaultValue}
            onSubmit={submitChoice}
            onCancel={cancelChoice}
          />
        ) : null}
        {retryState && !retryState.resolved ? (
          <RetryBubble
            workflowName={workflowDisplayName(retryState.workflowId)}
            error={retryState.error}
            attempt={retryState.attempt}
            onRetry={() => decideRetry("retry")}
            onSkip={() => decideRetry("skip")}
          />
        ) : null}
        {isStreaming &&
        !planState &&
        !refState &&
        !textState &&
        !colorState &&
        !aspectState &&
        !resolutionState &&
        !choiceState &&
        !retryState ? (
          <div className="rfs-chat-thinking">
            <span className="rfs-chat-thinking-dot" />
            <span className="rfs-chat-thinking-dot" />
            <span className="rfs-chat-thinking-dot" />
          </div>
        ) : null}
        {error ? <div className="rfs-chat-error">{error}</div> : null}
      </div>

      <footer className="rfs-chat-footer">
        <textarea
          className="rfs-chat-input"
          placeholder={
            !activeAssetId
              ? "Pick a photo from the asset rail first…"
              : "Ask the studio anything (Enter to send)…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={!activeAssetId || isStreaming}
          rows={2}
        />
        <div className="rfs-chat-footer-actions">
          <button
            className="rfs-btn rfs-btn-primary rfs-chat-send"
            onClick={send}
            disabled={!input.trim() || isStreaming || !activeAssetId}
          >
            {isStreaming ? "Working…" : "Send"}
          </button>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// Message bubbles
// ============================================================

function MessageBubble({ message }: { message: ChatMessage }) {
  // User message — text only (we don't render the image attachment back
  // to the user; the canvas is right there).
  if (message.role === "user") {
    if (typeof message.content === "string") {
      return (
        <div className="rfs-chat-msg rfs-chat-msg-user">
          <div className="rfs-chat-bubble">{message.content}</div>
        </div>
      );
    }
    // Tool result message — show a compact summary
    const results = message.content.filter((b): b is ToolResultBlock => b.type === "tool_result");
    if (results.length === 0) return null;
    return (
      <div className="rfs-chat-msg rfs-chat-msg-system">
        {results.map((r, i) => (
          <div key={i} className={`rfs-chat-tool-result${r.is_error ? " is-error" : ""}`}>
            {typeof r.content === "string" ? r.content : "Tool result"}
          </div>
        ))}
      </div>
    );
  }

  // Assistant message — render text blocks; tool_use blocks render as
  // inline plan/run breadcrumbs (the actual bubbles are rendered as
  // sibling state, so here we just acknowledge the block existed).
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      {message.content.map((block, i) => {
        if (block.type === "text" && block.text.trim()) {
          return (
            <div key={i} className="rfs-chat-bubble">
              {block.text}
            </div>
          );
        }
        if (block.type === "tool_use") {
          return (
            <div key={i} className="rfs-chat-tool-call" title={JSON.stringify(block.input)}>
              <span className="rfs-chat-tool-icon">⚙</span>
              {labelForTool(block)}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

function labelForTool(block: ToolUseBlock): string {
  switch (block.name) {
    case "propose_plan":
      return "Proposing plan…";
    case "request_pin":
      return "Asking you to pin a spot";
    case "request_mask":
      return "Asking you to brush a region";
    case "request_reference":
      return "Asking for a reference image";
    case "request_text":
      return "Asking for text";
    case "request_color":
      return "Asking you to pick a color";
    case "request_aspect":
      return "Asking you to pick an aspect ratio";
    case "request_resolution":
      return "Asking you to pick a resolution";
    case "request_choice":
      return "Asking you to pick an option";
    case "run_workflow":
      return `Running ${workflowDisplayName(String(block.input.workflow_id ?? "workflow"))}…`;
    case "finish":
      return "Done";
    default:
      return block.name;
  }
}

function PlanBubble({
  steps,
  rationale,
  onConfirm,
  onReject,
}: {
  steps: PlanStep[];
  rationale: string;
  onConfirm: () => void;
  onReject: () => void;
}) {
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-plan">
        <div className="rfs-chat-plan-header">
          <span className="rfs-chat-plan-eyebrow">Plan</span>
          <span className="rfs-chat-plan-rationale">{rationale}</span>
        </div>
        <ol className="rfs-chat-plan-steps">
          {steps.map((s, i) => (
            <li key={i}>
              <span className="rfs-chat-plan-num">{i + 1}</span>
              <div className="rfs-chat-plan-step-text">
                <div className="rfs-chat-plan-step-desc">{s.description}</div>
                <div className="rfs-chat-plan-step-id">{workflowDisplayName(s.workflow_id)}</div>
              </div>
            </li>
          ))}
        </ol>
        <div className="rfs-chat-plan-actions">
          <button className="rfs-btn" onClick={onReject}>Push back</button>
          <button className="rfs-btn rfs-btn-primary" onClick={onConfirm}>Run plan</button>
        </div>
      </div>
    </div>
  );
}

function ReferenceBubble({
  hint,
  onSubmit,
  onCancel,
}: {
  hint: string;
  onSubmit: (file: File) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">{hint}</div>
      <label className="rfs-drop" style={{ marginTop: 6 }}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onSubmit(f);
            e.currentTarget.value = "";
          }}
        />
        <span>Click to upload a reference image</span>
      </label>
      <button className="rfs-link" onClick={onCancel} style={{ marginTop: 4, fontSize: 12 }}>
        Skip
      </button>
    </div>
  );
}

function ColorBubble({
  hint,
  defaultHex,
  onSubmit,
  onCancel,
}: {
  hint: string;
  defaultHex: string;
  onSubmit: (hex: string) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState(defaultHex);
  const [hexInput, setHexInput] = useState(defaultHex);
  const onHex = (s: string) => {
    setHexInput(s);
    if (isValidHex(s)) setPicked(normaliseHex(s));
  };
  const submit = () => {
    if (isValidHex(hexInput)) onSubmit(normaliseHex(hexInput));
    else onSubmit(picked);
  };
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">{hint}</div>
      <div className="rfs-chat-color">
        <div className="rfs-chat-color-presets">
          {COLOR_PRESETS.map((p) => (
            <button
              key={p.hex}
              className={`rfs-chat-color-swatch${picked === p.hex ? " is-picked" : ""}`}
              style={{ background: p.hex }}
              onClick={() => onSubmit(p.hex)}
              title={`${p.label} (${p.hex})`}
              aria-label={p.label}
            />
          ))}
        </div>
        <div className="rfs-chat-color-row">
          <input
            type="color"
            value={picked}
            onChange={(e) => {
              const v = normaliseHex(e.target.value);
              setPicked(v);
              setHexInput(v);
            }}
            className="rfs-chat-color-native"
            aria-label="Custom color"
          />
          <input
            type="text"
            className="rfs-chat-color-hex"
            value={hexInput}
            onChange={(e) => onHex(e.target.value)}
            placeholder="#FFFFFF"
            spellCheck={false}
          />
          <button
            className="rfs-btn rfs-btn-primary"
            onClick={submit}
            disabled={!isValidHex(hexInput)}
          >
            Use color
          </button>
        </div>
        <button className="rfs-link" onClick={onCancel} style={{ fontSize: 12, alignSelf: "flex-start" }}>
          Skip
        </button>
      </div>
    </div>
  );
}

function TextBubble({
  label,
  placeholder,
  optional,
  onSubmit,
  onCancel,
}: {
  label: string;
  placeholder?: string;
  optional: boolean;
  onSubmit: (s: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">
        {label}{optional ? " (optional)" : ""}
      </div>
      <textarea
        className="rfs-textarea"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        autoFocus
        style={{ marginTop: 6 }}
      />
      <div style={{ display: "flex", gap: 6, marginTop: 6, justifyContent: "flex-end" }}>
        {optional ? (
          <button className="rfs-btn" onClick={() => onSubmit("")}>Skip</button>
        ) : (
          <button className="rfs-btn" onClick={onCancel}>Cancel</button>
        )}
        <button
          className="rfs-btn rfs-btn-primary"
          onClick={() => onSubmit(value)}
          disabled={!optional && !value.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
}

// AspectBubble — wrapping pill row. Each pill carries a tiny shape
// icon sized to the actual ratio (so 4:5 is taller than 16:9 at a
// glance) plus the W:H label. Pills wrap onto multiple rows when
// the chat panel is narrow, so this scales as we add ratios. Custom
// W:H input is opt-in (smart-resize only) and gets its own row below.
function AspectBubble({
  hint,
  options,
  allowCustom,
  defaultValue,
  onSubmit,
  onCancel,
}: {
  hint: string;
  options: string[];
  allowCustom: boolean;
  defaultValue?: string;
  onSubmit: (s: string) => void;
  onCancel: () => void;
}) {
  const [picked, setPicked] = useState<string>(defaultValue ?? options[0] ?? "1:1");
  const [customW, setCustomW] = useState("");
  const [customH, setCustomH] = useState("");
  const submitCustom = () => {
    const w = parseInt(customW, 10);
    const h = parseInt(customH, 10);
    if (!w || !h || w < 1 || h < 1) return;
    onSubmit(`${w}:${h}`);
  };
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">{hint}</div>
      <div className="rfs-chat-aspect">
        <div className="rfs-chat-aspect-grid">
          {options.map((opt) => {
            const [wStr, hStr] = opt.split(":");
            const w = parseInt(wStr, 10) || 1;
            const h = parseInt(hStr, 10) || 1;
            const max = 14;
            const tileW = w >= h ? max : Math.round((w / h) * max);
            const tileH = h >= w ? max : Math.round((h / w) * max);
            return (
              <button
                key={opt}
                className={`rfs-chat-aspect-tile${picked === opt ? " is-picked" : ""}`}
                onClick={() => {
                  setPicked(opt);
                  onSubmit(opt);
                }}
                title={opt}
              >
                <span className="rfs-chat-aspect-shape-wrap" aria-hidden>
                  <span
                    className="rfs-chat-aspect-shape"
                    style={{ width: tileW, height: tileH }}
                  />
                </span>
                <span className="rfs-chat-aspect-label">{opt}</span>
              </button>
            );
          })}
        </div>
        {allowCustom ? (
          <div className="rfs-chat-aspect-custom">
            <span className="rfs-chat-aspect-custom-label">Custom</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={customW}
              onChange={(e) => setCustomW(e.target.value)}
              placeholder="W"
              className="rfs-chat-aspect-num"
              aria-label="Custom width"
            />
            <span className="rfs-chat-aspect-custom-sep">:</span>
            <input
              type="number"
              min={1}
              max={9999}
              value={customH}
              onChange={(e) => setCustomH(e.target.value)}
              placeholder="H"
              className="rfs-chat-aspect-num"
              aria-label="Custom height"
            />
            <button
              className="rfs-btn rfs-btn-primary"
              onClick={submitCustom}
              disabled={!parseInt(customW, 10) || !parseInt(customH, 10)}
            >
              Use
            </button>
          </div>
        ) : null}
        <button
          className="rfs-link"
          onClick={onCancel}
          style={{ fontSize: 12, alignSelf: "flex-start" }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}

// ResolutionBubble — segmented control for 1K / 2K / 4K. Annotates the
// source's bucket so the user can tell whether their pick will upscale.
// Tile colours match the canvas resolution pill so the eye picks up the
// 1K (slate) / 2K (sky) / 4K (amber) signal without re-learning it.
function ResolutionBubble({
  hint,
  defaultValue,
  sourceDims,
  onSubmit,
  onCancel,
}: {
  hint: string;
  defaultValue?: string;
  sourceDims: { width: number; height: number } | null;
  onSubmit: (s: string) => void;
  onCancel: () => void;
}) {
  const sourceBucket: ResBucket | null = sourceDims
    ? resBucket(sourceDims.width, sourceDims.height)
    : null;
  const initial: ResBucket =
    (defaultValue as ResBucket) ?? sourceBucket ?? "2K";
  const [picked, setPicked] = useState<ResBucket>(initial);
  const upscaling = sourceBucket && isUpscale(sourceBucket, picked);
  const buckets: ResBucket[] = ["1K", "2K", "4K"];
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">{hint}</div>
      <div className="rfs-chat-resolution">
        <div className="rfs-chat-resolution-segmented" role="radiogroup">
          {buckets.map((b) => (
            <button
              key={b}
              role="radio"
              aria-checked={picked === b}
              className={`rfs-chat-resolution-btn rfs-chat-resolution-btn-${b.toLowerCase()}${picked === b ? " is-picked" : ""}`}
              onClick={() => setPicked(b)}
            >
              {b}
            </button>
          ))}
        </div>
        {sourceBucket ? (
          <div className="rfs-chat-resolution-meta">
            Source is <strong>{sourceBucket}</strong>
            {sourceDims ? ` · ${sourceDims.width}×${sourceDims.height}` : ""}
          </div>
        ) : null}
        {upscaling ? (
          <div className="rfs-help rfs-help-warn">
            Heads up — picking {picked} from a {sourceBucket} source means
            upscaling; the model can't add detail that isn't there.
          </div>
        ) : null}
        <div className="rfs-chat-resolution-actions">
          <button className="rfs-link" onClick={onCancel} style={{ fontSize: 12 }}>
            Skip
          </button>
          <button className="rfs-btn rfs-btn-primary" onClick={() => onSubmit(picked)}>
            Use {picked}
          </button>
        </div>
      </div>
    </div>
  );
}

// RetryBubble — inline error card for run_workflow failures inside an
// agent plan. Pauses the loop until the user decides: Retry (re-fire
// the same tool_use) or Skip (let the model adapt around the failure
// with the existing error tool_result). Attempt count survives across
// retries so repeated failures show "Attempt 3 failed" instead of
// silently looping.
function RetryBubble({
  workflowName,
  error,
  attempt,
  onRetry,
  onSkip,
}: {
  workflowName: string;
  error: string;
  attempt: number;
  onRetry: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-retry">
        <div className="rfs-chat-retry-header">
          <span className="rfs-chat-retry-eyebrow">
            Step failed{attempt > 1 ? ` · attempt ${attempt}` : ""}
          </span>
          <span className="rfs-chat-retry-workflow">{workflowName}</span>
        </div>
        <div className="rfs-chat-retry-error">{error}</div>
        <div className="rfs-chat-retry-actions">
          <button className="rfs-btn" onClick={onSkip}>
            Skip step and continue
          </button>
          <button className="rfs-btn rfs-btn-primary" onClick={onRetry}>
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}

// ChoiceBubble — generic enum picker. Single-click submit; falls back
// when we don't have a dedicated tool for a particular workflow param.
function ChoiceBubble({
  hint,
  options,
  defaultValue,
  onSubmit,
  onCancel,
}: {
  hint: string;
  options: ChoiceOption[];
  defaultValue?: string;
  onSubmit: (s: string) => void;
  onCancel: () => void;
}) {
  return (
    <div className="rfs-chat-msg rfs-chat-msg-assistant">
      <div className="rfs-chat-bubble">{hint}</div>
      <div className="rfs-chat-choice">
        {options.map((o) => (
          <button
            key={o.value}
            className={`rfs-chat-choice-btn${defaultValue === o.value ? " is-default" : ""}`}
            onClick={() => onSubmit(o.value)}
          >
            {o.label}
          </button>
        ))}
        <button
          className="rfs-link"
          onClick={onCancel}
          style={{ fontSize: 12, alignSelf: "flex-start" }}
        >
          Skip
        </button>
      </div>
    </div>
  );
}
