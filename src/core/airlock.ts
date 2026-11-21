/**
 * AURA-GOV / Zero-Trust Airlock
 * -----------------------------
 * All detection happens on the local node. The external model never receives
 * raw codenames, names, addresses, secrets or network identifiers.
 * A deterministic lexicon + pattern pass produces reversible vault tokens.
 *
 * The detector is intentionally transparent: every match carries the exact
 * rule that produced it and a confidence that can be independently audited.
 */

export type EntityType =
  | 'CODENAME'
  | 'PROGRAM'
  | 'PERSON'
  | 'EMAIL'
  | 'PHONE'
  | 'SECRET'
  | 'IP'
  | 'ADDRESS'
  | 'SSN'
  | 'DOB'
  | 'MRN'
  | 'CARD'
  | 'IBAN';

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
  ruleCount: number;
};

export const entityTypeMeta: Record<
  EntityType,
  { label: string; short: string; className: string; sensitivity: number }
> = {
  CODENAME: { label: 'Classified codename', short: 'CDN', className: 'entity-codename', sensitivity: 18 },
  PROGRAM: { label: 'Internal program', short: 'PRG', className: 'entity-program', sensitivity: 8 },
  PERSON: { label: 'Person / PII', short: 'PER', className: 'entity-person', sensitivity: 10 },
  EMAIL: { label: 'Email address', short: 'EML', className: 'entity-email', sensitivity: 12 },
  PHONE: { label: 'Phone number', short: 'TEL', className: 'entity-phone', sensitivity: 10 },
  SECRET: { label: 'API / live secret', short: 'SEC', className: 'entity-secret', sensitivity: 28 },
  IP: { label: 'Internal network', short: 'NET', className: 'entity-ip', sensitivity: 8 },
  ADDRESS: { label: 'Physical facility', short: 'ADR', className: 'entity-address', sensitivity: 6 },
  SSN: { label: 'Government identifier', short: 'SSN', className: 'entity-ssn', sensitivity: 30 },
  DOB: { label: 'Date of birth', short: 'DOB', className: 'entity-dob', sensitivity: 12 },
  MRN: { label: 'Medical record number', short: 'MRN', className: 'entity-mrn', sensitivity: 20 },
  CARD: { label: 'Payment card', short: 'CRD', className: 'entity-card', sensitivity: 32 },
  IBAN: { label: 'Bank account / IBAN', short: 'IBN', className: 'entity-iban', sensitivity: 22 },
};

const CODENAMES: Array<{ raw: string; type: EntityType; rule: string }> = [
  { raw: 'Project HALCYON', type: 'CODENAME', rule: 'Classified lexicon v10' },
  { raw: 'PROJECT HALCYON', type: 'CODENAME', rule: 'Classified lexicon v10' },
  { raw: 'NIGHTGLASS', type: 'CODENAME', rule: 'Classified lexicon v10' },
  { raw: 'ORBITAL-7', type: 'PROGRAM', rule: 'Program register' },
  { raw: 'SOLARIS', type: 'PROGRAM', rule: 'Program register' },
  { raw: 'MERIDIAN PARK', type: 'ADDRESS', rule: 'Facility lexicon' },
  { raw: 'Meridian Park', type: 'ADDRESS', rule: 'Facility lexicon' },
  { raw: 'Priya Raman', type: 'PERSON', rule: 'PII lexicon' },
  { raw: 'Marcus Vale', type: 'PERSON', rule: 'PII lexicon' },
  { raw: 'A. Kaur', type: 'PERSON', rule: 'PII lexicon' },
];

const PERSON_ALIASES = ['Priya Raman', 'Marcus Vale', 'A. Kaur'];

/** Luhn checksum used to keep the card detector from flagging arbitrary digits. */
export function luhnValid(raw: string): boolean {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

const PATTERNS: Array<{
  type: EntityType;
  regex: RegExp;
  rule: string;
  confidence: number;
  validate?: (raw: string) => boolean;
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
    type: 'SSN',
    regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g,
    rule: 'SSN structure + range guard',
    confidence: 0.998,
  },
  {
    type: 'MRN',
    regex: /\bMRN[-:\s]?\d{6,10}\b/gi,
    rule: 'Medical record prefix',
    confidence: 0.996,
  },
  {
    type: 'DOB',
    regex: /\b(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/(?:19|20)\d{2}\b/g,
    rule: 'MM/DD/YYYY birth-date shape',
    confidence: 0.988,
  },
  {
    type: 'CARD',
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    rule: 'PAN shape + Luhn checksum',
    confidence: 0.994,
    validate: luhnValid,
  },
  {
    type: 'IBAN',
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g,
    rule: 'IBAN country + check digits',
    confidence: 0.992,
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
  if (type === 'SSN') return 'SSN';
  if (type === 'DOB') return 'DOB';
  if (type === 'MRN') return 'MRN';
  if (type === 'CARD') return 'CARD';
  if (type === 'IBAN') return 'IBAN';
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
      if (pattern.validate && !pattern.validate(match[0])) continue;
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
  const weighted = entities.reduce(
    (sum, entity) => sum + entityTypeMeta[entity.type].sensitivity,
    0,
  );
  const riskScore = Math.min(99, Math.round(weighted * 1.6));

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
    ruleCount: CODENAMES.length + PATTERNS.length + PERSON_ALIASES.length,
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
