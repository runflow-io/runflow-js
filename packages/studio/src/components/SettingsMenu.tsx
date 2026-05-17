"use client";

// Inline header toggle for studio settings. Was a cog popover when
// there were multiple toggles planned; with a single boolean today
// the popover felt like overkill — one click to open, one to close,
// just to flick a switch. This is a flat label + native checkbox in
// the header, with the explanation surfaced via a hover tooltip on
// the whole control.
//
// The `gateBetweenSteps` flag makes Sentinel evaluate every
// intermediate step in a chain (and pause the chain on red),
// not just the final output. Off by default — adds 2-4 minutes
// per step, which is too slow for casual demos but useful when the
// operator wants to catch a regression early.

import {
  setStudioSetting,
  useStudioSettings,
} from "../lib/studio-settings";

const TOOLTIP =
  "Pause the chain if any intermediate step fails the quality check. Adds ~2 minutes per step.";

export function SettingsMenu() {
  const settings = useStudioSettings();
  const checked = settings.gateBetweenSteps;
  return (
    <label className="rfs-header-toggle" title={TOOLTIP}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => setStudioSetting("gateBetweenSteps", e.target.checked)}
        aria-label="Strict quality gates"
      />
      <span className="rfs-header-toggle-track" aria-hidden>
        <span className="rfs-header-toggle-knob" />
      </span>
      <span className="rfs-header-toggle-label">Strict quality gates</span>
    </label>
  );
}
