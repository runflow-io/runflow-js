// Global studio settings, persisted to localStorage. Today there's
// just one toggle (gateBetweenSteps) but this is the home for any
// future studio-wide preference.
//
// Read pattern: components subscribe via useStudioSettings(). The
// dispatcher reads the latest values via getStudioSettings() at
// dispatch time so it doesn't need to be passed through every call
// site.

"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "rfs-studio-settings";

export type StudioSettings = {
  /** When true, multi-step plans wait for Sentinel verdict on each
   * intermediate output before kicking off the next step. A red
   * verdict halts the chain. When false (default), intermediate
   * steps skip Sentinel entirely so chains run fast. */
  gateBetweenSteps: boolean;
};

const DEFAULTS: StudioSettings = {
  gateBetweenSteps: false,
};

function read(): StudioSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<StudioSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return DEFAULTS;
  }
}

function write(next: StudioSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode etc */
  }
}

// Module-scope cache so getStudioSettings() returns the latest write
// even before React's setState has flushed.
let cached: StudioSettings = DEFAULTS;
if (typeof window !== "undefined") {
  cached = read();
}

export function getStudioSettings(): StudioSettings {
  return cached;
}

// Pub/sub for cross-component sync. The cog popover writes; the
// dispatcher reads via getStudioSettings(); other components reading
// via useStudioSettings re-render.
type Listener = (s: StudioSettings) => void;
const listeners = new Set<Listener>();

export function setStudioSetting<K extends keyof StudioSettings>(
  key: K,
  value: StudioSettings[K],
) {
  cached = { ...cached, [key]: value };
  write(cached);
  for (const l of listeners) l(cached);
}

export function useStudioSettings(): StudioSettings {
  const [state, setState] = useState<StudioSettings>(() =>
    typeof window === "undefined" ? DEFAULTS : read(),
  );
  useEffect(() => {
    const listener: Listener = (s) => setState(s);
    listeners.add(listener);
    // Sync on mount in case another component wrote between SSR and
    // hydration.
    setState(cached);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return state;
}
