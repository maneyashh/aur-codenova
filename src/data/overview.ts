export type StageStatus = 'queued' | 'running' | 'complete' | 'note';

export type PipelineStage = {
  id: string;
  label: string;
  index: string;
  detail: string;
  ms: number;
  tone: 'acid' | 'amber' | 'red';
};

export const pipelineStages: PipelineStage[] = [
  {
    id: 'ingest',
    label: 'Ingest',
    index: '01',
    detail: 'AST-2291 · 2400×3000',
    ms: 11,
    tone: 'acid',
  },
  {
    id: 'airlock',
    label: 'Airlock',
    index: '02',
    detail: '10 entities tokenized',
    ms: 42,
    tone: 'acid',
  },
  {
    id: 'visual',
    label: 'Visual',
    index: '03',
    detail: 'ΔE max 4.82',
    ms: 128,
    tone: 'amber',
  },
  {
    id: 'temporal',
    label: 'Temporal',
    index: '04',
    detail: '2 claims at risk',
    ms: 64,
    tone: 'red',
  },
  {
    id: 'voice',
    label: 'Voice',
    index: '05',
    detail: '6 tokens patched',
    ms: 38,
    tone: 'acid',
  },
  {
    id: 'clearance',
    label: 'Clearance',
    index: '06',
    detail: '91.4 · 2 notes',
    ms: 12,
    tone: 'amber',
  },
];

export type CompileLog = {
  time: string;
  stage: string;
  text: string;
};

export const stageLogs: Record<string, CompileLog> = {
  ingest: {
    time: '14:31:02.094',
    stage: 'INGEST',
    text: 'AST-2291 resolved · sRGB / 8.42MB · checksum verified',
  },
  airlock: {
    time: '14:31:02.118',
    stage: 'AIRLOCK',
    text: '10 entities tokenized · 0 raw bytes egress',
  },
  visual: {
    time: '14:31:02.341',
    stage: 'VISUAL',
    text: 'CIEDE2000 max ΔE 4.82 · geometry G-01 breach',
  },
  temporal: {
    time: '14:31:02.777',
    stage: 'TEMPORAL',
    text: '2 claims expire before publish window · publish gate held',
  },
  voice: {
    time: '14:31:03.004',
    stage: 'VOICE',
    text: '6 tokens patched · cadence retained 94.6%',
  },
  clearance: {
    time: '14:31:03.216',
    stage: 'CLEARANCE',
    text: 'verdict issued · 91.4 · CLEAR WITH NOTES · 2 open',
  },
};

export const initialCompileLogs: CompileLog[] = [
  stageLogs.airlock,
  stageLogs.visual,
  stageLogs.temporal,
  stageLogs.voice,
  stageLogs.clearance,
];

export type FeedStatus = 'CLEAR' | 'REVIEW' | 'BLOCKED';

export type FeedAsset = {
  id: string;
  name: string;
  channel: string;
  score: string;
  status: FeedStatus;
  age: string;
  kind: 'image' | 'text' | 'deck' | 'film' | 'ui';
  tint: string;
};

export const verdictFeed: FeedAsset[] = [
  {
    id: 'AST-2291',
    name: 'Orbital Hero_07',
    channel: 'Paid / Display',
    score: '91.4',
    status: 'REVIEW',
    age: '12s',
    kind: 'image',
    tint: '#D8FF4F',
  },
  {
    id: 'AST-2288',
    name: 'Solaris Manifesto',
    channel: 'Web / Longform',
    score: '99.1',
    status: 'CLEAR',
    age: '4m',
    kind: 'text',
    tint: '#8AB4FF',
  },
  {
    id: 'AST-2283',
    name: 'Q3 Investor Deck',
    channel: 'PDF / 42pp',
    score: '87.2',
    status: 'REVIEW',
    age: '18m',
    kind: 'deck',
    tint: '#FF6B35',
  },
  {
    id: 'AST-2279',
    name: 'Launch Film 15s',
    channel: 'Video / Social',
    score: '96.8',
    status: 'CLEAR',
    age: '31m',
    kind: 'film',
    tint: '#F2F4EC',
  },
  {
    id: 'AST-2271',
    name: 'Telemetry Interface',
    channel: 'Product / App',
    score: '94.5',
    status: 'CLEAR',
    age: '52m',
    kind: 'ui',
    tint: '#9BB9FF',
  },
  {
    id: 'AST-2266',
    name: 'NIGHTGLASS Teaser',
    channel: 'Email / Internal',
    score: '00.0',
    status: 'BLOCKED',
    age: '1h',
    kind: 'text',
    tint: '#FF5C5C',
  },
];

export const radarAxes = [
  { label: 'Luminance', value: 96, baseline: 100 },
  { label: 'Hue', value: 91, baseline: 100 },
  { label: 'Geometry', value: 82, baseline: 100 },
  { label: 'Type', value: 94, baseline: 100 },
  { label: 'Voice', value: 95, baseline: 100 },
  { label: 'Claims', value: 88, baseline: 100 },
];

export const telemetryDeltas = [
  { label: 'Perceptual drift', value: '96.4', note: 'max ΔE 4.82', tone: 'amber' as const },
  { label: 'Claim validity', value: '74.0', note: '2 expiry blocks', tone: 'red' as const },
  { label: 'Voice fidelity', value: '94.6', note: '6 tokens patched', tone: 'acid' as const },
];

export const clearanceNotes = [
  {
    code: 'F-092',
    label: 'Logo clearspace breached by 6px',
    domain: 'VISUAL',
    tone: 'amber' as const,
  },
  {
    code: 'T-109',
    label: 'Constellation claim expires pre-publish',
    domain: 'TEMPORAL',
    tone: 'red' as const,
  },
];

export const traceSummary = {
  runId: 'RUN-7F2A-091',
  asset: 'ORBITAL_HERO_07',
  campaign: 'ORBITAL_LAUNCH_07',
  score: 91.4,
};
