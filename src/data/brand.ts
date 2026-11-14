import {
  contrastRatio,
  deltaE2000,
  driftVerdict,
  round,
  wcagLevel,
  type DriftVerdict,
  type WCAGLevel,
} from '../core/color';

export type BrandColor = {
  name: string;
  role: string;
  token: string;
  target: string;
  actual: string;
  usage: string;
};

type RawBrandColor = BrandColor;

const rawPalette: RawBrandColor[] = [
  {
    name: 'Solar Lime',
    role: 'Primary signal',
    token: 'HEL-SOLAR-01',
    target: '#D8FF4F',
    actual: '#D3F44A',
    usage: 'Headlines, CTA fields, eclipse rim',
  },
  {
    name: 'Absolute Void',
    role: 'Field',
    token: 'HEL-VOID-00',
    target: '#080A09',
    actual: '#0C100E',
    usage: 'Primary field, negative space',
  },
  {
    name: 'Ember',
    role: 'Alert accent',
    token: 'HEL-EMBER-02',
    target: '#FF6B35',
    actual: '#E85A28',
    usage: 'Secondary data marks',
  },
  {
    name: 'Signal Blue',
    role: 'Data / telemetry',
    token: 'HEL-SIGNAL-04',
    target: '#8AB4FF',
    actual: '#90B7F2',
    usage: 'Telemetry, inline links',
  },
  {
    name: 'Bone',
    role: 'Typography',
    token: 'HEL-BONE-01',
    target: '#F2F4EC',
    actual: '#EDF0E4',
    usage: 'Body, headline reversal',
  },
];

export type PaletteSample = BrandColor & {
  deltaE: number;
  verdict: DriftVerdict;
  ratioOnVoid: number;
};

export const palette: PaletteSample[] = rawPalette.map((color) => ({
  ...color,
  deltaE: round(deltaE2000(color.target, color.actual), 2),
  verdict: driftVerdict(deltaE2000(color.target, color.actual)),
  ratioOnVoid: round(contrastRatio(color.actual, '#080A09'), 2),
}));

export type GeometryCheck = {
  id: string;
  label: string;
  requirement: string;
  measured: string;
  verdict: 'PASS' | 'FAIL';
  note: string;
};

export const geometryChecks: GeometryCheck[] = [
  {
    id: 'G-01',
    label: 'Primary lockup clearspace',
    requirement: '≥ 24 px',
    measured: '18 px',
    verdict: 'FAIL',
    note: 'Ember orbital mark intrudes 6px into the exclusion field.',
  },
  {
    id: 'G-02',
    label: 'Minimum mark width',
    requirement: '≥ 96 px',
    measured: '162 px',
    verdict: 'PASS',
    note: 'Displayed at 1.69× minimum digital width.',
  },
  {
    id: 'G-03',
    label: 'Optical centre tolerance',
    requirement: '≤ 2.0°',
    measured: '1.8°',
    verdict: 'PASS',
    note: 'Measured on the primary mass, not the bounding box.',
  },
  {
    id: 'G-04',
    label: 'Co-brand lockup ratio',
    requirement: '1 : 2.4',
    measured: '1 : 2.4',
    verdict: 'PASS',
    note: 'Companion mark resolves at the contracted optical weight.',
  },
];

export type AccessibilityCheck = {
  id: string;
  label: string;
  foreground: string;
  background: string;
  ratio: number;
  level: WCAGLevel;
  pass: boolean;
  region: { x: number; y: number; width: number; height: number };
  note: string;
};

type RawA11yCheck = Omit<AccessibilityCheck, 'ratio' | 'level' | 'pass'>;

const rawA11yChecks: RawA11yCheck[] = [
  {
    id: 'A-01',
    label: 'Display headline / Void',
    foreground: '#F2F4EC',
    background: '#080A09',
    region: { x: 34, y: 552, width: 500, height: 158 },
    note: 'Ivory on void. AAA normal text.',
  },
  {
    id: 'A-02',
    label: 'Eyebrow / Void',
    foreground: '#D8FF4F',
    background: '#080A09',
    region: { x: 38, y: 530, width: 300, height: 22 },
    note: 'Solar lime micro-label. AAA normal text.',
  },
  {
    id: 'A-03',
    label: 'Primary CTA / Solar',
    foreground: '#080A09',
    background: '#D8FF4F',
    region: { x: 38, y: 762, width: 206, height: 42 },
    note: 'Void on solar. AAA at all sizes.',
  },
  {
    id: 'A-04',
    label: 'Legal micro / Void',
    foreground: '#7C857E',
    background: '#080A09',
    region: { x: 34, y: 838, width: 330, height: 22 },
    note: 'Graphite microcopy. AA normal text.',
  },
  {
    id: 'A-05',
    label: 'Verification decal / Bone',
    foreground: '#D8FF4F',
    background: '#F2F4EC',
    region: { x: 548, y: 486, width: 132, height: 30 },
    note: 'Solar glyph on bone. Fails 3:1 non-text minimum.',
  },
];

export const a11yChecks: AccessibilityCheck[] = rawA11yChecks.map((check) => {
  const ratio = round(contrastRatio(check.foreground, check.background), 2);
  const level = wcagLevel(ratio, false);
  return { ...check, ratio, level, pass: level !== 'Fail' };
});

export const failingA11y = a11yChecks.filter((check) => !check.pass);

export type Finding = {
  id: string;
  domain: 'VISUAL' | 'TEMPORAL' | 'VOICE' | 'AIRLOCK';
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  title: string;
  detail: string;
};

export const visualFindings: Finding[] = [
  {
    id: 'F-092',
    domain: 'VISUAL',
    severity: 'MAJOR',
    title: 'Logo clearspace breached by 6px',
    detail:
      'The orbital mark enters the 24px exclusion field at 18px. Deterministic geometry check G-01.',
  },
  {
    id: 'F-096',
    domain: 'VISUAL',
    severity: 'MINOR',
    title: 'Verification decal fails contrast',
    detail:
      'Solar on bone renders at 1.16:1 — below the 3:1 non-text minimum. Heatmap region A-05.',
  },
];

export const brandProfile = {
  name: 'HELIOS DYNAMICS',
  shortName: 'HELIOS',
  campaign: 'ORBITAL_LAUNCH_07',
  policySet: 'HEL-BRAND-4.2.1',
  operator: 'A. KAUR',
  node: 'LOCAL / S-01',
  integrity: 91.4,
  asset: {
    id: 'AST-2291',
    name: 'ORBITAL_HERO_07',
    dimensions: '2400 × 3000',
    format: 'PNG / sRGB',
    weight: '8.42 MB',
  },
};
