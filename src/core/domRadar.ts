/**
 * AURA-GOV / Continuous DOM Drift Radar
 * -------------------------------------
 * A real MutationObserver watches a sandboxed preview node. Every style,
 * attribute or child-list mutation triggers a live CIEDE2000 + WCAG 2.2
 * measurement against the brand contract. Nothing here is simulated.
 */
import { contrastRatio, deltaE2000, driftVerdict, rgbToHex, round, type DriftVerdict } from './color';

export const BRAND_BASELINE_HEX = '#D8FF4F';
export const BRAND_BASELINE_TOKEN = 'HEL-SOLAR-01';
export const WCAG_TEXT_MIN = 4.5;

export type RogueId = 'MUT-01' | 'MUT-02' | 'MUT-03';
export type DriftTrigger = 'BASELINE' | RogueId | 'QUARANTINE' | 'EXTERNAL';

export interface DriftReading {
  trigger: DriftTrigger;
  kind: 'clean' | 'color' | 'dom-node' | 'color+dom';
  verdict: DriftVerdict;
  deltaE: number;
  contrast: number;
  wcagPass: boolean;
  rogueNodes: number;
  /** ms from the mutation (or revert) starting to the reading being produced. */
  detectMs: number;
  offender: string;
  bg: string;
  fg: string;
  detail: string;
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
];

function cssColorToHex(value: string, fallback: string): string {
  const parts = value.match(/[\d.]+/g);
  if (!parts || parts.length < 3) return fallback;
  if (parts.length >= 4 && Number(parts[3]) === 0) return fallback;
  const [r, g, b] = parts.map(Number);
  return rgbToHex({ r, g, b });
}

export interface DomRadar {
  inject: (id: RogueId) => void;
  quarantine: () => void;
  measureNow: () => DriftReading;
  disconnect: () => void;
}

/** Observe `root`. Call disconnect() in effect cleanup. */
export function createDomRadar(root: HTMLElement, onReading: (reading: DriftReading) => void): DomRadar {
  const observerOptions: MutationObserverInit = {
    attributes: true,
    attributeFilter: ['style', 'class', 'data-rogue-pixel'],
    childList: true,
    subtree: true,
  };

  // Brand-contract snapshot, taken once, used for surgical revert.
  const initialChildren = Array.from(root.children);
  const initialStyles = new Map<HTMLElement, string | null>();
  root.querySelectorAll<HTMLElement>('[data-radar-surface]').forEach((el) => {
    initialStyles.set(el, el.getAttribute('style'));
  });

  let t0 = 0;
  let pending: DriftTrigger = 'EXTERNAL';

  const measure = (trigger: DriftTrigger): DriftReading => {
    const detectMs = t0 === 0 ? 0 : round(performance.now() - t0, 2);
    const rogueNodes = root.querySelectorAll('[data-rogue-pixel]').length;

    const samples = Array.from(root.querySelectorAll<HTMLElement>('[data-radar-surface]')).map((el) => {
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

    const fallback = { offender: 'none', bg: BRAND_BASELINE_HEX, fg: '#080A09', deltaE: 0, contrast: 21 };
    const worst = samples.length
      ? samples.reduce((a, b) => (b.deltaE > a.deltaE ? b : a), samples[0])
      : fallback;

    const colorDrift = worst.deltaE > 2.5;
    const kind: DriftReading['kind'] =
      rogueNodes > 0 ? (colorDrift ? 'color+dom' : 'dom-node') : colorDrift ? 'color' : 'clean';
    const verdict: DriftVerdict = rogueNodes > 0 ? 'FAIL' : driftVerdict(worst.deltaE);

    let detail = 'Within brand contract';
    if (kind === 'color' || kind === 'color+dom') {
      detail = `${worst.offender} ${worst.bg} vs ${BRAND_BASELINE_HEX} · ΔE2000 ${worst.deltaE.toFixed(1)}`;
    }
    if (rogueNodes > 0) {
      detail = `Unauthorized DOM node injection ×${rogueNodes}${colorDrift ? ' · ' + detail : ''}`;
    }

    return {
      trigger,
      kind,
      verdict,
      deltaE: worst.deltaE,
      contrast: worst.contrast,
      wcagPass: worst.contrast >= WCAG_TEXT_MIN,
      rogueNodes,
      detectMs,
      offender: worst.offender,
      bg: worst.bg,
      fg: worst.fg,
      detail,
    };
  };

  const observer = new MutationObserver(() => {
    const reading = measure(pending);
    pending = 'EXTERNAL';
    t0 = 0;
    onReading(reading);
  });
  observer.observe(root, observerOptions);

  return {
    inject: (id) => {
      const preset = ROGUE_PRESETS.find((entry) => entry.id === id);
      if (!preset) return;
      pending = id;
      t0 = performance.now();
      preset.apply(root);
    },
    quarantine: () => {
      observer.disconnect();
      t0 = performance.now();
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
      const reading = measure('QUARANTINE');
      t0 = 0;
      pending = 'EXTERNAL';
      observer.observe(root, observerOptions);
      onReading(reading);
    },
    measureNow: () => measure('BASELINE'),
    disconnect: () => observer.disconnect(),
  };
}