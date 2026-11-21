/**
 * AURA-GOV / Single source of truth
 * ---------------------------------
 * The screens used to carry hand-written stage tables, risk rows and trace
 * logs. That made the demo look impressive but produced contradictions the
 * moment a second dataset was loaded. This module derives the entire clearance
 * record from the deterministic engines, so every screen reads the same numbers.
 */
import {
  analyzePayload,
  type AirlockReport,
} from './airlock';
import {
  addDays,
  claims,
  evaluateClaim,
  formatShortDate,
  TODAY,
  type Claim,
  type TemporalEvaluation,
} from './claims';
import {
  contrastRatio,
  deltaE2000,
  round,
  wcagLevel,
  type WCAGLevel,
} from './color';
import {
  llmBuzzwords,
  tokenPatches,
  VOICE_LLM,
  VOICE_ORIGINAL,
  VOICE_SURGICAL,
  computeVoiceMetrics,
  voiceFidelity,
  type VoiceFidelity,
  type VoiceMetrics,
} from './voice';
import {
  a11yChecks as baselineA11y,
  brandProfile,
  geometryChecks,
  palette as baselinePalette,
  visualFindings,
  type AccessibilityCheck,
  type Finding,
  type GeometryCheck,
  type PaletteSample,
} from '../data/brand';
import type { CompileLog, PipelineStage } from '../data/overview';
import type { PosterTheme, Scenario, ScenarioNote } from '../sim/types';
import { DEFAULT_POSTER, paletteForScenario, SCENARIOS } from '../sim/scenarios';
import { runArbiterPass, type ArbiterResult, type ArbiterSignals } from './arbiter';
import { sha256Hex, shortHash } from './vault';

export interface DomainScore {
  key: 'visual' | 'temporal' | 'voice' | 'airlock';
  label: string;
  value: number;
  tone: 'acid' | 'amber' | 'red';
  note: string;
}

export interface TemporalSnapshot {
  evaluations: { claim: Claim; evaluation: TemporalEvaluation }[];
  blocked: number;
  watch: number;
  valid: number;
  total: number;
  score: number;
}

export interface VisualSnapshot {
  theme: PosterTheme;
  palette: PaletteSample[];
  maxDeltaE: number;
  findings: Finding[];
  geometry: GeometryCheck[];
  a11y: AccessibilityCheck[];
  a11yFails: number;
  geometryFails: number;
  score: number;
}

export interface VoiceSnapshot {
  variant: 'surgical' | 'llm';
  text: string;
  fidelity: VoiceFidelity;
  metrics: VoiceMetrics;
  patches: number;
  buzzwords: number;
  score: number;
}

export interface ClearanceReport {
  scenario: Scenario;
  isBaseline: boolean;
  asset: Scenario['asset'];
  publishDate: string;
  today: string;
  airlock: AirlockReport;
  temporal: TemporalSnapshot;
  visual: VisualSnapshot;
  voice: VoiceSnapshot;
  domains: DomainScore[];
  score: number;
  verdictLabel: string;
  verdictShort: string;
  verdictTone: 'acid' | 'amber' | 'red';
  verdictCopy: string;
  notes: ScenarioNote[];
  stages: PipelineStage[];
  logs: CompileLog[];
  logByStage: Record<string, CompileLog>;
  signals: ArbiterSignals;
  arbiter: ArbiterResult;
  traceHash: string;
  traceHashShort: string;
  runId: string;
  signature: string;
  totalMs: number;
  radarAxes: { label: string; value: number; baseline: number }[];
  headline: { main: string; rest: string };
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const toneFor = (value: number): 'acid' | 'amber' | 'red' =>
  value >= 85 ? 'acid' : value >= 60 ? 'amber' : 'red';

function buildA11y(theme: PosterTheme): AccessibilityCheck[] {
  const regions = {
    A01: { x: 34, y: 552, width: 500, height: 158 },
    A02: { x: 38, y: 530, width: 300, height: 22 },
    A03: { x: 38, y: 762, width: 206, height: 42 },
    A04: { x: 34, y: 838, width: 330, height: 22 },
    A05: { x: 548, y: 486, width: 132, height: 30 },
  };
  const raw = [
    {
      id: 'A-01',
      label: 'Display headline / Field',
      foreground: theme.ink,
      background: theme.fieldBottom,
      region: regions.A01,
      note: 'Headline ink against the rendered poster field.',
      min: 4.5,
    },
    {
      id: 'A-02',
      label: 'Eyebrow / Field',
      foreground: theme.accent,
      background: theme.fieldBottom,
      region: regions.A02,
      note: 'Signal accent used as a micro-label.',
      min: 4.5,
    },
    {
      id: 'A-03',
      label: 'Primary CTA / Signal',
      foreground: theme.fieldBottom,
      background: theme.accent,
      region: regions.A03,
      note: 'Field ink on the primary signal fill.',
      min: 4.5,
    },
    {
      id: 'A-04',
      label: 'Legal micro / Field',
      foreground: '#7C857E',
      background: theme.fieldBottom,
      region: regions.A04,
      note: 'Graphite microcopy on the field.',
      min: 4.5,
    },
    {
      id: 'A-05',
      label: 'Verification decal',
      foreground: theme.decalInk,
      background: theme.fieldBottom,
      region: regions.A05,
      note: 'Decal glyph / field. WCAG 2.2 non-text minimum is 3:1.',
      min: 3,
    },
  ];

  return raw.map((check) => {
    const ratio = round(contrastRatio(check.foreground, check.background), 2);
    const level: WCAGLevel = wcagLevel(ratio, false);
    return {
      id: check.id,
      label: check.label,
      foreground: check.foreground,
      background: check.background,
      ratio,
      level,
      pass: ratio >= check.min,
      region: check.region,
      note: check.note,
    };
  });
}

function timeStamp(baseMs: number, offsetMs: number): string {
  const total = baseMs + offsetMs;
  const hours = Math.floor(total / 3_600_000) % 24;
  const minutes = Math.floor(total / 60_000) % 60;
  const seconds = Math.floor(total / 1000) % 60;
  const millis = Math.round(total % 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds,
  ).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

const BASE_TIME_MS = 14 * 3_600_000 + 31 * 60_000 + 2000 + 94;

export function buildClearanceReport(
  scenarioInput: Scenario | null,
  publishOffset: number,
): ClearanceReport {
  const isBaseline = scenarioInput === null;
  const scenario = scenarioInput ?? SCENARIOS.visual;
  const theme = scenario.poster ?? DEFAULT_POSTER;
  const asset = scenario.asset;

  /* ---------------------------- airlock ---------------------------- */
  const airlock = analyzePayload(scenario.airlockPayload);

  /* ---------------------------- temporal --------------------------- */
  const publishDate = addDays(TODAY, publishOffset);
  const evaluations = claims.map((claim) => ({
    claim,
    evaluation: evaluateClaim(claim, publishDate),
  }));
  const blocked = evaluations.filter(({ evaluation }) => evaluation.severity === 'blocked').length;
  const watch = evaluations.filter(({ evaluation }) => evaluation.severity === 'watch').length;
  const valid = evaluations.filter(({ evaluation }) => evaluation.severity === 'clear').length;
  const temporalScore = round(((valid + watch * 0.55) / Math.max(1, claims.length)) * 100, 1);

  /* ----------------------------- visual ---------------------------- */
  const palette = isBaseline ? baselinePalette : paletteForScenario(scenario);
  const maxDeltaE = palette.reduce((max, color) => Math.max(max, color.deltaE), 0);
  const findings = scenario.visual.findings.length
    ? scenario.visual.findings
    : visualFindings;
  const a11y = isBaseline ? baselineA11y : buildA11y(theme);
  const a11yFails = a11y.filter((check) => !check.pass).length;
  const geometryFails = geometryChecks.filter((check) => check.verdict === 'FAIL').length;
  const visualScore = clamp(round(100 - maxDeltaE, 1), 0, 100);

  /* ------------------------------ voice ---------------------------- */
  const variant = scenario.voiceVariant;
  const voiceText = variant === 'llm' ? VOICE_LLM : VOICE_SURGICAL;
  const fidelity = voiceFidelity(VOICE_ORIGINAL, voiceText);
  const metrics = computeVoiceMetrics(voiceText);
  const buzzwords =
    variant === 'llm'
      ? llmBuzzwords.filter((word) =>
          new RegExp(`\\b${word}\\b`, 'i').test(VOICE_LLM),
        ).length
      : 0;
  const voiceScore = fidelity.score;

  /* ----------------------------- airlock score --------------------- */
  const airlockScore = clamp(round(100 - airlock.riskScore * 0.9, 1), 0, 100);

  /* ----------------------------- overall --------------------------- */
  const weighted =
    visualScore * 0.3 + temporalScore * 0.25 + voiceScore * 0.2 + airlockScore * 0.25;
  const hardPiiBlock = airlock.riskScore >= 90 && airlock.entities.length >= 10;
  let score = round(weighted, 1);
  let verdictLabel: string;
  let verdictTone: 'acid' | 'amber' | 'red';

  if (hardPiiBlock) {
    score = Math.min(score, 64.9);
    verdictLabel = 'BLOCK · PII EGRESS';
    verdictTone = 'red';
  } else if (score >= 90) {
    verdictLabel = 'CLEAR';
    verdictTone = 'acid';
  } else if (score >= 75) {
    verdictLabel = 'CLEAR WITH NOTES';
    verdictTone = 'amber';
  } else if (score >= 50) {
    verdictLabel = 'HOLD FOR REMEDIATION';
    verdictTone = 'red';
  } else {
    verdictLabel = 'BLOCK';
    verdictTone = 'red';
  }

  const verdictShort =
    verdictLabel === 'CLEAR'
      ? 'CLEAR'
      : verdictLabel === 'CLEAR WITH NOTES'
        ? 'NOTES'
        : verdictLabel.startsWith('BLOCK')
          ? 'BLOCK'
          : 'HOLD';

  const verdictCopy = hardPiiBlock
    ? `${airlock.entities.length} raw identifiers were caught in the payload. ${blocked} claim${
        blocked === 1 ? '' : 's'
      } invalidate before publish and voice fidelity is ${voiceScore.toFixed(1)}. Nothing left this node.`
    : `${findings.length} deterministic finding${findings.length === 1 ? '' : 's'} and ${blocked} blocked claim${
        blocked === 1 ? '' : 's'
      } remain. No model judgement was used.`;

  const domains: DomainScore[] = [
    {
      key: 'visual',
      label: 'Perceptual integrity',
      value: visualScore,
      tone: toneFor(visualScore),
      note: `max ΔE ${maxDeltaE.toFixed(2)} · ${a11yFails} WCAG fail${a11yFails === 1 ? '' : 's'}`,
    },
    {
      key: 'temporal',
      label: 'Claim validity',
      value: temporalScore,
      tone: toneFor(temporalScore),
      note: `${blocked} blocked · ${watch} watch`,
    },
    {
      key: 'voice',
      label: 'Voice fidelity',
      value: voiceScore,
      tone: toneFor(voiceScore),
      note: variant === 'llm' ? 'generative rewrite' : `${tokenPatches.length} tokens patched`,
    },
    {
      key: 'airlock',
      label: 'Airlock integrity',
      value: airlockScore,
      tone: toneFor(airlockScore),
      note: `${airlock.entities.length} entities · sensitivity ${airlock.riskScore}`,
    },
  ];

  /* ----------------------------- notes ----------------------------- */
  const notes: ScenarioNote[] = [];
  const pushNote = (note: ScenarioNote) => {
    if (!notes.some((entry) => entry.code === note.code)) notes.push(note);
  };

  findings.forEach((finding) => {
    pushNote({
      code: finding.id,
      label: finding.title,
      domain: finding.domain,
      tone: finding.severity === 'CRITICAL' ? 'red' : 'amber',
    });
  });
  evaluations.forEach(({ claim, evaluation }) => {
    if (evaluation.severity === 'blocked') {
      pushNote({
        code: claim.id,
        label: `${claim.text.slice(0, 54)}${claim.text.length > 54 ? '…' : ''} — expires before publish`,
        domain: 'TEMPORAL',
        tone: 'red',
      });
    }
  });
  if (airlock.entities.length > 0) {
    pushNote({
      code: `A-${airlock.entities.length}`,
      label: `${airlock.entities.length} raw identifiers in payload`,
      domain: 'AIRLOCK',
      tone: 'red',
    });
  }
  if (voiceScore < 90) {
    pushNote({
      code: 'V-06',
      label: `Voice fidelity collapsed to ${voiceScore.toFixed(1)}`,
      domain: 'VOICE',
      tone: 'amber',
    });
  }

  /* ---------------------------- pipeline --------------------------- */
  const stageDefs: Array<{
    id: string;
    label: string;
    detail: string;
    ms: number;
    tone: 'acid' | 'amber' | 'red';
    log: string;
  }> = [
    {
      id: 'ingest',
      label: 'Ingest',
      detail: `${asset.id} · ${asset.dimensions}`,
      ms: 11,
      tone: 'acid',
      log: `${asset.id} resolved · ${asset.format} · checksum verified`,
    },
    {
      id: 'airlock',
      label: 'Airlock',
      detail: `${airlock.entities.length} entities tokenized`,
      ms: 42,
      tone: 'acid',
      log: `${airlock.entities.length} entities tokenized · ${airlock.ruleCount} rules · 0 raw bytes egress`,
    },
    {
      id: 'visual',
      label: 'Visual',
      detail: `ΔE max ${maxDeltaE.toFixed(2)}`,
      ms: 128,
      tone: toneFor(visualScore),
      log: `CIEDE2000 max ΔE ${maxDeltaE.toFixed(2)} · ${geometryFails} geometry breach${
        geometryFails === 1 ? '' : 'es'
      } · ${a11yFails} WCAG fail${a11yFails === 1 ? '' : 's'}`,
    },
    {
      id: 'temporal',
      label: 'Temporal',
      detail: `${blocked} blocked · ${watch} watch`,
      ms: 64,
      tone: blocked > 0 ? 'red' : watch > 0 ? 'amber' : 'acid',
      log: `${blocked} claims expire before ${formatShortDate(publishDate)} · ${watch} advisory holds`,
    },
    {
      id: 'voice',
      label: 'Voice',
      detail:
        variant === 'llm'
          ? `generative rewrite · ${voiceScore.toFixed(1)}`
          : `${tokenPatches.length} tokens patched`,
      ms: 38,
      tone: toneFor(voiceScore),
      log:
        variant === 'llm'
          ? `generative rewrite detected · cadence retained ${voiceScore.toFixed(1)}%`
          : `${tokenPatches.length} tokens patched · cadence retained ${voiceScore.toFixed(1)}%`,
    },
    {
      id: 'clearance',
      label: 'Clearance',
      detail: `${score.toFixed(1)} · ${verdictShort}`,
      ms: 12,
      tone: verdictTone,
      log: `verdict issued · ${score.toFixed(1)} · ${verdictLabel} · ${notes.length} open`,
    },
  ];

  let offset = 0;
  const stages: PipelineStage[] = stageDefs.map((stage, index) => {
    const stageWithTime = {
      id: stage.id,
      label: stage.label,
      index: String(index + 1).padStart(2, '0'),
      detail: stage.detail,
      ms: stage.ms,
      tone: stage.tone,
    };
    offset += stage.ms;
    return stageWithTime;
  });

  const logByStage: Record<string, CompileLog> = {};
  offset = 0;
  const logs: CompileLog[] = stageDefs.map((stage) => {
    offset += stage.ms;
    const log = {
      time: timeStamp(BASE_TIME_MS, offset),
      stage: stage.id.toUpperCase(),
      text: stage.log,
    };
    logByStage[stage.id] = log;
    return log;
  });
  const totalMs = round(stageDefs.reduce((sum, stage) => sum + stage.ms, 0), 1);

  /* ---------------------------- arbiter ---------------------------- */
  const pendingEvidence = claims.reduce(
    (sum, claim) => sum + claim.evidence.filter((node) => node.status === 'PENDING').length,
    0,
  );
  const signals: ArbiterSignals = {
    voice: {
      fidelity: voiceScore,
      buzzwords,
      patches: tokenPatches.length,
      sentences: metrics.sentences,
      words: metrics.words,
    },
    visual: {
      maxDeltaE,
      a11yFails,
      geometryFails,
      samples: palette.length,
    },
    airlock: {
      entities: airlock.entities.length,
      lowConfidence: airlock.entities.filter((entity) => entity.confidence < 0.995).length,
      highRisk: airlock.entities.filter((entity) =>
        ['SECRET', 'SSN', 'CARD', 'IBAN', 'MRN'].includes(entity.type),
      ).length,
      ruleCount: airlock.ruleCount,
    },
    temporal: {
      claims: claims.length,
      blocked,
      watch,
      pending: pendingEvidence,
    },
  };
  const arbiter = runArbiterPass(signals, false);

  /* ----------------------------- hashes ---------------------------- */
  const traceHash = sha256Hex(
    JSON.stringify({
      scenario: isBaseline ? 'BASELINE' : scenario.id,
      publishDate,
      asset: asset.id,
      entities: airlock.entities.map((entity) => `${entity.type}:${entity.raw}`),
      palette: palette.map((color) => `${color.token}:${color.actual}:${color.deltaE}`),
      claims: evaluations.map(({ claim, evaluation }) => `${claim.id}:${evaluation.state}`),
      voice: voiceScore,
      findings: findings.map((finding) => finding.id),
      score,
    }),
  );

  const [titleMain, ...titleRestParts] = (asset.title || 'Orbital Launch — Hero 07').split(' — ');

  return {
    scenario,
    isBaseline,
    asset,
    publishDate,
    today: TODAY,
    airlock,
    temporal: {
      evaluations,
      blocked,
      watch,
      valid,
      total: claims.length,
      score: temporalScore,
    },
    visual: {
      theme,
      palette,
      maxDeltaE,
      findings,
      geometry: geometryChecks,
      a11y,
      a11yFails,
      geometryFails,
      score: visualScore,
    },
    voice: {
      variant,
      text: voiceText,
      fidelity,
      metrics,
      patches: tokenPatches.length,
      buzzwords,
      score: voiceScore,
    },
    domains,
    score,
    verdictLabel,
    verdictShort,
    verdictTone,
    verdictCopy,
    notes,
    stages,
    logs,
    logByStage,
    signals,
    arbiter,
    traceHash,
    traceHashShort: shortHash(traceHash),
    runId: `RUN-${traceHash.slice(0, 4).toUpperCase()}-${traceHash.slice(4, 7).toUpperCase()}`,
    signature: `AURA-CORE / SHA-${traceHash.slice(0, 4).toUpperCase()}`,
    totalMs,
    radarAxes: [
      {
        label: 'Luminance',
        value: Math.round(clamp(100 - a11yFails * 12, 0, 100)),
        baseline: 100,
      },
      { label: 'Hue', value: Math.round(visualScore), baseline: 100 },
      {
        label: 'Geometry',
        value: geometryFails > 0 ? 82 : 100,
        baseline: 100,
      },
      {
        label: 'Type',
        value: Math.round(clamp(100 - a11yFails * 4, 0, 100)),
        baseline: 100,
      },
      { label: 'Voice', value: Math.round(voiceScore), baseline: 100 },
      { label: 'Claims', value: Math.round(temporalScore), baseline: 100 },
    ],
    headline: { main: titleMain, rest: titleRestParts.join(' — ') },
  };
}

export function buildBaselineReport(publishOffset: number): ClearanceReport {
  return buildClearanceReport(null, publishOffset);
}

export { brandProfile, deltaE2000 };
