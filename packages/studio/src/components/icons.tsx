// Centralized icon set for the Runflow Studio. SVG inline so we don't
// pull in an icon library; viewBox standardized to 24x24.

import type { ReactNode } from "react";

export const Icon = {
  // Header
  sidebarHide: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M14 9l-2 3 2 3" />
    </svg>
  ),
  sidebarShow: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M11 9l2 3-2 3" />
    </svg>
  ),
  share: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M16 6l-4-4-4 4M12 2v14" />
      <path d="M5 14v6a2 2 0 002 2h10a2 2 0 002-2v-6" />
    </svg>
  ),
  download: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 4v12M6 12l6 6 6-6M4 20h16" />
    </svg>
  ),
  downloadAll: (
    // Stack-of-pages glyph with a small down arrow on the front sheet.
    // Reads as "bundle of files + download" so the user clocks it as
    // "grab all versions as one file" without needing the tooltip.
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M4 7v12a2 2 0 0 0 2 2h10" opacity="0.55" />
      <path d="M13 13v4M11 15l2 2 2-2" />
    </svg>
  ),
  link: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.5-1.5" />
    </svg>
  ),
  check: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5L20 7" />
    </svg>
  ),
  undo: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5" />
    </svg>
  ),
  redo: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M21 12a9 9 0 00-15-6.7L3 8M3 3v5h5" />
    </svg>
  ),
  close: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  ),
  search: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  ),
  upload: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 4v12M6 10l6-6 6 6" />
      <path d="M4 20h16" />
    </svg>
  ),
  generate: (
    // Four-pointed sparkle — the universal "AI made this" affordance.
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3z" />
      <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7L19 16z" />
    </svg>
  ),
  back: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  ),
  refresh: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 12a9 9 0 1 1 3 6.7" />
      <path d="M3 19v-6h6" />
    </svg>
  ),
  compare: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 3v18M5 8l-2 4 2 4M19 8l2 4-2 4" />
    </svg>
  ),
  zoomIn: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M11 8v6M8 11h6" />
    </svg>
  ),
  zoomOut: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5M8 11h6" />
    </svg>
  ),
  // Tabs
  workflows: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  chat: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 7a3 3 0 013-3h12a3 3 0 013 3v8a3 3 0 01-3 3H8l-4 4v-4H6a3 3 0 01-3-3V7z" />
    </svg>
  ),
  history: (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M3 12a9 9 0 109-9 9 9 0 00-7.6 4.2L3 9" />
      <path d="M3 4v5h5M12 7v5l3 2" />
    </svg>
  ),
  // Workflow card icons
  "ai-edit": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 21l3-1 11-11-2-2L4 18l-1 3z" />
      <path d="M14 7l3 3" />
      <circle cx="20" cy="4" r="1.4" fill="currentColor" />
    </svg>
  ),
  "reference-inpaint": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 13l5-4 4 3" />
      <circle cx="17" cy="8" r="1.5" fill="currentColor" />
      <path d="M14 19l3-3 3 3" />
    </svg>
  ),
  "logo-fix": (
    // T-shirt silhouette with a small badge — reads as "place a logo
    // on the garment" at thumbnail size.
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 4l2 2h6l2-2 3 2-2 4h-2v10H6V10H4L2 6z" />
      <circle cx="13.5" cy="11.5" r="2" />
    </svg>
  ),
  "ai-scene": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 19l5-7 4 5 3-3 6 5z" />
      <circle cx="17" cy="7" r="2" />
    </svg>
  ),
  "zalando-package": (
    // Shopping bag: signals "marketplace bundle" — a package of edits
    // that produces one catalog-ready image. Same visual family as the
    // other icons (1.8px stroke, 24×24 viewBox, currentColor).
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7z" />
      <path d="M9 7V5a3 3 0 0 1 6 0v2" />
      <path d="M9 11v2M15 11v2" />
    </svg>
  ),
  "product-isolation": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" strokeDasharray="3 2" />
      <path d="M9 8c2 0 3 2 3 4s1 4 3 4" />
    </svg>
  ),
  outpaint: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </svg>
  ),
  "smart-resize": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12h8M12 8v8" strokeDasharray="2 2" />
      <path d="M3 8l3-3M21 8l-3-3M3 16l3 3M21 16l-3 3" />
    </svg>
  ),
  "background-color": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <path d="M3 13l5-4 4 3 4-5 5 6" />
    </svg>
  ),
  "background-removal": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeDasharray="3 2"
    >
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" strokeDasharray="0" />
    </svg>
  ),
  "tag-removal": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M20 12L12 20a2.8 2.8 0 01-4 0l-4-4a2.8 2.8 0 010-4L12 4h8v8z" />
      <circle cx="16.5" cy="7.5" r="1.2" />
    </svg>
  ),
  "object-removal": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M8 12h8" />
    </svg>
  ),
  "model-removal": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="8" r="3" />
      <path d="M3 21c0-4 3-6 6-6" />
      <path d="M14 14l6 6M20 14l-6 6" />
    </svg>
  ),
  "skin-fix": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M12 3l2 5 5 1-4 4 1 5-4-3-4 3 1-5-4-4 5-1 2-5z" />
    </svg>
  ),
  "ai-logo": (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3" />
    </svg>
  ),
  video: (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3" y="6" width="13" height="12" rx="2" />
      <path d="M16 10l5-3v10l-5-3z" />
    </svg>
  ),
} as const satisfies Record<string, ReactNode>;
