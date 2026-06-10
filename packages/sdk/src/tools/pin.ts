/**
 * Pin → prompt helpers.
 *
 * `google/nano-banana-pro/edit` (and the other prompt-driven edit models)
 * have no `pin_x` / `pin_y` input fields. The convention — used by the
 * Studio shell's ai-edit tool and expected by the model — is to name the
 * region in the prompt text: a 3×3 grid of `upper|middle|lower` ×
 * `left|center|right` phrases derived from normalized pin coordinates.
 *
 * These helpers are the single public implementation of that convention,
 * shared by `@runflow-io/studio` and external forks, so pin-based editing
 * produces the exact same dispatch body everywhere.
 */

/** A pin location in normalized image coordinates (0..1 on each axis). */
export interface PinPoint {
  /** Horizontal position: 0 = left edge, 1 = right edge. */
  x: number;
  /** Vertical position: 0 = top edge, 1 = bottom edge. */
  y: number;
}

/**
 * Map a normalized pin to its region phrase on the 3×3 grid.
 *
 * Thirds are split at 0.33 and 0.66 (exact boundary values fall into the
 * middle/center band): `{x: 0.1, y: 0.1}` → `"upper-left"`,
 * `{x: 0.5, y: 0.5}` → `"middle-center"`, `{x: 0.9, y: 0.9}` →
 * `"lower-right"`.
 */
export function pinRegion(pin: PinPoint): string {
  const yLabel = pin.y < 0.33 ? "upper" : pin.y < 0.66 ? "middle" : "lower";
  const xLabel = pin.x < 0.33 ? "left" : pin.x < 0.66 ? "center" : "right";
  return `${yLabel}-${xLabel}`;
}

/**
 * Compose the full edit prompt for a named region. This is the exact
 * template the Studio shell dispatches — kept verbatim so shells, forks,
 * and the e2e proof share one contract.
 */
export function composeRegionPrompt(region: string, instruction: string): string {
  return `Edit the ${region} area of this image: ${instruction}. Photoreal product photography, preserve the rest of the image, true colors and lighting.`;
}

/**
 * Compose the full edit prompt for a pin location.
 *
 * @example
 * ```ts
 * const body = {
 *   input: {
 *     prompt: composePinPrompt({ x: 0.25, y: 0.25 }, "remove the price tag"),
 *     image_urls: [sourceUrl],
 *   },
 * };
 * await rf.models.run("google/nano-banana-pro/edit", body);
 * ```
 */
export function composePinPrompt(pin: PinPoint, instruction: string): string {
  return composeRegionPrompt(pinRegion(pin), instruction);
}
