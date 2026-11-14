import type { Finding } from '../data/brand';

export type ScenarioId = 'visual' | 'privacy';

export type ScenarioTone = 'acid' | 'amber' | 'red' | 'blue';

export type ScenarioTag = {
  label: string;
  tone: ScenarioTone;
};

export type ScenarioNote = {
  code: string;
  label: string;
  domain: 'VISUAL' | 'TEMPORAL' | 'VOICE' | 'AIRLOCK';
  tone: 'red' | 'amber';
};

export type PosterTheme = {
  accent: string;
  ink: string;
  fieldTop: string;
  fieldMid: string;
  fieldBottom: string;
  glow: string;
  grid: string;
  campaign: string;
  dateLine: string;
  vertical: string;
  decal: string;
  decalInk: string;
  eyebrow: string;
  headline: string;
  headlineAccent: string;
  subline: string;
  cta: string;
  footerLeft: string;
  footerRight: string;
  promo?: { code: string; expiry: string };
};

export type ScenarioAsset = {
  id: string;
  name: string;
  file: string;
  dimensions: string;
  format: string;
  weight: string;
  channel: string;
  title: string;
  subtitle: string;
};

export type ScenarioCommand = {
  caption: string;
  captionTag: string;
  captionTone: ScenarioTone;
  verdictScore: number;
  verdictLabel: string;
  verdictTone: 'amber' | 'red';
  verdictCopy: string;
  signature: string;
  notes: ScenarioNote[];
};

export type ScenarioVisual = {
  score: number;
  state: string;
  copy: string;
  stamp: string;
  findings: Finding[];
};

export type Scenario = {
  id: ScenarioId;
  code: string;
  index: string;
  title: string;
  subtitle: string;
  summary: string;
  accent: string;
  accentSoft: string;
  tags: ScenarioTag[];
  asset: ScenarioAsset;
  command: ScenarioCommand;
  poster: PosterTheme;
  palette?: Partial<Record<'signal' | 'field' | 'ember' | 'bone', string>>;
  visual: ScenarioVisual;
  airlockPayload: string;
  voiceVariant: 'surgical' | 'llm';
  publishOffset: number;
};

export type SimPhase = 'gateway' | 'tour' | 'free';

export type TourStep = {
  id: 'run' | 'trace' | 'remediate';
  target: string;
  eyebrow: string;
  title: string;
  body: string;
  cta: string;
  doneCta: string;
  placement: 'bottom' | 'top';
};
