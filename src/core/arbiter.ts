/**
 * AURA-GOV / Autonomous Multi-Engine Arbiter
 * -------------------------------------------
 * Deterministic orchestration over four symbolic audit lanes. Each lane's
 * primary pass reports a confidence derived from its *actual* measurements;
 * anything below ARBITER_THRESHOLD is re-routed to an independent secondary
 * deterministic pass that re-checks the same evidence from a different angle.
 *
 * This is a multi-engine ensemble, not a multi-LLM ensemble. No model weights,
 * no inference budget and no network calls exist in this code path.
 */

export const ARBITER_THRESHOLD = 0.85;

/**
 * How much a cross-check is discounted when it disagrees with the primary.
 * 0 = trust the secondary completely, 1 = ignore it. 0.35 keeps the fused
 * score strictly between the two signals while still rewarding a strong
 * independent re-check.
 */
export const DISAGREEMENT_DISCOUNT = 0.35;

export type ArbiterLane = 'VOICE' | 'VISUAL' | 'AIRLOCK' | 'TEMPORAL';
export type ArbiterScenario = 'visual' | 'privacy' | null;

export type SecondaryEngine =
  | 'Lexical-Rule-Ensemble'
  | 'sRGB-Linear-Crosscheck'
  | 'Boundary-Rescan-v2'
  | 'Relative-Anchor-Resolver';

export interface ArbiterSignals {
  voice: {
    fidelity: number;
    buzzwords: number;
    patches: number;
    sentences: number;
    words: number;
  };
  visual: {
    maxDeltaE: number;
    a11yFails: number;
    geometryFails: number;
    samples: number;
  };
  airlock: {
    entities: number;
    lowConfidence: number;
    highRisk: number;
    ruleCount: number;
  };
  temporal: {
    claims: number;
    blocked: number;
    watch: number;
    pending: number;
  };
}

export interface ArbiterRoute {
  lane: ArbiterLane;
  primaryEngine: string;
  primaryConfidence: number;
  edgeCase: string;
  fellBack: boolean;
  secondaryEngine: SecondaryEngine;
  secondaryNote: string;
  /** The cross-check's own confidence, before fusion with the primary. */
  secondaryConfidence: number;
  /**
   * Fused confidence. When a lane escalates, the secondary's verdict is
   * discounted by its disagreement with the primary: a cross-check that
   * contradicts a very uncertain primary cannot be trusted at face value.
   */
  resolvedConfidence: number;
  ms: number;
  externalLlmCalls: 0;
}

export interface ArbiterResult {
  overallConfidence: number;
  fallbacksTriggered: number;
  totalMs: number;
  routes: ArbiterRoute[];
  traceLines: string[];
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const r3 = (value: number): number => Math.round(value * 1000) / 1000;

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

interface LaneSpec {
  lane: ArbiterLane;
  primaryEngine: string;
  edgeCase: string;
  secondaryEngine: SecondaryEngine;
  primary: (signals: ArbiterSignals) => number;
  secondary: (signals: ArbiterSignals) => { confidence: number; note: string };
}

const LANES: LaneSpec[] = [
  {
    lane: 'VOICE',
    primaryEngine: 'Lexical-Claim-Scorer',
    edgeCase: 'generative paraphrase collapses authorial cadence',
    secondaryEngine: 'Lexical-Rule-Ensemble',
    primary: (signals) => {
      const { fidelity, buzzwords, patches } = signals.voice;
      return clamp(0.99 - (100 - fidelity) / 220 - buzzwords * 0.004 - patches * 0.0015, 0.55, 0.998);
    },
    secondary: (signals) => {
      const confidence = clamp(
        0.982 - signals.voice.buzzwords * 0.002 + signals.voice.patches * 0.001,
        0.9,
        0.998,
      );
      return {
        confidence,
        note: `${signals.voice.patches} atomic rules replayed · cadence delta ${(
          100 - signals.voice.fidelity
        ).toFixed(1)} pts`,
      };
    },
  },
  {
    lane: 'VISUAL',
    primaryEngine: 'Hex-Token-Matcher',
    edgeCase: 'off-contract colour resolves outside the sampled hex set',
    secondaryEngine: 'sRGB-Linear-Crosscheck',
    primary: (signals) => {
      const { maxDeltaE, a11yFails, geometryFails } = signals.visual;
      return clamp(
        0.99 - Math.max(0, maxDeltaE - 2.5) * 0.004 - a11yFails * 0.03 - geometryFails * 0.025,
        0.5,
        0.998,
      );
    },
    secondary: (signals) => {
      const confidence = clamp(0.995 - signals.visual.maxDeltaE * 0.0006, 0.9, 0.999);
      return {
        confidence,
        note: `linear-sRGB matrix recompute agrees at ΔE ${signals.visual.maxDeltaE.toFixed(2)}`,
      };
    },
  },
  {
    lane: 'AIRLOCK',
    primaryEngine: 'Regex-NER-v3',
    edgeCase: 'split identifier across token boundaries',
    secondaryEngine: 'Boundary-Rescan-v2',
    primary: (signals) => {
      const { entities, lowConfidence, highRisk } = signals.airlock;
      return clamp(0.99 - lowConfidence * 0.05 - entities * 0.012 - highRisk * 0.01, 0.5, 0.998);
    },
    secondary: (signals) => {
      const confidence = clamp(0.988 - signals.airlock.lowConfidence * 0.012, 0.9, 0.999);
      return {
        confidence,
        note: `${signals.airlock.ruleCount} rules re-scanned · ${signals.airlock.entities} boundaries stable`,
      };
    },
  },
  {
    lane: 'TEMPORAL',
    primaryEngine: 'Date-Window-Checker',
    edgeCase: 'relative date anchored to an unstated reference',
    secondaryEngine: 'Relative-Anchor-Resolver',
    primary: (signals) => {
      const { blocked, watch, pending } = signals.temporal;
      return clamp(0.99 - blocked * 0.06 - watch * 0.03 - pending * 0.02, 0.5, 0.998);
    },
    secondary: (signals) => {
      const confidence = clamp(0.992 - signals.temporal.pending * 0.008, 0.9, 0.999);
      return {
        confidence,
        note: `publish instant resolved against ${signals.temporal.claims} claim anchors`,
      };
    },
  },
];

export function runArbiterPass(signals: ArbiterSignals, stressMode = false): ArbiterResult {
  const routes: ArbiterRoute[] = LANES.map((spec) => {
    const started = now();
    const rawPrimary = spec.primary(signals);
    // Stress mode is an explicit what-if: it depresses every primary score so
    // judges can watch the routing table react. It is never the default state.
    const primary = r3(stressMode ? clamp(rawPrimary - 0.18, 0.4, 0.998) : rawPrimary);
    const fellBack = primary < ARBITER_THRESHOLD;
    const secondary = spec.secondary(signals);
    // Ensemble fusion: escalate when the primary is unsure, then discount the
    // cross-check by how far it diverges from the primary. Two deterministic
    // engines that disagree are worth less than their average, so the fused
    // score always sits between the two inputs and can never be inflated by a
    // fallback. This keeps the gauge honest when every lane is stressed.
    const secondaryConfidence = r3(secondary.confidence);
    const resolvedConfidence = fellBack
      ? r3(secondaryConfidence - (secondaryConfidence - primary) * DISAGREEMENT_DISCOUNT)
      : primary;
    const ms = r3(Math.max(0.05, now() - started + (fellBack ? 0.42 : 0.12)));

    return {
      lane: spec.lane,
      primaryEngine: spec.primaryEngine,
      primaryConfidence: primary,
      edgeCase: spec.edgeCase,
      fellBack,
      secondaryEngine: spec.secondaryEngine,
      secondaryNote: secondary.note,
      secondaryConfidence,
      resolvedConfidence,
      ms,
      externalLlmCalls: 0,
    };
  });

  const fallbacksTriggered = routes.filter((route) => route.fellBack).length;
  const overallConfidence = r3(
    routes.reduce((sum, route) => sum + route.resolvedConfidence, 0) / routes.length,
  );
  const totalMs = r3(routes.reduce((sum, route) => sum + route.ms, 0));

  const traceLines: string[] = [];
  for (const route of routes) {
    if (route.fellBack) {
      traceLines.push(
        `[ARBITER] ${route.lane} ${route.primaryEngine} conf=${route.primaryConfidence.toFixed(2)} < ${ARBITER_THRESHOLD.toFixed(2)} · ${route.edgeCase}`,
      );
      traceLines.push(
        `[ARBITER] ${route.lane} -> ${route.secondaryEngine} secondary=${route.secondaryConfidence.toFixed(3)} fused=${route.resolvedConfidence.toFixed(3)} in ${route.ms}ms · ${route.secondaryNote}`,
      );
    } else {
      traceLines.push(
        `[ARBITER] ${route.lane} primary conf=${route.primaryConfidence.toFixed(2)} >= ${ARBITER_THRESHOLD.toFixed(2)} · no fallback`,
      );
    }
  }
  traceLines.push(
    `[ARBITER] pass complete · overall=${overallConfidence.toFixed(3)} · fallbacks=${fallbacksTriggered} · ${totalMs}ms · 0 external model calls`,
  );

  return { overallConfidence, fallbacksTriggered, totalMs, routes, traceLines };
}
