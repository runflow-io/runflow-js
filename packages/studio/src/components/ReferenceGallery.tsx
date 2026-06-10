// Multi-slot reference image picker. Used by both the mask-ref
// workflow (StudioShell) and the text-to-image generate panel. The
// caller owns the state (primary file + extras + preview URLs); the
// gallery just renders the tile grid and the upload affordance.
//
// Slot 0 is the "primary" reference, which historically (chat agent,
// logo workflow) was the only reference. Slots 1..N-1 are extras. The
// distinction is kept here because some downstream code paths still
// only consume the singular field — splitting the state makes that
// back-compat trivial without forcing every caller to migrate.

export function ReferenceGallery({
  referencePreview,
  extraReferencePreviews,
  onReferenceFile,
  onAddReferenceFiles,
  onRemoveExtraReference,
  maxReferences,
  className,
}: {
  referencePreview: string | null;
  extraReferencePreviews: string[];
  onReferenceFile: (file: File | null) => void;
  onAddReferenceFiles: (files: File[]) => void;
  onRemoveExtraReference: (index: number) => void;
  maxReferences: number;
  className?: string;
}) {
  const totalFilled = (referencePreview ? 1 : 0) + extraReferencePreviews.length;
  const canAddMore = totalFilled < maxReferences;
  return (
    <div
      className={`rfs-ref-gallery${className ? ` ${className}` : ""}`}
      aria-label="Reference images"
    >
      {referencePreview ? (
        <div className="rfs-ref-tile">
          <img src={referencePreview} alt="Reference 1" />
          <button
            type="button"
            className="rfs-ref-tile-remove"
            onClick={() => onReferenceFile(null)}
            aria-label="Remove reference 1"
          >
            ×
          </button>
        </div>
      ) : null}
      {extraReferencePreviews.map((url, i) => (
        <div className="rfs-ref-tile" key={`${url}-${i}`}>
          <img src={url} alt={`Reference ${i + 2}`} />
          <button
            type="button"
            className="rfs-ref-tile-remove"
            onClick={() => onRemoveExtraReference(i)}
            aria-label={`Remove reference ${i + 2}`}
          >
            ×
          </button>
        </div>
      ))}
      {canAddMore ? (
        <label className="rfs-ref-add">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) onAddReferenceFiles(files);
              e.currentTarget.value = "";
            }}
          />
          <span className="rfs-ref-add-icon" aria-hidden>
            +
          </span>
          <span className="rfs-ref-add-label">
            {totalFilled === 0
              ? `Add reference (up to ${maxReferences})`
              : `Add another (${totalFilled}/${maxReferences})`}
          </span>
        </label>
      ) : (
        <div className="rfs-ref-cap-note">
          {maxReferences} reference{maxReferences === 1 ? "" : "s"} — limit reached
        </div>
      )}
    </div>
  );
}
