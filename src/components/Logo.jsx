import React from 'react';

/**
 * LogoMark — the interlocking double-C monogram, rendered as inline SVG.
 * No background, no raster artifacts — just crisp vector paths that scale
 * to any size and drop cleanly onto light or dark surfaces.
 */
export const LogoMark = ({ size = 32, className = '' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="cm-logo-outer" x1="10" y1="10" x2="70" y2="70" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#E6007A" />
        <stop offset="100%" stopColor="#7C3AED" />
      </linearGradient>
      <linearGradient id="cm-logo-inner" x1="40" y1="40" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#7C3AED" />
        <stop offset="100%" stopColor="#00D9FF" />
      </linearGradient>
    </defs>
    <path
      d="M 58.77 55.75 A 24.5 24.5 0 1 1 58.77 24.25"
      stroke="url(#cm-logo-outer)"
      strokeWidth="11"
      strokeLinecap="round"
    />
    <path
      d="M 71.21 69.09 A 17.25 17.25 0 1 1 71.21 46.91"
      stroke="url(#cm-logo-inner)"
      strokeWidth="9.5"
      strokeLinecap="round"
    />
  </svg>
);

/**
 * Logo — icon + wordmark lockup. `light` swaps the wordmark to white for
 * dark surfaces (e.g. the footer).
 */
const Logo = ({ size = 32, textSize = 'text-lg', light = false, className = '' }) => (
  <div className={`flex items-center gap-2 ${className}`}>
    <LogoMark size={size} />
    <span
      className="cm-display font-bold tracking-tight"
      style={{ color: light ? '#FFFFFF' : '#111827', fontSize: undefined }}
    >
      <span className={textSize}>Commissioner</span>
    </span>
  </div>
);

export default Logo;
