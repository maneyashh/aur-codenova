import {
  contrastRatio,
  deltaE2000,
  driftVerdict,
  round,
} from '../core/color';
import { palette, type PaletteSample } from '../data/brand';
import type { PosterTheme, Scenario, ScenarioId, TourStep } from './types';

/**
 * JUDGE SIMULATION / scenario data
 * --------------------------------
 * Scenario content is presentation data only. Every verdict, ΔE value and
 * fidelity score is still computed by the deterministic engines in src/core.
 */

export const DEFAULT_POSTER: PosterTheme = {
  accent: '#D8FF4F',
  ink: '#F2F4EC',
  fieldTop: '#0A0E0C',
  fieldMid: '#070A08',
  fieldBottom: '#050706',
  glow: '#D8FF4F',
  grid: '#F2F4EC',
  campaign: 'CAMPAIGN 07 / ORBITAL',
  dateLine: 'NOV 2026 · S-01',
  vertical: 'ORBITAL ENERGY PLATFORM / SERIES 07',
  decal: 'AURA VERIFIED',
  decalInk: '#D8FF4F',
  eyebrow: 'ORBITAL ENERGY — SERIES 07',
  headline: 'BEYOND',
  headlineAccent: 'HORIZON',
  subline: 'Continuous power at the edge of the map.',
  cta: 'REQUEST MISSION BRIEF',
  footerLeft: '© 2026 HELIOS DYNAMICS · ALL SYSTEMS NOMINAL',
  footerRight: 'ORB-07 / 04',
};

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  visual: {
    id: 'visual',
    code: 'DATASET A',
    index: '01',
    title: 'Visual & Temporal Crisis',
    subtitle: 'Orbital Launch — Hero 07',
    summary:
      'A hero poster is about to ship in off-brand magenta, with a promo code that expired three weeks before the publish window.',
    accent: '#FF5C7A',
    accentSoft: 'rgba(255, 92, 122, 0.16)',
    tags: [
      { label: 'ΔE 73.1 drift', tone: 'red' },
      { label: 'G-01 breach', tone: 'amber' },
      { label: 'Promo expired', tone: 'red' },
    ],
    asset: {
      id: 'AST-2291',
      name: 'ORBITAL_HERO_07',
      file: 'orbital_hero_07_flash.png',
      dimensions: '2400 × 3000',
      format: 'PNG / sRGB',
      weight: '8.42 MB',
      channel: 'Paid / Display',
      title: 'Orbital Launch — Flash Sale',
      subtitle: 'Hero 07 · promo variant',
    },
    command: {
      caption:
        'BEYOND HORIZON. Save 30% with code ORBIT30 — offer ends 31 OCT 2026.',
      captionTag: 'PROMO EXPIRED',
      captionTone: 'red',
      verdictScore: 74.8,
      verdictLabel: 'HOLD FOR REMEDIATION',
      verdictTone: 'red',
      verdictCopy:
        'Two deterministic blockers: primary signal drift and a dead promotional claim. No model judgement was used.',
      signature: 'AURA-CORE / SHA-4B71',
      notes: [
        { code: 'F-101', label: 'Primary signal drift ΔE 73.1', domain: 'VISUAL', tone: 'red' },
        { code: 'C-118', label: 'Promo expired before publish', domain: 'TEMPORAL', tone: 'amber' },
      ],
    },
    poster: {
      ...DEFAULT_POSTER,
      accent: '#FF4D6D',
      ink: '#F7EFEA',
      fieldTop: '#170A11',
      fieldMid: '#10070C',
      fieldBottom: '#080306',
      glow: '#FF4D6D',
      grid: '#FFD9E1',
      campaign: 'CAMPAIGN 07 / FLASH',
      dateLine: 'OCT 2026 · S-01',
      vertical: 'ORBITAL ENERGY PLATFORM / PROMO 30',
      decal: 'OFF-BRAND',
      decalInk: '#B3123C',
      eyebrow: 'ORBITAL ENERGY — LIMITED OFFER',
      headline: 'BEYOND',
      headlineAccent: 'HORIZON',
      subline: 'Save 30% with code ORBIT30 — offer ends 31 Oct.',
      cta: 'CLAIM 30% OFF',
      footerLeft: '© 2026 HELIOS DYNAMICS · PROMO EXPIRED 31 OCT 2026',
      footerRight: 'ORB-07 / PROMO',
      promo: { code: 'ORBIT30', expiry: 'EXPIRED 31 OCT 2026' },
    },
    palette: {
      signal: '#FF4D6D',
      field: '#1A0B12',
      ember: '#C2185B',
      bone: '#F6E9E4',
    },
    visual: {
      score: 74.8,
      state: 'HOLD FOR REMEDIATION',
      copy:
        'Off-brand magenta replaces the primary signal, the promo claim is dead on arrival, and the lockup still breaches clearspace.',
      stamp: 'PASS 121ms · 41 RULES',
      findings: [
        {
          id: 'F-101',
          domain: 'VISUAL',
          severity: 'CRITICAL',
          title: 'Primary signal replaced by off-brand magenta',
          detail:
            'Measured ΔE 73.1 against HEL-SOLAR-01 — 29× the ΔE 2.5 contract. Deterministic, not perceptual opinion.',
        },
        {
          id: 'F-104',
          domain: 'TEMPORAL',
          severity: 'MAJOR',
          title: 'Promo code ORBIT30 expired 31 Oct 2026',
          detail:
            'Caption ships a dead offer into a November publish window. Claim C-118 is expired at publication.',
        },
        {
          id: 'F-092',
          domain: 'VISUAL',
          severity: 'MAJOR',
          title: 'Logo clearspace breached by 6px',
          detail:
            'The orbital mark enters the 24px exclusion field at 18px. Deterministic geometry check G-01.',
        },
      ],
    },
    airlockPayload: `ORBITAL_LAUNCH_07 / CAPTION PACK — DO NOT DISTRIBUTE

Headline: BEYOND HORIZON.
Caption: Save 30% on the Orbital Energy Platform with code ORBIT30. Offer ends 31 OCT 2026 — book your mission brief before the window closes.

Approval chain: Priya Raman (Copy Desk) · priya.raman@heliosdyn.com
Asset: AST-2291 / 2400 × 3000 / sRGB
Program: ORBITAL-7`,
    voiceVariant: 'surgical',
    publishOffset: 21,
  },

  privacy: {
    id: 'privacy',
    code: 'DATASET B',
    index: '02',
    title: 'Privacy & Voice DNA Breach',
    subtitle: 'Wire Draft — Press Release 11',
    summary:
      'A press release is queued for the wire with raw PII in the body and a paragraph of model-generated slop where the author used to be.',
    accent: '#C7A2FF',
    accentSoft: 'rgba(199, 162, 255, 0.16)',
    tags: [
      { label: '14 PII entities', tone: 'red' },
      { label: 'Fidelity 50.9', tone: 'amber' },
      { label: '0 vault tokens', tone: 'red' },
    ],
    asset: {
      id: 'PR-0011',
      name: 'PRESS_RELEASE_11',
      file: 'wire_draft_pr11.docx',
      dimensions: '1,840 words',
      format: 'DOCX / UTF-8',
      weight: '412 KB',
      channel: 'Wire / Global',
      title: 'Helios Dynamics — Series B',
      subtitle: 'Press release · unredacted draft',
    },
    command: {
      caption:
        'Media contact Priya Raman · priya.raman@heliosdyn.com · +1 (415) 555-0142 · key sk_live_4f9c…',
      captionTag: 'RAW PII',
      captionTone: 'red',
      verdictScore: 81.3,
      verdictLabel: 'BLOCK · PII EGRESS',
      verdictTone: 'red',
      verdictCopy:
        'Fourteen identifiers and one generative rewrite were caught locally. Nothing left the node.',
      signature: 'AURA-CORE / SHA-7D02',
      notes: [
        { code: 'A-14', label: '14 raw identifiers in payload', domain: 'AIRLOCK', tone: 'red' },
        { code: 'V-06', label: 'Voice fidelity collapsed to 50.9', domain: 'VOICE', tone: 'amber' },
      ],
    },
    poster: DEFAULT_POSTER,
    visual: {
      score: 91.4,
      state: 'CLEAR WITH NOTES',
      copy:
        'The specimen itself is compliant. The breach lives in the text payload — see the Airlock and Voice DNA.',
      stamp: 'PASS 128ms · 41 RULES',
      findings: [
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
      ],
    },
    airlockPayload: `FOR IMMEDIATE RELEASE — HELIOS DYNAMICS / ORBITAL-7

HELIOS DYNAMICS UNVEILS A REVOLUTIONARY, FUTURE-READY ENERGY PLATFORM

LONDON — Helios Dynamics today announced a transformative new chapter in orbital energy, unlocking unparalleled performance for every mission across the globe. Our innovative, best-in-class solution empowers stakeholders to elevate operations and deliver exceptional outcomes at every stage of the journey.

"This is a game-changing moment for the entire industry," said Priya Raman, Chief Communications Officer. "Helios is uniquely positioned to leverage synergistic capabilities and drive meaningful impact at scale."

Media contact: Priya Raman, priya.raman@heliosdyn.com, +1 (415) 555-0142.
After hours: Marcus Vale, +1 (415) 555-0177.
Secure drop: sk_live_4f9c2a7b8e1d6f3a9c0b
Internal relay: 10.42.18.7
Briefings at Meridian Park, Building 4.

Program notes: Project HALCYON remains the primary vehicle for NIGHTGLASS and SOLARIS. Do not reference ORBITAL-7 cost basis.`,
    voiceVariant: 'llm',
    publishOffset: 9,
  },
};

export const SCENARIO_LIST: Scenario[] = [SCENARIOS.visual, SCENARIOS.privacy];

const PALETTE_KEYS: Record<string, 'signal' | 'field' | 'ember' | 'bone'> = {
  'HEL-SOLAR-01': 'signal',
  'HEL-VOID-00': 'field',
  'HEL-EMBER-02': 'ember',
  'HEL-BONE-01': 'bone',
};

/**
 * Recomputes the palette readout from the scenario's rendered colours.
 * The math is unchanged — only the sampled values differ.
 */
export function paletteForScenario(scenario: Scenario | null): PaletteSample[] {
  if (!scenario?.palette) return palette;

  return palette.map((color) => {
    const key = PALETTE_KEYS[color.token];
    const actual = (key && scenario.palette?.[key]) || color.actual;
    const delta = deltaE2000(color.target, actual);
    return {
      ...color,
      actual,
      deltaE: round(delta, 2),
      verdict: driftVerdict(delta),
      ratioOnVoid: round(contrastRatio(actual, '#080A09'), 2),
    };
  });
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'run',
    target: 'run',
    eyebrow: 'STEP 01 / EXECUTE',
    title: 'Run the deterministic scan',
    body: 'Execute the local deterministic scan. Every stage runs in this browser tab — no model call, no upload, no queue.',
    cta: 'Run scan',
    doneCta: 'Continue',
    placement: 'bottom',
  },
  {
    id: 'trace',
    target: 'trace',
    eyebrow: 'STEP 02 / PROVE',
    title: 'Math, not guesses',
    body: 'AURA-GOV computes visual physics and PII redaction entirely locally. Zero external models used.',
    cta: 'Next',
    doneCta: 'Next',
    placement: 'bottom',
  },
  {
    id: 'remediate',
    target: 'remediate',
    eyebrow: 'STEP 03 / REMEDIATE',
    title: 'Repair without rewriting',
    body: 'Apply a surgical voice-preserving patch. Six token swaps, zero sentence regenerated, authorship intact.',
    cta: 'Apply surgical patch',
    doneCta: 'Apply surgical patch',
    placement: 'top',
  },
];
