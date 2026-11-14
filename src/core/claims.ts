/**
 * AURA-GOV / Temporal Truth Engine
 * --------------------------------
 * A claim is not a static sentence. It is a contract with a validity window.
 * Every promotional claim is evaluated against the *future publication date*,
 * not the moment it was written.
 */

export type ClaimCategory = 'PROMOTIONAL' | 'PRODUCT' | 'MARKET' | 'LEGAL';

export type EvidenceStatus = 'VERIFIED' | 'PENDING' | 'CONTRADICTED';

export type EvidenceNode = {
  id: string;
  label: string;
  source: string;
  status: EvidenceStatus;
  delta?: string;
};

export type Claim = {
  id: string;
  text: string;
  category: ClaimCategory;
  source: string;
  issued: string;
  expires: string;
  owner: string;
  evidence: EvidenceNode[];
  absoluteLanguage?: boolean;
};

export type TemporalState =
  | 'VALID'
  | 'AT_RISK'
  | 'UNVERIFIED'
  | 'EXPIRES_BEFORE_PUBLISH';

export type TemporalEvaluation = {
  state: TemporalState;
  label: string;
  severity: 'clear' | 'watch' | 'blocked';
  daysToExpiry: number;
  daysUntilPublish: number;
  reason: string;
};

const DAY_MS = 86_400_000;

/** Base "today" for the deterministic demo, pinned for reproducibility. */
export const TODAY = '2026-11-12';

/** Default publication window: 9 days into the future. */
export const DEFAULT_PUBLISH_OFFSET = 9;

export const PUBLISH_OFFSET_MAX = 75;

export const TIMELINE_START = '2026-11-01';
export const TIMELINE_END = '2027-02-15';

export function parseDate(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getTime();
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(new Date(parseDate(iso) + days * DAY_MS));
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseDate(toIso) - parseDate(fromIso)) / DAY_MS);
}

export function formatShortDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    timeZone: 'UTC',
  })
    .format(new Date(parseDate(iso)))
    .toUpperCase();
}

export function formatLongDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  })
    .format(new Date(parseDate(iso)))
    .toUpperCase();
}

export function evaluateClaim(
  claim: Claim,
  publishDate: string,
  today = TODAY,
): TemporalEvaluation {
  const daysToExpiry = daysBetween(today, claim.expires);
  const daysUntilPublish = daysBetween(today, publishDate);
  const publishAfterExpiry = parseDate(publishDate) > parseDate(claim.expires);
  const daysFromPublishToExpiry = daysBetween(publishDate, claim.expires);

  if (publishAfterExpiry) {
    return {
      state: 'EXPIRES_BEFORE_PUBLISH',
      label: 'EXPIRED AT PUBLISH',
      severity: 'blocked',
      daysToExpiry,
      daysUntilPublish,
      reason: `Validity ends ${formatLongDate(claim.expires)} — ${Math.abs(
        daysFromPublishToExpiry,
      )} day(s) before the scheduled publish date.`,
    };
  }

  if (claim.evidence.some((node) => node.status === 'CONTRADICTED')) {
    return {
      state: 'UNVERIFIED',
      label: 'CONTRADICTED',
      severity: 'blocked',
      daysToExpiry,
      daysUntilPublish,
      reason: 'Primary evidence graph contains a live contradiction.',
    };
  }

  if (claim.evidence.some((node) => node.status === 'PENDING')) {
    return {
      state: 'UNVERIFIED',
      label: 'EVIDENCE PENDING',
      severity: 'watch',
      daysToExpiry,
      daysUntilPublish,
      reason: 'Validity window is open, but a supporting evidence node is unresolved.',
    };
  }

  if (daysFromPublishToExpiry <= 7) {
    return {
      state: 'AT_RISK',
      label: 'EXPIRES ≤ 7D',
      severity: 'watch',
      daysToExpiry,
      daysUntilPublish,
      reason: `Claim is live at publish, but expires ${daysFromPublishToExpiry} day(s) later.`,
    };
  }

  return {
    state: 'VALID',
    label: 'VALID',
    severity: 'clear',
    daysToExpiry,
    daysUntilPublish,
    reason: `Evidence complete. Claim remains valid through ${formatLongDate(
      claim.expires,
    )}.`,
  };
}

export const claims: Claim[] = [
  {
    id: 'C-114',
    text: 'Helios captured 42% of the orbital payload market in Q3.',
    category: 'MARKET',
    source: 'Q3 Board Deck / p.18',
    issued: '2026-10-02',
    expires: '2026-12-15',
    owner: 'M. Vale',
    absoluteLanguage: false,
    evidence: [
      {
        id: 'E-221',
        label: 'Orbital Market Index — Q3',
        source: 'Meridian Research',
        status: 'PENDING',
        delta: 'reporting window closes Nov 18',
      },
      {
        id: 'E-224',
        label: 'Internal revenue reconciliation',
        source: 'Finance / Ledger 04',
        status: 'VERIFIED',
      },
    ],
  },
  {
    id: 'C-109',
    text: 'The Solaris constellation is fully deployed and operational.',
    category: 'PRODUCT',
    source: 'Investor Narrative v7',
    issued: '2026-10-18',
    expires: '2026-11-15',
    owner: 'P. Raman',
    evidence: [
      {
        id: 'E-188',
        label: 'Constellation deployment manifest',
        source: 'Flight Ops',
        status: 'VERIFIED',
      },
    ],
  },
  {
    id: 'C-121',
    text: 'Ion drive efficiency improved by 38% in live orbital trials.',
    category: 'PRODUCT',
    source: 'Engineering Brief 22-C',
    issued: '2026-11-01',
    expires: '2026-12-31',
    owner: 'A. Kaur',
    evidence: [
      {
        id: 'E-241',
        label: 'Trial telemetry, 18 Nov burn',
        source: 'Propulsion Lab',
        status: 'VERIFIED',
      },
      {
        id: 'E-242',
        label: 'Independent instrumentation audit',
        source: 'Kepler Verification',
        status: 'VERIFIED',
      },
    ],
  },
  {
    id: 'C-102',
    text: 'Helios will be carbon-neutral across all ground operations by Q1 2027.',
    category: 'LEGAL',
    source: 'ESG Filing 2026',
    issued: '2026-09-20',
    expires: '2027-03-31',
    owner: 'R. Okafor',
    evidence: [
      {
        id: 'E-164',
        label: 'Scope 2 abatement schedule',
        source: 'Sustainability Office',
        status: 'VERIFIED',
      },
      {
        id: 'E-167',
        label: 'Q1 2027 commissioning plan',
        source: 'Ground Ops',
        status: 'VERIFIED',
      },
    ],
  },
  {
    id: 'C-118',
    text: 'The Solaris platform delivers limitless power for every mission.',
    category: 'PROMOTIONAL',
    source: 'Campaign Copy v3',
    issued: '2026-11-05',
    expires: '2026-11-20',
    owner: 'Copy Desk',
    absoluteLanguage: true,
    evidence: [
      {
        id: 'E-251',
        label: 'Claim substantiation dossier',
        source: 'Brand Governance',
        status: 'PENDING',
        delta: 'absolute language flagged by Voice DNA',
      },
    ],
  },
];

export function claimById(id: string): Claim {
  return claims.find((claim) => claim.id === id) ?? claims[0];
}
