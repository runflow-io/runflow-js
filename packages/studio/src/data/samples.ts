// Sample assets shown in the left rail's project explorer on first load.
// Sources: samples.generated.json — a mix of v1 FAL Flux text-to-image
// outputs (scripts/gen-runflow-samples.mjs) and v2 Runflow API edits
// chained on those samples (scripts/gen-runflow-samples-v2.mjs).
//
// Tags drive workflow applicability hints — e.g. skin-fix /
// model-removal gate to "on-model" shots. recommendedWorkflows is
// editorial: a hand-picked list of which workflow cards should light
// up when this asset is the active one, so each sample doubles as a
// purpose-built demo for one or more cards.

import generated from "./samples.generated.json";

export type SampleAsset = {
  id: string;
  title: string;
  url: string;
  tags: string[];
  width?: number;
  height?: number;
  /** 1–3 workflow ids that the rail should highlight when this asset
   * is selected — the "show off this card on this image" demo path. */
  recommendedWorkflows?: string[];
};

type GeneratedShape = {
  generatedAt: string;
  images: Array<{
    id: string;
    title: string;
    tags: string[];
    aspect_ratio: string;
    prompt: string;
    url?: string;
    width?: number;
    height?: number;
    recommendedWorkflows?: string[];
    error?: string;
  }>;
};

const data = generated as GeneratedShape;

export const SAMPLES: SampleAsset[] = data.images
  .filter((img) => img.url && !img.error)
  .map((img) => ({
    id: img.id,
    title: img.title,
    url: img.url as string,
    tags: img.tags,
    width: img.width,
    height: img.height,
    recommendedWorkflows: img.recommendedWorkflows,
  }));
