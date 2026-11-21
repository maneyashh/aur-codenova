/**
 * Feed fixtures only. Pipeline stages, trace logs, verdict notes and radar axes
 * are derived per dataset in `src/core/compiler.ts` — never hard-coded here.
 */

export type PipelineStage = {
  id: string;
  label: string;
  index: string;
  detail: string;
  ms: number;
  tone: 'acid' | 'amber' | 'red';
};

export type CompileLog = {
  time: string;
  stage: string;
  text: string;
};

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

/** Historical queue. The first row is always replaced by the live clearance. */
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
