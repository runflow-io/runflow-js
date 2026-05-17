// Rotating "the studio is busy doing something" microcopy for the
// pending pill on the canvas. Each workflow has a curated list of
// phrases the user sees cycle through every few seconds while a run
// is in flight, so the canvas doesn't sit on the same static label
// (e.g. "Running Pinpoint a change") for the full 60+ seconds the
// model takes.
//
// The phrases are vibes, not literal status. They're roughly ordered
// to match what the model is doing under the hood (analysing input,
// running the model, polishing output) but the user doesn't need to
// know which step is real.

import { useEffect, useState } from "react";

const ROTATE_INTERVAL_MS = 3500;

const PHRASES: Record<string, string[]> = {
  "ai-edit": [
    "Looking at the spot you pinned",
    "Reading what you want changed",
    "Reasoning about edges",
    "Composing the result",
    "Almost there",
  ],
  "reference-inpaint": [
    "Bundling your mask",
    "Uploading the reference",
    "Studying the reference",
    "Running the inpainter",
    "Blending the seam",
    "Polishing the result",
  ],
  "logo-fix": [
    "Reading your logo",
    "Studying the garment",
    "Finding the placement",
    "Composing the print",
    "Polishing the edges",
  ],
  "ai-scene": [
    "Reading your scene description",
    "Studying the subject",
    "Designing the new environment",
    "Lighting the scene",
    "Composing the image",
    "Final touches",
  ],
  "product-isolation": [
    "Detecting the subject",
    "Lifting it cleanly",
    "Building the white backdrop",
    "Adding the natural shadow",
    "Sharpening the edges",
    "Finalising",
  ],
  "smart-resize": [
    "Reading the layout",
    "Re-composing for the new ratio",
    "Filling the new areas",
    "Polishing edges",
    "Finalising",
  ],
  outpaint: [
    "Measuring the canvas extension",
    "Generating new background",
    "Blending into the original",
    "Smoothing the seams",
    "Finalising",
  ],
  "background-color": [
    "Detecting the subject",
    "Replacing the backdrop",
    "Smoothing the edge",
    "Finalising",
  ],
  "background-removal": [
    "Detecting the subject",
    "Cutting it out",
    "Cleaning edges",
    "Saving with transparency",
  ],
  "tag-removal": [
    "Scanning for tags",
    "Identifying the price labels",
    "In-painting where they were",
    "Smoothing the result",
  ],
  "object-removal": [
    "Reading what to erase",
    "Locating it in the frame",
    "Studying what's underneath",
    "Generating the fill",
    "Blending edges",
  ],
  "model-removal": [
    "Reading the garment",
    "Studying the pose",
    "Removing the model",
    "Reconstructing the garment",
    "Finalising",
  ],
  "skin-fix": [
    "Detecting skin tones",
    "Reading the subject's identity",
    "Polishing the texture",
    "Preserving micro-detail",
    "Finalising",
  ],
  generate: [
    "Reading your prompt",
    "Composing the scene",
    "Drafting forms",
    "Lighting it",
    "Adding detail",
    "Polishing",
  ],
};

const FALLBACK = ["Working", "Almost there", "Polishing", "Finalising"];

// Returns the phrase to display for a pending workflow run. Re-renders
// every ROTATE_INTERVAL_MS so the canvas pill cycles through the
// per-workflow list. When `pending` flips false, the timer cleans up.
export function usePendingPhrase(workflowId: string | null, pending: boolean): string {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => setTick((t) => t + 1), ROTATE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pending]);
  const phrases = (workflowId && PHRASES[workflowId]) || FALLBACK;
  return phrases[tick % phrases.length] ?? phrases[0];
}
