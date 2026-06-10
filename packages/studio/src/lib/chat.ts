// Client-side chat infrastructure for the Runflow Studio agent.
//
// Handles four jobs:
//   1. Types — Anthropic message + content-block shapes shared with
//      the API endpoint.
//   2. Streaming — parseSse() reads Anthropic's content-block-delta
//      stream, yielding events as they arrive. streamChatTurn()
//      accumulates blocks + emits callbacks for the UI.
//   3. Tool dispatch — runTool() takes a tool_use block from the model
//      and a StudioHandle, runs the right capture/execute path, and
//      returns a tool_result block ready to send back next turn.
//   4. State — CapturedInputs tracks pin/mask/reference across the
//      multi-turn agent loop so run_workflow can read the most recent
//      capture without the model passing pixels.
//
// The agent loop itself (post user msg → stream assistant → run tools →
// post tool_results → stream again) lives in ChatPanel.

// ============================================================
// Anthropic message types
// ============================================================

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
};
export type ToolResultBlock = {
  type: "tool_result";
  tool_use_id: string;
  content: string;
  is_error?: boolean;
};
export type ImageBlock = {
  type: "image";
  source: { type: "url"; url: string } | { type: "base64"; media_type: string; data: string };
};

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock | ImageBlock;

export type ChatMessage =
  | { role: "user"; content: string | ContentBlock[] }
  | { role: "assistant"; content: ContentBlock[] };

// ============================================================
// Studio handle — what the chat asks the canvas + dispatcher to do
// ============================================================

export type Pin = { x: number; y: number };

export type ChoiceOption = { value: string; label: string };

export type StudioHandle = {
  getActiveAssetId: () => string | null;
  getCurrentVersionUrl: () => string | null;
  requestPin: (hint: string) => Promise<Pin | null>;
  requestMask: (hint: string) => Promise<Blob | null>;
  requestReference: (hint: string) => Promise<File | null>;
  requestText: (label: string, placeholder?: string, optional?: boolean) => Promise<string | null>;
  requestColor: (hint: string, defaultHex?: string) => Promise<string | null>;
  requestAspect: (
    hint: string,
    options: string[],
    allowCustom: boolean,
    defaultValue?: string,
  ) => Promise<string | null>;
  requestResolution: (hint: string, defaultValue?: string) => Promise<string | null>;
  requestChoice: (
    hint: string,
    options: ChoiceOption[],
    defaultValue?: string,
  ) => Promise<string | null>;
  confirmPlan: (
    steps: { workflow_id: string; description: string }[],
    rationale: string,
  ) => Promise<boolean>;
  runWorkflow: (
    workflowId: string,
    params: Record<string, string>,
    captured: CapturedInputs,
    opts?: { intermediate?: boolean },
  ) => Promise<
    { ok: true; versionId: string; outputUrl: string; label: string } | { ok: false; error: string }
  >;
};

// ============================================================
// Captured inputs — chat-loop state shared across tool dispatches
// ============================================================

export type CapturedInputs = {
  pin: Pin | null;
  mask: Blob | null;
  reference: File | null;
  // Free-form text captured via request_text. The model may ask for
  // multiple texts in a multi-step plan; we keep only the most recent.
  // Most workflows that take text take it inline via run_workflow's
  // `prompt` arg, so this is rarely the canonical channel.
  text: string | null;
  // Hex string captured via request_color. Lets run_workflow fall back
  // to the user's pick if the model forgot to echo it into params.color.
  color: string | null;
  // Aspect ratio + resolution captured via request_aspect /
  // request_resolution — same fallback pattern as color.
  aspectRatio: string | null;
  resolution: string | null;
};

export const emptyCaptured: CapturedInputs = {
  pin: null,
  mask: null,
  reference: null,
  text: null,
  color: null,
  aspectRatio: null,
  resolution: null,
};

// ============================================================
// SSE parser — yields one Anthropic event at a time
// ============================================================

type SseEvent = { event: string; data: Record<string, unknown> };

async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE events are separated by blank lines
      for (let split = buffer.indexOf("\n\n"); split >= 0; split = buffer.indexOf("\n\n")) {
        const raw = buffer.slice(0, split);
        buffer = buffer.slice(split + 2);
        const lines = raw.split("\n");
        let event = "message";
        let dataStr = "";
        for (const line of lines) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) {
            // Multiple data: lines concatenate
            dataStr += (dataStr ? "\n" : "") + line.slice(5).trim();
          }
        }
        if (!dataStr || dataStr === "[DONE]") continue;
        try {
          yield { event, data: JSON.parse(dataStr) };
        } catch {
          /* malformed event; skip */
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================
import { URLS } from "./urls";

// streamChatTurn — POST to /demos/api/chat, parse the SSE stream,
// emit updates for the UI, return the completed assistant message.
// ============================================================

export type ChatStreamCallbacks = {
  /** Called every time the assistant streams a chunk of text. */
  onTextDelta?: (text: string) => void;
  /** Called once a tool_use block has fully arrived (input parsed). */
  onToolUse?: (block: ToolUseBlock) => void;
  /** Called once on stream open with the message id, if surfaced. */
  onMessageStart?: (id: string) => void;
};

export type ChatStreamResult =
  | { ok: true; message: { role: "assistant"; content: ContentBlock[] }; stopReason?: string }
  | { ok: false; error: string };

export async function streamChatTurn(
  messages: ChatMessage[],
  sessionId: string,
  callbacks: ChatStreamCallbacks,
  signal?: AbortSignal,
): Promise<ChatStreamResult> {
  let resp: Response;
  try {
    resp = await fetch(URLS.chat, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, session_id: sessionId }),
      signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Network error" };
  }

  if (!resp.ok) {
    let msg = `Chat request failed (${resp.status})`;
    try {
      const err = await resp.json();
      if (err.error) msg = err.error;
    } catch {
      /* ignore */
    }
    return { ok: false, error: msg };
  }
  if (!resp.body) return { ok: false, error: "No response body" };

  // Accumulators keyed by content-block index
  const blocks: ContentBlock[] = [];
  const toolInputBuffers = new Map<number, string>();
  let stopReason: string | undefined;

  try {
    for await (const ev of parseSse(resp.body)) {
      if (ev.event === "message_start") {
        const id = (ev.data as { message?: { id?: string } }).message?.id;
        if (id) callbacks.onMessageStart?.(id);
      } else if (ev.event === "content_block_start") {
        const idx = (ev.data as { index: number }).index;
        const block = (ev.data as { content_block: ContentBlock }).content_block;
        blocks[idx] = { ...block } as ContentBlock;
        if (block.type === "tool_use") {
          toolInputBuffers.set(idx, "");
        }
      } else if (ev.event === "content_block_delta") {
        const idx = (ev.data as { index: number }).index;
        const delta = (ev.data as { delta: { type: string; text?: string; partial_json?: string } })
          .delta;
        if (delta.type === "text_delta" && typeof delta.text === "string") {
          const block = blocks[idx];
          if (block && block.type === "text") {
            block.text += delta.text;
            callbacks.onTextDelta?.(delta.text);
          }
        } else if (delta.type === "input_json_delta" && typeof delta.partial_json === "string") {
          const prev = toolInputBuffers.get(idx) ?? "";
          toolInputBuffers.set(idx, prev + delta.partial_json);
        }
      } else if (ev.event === "content_block_stop") {
        const idx = (ev.data as { index: number }).index;
        const block = blocks[idx];
        if (block && block.type === "tool_use") {
          const buf = toolInputBuffers.get(idx) ?? "{}";
          try {
            block.input = JSON.parse(buf);
          } catch {
            block.input = {};
          }
          callbacks.onToolUse?.(block);
        }
      } else if (ev.event === "message_delta") {
        const reason = (ev.data as { delta?: { stop_reason?: string } }).delta?.stop_reason;
        if (reason) stopReason = reason;
      } else if (ev.event === "message_stop") {
        // done
      } else if (ev.event === "error") {
        const errMsg =
          (ev.data as { error?: { message?: string } }).error?.message ?? "stream error";
        return { ok: false, error: errMsg };
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { ok: false, error: "Cancelled" };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Stream error" };
  }

  // Filter out any sparse holes (shouldn't happen but be safe)
  const dense = blocks.filter((b): b is ContentBlock => !!b);
  return { ok: true, message: { role: "assistant", content: dense }, stopReason };
}

// ============================================================
// Tool dispatch — translates a tool_use block into a tool_result
// by calling the StudioHandle and updating CapturedInputs.
// ============================================================

export type DispatchResult = {
  toolResult: ToolResultBlock;
  /** Updated captured inputs to thread into the next dispatch call. */
  captured: CapturedInputs;
  /** UI-side notes the chat panel needs to react to (e.g. plan to render). */
  uiEffect?:
    | {
        kind: "plan_proposed";
        steps: { workflow_id: string; description: string }[];
        rationale: string;
        confirmed: boolean;
      }
    | {
        kind: "workflow_complete";
        workflowId: string;
        versionId: string;
        outputUrl: string;
        label: string;
      }
    | { kind: "workflow_failed"; workflowId: string; error: string }
    | { kind: "input_captured"; field: keyof CapturedInputs };
};

function ok(toolUseId: string, content: string): ToolResultBlock {
  return { type: "tool_result", tool_use_id: toolUseId, content };
}
function err(toolUseId: string, content: string): ToolResultBlock {
  return { type: "tool_result", tool_use_id: toolUseId, content, is_error: true };
}

export async function runTool(
  block: ToolUseBlock,
  handle: StudioHandle,
  captured: CapturedInputs,
): Promise<DispatchResult> {
  const id = block.id;
  const next: CapturedInputs = { ...captured };

  switch (block.name) {
    case "propose_plan": {
      const steps = (block.input.steps ?? []) as {
        workflow_id: string;
        description: string;
      }[];
      const rationale = String(block.input.rationale ?? "");
      const confirmed = await handle.confirmPlan(steps, rationale);
      return {
        toolResult: ok(
          id,
          confirmed
            ? "User confirmed the plan. Proceed with step 1."
            : "User rejected the plan. Propose a different plan or ask a clarifying question.",
        ),
        captured: next,
        uiEffect: { kind: "plan_proposed", steps, rationale, confirmed },
      };
    }
    case "request_pin": {
      const hint = String(block.input.hint ?? "Click on the image");
      const pin = await handle.requestPin(hint);
      if (!pin) return { toolResult: err(id, "User cancelled the pin request."), captured };
      next.pin = pin;
      return {
        toolResult: ok(id, `Pin captured at (${pin.x.toFixed(3)}, ${pin.y.toFixed(3)}).`),
        captured: next,
        uiEffect: { kind: "input_captured", field: "pin" },
      };
    }
    case "request_mask": {
      const hint = String(block.input.hint ?? "Brush over the area");
      const mask = await handle.requestMask(hint);
      if (!mask) return { toolResult: err(id, "User cancelled the mask request."), captured };
      next.mask = mask;
      return {
        toolResult: ok(id, "Mask captured."),
        captured: next,
        uiEffect: { kind: "input_captured", field: "mask" },
      };
    }
    case "request_reference": {
      const hint = String(block.input.hint ?? "Upload a reference image");
      const file = await handle.requestReference(hint);
      if (!file) return { toolResult: err(id, "User cancelled the reference upload."), captured };
      next.reference = file;
      return {
        toolResult: ok(id, `Reference image captured (${file.name}).`),
        captured: next,
        uiEffect: { kind: "input_captured", field: "reference" },
      };
    }
    case "request_color": {
      const hint = String(block.input.hint ?? "Pick a color");
      const def = typeof block.input.default === "string" ? block.input.default : undefined;
      const hex = await handle.requestColor(hint, def);
      if (hex === null)
        return { toolResult: err(id, "User cancelled the color picker."), captured };
      next.color = hex;
      return {
        toolResult: ok(
          id,
          `Color captured: ${hex}. Pass this exact hex into run_workflow's color parameter.`,
        ),
        captured: next,
        uiEffect: { kind: "input_captured", field: "color" },
      };
    }
    case "request_aspect": {
      const hint = String(block.input.hint ?? "Pick an aspect ratio");
      const rawOptions = block.input.options;
      const options = Array.isArray(rawOptions)
        ? rawOptions.filter((o): o is string => typeof o === "string" && o.length > 0)
        : [];
      if (options.length === 0) {
        return { toolResult: err(id, "request_aspect needs at least one option."), captured };
      }
      const allowCustom = !!block.input.allow_custom;
      const def = typeof block.input.default === "string" ? block.input.default : undefined;
      const value = await handle.requestAspect(hint, options, allowCustom, def);
      if (value === null) {
        return { toolResult: err(id, "User cancelled the aspect ratio picker."), captured };
      }
      next.aspectRatio = value;
      return {
        toolResult: ok(
          id,
          `Aspect ratio captured: ${value}. Pass this exact string into run_workflow's aspect_ratio parameter.`,
        ),
        captured: next,
      };
    }
    case "request_resolution": {
      const hint = String(block.input.hint ?? "Pick a resolution");
      const def = typeof block.input.default === "string" ? block.input.default : undefined;
      const value = await handle.requestResolution(hint, def);
      if (value === null) {
        return { toolResult: err(id, "User cancelled the resolution picker."), captured };
      }
      next.resolution = value;
      return {
        toolResult: ok(
          id,
          `Resolution captured: ${value}. Pass this exact string into run_workflow's resolution parameter.`,
        ),
        captured: next,
      };
    }
    case "request_choice": {
      const hint = String(block.input.hint ?? "Pick one");
      const rawOptions = block.input.options;
      const options: ChoiceOption[] = Array.isArray(rawOptions)
        ? rawOptions
            .filter(
              (o): o is { value: string; label: string } =>
                !!o &&
                typeof o === "object" &&
                typeof (o as ChoiceOption).value === "string" &&
                typeof (o as ChoiceOption).label === "string",
            )
            .map((o) => ({ value: o.value, label: o.label }))
        : [];
      if (options.length < 2) {
        return { toolResult: err(id, "request_choice needs at least two options."), captured };
      }
      const def = typeof block.input.default === "string" ? block.input.default : undefined;
      const value = await handle.requestChoice(hint, options, def);
      if (value === null) {
        return { toolResult: err(id, "User cancelled the choice picker."), captured };
      }
      return {
        toolResult: ok(
          id,
          `User picked: ${value}. Pass this value into the matching run_workflow parameter.`,
        ),
        captured: next,
      };
    }
    case "request_text": {
      const label = String(block.input.label ?? "Describe");
      const placeholder = block.input.placeholder ? String(block.input.placeholder) : undefined;
      const optional = !!block.input.optional;
      const text = await handle.requestText(label, placeholder, optional);
      if (text === null) {
        return { toolResult: err(id, "User cancelled the text input."), captured };
      }
      next.text = text;
      return {
        toolResult: ok(
          id,
          text === "" ? "User skipped the optional text." : `Text captured: "${text}"`,
        ),
        captured: next,
        uiEffect: { kind: "input_captured", field: "text" },
      };
    }
    case "run_workflow": {
      const workflowId = String(block.input.workflow_id ?? "");
      if (!workflowId) return { toolResult: err(id, "Missing workflow_id."), captured };
      const params: Record<string, string> = {};
      for (const k of [
        "prompt",
        "aspect_ratio",
        "resolution",
        "color",
        "product_isolation_prompt",
      ]) {
        const v = block.input[k];
        if (typeof v === "string" && v.length) params[k] = v;
      }
      // is_intermediate: true on every step EXCEPT the last in a
      // multi-step plan. The dispatcher decides what that means based
      // on the global gateBetweenSteps setting (skip Sentinel by
      // default; await + halt-on-red when gating is on).
      const isIntermediate = !!block.input.is_intermediate;
      const result = await handle.runWorkflow(workflowId, params, captured, {
        intermediate: isIntermediate,
      });
      if (!result.ok) {
        return {
          toolResult: err(id, result.error),
          captured: next,
          uiEffect: { kind: "workflow_failed", workflowId, error: result.error },
        };
      }
      // Once a workflow runs, captured spatial inputs (pin/mask/reference)
      // are consumed — the next workflow in a chain operates on the new
      // version's image and needs fresh inputs.
      next.pin = null;
      next.mask = null;
      next.reference = null;
      next.text = null;
      return {
        toolResult: ok(
          id,
          `Workflow ${workflowId} succeeded. New version saved (id: ${result.versionId}). Image is now updated.`,
        ),
        captured: next,
        uiEffect: {
          kind: "workflow_complete",
          workflowId,
          versionId: result.versionId,
          outputUrl: result.outputUrl,
          label: result.label,
        },
      };
    }
    case "finish": {
      return { toolResult: ok(id, "Acknowledged."), captured: next };
    }
    default:
      return {
        toolResult: err(id, `Unknown tool: ${block.name}`),
        captured: next,
      };
  }
}

// ============================================================
// Misc helpers
// ============================================================

let _sessionId: string | null = null;
export function getSessionId(): string {
  if (_sessionId) return _sessionId;
  const stored =
    typeof window !== "undefined" ? window.sessionStorage.getItem("rfs-chat-session") : null;
  if (stored) {
    _sessionId = stored;
    return stored;
  }
  const fresh = `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  _sessionId = fresh;
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem("rfs-chat-session", fresh);
    } catch {
      /* private mode etc */
    }
  }
  return fresh;
}

/**
 * Walk the assistant's content blocks and pull out the tool_use entries.
 * Returns them in order so the caller can dispatch sequentially.
 */
export function extractToolUses(message: { content: ContentBlock[] }): ToolUseBlock[] {
  return message.content.filter((b): b is ToolUseBlock => b.type === "tool_use");
}
