"use client";

// Top-right toast stack. Surfaces async edit results without blocking
// the canvas: when a non-current pending version completes, the toast
// gives the user a one-click jump to view it.

import { Icon } from "./icons";

export type StudioToast = {
  id: string;
  kind: "success" | "error" | "warning";
  title: string;
  body?: string;
  thumbUrl?: string;
  actionLabel?: string;
  onView?: () => void;
  ts: number;
};

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: StudioToast[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div className="rfs-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`rfs-toast rfs-toast-${t.kind}`} role="status">
          {t.thumbUrl ? <img className="rfs-toast-thumb" src={t.thumbUrl} alt="" /> : null}
          <div className="rfs-toast-text">
            <div className="rfs-toast-title">{t.title}</div>
            {t.body ? <div className="rfs-toast-body">{t.body}</div> : null}
          </div>
          {t.onView ? (
            <button
              type="button"
              className="rfs-toast-action"
              onClick={() => {
                t.onView?.();
                onDismiss(t.id);
              }}
            >
              {t.actionLabel ?? "View"}
            </button>
          ) : null}
          <button
            type="button"
            className="rfs-toast-close"
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
          >
            {Icon.close}
          </button>
        </div>
      ))}
    </div>
  );
}
