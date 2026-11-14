/**
 * AURA-GOV / Zero-Trust Airlock
 * -----------------------------
 * All detection happens on the local node. The external model never receives
 * raw codenames, names, addresses, secrets or network identifiers.
 * A deterministic lexicon + pattern pass produces reversible vault tokens.
 */

export type EntityType =
  | 'CODENAME'
  | 'PROGRAM'
  | 'PERSON'
  | 'EMAIL'
  | 'PHONE'
  | 'SECRET'
  | 'IP'
  | 'ADDRESS';

export type DetectedEntity = {
  id: string;
  raw: string;
  type: EntityType;
  token: string;
  start: number;
  end: number;
  rule: string;
  confidence: number;
};

export type PayloadSegment =
  | { kind: 'text'; text: string }
  | { kind: 'entity'; text: string; entity: DetectedEntity };

export type AirlockReport = {
  entities: DetectedEntity[];
  sanitized: string;
  segments: PayloadSegment[];
  protectedCharacters: number;
  riskScore: number;
  vault: { token: string; type: EntityType; rule: string }[];
};

export const entityTypeMeta: Record<
  EntityType,
  { label: string; short: string; className: string }
> = {
  CODENAME: { label: 'Classified codename', short: 'CDN', className: 'entity-codename' },
  PROGRAM: { label: 'Internal program', short: 'PRG', className: 'entity-program' },
  PERSON: { label: 'Person / PII', short: 'PER', className: 'entity-person' },
  EMAIL: { label: 'Email address', short: 'EML', className: 'entity-email' },
  PHONE: { label: 'Phone number', short: 'TEL', className: 'entity-phone' },
  SECRET: { label: 'API / live secret', short: 'SEC', className: 'entity-secret' },
  IP: { label: 'Internal network', short: 'NET', className: 'entity-ip' },
  ADDRESS: { label: 'Physical facility', short: 'ADR', className: 'entity-address' },
};

const CODENAMES: Array<{ raw: string; type: EntityType; rule: string }> = [
  { raw: 'Project HALCYON', type: 'CODENAME', rule: 'Classified lexicon v9' },
  { raw: 'PROJECT HALCYON', type: 'CODENAME', rule: 'Classified lexicon v9' },
  { raw: 'NIGHTGLASS', type: 'CODENAME', rule: 'Classified lexicon v9' },
  { raw: 'ORBITAL-7', type: 'PROGRAM', rule: 'Program register' },
  { raw: 'SOLARIS', type: 'PROGRAM', rule: 'Program register' },
  { raw: 'MERIDIAN PARK', type: 'ADDRESS', rule: 'Facility lexicon' },
  { raw: 'Meridian Park', type: 'ADDRESS', rule: 'Facility lexicon' },
  { raw: 'Priya Raman', type: 'PERSON', rule: 'PII lexicon' },
  { raw: 'Marcus Vale', type: 'PERSON', rule: 'PII lexicon' },
  { raw: 'A. Kaur', type: 'PERSON', rule: 'PII lexicon' },
];

const PERSON_ALIASES = ['Priya Raman', 'Marcus Vale', 'A. Kaur'];

const PATTERNS: Array<{
  type: EntityType;
  regex: RegExp;
  rule: string;
  confidence: number;
}> = [
  {
    type: 'EMAIL',
    regex: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    rule: 'RFC 5322 local pattern',
    confidence: 0.999,
  },
  {
    type: 'SECRET',
    regex: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{12,}\b/g,
    rule: 'Known key prefix + entropy',
    confidence: 0.997,
  },
  {
    type: 'PHONE',
    regex: /\+\d{1,3}\s?\(\d{3}\)\s?\d{3}-\d{4}\b/g,
    rule: 'NANP / E.164 pattern',
    confidence: 0.996,
  },
  {
    type: 'IP',
    regex: /\b(?:10|127|192\.168|172\.(?:1[6-9]|2\d|3[01]))(?:\.\d{1,3}){2,3}\b/g,
    rule: 'RFC 1918 private range',
    confidence: 0.994,
  },
];

function tokenPrefix(type: EntityType): string {
  if (type === 'CODENAME') return 'CODENAME';
  if (type === 'PROGRAM') return 'PROGRAM';
  if (type === 'PERSON') return 'PERSON';
  if (type === 'EMAIL') return 'EMAIL';
  if (type === 'PHONE') return 'PHONE';
  if (type === 'SECRET') return 'SECRET';
  if (type === 'IP') return 'NODE';
  return 'ADDRESS';
}

function mergeEntities(candidates: Omit<DetectedEntity, 'id' | 'token'>[]): DetectedEntity[] {
  const sorted = [...candidates].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return b.end - b.start - (a.end - a.start);
  });

  const accepted: Omit<DetectedEntity, 'id' | 'token'>[] = [];
  for (const candidate of sorted) {
    const overlaps = accepted.some(
      (existing) => candidate.start < existing.end && candidate.end > existing.start,
    );
    if (!overlaps) accepted.push(candidate);
  }

  const counters = new Map<string, number>();
  const tokenByValue = new Map<string, string>();

  return accepted.map((candidate, index) => {
    const key = `${candidate.type}:${candidate.raw.toLowerCase()}`;
    let token = tokenByValue.get(key);
    if (!token) {
      const prefix = tokenPrefix(candidate.type);
      const next = (counters.get(prefix) ?? 0) + 1;
      counters.set(prefix, next);
      token = `[${prefix}_${String(next).padStart(2, '0')}]`;
      tokenByValue.set(key, token);
    }
    return {
      ...candidate,
      id: `ENT-${String(index + 1).padStart(2, '0')}`,
      token,
    };
  });
}

export function analyzePayload(text: string): AirlockReport {
  const candidates: Omit<DetectedEntity, 'id' | 'token'>[] = [];

  for (const entry of CODENAMES) {
    const escaped = entry.raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      candidates.push({
        raw: match[0],
        type: entry.type,
        start: match.index,
        end: match.index + match[0].length,
        rule: entry.rule,
        confidence: 0.998,
      });
    }
  }

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      candidates.push({
        raw: match[0],
        type: pattern.type,
        start: match.index,
        end: match.index + match[0].length,
        rule: pattern.rule,
        confidence: pattern.confidence,
      });
    }
  }

  // Guard: exact person aliases are captured even without a title prefix.
  for (const name of PERSON_ALIASES) {
    let cursor = text.indexOf(name);
    while (cursor !== -1) {
      candidates.push({
        raw: name,
        type: 'PERSON',
        start: cursor,
        end: cursor + name.length,
        rule: 'PII lexicon',
        confidence: 0.992,
      });
      cursor = text.indexOf(name, cursor + name.length);
    }
  }

  const entities = mergeEntities(candidates);
  const segments: PayloadSegment[] = [];
  let cursor = 0;

  for (const entity of entities) {
    if (entity.start > cursor) {
      segments.push({ kind: 'text', text: text.slice(cursor, entity.start) });
    }
    segments.push({ kind: 'entity', text: entity.raw, entity });
    cursor = entity.end;
  }
  if (cursor < text.length) {
    segments.push({ kind: 'text', text: text.slice(cursor) });
  }

  let sanitized = '';
  for (const segment of segments) {
    sanitized += segment.kind === 'entity' ? segment.entity.token : segment.text;
  }

  const protectedCharacters = entities.reduce((sum, entity) => sum + entity.raw.length, 0);
  const riskScore = Math.min(
    99,
    Math.round(
      (entities.filter((entity) => entity.type === 'SECRET').length * 28 +
        entities.filter((entity) => entity.type === 'CODENAME').length * 18 +
        entities.filter((entity) => entity.type === 'EMAIL').length * 12 +
        entities.filter((entity) => entity.type === 'PERSON').length * 10 +
        entities.filter((entity) => entity.type === 'PHONE').length * 10 +
        entities.filter((entity) => entity.type === 'IP').length * 8 +
        entities.filter((entity) => entity.type === 'ADDRESS').length * 6 +
        entities.filter((entity) => entity.type === 'PROGRAM').length * 8) *
        1.6,
    ),
  );

  return {
    entities,
    sanitized,
    segments,
    protectedCharacters,
    riskScore,
    vault: entities.map((entity) => ({
      token: entity.token,
      type: entity.type,
      rule: entity.rule,
    })),
  };
}

export const AIRLOCK_SAMPLE = `Hi Priya Raman,

Attaching the final copy for Project HALCYON (internal shorthand: NIGHTGLASS). The ORBITAL-7 launch brief is due Friday. Route revisions to priya.raman@heliosdynamics.com or +1 (415) 555-0142.

Staging key: sk_live_51HxQ2e8LmN4pR7tY — do not forward. Marcus Vale (VP, Orbital Systems) will review from Building 4, Meridian Park. Internal node 10.42.7.19 is allowlisted.

— Brand Desk`;

export function maskValue(raw: string): string {
  if (raw.length <= 4) return '••••';
  return `${raw.slice(0, 2)}${'•'.repeat(Math.min(10, raw.length - 4))}${raw.slice(-2)}`;
}
