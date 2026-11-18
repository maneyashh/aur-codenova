/**
 * AURA-GOV / Enterprise Multi-Tenant Policy Vault
 * -----------------------------------------------
 * A governance layer on top of the real airlock detector. Detection still
 * comes from analyzePayload(); each tenant profile decides which detected
 * classes are vaulted, which pass, how risk is weighted, and how long tokens
 * live. A chained SHA-256 ledger records every policy action.
 */
import { analyzePayload, type AirlockReport, type DetectedEntity, type EntityType } from './airlock';

export type TenantId = 'TENANT-FINTECH' | 'TENANT-HIPAA' | 'TENANT-RETAIL';

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

export const TENANT_ORDER: readonly TenantId[] = ['TENANT-FINTECH', 'TENANT-HIPAA', 'TENANT-RETAIL'];

export const TENANTS: Record<TenantId, TenantProfile> = {
  'TENANT-FINTECH': {
    id: 'TENANT-FINTECH',
    name: 'Strict FinTech',
    framework: 'SOC2 / PII',
    redacts: ['CODENAME', 'PROGRAM', 'PERSON', 'EMAIL', 'PHONE', 'SECRET', 'IP', 'ADDRESS'],
    allowList: [],
    tokenTtlMin: 15,
    riskMultiplier: 1.8,
    egressLock: 'STRICT EGRESS LOCK',
  },
  'TENANT-HIPAA': {
    id: 'TENANT-HIPAA',
    name: 'Healthcare HIPAA',
    framework: 'PHI Guard',
    redacts: ['PERSON', 'EMAIL', 'PHONE', 'ADDRESS', 'CODENAME', 'SECRET', 'IP'],
    allowList: [],
    tokenTtlMin: 30,
    riskMultiplier: 1.5,
    egressLock: 'HARDWARE-BOUND SEAL',
  },
  'TENANT-RETAIL': {
    id: 'TENANT-RETAIL',
    name: 'Global Retail',
    framework: 'GDPR Standard',
    redacts: ['PERSON', 'EMAIL', 'PHONE', 'SECRET', 'IP'],
    allowList: ['ORBITAL-7', 'SOLARIS'],
    tokenTtlMin: 60,
    riskMultiplier: 1.0,
    egressLock: 'STANDARD EGRESS',
  },
};

// Same weights as the airlock's own risk model, applied only to vaulted entities.
const RISK_WEIGHT: Record<EntityType, number> = {
  SECRET: 28,
  CODENAME: 18,
  EMAIL: 12,
  PERSON: 10,
  PHONE: 10,
  IP: 8,
  ADDRESS: 6,
  PROGRAM: 8,
};

export interface VaultRow {
  entity: DetectedEntity;
  redacted: boolean;
  allowListed: boolean;
  /** What actually crosses the perimeter for this entity. */
  token: string;
}

export interface VaultView {
  profile: TenantProfile;
  rows: VaultRow[];
  egress: string;
  risk: number;
  redactedCount: number;
  passthroughCount: number;
  protectedCharacters: number;
  revoked: boolean;
}

/** Apply a tenant policy to an existing airlock report. */
export function applyTenantPolicy(report: AirlockReport, tenantId: TenantId, revoked: boolean): VaultView {
  const profile = TENANTS[tenantId];

  const rows: VaultRow[] = report.entities.map((entity) => {
    const allowListed = profile.allowList.some((entry) => entry.toLowerCase() === entity.raw.toLowerCase());
    const redacted = profile.redacts.includes(entity.type) && !allowListed;
    const token = redacted ? (revoked ? REVOKED_TOKEN : entity.token) : entity.raw;
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
  const base = redactedRows.reduce((sum, row) => sum + RISK_WEIGHT[row.entity.type], 0);
  const risk = Math.min(99, Math.round(base * 1.6 * profile.riskMultiplier));

  return {
    profile,
    rows,
    egress,
    risk,
    redactedCount: redactedRows.length,
    passthroughCount: rows.length - redactedRows.length,
    protectedCharacters: redactedRows.reduce((sum, row) => sum + row.entity.raw.length, 0),
    revoked,
  };
}

/** Convenience: run the real airlock detector, then apply the tenant policy. */
export function evaluateVault(text: string, tenantId: TenantId, revoked: boolean) {
  const report = analyzePayload(text);
  return { report, view: applyTenantPolicy(report, tenantId, revoked) };
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

export function computeVaultReceipt(
  prevHash: string,
  tenantId: TenantId,
  action: string,
  entityCount: number,
): string {
  return sha256Hex(`${prevHash}|${tenantId}|${action}|${entityCount}`);
}

export interface LedgerEntry {
  tenantId: TenantId;
  action: string;
  entityCount: number;
  prevHash: string;
  hash: string;
}

export function appendReceipt(
  ledger: readonly LedgerEntry[],
  tenantId: TenantId,
  action: string,
  entityCount: number,
): LedgerEntry[] {
  const prevHash = ledger.length ? ledger[ledger.length - 1].hash : GENESIS_HASH;
  return [
    ...ledger,
    { tenantId, action, entityCount, prevHash, hash: computeVaultReceipt(prevHash, tenantId, action, entityCount) },
  ];
}

/** Recomputes every link. Returns the index of the first broken receipt, or -1 if intact. */
export function findLedgerBreak(ledger: readonly LedgerEntry[]): number {
  let prev = GENESIS_HASH;
  for (let i = 0; i < ledger.length; i++) {
    const entry = ledger[i];
    const expected = computeVaultReceipt(prev, entry.tenantId, entry.action, entry.entityCount);
    if (entry.prevHash !== prev || entry.hash !== expected) return i;
    prev = entry.hash;
  }
  return -1;
}

export const shortHash = (hash: string): string => `${hash.slice(0, 6)}…${hash.slice(-4)}`;