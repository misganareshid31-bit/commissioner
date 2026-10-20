import React from 'react';

// Native pixel size of /assets/logo-mark-transparent.png — used to keep the
// mark's true aspect ratio (it's slightly wider than tall) at any size.
const MARK_ASPECT = 569 / 498;

/**
 * LogoMark — the real Commissioner monogram, background removed. This is a
 * cleaned-up cutout of the original artwork (transparent PNG), not a redraw,
 * so it drops cleanly onto light or dark surfaces with no plaque/background
 * behind it.
 */
export const LogoMark = ({ size = 32, className = '' }) => (
  <img
    src="/assets/logo-mark-transparent.png"
    alt="Commissioner"
    className={className}
    style={{ height: size, width: size * MARK_ASPECT, objectFit: 'contain', display: 'block' }}
    draggable={false}
  />
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
