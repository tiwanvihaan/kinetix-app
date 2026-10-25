import React from "react";

/**
 * Kinetix brand mark — a neural pathway motif rendered as a flat inline SVG.
 * Scales to its container via width/height props; inherits currentColor for strokes.
 */
export default function KinetixLogo({ className = "h-12 w-12", strokeWidth = 2 }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="Kinetix"
    >
      {/* connecting axons */}
      <path d="M14 14 L26 24 L14 34" opacity="0.85" />
      <path d="M34 12 L26 24 L34 36" opacity="0.85" />
      <path d="M12 24 L26 24" opacity="0.7" />
      {/* synapses */}
      <circle cx="14" cy="14" r="3" fill="currentColor" stroke="none" />
      <circle cx="34" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="24" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="14" cy="34" r="3" fill="currentColor" stroke="none" />
      <circle cx="34" cy="36" r="2.4" fill="currentColor" stroke="none" />
      {/* central node */}
      <circle cx="26" cy="24" r="4.2" fill="currentColor" stroke="none" />
    </svg>
  );
}