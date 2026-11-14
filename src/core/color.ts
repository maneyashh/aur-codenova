/**
 * AURA-GOV / Deterministic Colour Science
 * ----------------------------------------
 * No model inference. No guessing. Pure, auditable math.
 *
 * - sRGB -> CIELAB (D65)
 * - CIEDE2000 perceptual colour difference (Sharma et al. implementation)
 * - WCAG 2.2 relative luminance & contrast ratios
 */

export type RGB = { r: number; g: number; b: number };
export type LAB = { L: number; a: number; b: number };

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export function hexToRgb(hex: string): RGB {
  const normalized = hex.replace('#', '').trim();
  const full =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`Invalid hex colour: ${hex}`);
  }

  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }: RGB): string {
  const channel = (value: number) =>
    clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

function srgbChannelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [lr, lg, lb] = [
    srgbChannelToLinear(r),
    srgbChannelToLinear(g),
    srgbChannelToLinear(b),
  ];
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

/** WCAG 2.2 contrast ratio, 1:1 to 21:1. Order-independent. */
export function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WCAGLevel = 'AAA' | 'AA' | 'AA Large' | 'Fail';

export function wcagLevel(ratio: number, largeText = false): WCAGLevel {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (largeText && ratio >= 3) return 'AA Large';
  return 'Fail';
}

export const WCAG_THRESHOLDS = {
  normalAA: 4.5,
  normalAAA: 7,
  largeAA: 3,
  largeAAA: 4.5,
  nonText: 3,
} as const;

/** sRGB (D65) -> XYZ -> CIELAB */
export function hexToLab(hex: string): LAB {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);

  const x = (lr * 0.4124564 + lg * 0.3575761 + lb * 0.1804375) / 0.95047;
  const y = lr * 0.2126729 + lg * 0.7151522 + lb * 0.072175;
  const z = (lr * 0.0193339 + lg * 0.119192 + lb * 0.9503041) / 1.08883;

  const epsilon = 216 / 24389;
  const kappa = 24389 / 27;

  const fx = x > epsilon ? Math.cbrt(x) : (kappa * x + 16) / 116;
  const fy = y > epsilon ? Math.cbrt(y) : (kappa * y + 16) / 116;
  const fz = z > epsilon ? Math.cbrt(z) : (kappa * z + 16) / 116;

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/**
 * CIEDE2000 colour difference.
 * Reference: Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula".
 */
export function deltaE2000(first: string, second: string): number {
  return labDeltaE2000(hexToLab(first), hexToLab(second));
}

export function labDeltaE2000(lab1: LAB, lab2: LAB): number {
  const radToDeg = 180 / Math.PI;
  const degToRad = Math.PI / 180;
  const pow25To7 = 25 ** 7;

  const { L: L1, a: a1, b: b1 } = lab1;
  const { L: L2, a: a2, b: b2 } = lab2;

  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + pow25To7)));

  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);

  const h1p = C1p === 0 ? 0 : (Math.atan2(b1, a1p) * radToDeg + 360) % 360;
  const h2p = C2p === 0 ? 0 : (Math.atan2(b2, a2p) * radToDeg + 360) % 360;

  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp = 0;

  if (C1p * C2p !== 0) {
    dhp = h2p - h1p;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * degToRad) / 2);

  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp = h1p + h2p;

  if (C1p * C2p !== 0) {
    hbarp =
      Math.abs(h1p - h2p) <= 180
        ? (h1p + h2p) / 2
        : h1p + h2p < 360
          ? (h1p + h2p + 360) / 2
          : (h1p + h2p - 360) / 2;
  }

  const T =
    1 -
    0.17 * Math.cos((hbarp - 30) * degToRad) +
    0.24 * Math.cos(2 * hbarp * degToRad) +
    0.32 * Math.cos((3 * hbarp + 6) * degToRad) -
    0.2 * Math.cos((4 * hbarp - 63) * degToRad);

  const dTheta = 30 * Math.exp(-(((hbarp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + pow25To7));
  const SL =
    1 + (0.015 * (Lbarp - 50) ** 2) / Math.sqrt(20 + (Lbarp - 50) ** 2);
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * degToRad) * RC;

  return Math.sqrt(
    (dLp / SL) ** 2 +
      (dCp / SC) ** 2 +
      (dHp / SH) ** 2 +
      RT * (dCp / SC) * (dHp / SH),
  );
}

export type DriftVerdict = 'PASS' | 'REVIEW' | 'FAIL';

export function driftVerdict(deltaE: number): DriftVerdict {
  if (deltaE <= 2.5) return 'PASS';
  if (deltaE <= 5) return 'REVIEW';
  return 'FAIL';
}

/** Perceptual warmth for visual heatmap blending (0-1). */
export function perceptualDistanceNormalized(
  first: string,
  second: string,
  ceiling = 100,
): number {
  return clamp(deltaE2000(first, second) / ceiling, 0, 1);
}
