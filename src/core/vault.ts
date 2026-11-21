/**
 * AURA-GOV / Enterprise Multi-Tenant Policy Vault
 * -----------------------------------------------
 * A governance layer on top of the real airlock detector. Detection still
 * comes from analyzePayload(); each tenant profile decides which detected
 * classes are vaulted, which pass, how risk is weighted, and how long tokens
 * live. A chained SHA-256 ledger records every policy action with actor,
 * timestamp and payload hash.
 *
 * Tokens are minted per issuance with a random suffix, so "re-issue" genuinely
 * produces fresh tokens instead of restoring the previous values. The ledger is
 * persisted in localStorage and can be verified (or deliberately tampered with)
 * from the UI.
 */
import {
  analyzePayload,
  entityTypeMeta,
  type AirlockReport,
  type DetectedEntity,
  type EntityType,
} from './airlock';

export type TenantId = 'TENANT-FINTECH' | 'TENANT-HIPAA' | 'TENANT-RETAIL';
export type VaultRole = 'OPERATOR' | 'AUDITOR';

export interface TenantProfile {
  id: TenantId;
  name: string;
  framework: string;
  redacts: readonly EntityType[];
  allowList: readonly string[];
  tokenTtlMin: number;
  riskMultiplier: number;
  egressLock: 'STRICT EGRESS LOCK' | 'HARDWARE-BOUND SEAL' | 'STANDARD EGRESS';
}

export const REVOKED_TOKEN = '[REVOKED_VAULT_TOKEN]';
export const EXPIRED_TOKEN = '[EXPIRED_VAULT_TOKEN]';

export const TENANT_ORDER: readonly TenantId[] = [
  'TENANT-FINTECH',
  'TENANT-HIPAA',
  'TENANT-RETAIL',
];

const ALL_TYPES: readonly EntityType[] = [
  'CODENAME',
  'PROGRAM',
  'PERSON',
  'EMAIL',
  'PHONE',
  'SECRET',
  'IP',
  'ADDRESS',
  'SSN',
  'DOB',
  'MRN',
  'CARD',
  'IBAN',
];

export const TENANTS: Record<TenantId, TenantProfile> = {
  'TENANT-FINTECH': {
    id: 'TENANT-FINTECH',
    name: 'Strict FinTech',
    framework: 'SOC2 / PII',
    redacts: ALL_TYPES,
    allowList: [],
    tokenTtlMin: 15,
    riskMultiplier: 1.8,
    egressLock: 'STRICT EGRESS LOCK',
  },
  'TENANT-HIPAA': {
    id: 'TENANT-HIPAA',
    name: 'Healthcare HIPAA',
    framework: 'PHI Guard',
    redacts: ALL_TYPES.filter((type) => type !== 'PROGRAM'),
    allowList: [],
    tokenTtlMin: 30,
    riskMultiplier: 1.5,
    egressLock: 'HARDWARE-BOUND SEAL',
  },
  'TENANT-RETAIL': {
    id: 'TENANT-RETAIL',
    name: 'Global Retail',
    framework: 'GDPR Standard',
    redacts: ['PERSON', 'EMAIL', 'PHONE', 'SECRET', 'IP', 'SSN', 'DOB', 'CARD', 'IBAN'],
    allowList: ['ORBITAL-7', 'SOLARIS'],
    tokenTtlMin: 60,
    riskMultiplier: 1.0,
    egressLock: 'STANDARD EGRESS',
  },
};

const RISK_WEIGHT: Record<EntityType, number> = Object.fromEntries(
  (Object.keys(entityTypeMeta) as EntityType[]).map((type) => [
    type,
    entityTypeMeta[type].sensitivity,
  ]),
) as Record<EntityType, number>;

export interface VaultRow {
  entity: DetectedEntity;
  redacted: boolean;
  allowListed: boolean;
  /** What actually crosses the perimeter for this entity. */
  token: string;
}

export interface VaultIssuance {
  id: string;
  issuedAt: number;
  ttlMin: number;
  tenantId: TenantId;
  revoked: boolean;
  tokens: Record<string, string>;
}

export interface VaultView {
  profile: TenantProfile;
  rows: VaultRow[];
  egress: string;
  /** Sensitivity intercepted by the vault (0-99). */
  risk: number;
  /** Sensitivity still crossing the perimeter after policy (0-99). */
  residualRisk: number;
  redactedCount: number;
  passthroughCount: number;
  protectedCharacters: number;
  revoked: boolean;
  expired: boolean;
  blocked: boolean;
  issuedAt: number;
  expiresAt: number;
  remainingMs: number;
  tokenCount: number;
}

function randomSuffix(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(2);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  }
  return Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0')
    .toUpperCase();
}

function tokenPrefix(type: EntityType): string {
  const map: Partial<Record<EntityType, string>> = {
    CODENAME: 'CODENAME',
    PROGRAM: 'PROGRAM',
    PERSON: 'PERSON',
    EMAIL: 'EMAIL',
    PHONE: 'PHONE',
    SECRET: 'SECRET',
    IP: 'NODE',
    ADDRESS: 'ADDRESS',
    SSN: 'SSN',
    DOB: 'DOB',
    MRN: 'MRN',
    CARD: 'CARD',
    IBAN: 'IBAN',
  };
  return map[type] ?? 'ENTITY';
}

export function mintIssuance(
  report: AirlockReport,
  tenantId: TenantId,
  now = Date.now(),
): VaultIssuance {
  const profile = TENANTS[tenantId];
  const tokens: Record<string, string> = {};
  const counters = new Map<string, number>();

  for (const entity of report.entities) {
    const prefix = tokenPrefix(entity.type);
    const next = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, next);
    tokens[entity.id] = `[${prefix}_${String(next).padStart(2, '0')}-${randomSuffix()}]`;
  }

  return {
    id: `ISS-${randomSuffix()}${randomSuffix()}`,
    issuedAt: now,
    ttlMin: profile.tokenTtlMin,
    tenantId,
    revoked: false,
    tokens,
  };
}

/** Apply a tenant policy to an existing airlock report. */
export function applyTenantPolicy(
  report: AirlockReport,
  tenantId: TenantId,
  issuance: VaultIssuance,
  now = Date.now(),
): VaultView {
  const profile = TENANTS[tenantId];
  const expired = now >= issuance.issuedAt + issuance.ttlMin * 60_000;
  const blocked = issuance.revoked || expired;

  const rows: VaultRow[] = report.entities.map((entity) => {
    const allowListed = profile.allowList.some(
      (entry) => entry.toLowerCase() === entity.raw.toLowerCase(),
    );
    const redacted = profile.redacts.includes(entity.type) && !allowListed;
    const token = redacted
      ? blocked
        ? expired
          ? EXPIRED_TOKEN
          : REVOKED_TOKEN
        : issuance.tokens[entity.id] ?? entity.token
      : entity.raw;
    return { entity, redacted, allowListed, token };
  });

  const byId = new Map(rows.map((row) => [row.entity.id, row] as const));

  let egress = '';
  for (const segment of report.segments) {
    if (segment.kind === 'text') {
      egress += segment.text;
    } else {
      egress += byId.get(segment.entity.id)?.token ?? segment.text;
    }
  }

  const redactedRows = rows.filter((row) => row.redacted);
  const passthroughSensitive = rows.filter((row) => !row.redacted && !row.allowListed);
  const base = redactedRows.reduce((sum, row) => sum + RISK_WEIGHT[row.entity.type], 0);
  const passthrough = passthroughSensitive.reduce(
    (sum, row) => sum + RISK_WEIGHT[row.entity.type],
    0,
  );
  const risk = Math.min(99, Math.round(base * 1.6 * profile.riskMultiplier));
  const residualRisk = Math.min(99, Math.round(passthrough * 1.6 * profile.riskMultiplier));

  return {
    profile,
    rows,
    egress,
    risk,
    residualRisk,
    redactedCount: redactedRows.length,
    passthroughCount: rows.length - redactedRows.length,
    protectedCharacters: redactedRows.reduce((sum, row) => sum + row.entity.raw.length, 0),
    revoked: issuance.revoked,
    expired,
    blocked,
    issuedAt: issuance.issuedAt,
    expiresAt: issuance.issuedAt + issuance.ttlMin * 60_000,
    remainingMs: Math.max(0, issuance.issuedAt + issuance.ttlMin * 60_000 - now),
    tokenCount: redactedRows.length,
  };
}

/** Convenience: run the real airlock detector, then apply the tenant policy. */
export function evaluateVault(
  text: string,
  tenantId: TenantId,
  issuance: VaultIssuance,
) {
  const report = analyzePayload(text);
  return { report, view: applyTenantPolicy(report, tenantId, issuance) };
}

export function issuanceFor(report: AirlockReport, tenantId: TenantId): VaultIssuance {
  return mintIssuance(report, tenantId);
}

/* ------------------------------------------------------------------ */
/* Role-based access control                                           */
/* ------------------------------------------------------------------ */

export type VaultCapability =
  | 'SWITCH_POLICY'
  | 'REVOKE'
  | 'REISSUE'
  | 'APPROVE_EGRESS'
  | 'TAMPER_TEST';

const CAPABILITIES: Record<VaultRole, readonly VaultCapability[]> = {
  OPERATOR: ['SWITCH_POLICY', 'REVOKE', 'REISSUE', 'APPROVE_EGRESS', 'TAMPER_TEST'],
  AUDITOR: ['SWITCH_POLICY', 'TAMPER_TEST'],
};

export function can(role: VaultRole, capability: VaultCapability): boolean {
  return CAPABILITIES[role].includes(capability);
}

/* ------------------------------------------------------------------ */
/* Synchronous SHA-256 (deterministic; no async Web Crypto round-trip)  */
/* ------------------------------------------------------------------ */

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const length = bytes.length;
  const padded = new Uint8Array(((length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((length * 8) / 0x100000000));
  view.setUint32(padded.length - 4, (length * 8) >>> 0);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const W = new Uint32Array(64);
  const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) >>> 0;
    }
    let a = H[0];
    let b = H[1];
    let c = H[2];
    let d = H[3];
    let e = H[4];
    let f = H[5];
    let g = H[6];
    let h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + W[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) >>> 0;
    }
    H[0] += a;
    H[1] += b;
    H[2] += c;
    H[3] += d;
    H[4] += e;
    H[5] += f;
    H[6] += g;
    H[7] += h;
  }
  return Array.from(H, (word) => word.toString(16).padStart(8, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Chained audit ledger                                                */
/* ------------------------------------------------------------------ */

export const GENESIS_HASH = '0'.repeat(64);

export interface LedgerEntry {
  seq: number;
  timestamp: string;
  actor: string;
  role: VaultRole;
  tenantId: TenantId;
  action: string;
  entityCount: number;
  payloadHash: string;
  prevHash: string;
  hash: string;
}

export type LedgerInput = {
  tenantId: TenantId;
  action: string;
  entityCount: number;
  payloadHash: string;
  actor?: string;
  role?: VaultRole;
  timestamp?: string;
};

export function computeVaultReceipt(
  prevHash: string,
  entry: Omit<LedgerEntry, 'hash' | 'prevHash'>,
): string {
  return sha256Hex(
    [
      prevHash,
      entry.seq,
      entry.timestamp,
      entry.actor,
      entry.role,
      entry.tenantId,
      entry.action,
      entry.entityCount,
      entry.payloadHash,
    ].join('|'),
  );
}

export function appendReceipt(
  ledger: readonly LedgerEntry[],
  input: LedgerInput,
): LedgerEntry[] {
  const prevHash = ledger.length ? ledger[ledger.length - 1].hash : GENESIS_HASH;
  const draft: Omit<LedgerEntry, 'hash' | 'prevHash'> = {
    seq: ledger.length,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actor: input.actor ?? 'A. KAUR',
    role: input.role ?? 'OPERATOR',
    tenantId: input.tenantId,
    action: input.action,
    entityCount: input.entityCount,
    payloadHash: input.payloadHash,
  };
  return [...ledger, { ...draft, prevHash, hash: computeVaultReceipt(prevHash, draft) }];
}

/** Recomputes every link. Returns the index of the first broken receipt, or -1 if intact. */
export function findLedgerBreak(ledger: readonly LedgerEntry[]): number {
  let prev = GENESIS_HASH;
  for (let index = 0; index < ledger.length; index += 1) {
    const entry = ledger[index];
    const expected = computeVaultReceipt(prev, entry);
    if (entry.prevHash !== prev || entry.hash !== expected) return index;
    prev = entry.hash;
  }
  return -1;
}

/** Deliberately mutates one receipt so the UI can prove tamper detection is real. */
export function tamperLedger(ledger: readonly LedgerEntry[], index: number): LedgerEntry[] {
  if (!ledger.length) return [];
  const target = Math.max(0, Math.min(index, ledger.length - 1));
  return ledger.map((entry, entryIndex) =>
    entryIndex === target
      ? { ...entry, action: `${entry.action}_TAMPERED`, entityCount: entry.entityCount + 7 }
      : entry,
  );
}

export const shortHash = (hash: string): string => `${hash.slice(0, 6)}…${hash.slice(-4)}`;

export const LEDGER_KEY = 'aura-gov.vault.ledger.v2';

export function genesisLedger(): LedgerEntry[] {
  return appendReceipt([], {
    tenantId: 'TENANT-FINTECH',
    action: 'LEDGER_INIT',
    entityCount: 0,
    payloadHash: sha256Hex('AURA-GOV/GENESIS'),
    actor: 'SYSTEM',
    role: 'AUDITOR',
    timestamp: '2026-11-12T00:00:00.000Z',
  });
}

export function loadLedger(): LedgerEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) return genesisLedger();
  try {
    const raw = window.localStorage.getItem(LEDGER_KEY);
    if (!raw) return genesisLedger();
    const parsed = JSON.parse(raw) as LedgerEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return genesisLedger();
    const valid = parsed.every(
      (entry) =>
        typeof entry.hash === 'string' &&
        typeof entry.prevHash === 'string' &&
        typeof entry.timestamp === 'string' &&
        typeof entry.seq === 'number',
    );
    return valid ? parsed : genesisLedger();
  } catch {
    return genesisLedger();
  }
}

export function saveLedger(ledger: readonly LedgerEntry[]): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(LEDGER_KEY, JSON.stringify(ledger));
  } catch {
    // Storage can be disabled in private windows; the in-memory chain still works.
  }
}

export function resetLedger(): LedgerEntry[] {
  const ledger = genesisLedger();
  saveLedger(ledger);
  return ledger;
}
