/**
 * AURA-GOV / Continuous DOM Drift Radar
 * -------------------------------------
 * A real MutationObserver watches a sandboxed preview node. Every style,
 * attribute or child-list mutation triggers a live CIEDE2000 + WCAG 2.2
 * measurement against the brand contract. Layout geometry is diffed too, so a
 * pure spacing attack cannot hide behind an unchanged palette.
 *
 * Nothing here is simulated. The sandbox is a real DOM subtree; the observer is
 * a real MutationObserver; the colour math is the same CIEDE2000 implementation
 * used by the forensic readout.
 */
import {
  contrastRatio,
  deltaE2000,
  driftVerdict,
  rgbToHex,
  round,
  type DriftVerdict,
} from './color';

export const BRAND_BASELINE_HEX = '#D8FF4F';
export const BRAND_BASELINE_TOKEN = 'HEL-SOLAR-01';
export const WCAG_TEXT_MIN = 4.5;
export const LAYOUT_TOLERANCE_PX = 2;

export type RogueId = 'MUT-01' | 'MUT-02' | 'MUT-03' | 'MUT-04';
export type DriftTrigger = 'BASELINE' | RogueId | 'QUARANTINE' | 'EXTERNAL';

export type DriftKind =
  | 'clean'
  | 'color'
  | 'dom-node'
  | 'layout'
  | 'color+dom'
  | 'color+layout'
  | 'dom+layout'
  | 'color+dom+layout';

export interface DriftReading {
  trigger: DriftTrigger;
  kind: DriftKind;
  verdict: DriftVerdict;
  deltaE: number;
  contrast: number;
  wcagPass: boolean;
  rogueNodes: number;
  /** Largest absolute geometry delta (px) across the guarded surfaces. */
  layoutDrift: number;
  /** ms from the mutation (or revert) starting to the reading being produced. */
  detectMs: number;
  offender: string;
  bg: string;
  fg: string;
  detail: string;
  samples: number;
  worstContrast: { offender: string; bg: string; fg: string; contrast: number };
}

export interface RoguePreset {
  id: RogueId;
  label: string;
  summary: string;
  apply: (root: HTMLElement) => void;
}

const surface = (root: HTMLElement, name: string): HTMLElement | null =>
  root.querySelector<HTMLElement>(`[data-radar-surface="${name}"]`);

export const ROGUE_PRESETS: RoguePreset[] = [
  {
    id: 'MUT-01',
    label: 'Rogue Promo Banner Injection',
    summary: 'Banner background overridden to #FF0055',
    apply: (root) => {
      const el = surface(root, 'banner');
      if (!el) return;
      el.style.backgroundColor = '#FF0055';
      el.style.color = '#D8FF4F';
    },
  },
  {
    id: 'MUT-02',
    label: 'Unauthorized CTA Token Override',
    summary: 'CTA button overridden to #9B51E0',
    apply: (root) => {
      const el = surface(root, 'cta');
      if (el) el.style.backgroundColor = '#9B51E0';
    },
  },
  {
    id: 'MUT-03',
    label: 'Unsanctioned DOM Tracker Node',
    summary: 'Injects <span data-rogue-pixel> into the tree',
    apply: (root) => {
      const node = document.createElement('span');
      node.setAttribute('data-rogue-pixel', '1');
      node.textContent = 'TRACKER PX';
      root.appendChild(node);
    },
  },
  {
    id: 'MUT-04',
    label: 'Geometry Sabotage (silent layout shift)',
    summary: 'Injects padding/height without touching any colour token',
    apply: (root) => {
      const banner = surface(root, 'banner');
      const cta = surface(root, 'cta');
      if (banner) {
        banner.style.paddingTop = '30px';
        banner.style.paddingBottom = '30px';
      }
      if (cta) {
        cta.style.minHeight = '52px';
        cta.style.paddingLeft = '44px';
      }
    },
  },
];

function cssColorToHex(value: string, fallback: string): string {
  const parts = value.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  if (parts.length >= 4 && Number(parts[3]) === 0) return fallback;
  const [r, g, b] = parts.map(Number);
  return rgbToHex({ r, g, b });
}

interface SurfaceSample {
  offender: string;
  bg: string;
  fg: string;
  deltaE: number;
  contrast: number;
}

export interface DomRadar {
  inject: (id: RogueId) => void;
  quarantine: () => void;
  measureNow: () => DriftReading;
  disconnect: () => void;
}

/** Observe `root`. Call disconnect() in effect cleanup. */
export function createDomRadar(
  root: HTMLElement,
  onReading: (reading: DriftReading) => void,
): DomRadar {
  const observerOptions: MutationObserverInit = {
    attributes: true,
    // Deliberately excludes `class`: the parent panel toggles its own class in
    // response to a reading, and observing that would emit a duplicate event.
    attributeFilter: ['style', 'data-rogue-pixel'],
    childList: true,
    subtree: true,
  };

  // Brand-contract snapshot, taken once, used for surgical revert and layout diffing.
  const initialChildren = Array.from(root.children);
  const initialStyles = new Map<HTMLElement, string | null>();
  const initialRects = new Map<HTMLElement, DOMRect>();
  root.querySelectorAll<HTMLElement>('[data-radar-surface]').forEach((el) => {
    initialStyles.set(el, el.getAttribute('style'));
    initialRects.set(el, el.getBoundingClientRect());
  });

  let t0 = 0;
  let pending: DriftTrigger = 'EXTERNAL';
  let timer: number | null = null;
  let quarantining = false;
  let lastEmit = 0;

  const clock = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now();

  const measureLayout = (): number => {
    let worst = 0;
    initialRects.forEach((rect, el) => {
      if (!el.isConnected) {
        worst = Math.max(worst, 999);
        return;
      }
      const next = el.getBoundingClientRect();
      const delta = Math.max(
        Math.abs(next.left - rect.left),
        Math.abs(next.top - rect.top),
        Math.abs(next.width - rect.width),
        Math.abs(next.height - rect.height),
      );
      worst = Math.max(worst, delta);
    });
    return round(worst, 1);
  };

  const measure = (trigger: DriftTrigger): DriftReading => {
    const detectMs = t0 === 0 ? 0 : round(clock() - t0, 2);
    const rogueNodes = root.querySelectorAll('[data-rogue-pixel]').length;

    const samples: SurfaceSample[] = Array.from(
      root.querySelectorAll<HTMLElement>('[data-radar-surface]'),
    ).map((el) => {
      const cs = getComputedStyle(el);
      const bg = cssColorToHex(cs.backgroundColor, BRAND_BASELINE_HEX);
      const fg = cssColorToHex(cs.color, '#080A09');
      return {
        offender: el.dataset.radarSurface ?? 'surface',
        bg,
        fg,
        deltaE: round(deltaE2000(BRAND_BASELINE_HEX, bg), 1),
        contrast: round(contrastRatio(fg, bg), 2),
      };
    });

    const fallback: SurfaceSample = {
      offender: 'none',
      bg: BRAND_BASELINE_HEX,
      fg: '#080A09',
      deltaE: 0,
      contrast: 21,
    };
    const worstDelta = samples.length
      ? samples.reduce((a, b) => (b.deltaE > a.deltaE ? b : a), samples[0])
      : fallback;
    const worstContrast = samples.length
      ? samples.reduce((a, b) => (b.contrast < a.contrast ? b : a), samples[0])
      : fallback;

    const layoutDrift = measureLayout();
    const colorDrift = worstDelta.deltaE > 2.5;
    const contrastFail = worstContrast.contrast < WCAG_TEXT_MIN;
    const layoutFail = layoutDrift > LAYOUT_TOLERANCE_PX;

    const parts: string[] = [];
    if (colorDrift) parts.push('color');
    if (rogueNodes > 0) parts.push('dom');
    if (layoutFail) parts.push('layout');
    const kind: DriftKind = parts.length ? (parts.join('+') as DriftKind) : 'clean';

    const verdict: DriftVerdict =
      rogueNodes > 0 || contrastFail || layoutFail ? 'FAIL' : driftVerdict(worstDelta.deltaE);

    const details: string[] = [];
    if (colorDrift) {
      details.push(
        `${worstDelta.offender} ${worstDelta.bg} vs ${BRAND_BASELINE_HEX} · ΔE2000 ${worstDelta.deltaE.toFixed(1)}`,
      );
    }
    if (contrastFail) {
      details.push(
        `WCAG ${worstContrast.contrast.toFixed(2)}:1 on ${worstContrast.offender} (min 4.5:1)`,
      );
    }
    if (rogueNodes > 0) details.push(`unauthorized DOM node ×${rogueNodes}`);
    if (layoutFail) details.push(`geometry shift ${layoutDrift.toFixed(1)}px`);
    if (details.length === 0) details.push('Within brand contract');

    return {
      trigger,
      kind,
      verdict,
      deltaE: worstDelta.deltaE,
      contrast: worstContrast.contrast,
      wcagPass: !contrastFail,
      rogueNodes,
      layoutDrift,
      detectMs,
      offender: worstDelta.offender,
      bg: worstDelta.bg,
      fg: worstDelta.fg,
      detail: details.join(' · '),
      samples: samples.length,
      worstContrast: {
        offender: worstContrast.offender,
        bg: worstContrast.bg,
        fg: worstContrast.fg,
        contrast: worstContrast.contrast,
      },
    };
  };

  const flush = () => {
    timer = null;
    if (quarantining) return;
    const trigger = pending;
    const reading = measure(trigger);
    pending = 'EXTERNAL';
    t0 = 0;
    // Coalesce a duplicate clean event caused by an unrelated DOM write.
    if (
      trigger === 'EXTERNAL' &&
      reading.kind === 'clean' &&
      reading.verdict === 'PASS' &&
      clock() - lastEmit < 350
    ) {
      return;
    }
    lastEmit = clock();
    onReading(reading);
  };

  const observer = new MutationObserver(() => {
    if (quarantining) return;
    if (timer !== null) return;
    timer = window.setTimeout(flush, 24);
  });
  observer.observe(root, observerOptions);

  return {
    inject: (id) => {
      const preset = ROGUE_PRESETS.find((entry) => entry.id === id);
      if (!preset) return;
      pending = id;
      t0 = clock();
      preset.apply(root);
    },
    quarantine: () => {
      if (quarantining) return;
      quarantining = true;
      observer.disconnect();
      const started = clock();
      // Remove everything that was not in the original contract…
      Array.from(root.children)
        .filter((child) => !initialChildren.includes(child))
        .forEach((child) => child.remove());
      // …and restore each surface's original inline style.
      initialStyles.forEach((style, el) => {
        if (style === null) el.removeAttribute('style');
        else el.setAttribute('style', style);
      });
      observer.takeRecords();
      t0 = started;
      const reading = measure('QUARANTINE');
      t0 = 0;
      pending = 'EXTERNAL';
      quarantining = false;
      lastEmit = clock();
      observer.observe(root, observerOptions);
      onReading(reading);
    },
    measureNow: () => measure('BASELINE'),
    disconnect: () => {
      observer.disconnect();
      if (timer !== null) window.clearTimeout(timer);
      timer = null;
    },
  };
}
