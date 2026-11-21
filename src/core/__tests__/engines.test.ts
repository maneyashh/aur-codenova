import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  contrastRatio,
  deltaE2000,
  driftVerdict,
  labDeltaE2000,
  wcagLevel,
} from '../color';
import {
  analyzePayload,
  luhnValid,
  maskValue,
} from '../airlock';
import {
  GENESIS_HASH,
  appendReceipt,
  applyTenantPolicy,
  findLedgerBreak,
  mintIssuance,
  sha256Hex,
  tamperLedger,
} from '../vault';
import { addDays, claims, evaluateClaim, TODAY } from '../claims';
import {
  ARBITER_THRESHOLD,
  DISAGREEMENT_DISCOUNT,
  runArbiterPass,
} from '../arbiter';
import { buildClearanceReport } from '../compiler';
import { SCENARIOS } from '../../sim/scenarios';

describe('CIEDE2000', () => {
  // Sharma, Wu & Dalal (2005) reference pairs.
  const pairs: Array<[number, number, number, number, number, number, number]> = [
    [50, 2.6772, -79.7751, 50, 0, -82.7485, 2.0425],
    [50, 3.1571, -77.2803, 50, 0, -82.7485, 2.8615],
    [50, 2.8361, -74.02, 50, 0, -82.7485, 3.4412],
    [50, -1.3802, -84.2814, 50, 0, -82.7485, 1.0],
  ];

  it.each(pairs)('matches Sharma pair %#', (L1, a1, b1, L2, a2, b2, expected) => {
    const value = labDeltaE2000(
      { L: L1, a: a1, b: b1 },
      { L: L2, a: a2, b: b2 },
    );
    expect(value).toBeCloseTo(expected, 3);
  });

  it('returns zero for identical colours', () => {
    expect(deltaE2000('#D8FF4F', '#D8FF4F')).toBe(0);
  });

  it('classifies drift against the contract thresholds', () => {
    expect(driftVerdict(1.2)).toBe('PASS');
    expect(driftVerdict(3.4)).toBe('REVIEW');
    expect(driftVerdict(8.1)).toBe('FAIL');
  });
});

describe('WCAG contrast', () => {
  it('computes the canonical 21:1 black/white ratio', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 2);
  });

  it('rejects the same colour', () => {
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 2);
  });

  it('assigns AA and AAA correctly', () => {
    expect(wcagLevel(7.1)).toBe('AAA');
    expect(wcagLevel(4.6)).toBe('AA');
    expect(wcagLevel(3.2, true)).toBe('AA Large');
    expect(wcagLevel(3.2, false)).toBe('Fail');
    expect(wcagLevel(2.1)).toBe('Fail');
  });
});

describe('SHA-256', () => {
  it('matches FIPS 180-4 vectors', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });

  it('agrees with Node crypto across lengths and unicode', () => {
    const samples = ['a'.repeat(1000), 'AURA-GOV · ΔE2000', '', 'x'.repeat(65)];
    for (const sample of samples) {
      const expected = createHash('sha256').update(sample).digest('hex');
      expect(sha256Hex(sample)).toBe(expected);
    }
  });
});

describe('Airlock detector', () => {
  const payload = SCENARIOS.privacy.airlockPayload;
  const report = analyzePayload(payload);
  const types = new Set(report.entities.map((entity) => entity.type));

  it('detects regulated identifiers, not just codenames', () => {
    for (const type of ['SSN', 'DOB', 'MRN', 'CARD', 'IBAN', 'EMAIL', 'PHONE', 'SECRET'] as const) {
      expect(types.has(type), `expected ${type} to be detected`).toBe(true);
    }
  });

  it('validates cards with Luhn', () => {
    expect(luhnValid('4111 1111 1111 1111')).toBe(true);
    expect(luhnValid('4111 1111 1111 1112')).toBe(false);
    expect(luhnValid('1234')).toBe(false);
  });

  it('replaces every raw entity in the sanitized payload', () => {
    expect(report.sanitized).not.toContain('Priya Raman');
    expect(report.sanitized).not.toContain('078-05-1120');
    expect(report.sanitized).not.toContain('GB82WEST12345698765432');
    expect(report.protectedCharacters).toBeGreaterThan(100);
    expect(report.sanitized).toContain('[PERSON_');
  });

  it('masks values without leaking the middle', () => {
    expect(maskValue('4111111111111111')).toBe('41••••••••••11');
  });
});

describe('Policy vault', () => {
  const report = analyzePayload(SCENARIOS.privacy.airlockPayload);

  it('mints a distinct token set on every issuance', () => {
    const first = mintIssuance(report, 'TENANT-FINTECH', 1_000);
    const second = mintIssuance(report, 'TENANT-FINTECH', 1_000);
    expect(first.tokens).not.toEqual(second.tokens);
    expect(first.id).not.toBe(second.id);
  });

  it('applies tenant redaction and residual risk', () => {
    const issuance = mintIssuance(report, 'TENANT-RETAIL');
    const view = applyTenantPolicy(report, 'TENANT-RETAIL', issuance, issuance.issuedAt);
    expect(view.redactedCount).toBeGreaterThan(0);
    expect(view.egress).not.toContain('Priya Raman');
    expect(view.residualRisk).toBeLessThanOrEqual(view.risk);
  });

  it('expires tokens when the TTL elapses', () => {
    const issuance = mintIssuance(report, 'TENANT-FINTECH', 1_000);
    const view = applyTenantPolicy(
      report,
      'TENANT-FINTECH',
      issuance,
      issuance.issuedAt + 16 * 60_000,
    );
    expect(view.expired).toBe(true);
    expect(view.blocked).toBe(true);
    expect(view.egress).toContain('[EXPIRED_VAULT_TOKEN]');
  });

  it('chains receipts and detects tampering', () => {
    let ledger = appendReceipt([], {
      tenantId: 'TENANT-FINTECH',
      action: 'LEDGER_INIT',
      entityCount: 0,
      payloadHash: sha256Hex('genesis'),
      timestamp: '2026-11-12T00:00:00.000Z',
    });
    expect(ledger[0].prevHash).toBe(GENESIS_HASH);
    ledger = appendReceipt(ledger, {
      tenantId: 'TENANT-FINTECH',
      action: 'TOKENS_ISSUED',
      entityCount: 12,
      payloadHash: sha256Hex('payload'),
      timestamp: '2026-11-12T00:01:00.000Z',
    });
    expect(findLedgerBreak(ledger)).toBe(-1);
    const broken = tamperLedger(ledger, 1);
    expect(findLedgerBreak(broken)).toBe(1);
  });
});

describe('Temporal engine', () => {
  it('blocks a claim whose validity ends before publish', () => {
    const claim = claims.find((entry) => entry.id === 'C-109')!;
    const today = evaluateClaim(claim, TODAY);
    const late = evaluateClaim(claim, addDays(TODAY, 9));
    expect(today.severity).not.toBe('blocked');
    expect(late.severity).toBe('blocked');
    expect(late.state).toBe('EXPIRES_BEFORE_PUBLISH');
  });
});

describe('Clearance compiler', () => {
  it('derives six stages, six logs and one hash per dataset', () => {
    const report = buildClearanceReport(SCENARIOS.privacy, 3);
    expect(report.stages).toHaveLength(6);
    expect(report.logs).toHaveLength(6);
    expect(report.domains).toHaveLength(4);
    expect(report.arbiter.routes).toHaveLength(4);
    expect(report.traceHash).toHaveLength(64);
  });

  it('keeps every screen reading the same numbers', () => {
    const report = buildClearanceReport(SCENARIOS.privacy, 3);
    expect(report.visual.maxDeltaE).toBe(
      Math.max(...report.visual.palette.map((color) => color.deltaE)),
    );
    expect(report.temporal.blocked).toBe(
      report.temporal.evaluations.filter(({ evaluation }) => evaluation.severity === 'blocked')
        .length,
    );
    expect(report.voice.score).toBe(report.domains.find((domain) => domain.key === 'voice')!.value);
    expect(report.logByStage.clearance.text).toContain(report.score.toFixed(1));
    expect(report.stages.at(-1)!.detail).toContain(report.score.toFixed(1));
    expect(report.stages.at(-1)!.detail).toContain(report.verdictShort);
  });

  it('is deterministic for identical inputs', () => {
    const first = buildClearanceReport(SCENARIOS.visual, 9);
    const second = buildClearanceReport(SCENARIOS.visual, 9);
    expect(first.traceHash).toBe(second.traceHash);
    expect(first.score).toBe(second.score);
  });

  it('flags the privacy payload as a PII egress block', () => {
    const report = buildClearanceReport(SCENARIOS.privacy, 3);
    expect(report.verdictTone).toBe('red');
    expect(report.verdictLabel).toContain('BLOCK');
    expect(report.airlock.entities.length).toBeGreaterThanOrEqual(10);
  });
});

describe('Arbiter fusion', () => {
  it('never inflates confidence through a fallback and degrades under stress', () => {
    const report = buildClearanceReport(SCENARIOS.visual, 9);
    const nominal = report.arbiter;
    const stressed = runArbiterPass(report.signals, true);

    expect(stressed.overallConfidence).toBeLessThan(nominal.overallConfidence);
    expect(stressed.fallbacksTriggered).toBeGreaterThan(nominal.fallbacksTriggered);
    expect(stressed.routes.every((route) => route.primaryConfidence < ARBITER_THRESHOLD)).toBe(
      true,
    );

    for (const route of nominal.routes) {
      if (route.fellBack) {
        expect(route.resolvedConfidence).toBeGreaterThanOrEqual(route.primaryConfidence);
        expect(route.resolvedConfidence).toBeLessThanOrEqual(route.secondaryConfidence);
        expect(route.resolvedConfidence).toBeCloseTo(
          route.secondaryConfidence -
            (route.secondaryConfidence - route.primaryConfidence) * DISAGREEMENT_DISCOUNT,
          3,
        );
      } else {
        expect(route.resolvedConfidence).toBe(route.primaryConfidence);
      }
      expect(route.externalLlmCalls).toBe(0);
    }
  });
});
