import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  Badge,
  Panel,
  PanelHead,
  ScreenHead,
  StatusDot,
  Toggle,
} from '../components/ui';
import { useStudio } from '../state/studio';
import { useScenario } from '../sim/SimulationProvider';
import {
  AIRLOCK_SAMPLE,
  analyzePayload,
  entityTypeMeta,
  maskValue,
  type AirlockReport,
  type EntityType,
} from '../core/airlock';
import {
  REVOKED_TOKEN,
  TENANTS,
  TENANT_ORDER,
  appendReceipt,
  applyTenantPolicy,
  findLedgerBreak,
  shortHash,
  type LedgerEntry,
  type TenantId,
} from '../core/vault';

function EntityHighlights({ report }: { report: AirlockReport }) {
  return (
    <>
      {report.segments.map((segment, index) =>
        segment.kind === 'entity' ? (
          <mark
            key={`${segment.entity.id}-${index}`}
            className={`entity-highlight ${entityTypeMeta[segment.entity.type].className}`}
            title={`${entityTypeMeta[segment.entity.type].label} · ${segment.entity.rule}`}
          >
            {segment.text}
          </mark>
        ) : (
          <span key={`text-${index}`}>{segment.text}</span>
        ),
      )}
      {'\n'}
    </>
  );
}

const TOKEN_SPLIT = /(\[[A-Z_]+\d*\])/g;
const TOKEN_TEST = /^\[[A-Z_]+\d*\]$/;

function EgressPayload({ sanitized }: { sanitized: string }) {
  const parts = sanitized.split(TOKEN_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        TOKEN_TEST.test(part) ? (
          <mark
            className={`token-vault ${part === REVOKED_TOKEN ? 'token-vault--revoked' : ''}`}
            key={`${part}-${index}`}
          >
            {part}
          </mark>
        ) : (
          <span key={`part-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

const CODENAME_TYPES: EntityType[] = ['CODENAME', 'PROGRAM'];
const PERSONAL_TYPES: EntityType[] = ['PERSON', 'EMAIL', 'PHONE', 'ADDRESS'];
const CREDENTIAL_TYPES: EntityType[] = ['SECRET', 'IP'];

export function Airlock() {
  const { pushToast } = useStudio();
  const scenario = useScenario();
  const defaultPayload = scenario?.airlockPayload ?? AIRLOCK_SAMPLE;
  const [payload, setPayload] = useState(defaultPayload);
  const [armed, setArmed] = useState(true);
  const [previewRaw, setPreviewRaw] = useState(false);
  const [reveal, setReveal] = useState(false);
  const [approved, setApproved] = useState(false);
  const [externalCalls, setExternalCalls] = useState(0);
  const [tenantId, setTenantId] = useState<TenantId>('TENANT-FINTECH');
  const [revoked, setRevoked] = useState(false);
  const [ledger, setLedger] = useState<LedgerEntry[]>(() =>
    appendReceipt([], 'TENANT-FINTECH', 'VAULT_INIT', 0),
  );
  const highlightRef = useRef<HTMLPreElement>(null);

  // Hydrate the ingress buffer whenever a new crisis dataset is selected.
  useEffect(() => {
    setPayload(scenario?.airlockPayload ?? AIRLOCK_SAMPLE);
    setApproved(false);
    setPreviewRaw(false);
    setReveal(false);
    setRevoked(false);
    setExternalCalls(0);
  }, [scenario?.id, scenario?.airlockPayload]);

  const report = useMemo(() => analyzePayload(payload), [payload]);
  const view = useMemo(() => applyTenantPolicy(report, tenantId, revoked), [report, tenantId, revoked]);
  const chainBreak = useMemo(() => findLedgerBreak(ledger), [ledger]);
  const chainIntact = chainBreak === -1;
  const leaking = !armed || previewRaw;
  const uniqueTypes = Array.from(new Set(report.entities.map((entity) => entity.type)));
  const profile = view.profile;
  const head = ledger[ledger.length - 1];

  const handlePayloadChange = (value: string) => {
    setPayload(value);
    setApproved(false);
  };

  const handleArmed = (next: boolean) => {
    setArmed(next);
    setApproved(false);
    pushToast(
      next
        ? {
            title: 'Zero-trust airlock armed',
            detail: 'All outbound text will be tokenized on this node before egress.',
            tone: 'clear',
          }
        : {
            title: 'Airlock bypassed',
            detail: 'Raw identifiers are now visible to the external link. Demo only.',
            tone: 'block',
          },
    );
  };

  const selectTenant = (id: TenantId) => {
    if (id === tenantId) return;
    const next = applyTenantPolicy(report, id, revoked);
    setTenantId(id);
    setApproved(false);
    setLedger((current) => appendReceipt(current, id, 'POLICY_SWITCH', next.redactedCount));
    pushToast({
      title: `${TENANTS[id].name} policy active`,
      detail: `${next.redactedCount} of ${report.entities.length} entities vaulted · ${next.passthroughCount} pass under this tenant's policy · risk ${next.risk}.`,
      tone: 'clear',
    });
  };

  const toggleRevoke = () => {
    const next = !revoked;
    setRevoked(next);
    setApproved(false);
    setLedger((current) =>
      appendReceipt(current, tenantId, next ? 'TOKENS_REVOKED' : 'TOKENS_REISSUED', view.redactedCount),
    );
    pushToast(
      next
        ? {
            title: `${view.redactedCount} vault tokens revoked`,
            detail: 'Every active token now resolves to [REVOKED_VAULT_TOKEN]. Egress is disabled until tokens are re-issued.',
            tone: 'block',
          }
        : {
            title: 'Vault tokens re-issued',
            detail: `Fresh ${profile.tokenTtlMin}-minute tokens minted under ${profile.id}.`,
            tone: 'clear',
          },
    );
  };

  const verifyChain = () => {
    const probe = ledger.map((entry, index) =>
      index === 0 ? { ...entry, entityCount: entry.entityCount + 1 } : entry,
    );
    const probeBreak = findLedgerBreak(probe);
    pushToast(
      chainIntact
        ? {
            title: `Receipt chain verified · ${ledger.length} receipts`,
            detail: `Every SHA-256 link recomputed locally. A tamper probe on receipt #00 was caught at #${String(probeBreak).padStart(2, '0')}.`,
            tone: 'clear',
          }
        : {
            title: `Receipt chain broken at #${String(chainBreak).padStart(2, '0')}`,
            detail: 'A receipt no longer matches its recomputed SHA-256 link.',
            tone: 'block',
          },
    );
  };

  const approveEgress = () => {
    if (leaking || approved || revoked) return;
    setApproved(true);
    setExternalCalls(1);
    setLedger((current) => appendReceipt(current, tenantId, 'EGRESS_APPROVED', view.redactedCount));
    pushToast({
      title: 'Sanitized egress approved',
      detail: `${view.redactedCount} vault tokens released · ${view.passthroughCount} allow-listed · response rehydration gated locally.`,
      tone: 'clear',
    });
  };

  const copyPayload = async () => {
    const value = leaking ? payload : view.egress;
    try {
      await navigator.clipboard.writeText(value);
      pushToast({
        title: leaking ? 'Unsafe payload copied' : 'Sanitized payload copied',
        detail: leaking
          ? 'Warning: this payload contains raw identifiers.'
          : `${view.redactedCount} identifiers replaced with vault tokens.`,
        tone: leaking ? 'block' : 'clear',
      });
    } catch {
      pushToast({
        title: 'Clipboard unavailable',
        detail: 'The local browser blocked clipboard access.',
        tone: 'info',
      });
    }
  };

  const groupState = (types: EntityType[], vaulted: string): string => {
    if (leaking) return 'EXPOSED';
    const rows = view.rows.filter((row) => types.includes(row.entity.type));
    if (rows.length === 0) return 'NONE DETECTED';
    if (rows.every((row) => row.redacted)) return revoked ? 'REVOKED' : vaulted;
    if (rows.every((row) => !row.redacted)) return 'POLICY PASS';
    return 'PARTIAL';
  };

  return (
    <div className="page page--airlock">
      <ScreenHead
        index="05"
        kicker="LOCAL SANITIZATION"
        title={
          <>
            Nothing leaves without <span className="title-accent">a clearance.</span>
          </>
        }
        description="A zero-trust preprocessing airlock. Codenames, people, facilities, secrets and network identifiers are tokenized locally — before any external model can see the prompt."
        badge={
          <span className="head-live">
            <StatusDot tone="acid" pulse /> 0 EXTERNAL CALLS
          </span>
        }
        actions={
          <>
            <span className="asset-pill asset-pill--secure">
              <LockKeyhole size={13} strokeWidth={1.7} />
              LOCAL INFERENCE ONLY
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                pushToast({
                  title: 'Airlock audit trace exported',
                  detail: `${view.redactedCount} redactions · ${view.protectedCharacters} protected characters · no network egress recorded.`,
                  tone: 'clear',
                })
              }
            >
              <Download size={14} strokeWidth={1.7} />
              Audit trail
            </button>
          </>
        }
      />

      <div className="vault-bar" data-tour="vault">
        <div className="vault-bar-head">
          <div className="vault-bar-title">
            <span className="vault-kicker">Round 3 · Improvement 03</span>
            <h2>Enterprise Multi-Tenant Policy Vault</h2>
          </div>
          <div className="vault-bar-actions">
            <span className={`vault-state ${revoked ? 'is-revoked' : ''}`}>
              <StatusDot tone={revoked ? 'red' : 'acid'} pulse={!revoked} />
              {revoked ? 'TOKENS REVOKED' : `${view.redactedCount} TOKENS ACTIVE · TTL ${profile.tokenTtlMin}m`}
            </span>
            <button
              type="button"
              className={`btn btn-small ${revoked ? 'btn-ghost' : 'btn-danger'}`}
              onClick={toggleRevoke}
            >
              <ShieldAlert size={12} strokeWidth={1.9} />
              {revoked ? 'Re-issue Vault Tokens' : 'Revoke Vault Tokens'}
            </button>
          </div>
        </div>

        <div className="vault-tenants" role="tablist" aria-label="Compliance profile">
          {TENANT_ORDER.map((id) => {
            const tenant = TENANTS[id];
            const active = id === tenantId;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`vault-tenant ${active ? 'is-active' : ''}`}
                onClick={() => selectTenant(id)}
              >
                <span className="vault-tenant-code">{tenant.id}</span>
                <strong>{tenant.name}</strong>
                <span className="vault-tenant-framework">{tenant.framework}</span>
                <span className="vault-tenant-facts">
                  {tenant.redacts.length} classes · TTL {tenant.tokenTtlMin}m · {tenant.riskMultiplier.toFixed(1)}× risk
                </span>
                <span className="vault-tenant-lock">{tenant.egressLock}</span>
              </button>
            );
          })}
        </div>

        <div className="vault-ledger">
          <span className="vault-ledger-label">
            <LockKeyhole size={11} strokeWidth={1.8} /> AUDIT LEDGER · {String(ledger.length).padStart(2, '0')} RECEIPTS
          </span>
          <span className="vault-chain" aria-label="Most recent receipt hashes">
            {ledger.slice(-4).map((entry, index, recent) => (
              <span className="vault-hash" key={entry.hash} title={`${entry.action} · ${entry.hash}`}>
                {shortHash(entry.hash)}
                {index < recent.length - 1 ? <i>→</i> : null}
              </span>
            ))}
          </span>
          <span className="vault-head-hash">HEAD {shortHash(head.hash)}</span>
          <button type="button" className="btn btn-ghost btn-small" onClick={verifyChain}>
            <CheckCircle2 size={12} strokeWidth={1.9} />
            Verify SHA-256 Receipt Chain ({chainIntact ? '100% Intact' : 'BROKEN'})
          </button>
        </div>
      </div>

      <div className="grid-12 airlock-layout">
        <div className="airlock-left span-7">
          <Panel className="ingress-panel" bracket>
            <PanelHead
              kicker="Ingress buffer"
              title="Local preprocessor"
              meta="TEXT / UTF-8"
              actions={
                <div className="ingress-head-tools">
                  <span className={`airlock-state ${armed ? 'is-armed' : 'is-bypassed'}`}>
                    <StatusDot tone={armed ? 'acid' : 'red'} pulse={armed} />
                    {armed ? 'ARMED' : 'BYPASSED'}
                  </span>
                  <Toggle checked={armed} onChange={handleArmed} label="Zero-trust" compact />
                </div>
              }
            />

            <div className="ingress-toolbar">
              <span className="ingress-file">
                <span className="file-dot" /> {scenario?.asset.file ?? 'MESSAGE_DRAFT_07.TXT'}
              </span>
              <div className="ingress-toolbar-right">
                <span className="ingress-chars">{payload.length} chars</span>
                <button
                  type="button"
                  className="tool-button"
                  onClick={() => {
                    setPayload(scenario?.airlockPayload ?? AIRLOCK_SAMPLE);
                    setApproved(false);
                    setPreviewRaw(false);
                    setReveal(false);
                    setExternalCalls(0);
                    pushToast({
                      title: 'Crisis payload reloaded',
                      detail: 'Raw identifiers injected for deterministic local detection.',
                      tone: 'info',
                    });
                  }}
                >
                  Reload payload
                </button>
              </div>
            </div>

            <div className="payload-editor">
              <pre className="payload-highlight" ref={highlightRef} aria-hidden="true">
                <EntityHighlights report={report} />
              </pre>
              <textarea
                className="payload-input"
                value={payload}
                onChange={(event) => handlePayloadChange(event.target.value)}
                onScroll={(event) => {
                  if (!highlightRef.current) return;
                  highlightRef.current.scrollTop = event.currentTarget.scrollTop;
                  highlightRef.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
                spellCheck={false}
                aria-label="Message payload to sanitize"
              />
              <span className={`editor-scanline ${armed ? '' : 'is-off'}`} aria-hidden="true" />
            </div>

            <div className="ingress-summary">
              <div className="ingress-metric">
                <span>ENTITIES</span>
                <strong>{String(report.entities.length).padStart(2, '0')}</strong>
              </div>
              <div className="ingress-metric">
                <span>PROTECTED</span>
                <strong>{view.protectedCharacters}<small> CHAR</small></strong>
              </div>
              <div className="ingress-metric">
                <span>RISK INTERCEPTED</span>
                <strong className="text-amber">{view.risk}<small> / 99</small></strong>
              </div>
              <div className="ingress-types">
                {uniqueTypes.slice(0, 5).map((type) => (
                  <span
                    className={`type-chip ${entityTypeMeta[type].className}`}
                    key={type}
                    title={entityTypeMeta[type].label}
                  >
                    {entityTypeMeta[type].short}
                  </span>
                ))}
                {uniqueTypes.length > 5 ? (
                  <span className="type-chip type-chip--more">+{uniqueTypes.length - 5}</span>
                ) : null}
              </div>
            </div>

            <div className="ingress-foot">
              <span><LockKeyhole size={11} strokeWidth={1.7} /> PROCESSED ON NODE S-01 · NOTHING QUEUED FOR EGRESS</span>
              <span>{uniqueTypes.length} CLASSES / LEXICON v9</span>
            </div>
          </Panel>

          <Panel className="entity-panel">
            <PanelHead
              kicker="Detection register"
              title="Entity vault"
              meta={`${view.redactedCount} VAULTED / ${view.passthroughCount} PASS · ${profile.id}`}
              actions={
                <button
                  type="button"
                  className={`tool-button ${reveal ? 'is-active' : ''}`}
                  onClick={() => setReveal(!reveal)}
                >
                  {reveal ? <EyeOff size={12} /> : <Eye size={12} />}
                  {reveal ? 'Mask values' : 'Reveal values'}
                </button>
              }
            />
            <div className="entity-table">
              <div className="entity-row entity-row--head">
                <span>Class</span>
                <span>Detected value</span>
                <span>Egress token</span>
                <span>Rule</span>
                <span>Conf.</span>
              </div>
              {view.rows.map((row) => (
                <div className="entity-row" key={row.entity.id}>
                  <span className={`entity-type ${entityTypeMeta[row.entity.type].className}`}>
                    <i>{entityTypeMeta[row.entity.type].short}</i>
                    {entityTypeMeta[row.entity.type].label}
                  </span>
                  <span className="entity-raw">
                    {reveal ? row.entity.raw : maskValue(row.entity.raw)}
                  </span>
                  <span
                    className={`entity-token ${
                      !row.redacted ? 'is-pass' : revoked ? 'is-revoked' : ''
                    }`}
                  >
                    {row.redacted ? row.token : row.allowListed ? 'ALLOW-LISTED' : 'POLICY PASS'}
                  </span>
                  <span className="entity-rule">{row.entity.rule}</span>
                  <span className="entity-confidence">
                    {(row.entity.confidence * 100).toFixed(1)}
                  </span>
                </div>
              ))}
              {report.entities.length === 0 ? (
                <div className="entity-empty">
                  No sensitive entities detected. The buffer is clear for raw egress.
                </div>
              ) : null}
            </div>
            <div className="entity-foot">
              <span>{reveal ? 'RAW VALUES VISIBLE ON LOCAL NODE ONLY' : 'VALUES MASKED · REVEAL IS LOCAL-ONLY'}</span>
              <span>LEXICON v9 + 4 REGEX PATTERNS · {profile.id}</span>
            </div>
          </Panel>
        </div>

        <Panel className="egress-panel span-5" bracket>
          <PanelHead
            kicker="Egress manifest"
            title="External payload"
            meta="TARGET / SANDBOX MODEL"
            actions={
              <Badge tone={leaking ? 'red' : revoked ? 'amber' : 'acid'} dot>
                {leaking ? 'LEAK' : revoked ? 'REVOKED' : 'SANITIZED'}
              </Badge>
            }
          />

          <div className="egress-flow">
            <div className="flow-node">
              <span className="flow-node-label">LOCAL</span>
              <strong>S-01</strong>
              <span className="flow-node-meta">raw buffer</span>
            </div>
            <span className="flow-link">····</span>
            <div className={`flow-node flow-node--shield ${leaking ? 'is-bypassed' : 'is-armed'}`}>
              {leaking ? <ShieldAlert size={15} strokeWidth={1.7} /> : <ShieldCheck size={15} strokeWidth={1.7} />}
              <strong>AIRLOCK</strong>
              <span className="flow-node-meta">
                {leaking ? 'bypassed' : revoked ? 'revoked' : `${view.redactedCount} tokens`}
              </span>
            </div>
            <span className="flow-link">····</span>
            <div className={`flow-node ${leaking ? 'flow-node--danger' : ''}`}>
              <span className="flow-node-label">EXTERNAL</span>
              <strong>MODEL</strong>
              <span className="flow-node-meta">{leaking ? 'raw data' : 'tokens only'}</span>
            </div>
          </div>

          <div className={`leak-control ${leaking ? 'is-leaking' : ''}`}>
            <div>
              <strong>{leaking ? 'Unprotected egress preview' : 'Zero-trust protection active'}</strong>
              <span>
                {leaking
                  ? 'The external model would receive raw codenames, names and live secrets.'
                  : 'Only vault tokens and structurally safe text cross the perimeter.'}
              </span>
            </div>
            <Toggle
              checked={previewRaw}
              onChange={(next) => {
                setPreviewRaw(next);
                setApproved(false);
              }}
              label="Preview leak"
              compact
            />
          </div>

          <div className={`egress-preview ${leaking ? 'is-leaking' : ''}`}>
            <div className="egress-preview-head">
              <span>PAYLOAD / {leaking ? 'RAW' : 'MASKED'} · {profile.id}</span>
              <button type="button" className="icon-button" onClick={copyPayload} aria-label="Copy payload">
                <Copy size={12} strokeWidth={1.8} />
              </button>
            </div>
            <pre className="egress-code">
              {leaking ? <EntityHighlights report={report} /> : <EgressPayload sanitized={view.egress} />}
            </pre>
            <div className="egress-preview-foot">
              <span className={leaking ? 'text-red' : view.passthroughCount > 0 ? 'text-amber' : 'text-acid'}>
                {leaking
                  ? 'RAW IDENTIFIERS EXPOSED'
                  : view.passthroughCount > 0
                    ? `${view.passthroughCount} PASS UNMASKED BY POLICY`
                    : '0 RAW IDENTIFIERS'}
              </span>
              <span>
                {leaking
                  ? `${report.entities.length} SECRETS VISIBLE`
                  : `${view.redactedCount} TOKENS / ${view.protectedCharacters} CHARS MASKED`}
              </span>
            </div>
          </div>

          <div className="egress-stats">
            <div>
              <span>ENTITIES MASKED</span>
              <strong>{String(view.redactedCount).padStart(2, '0')}</strong>
            </div>
            <div>
              <span>RAW CHARS</span>
              <strong>{leaking ? report.protectedCharacters : '00'}</strong>
            </div>
            <div>
              <span>RISK SCORE</span>
              <strong className={leaking ? 'text-red' : 'text-amber'}>{view.risk}</strong>
            </div>
            <div>
              <span>EXTERNAL CALLS</span>
              <strong>{String(externalCalls).padStart(2, '0')}</strong>
            </div>
          </div>

          <div className="egress-policies">
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Classified codenames & programs</span>
              <strong>{groupState(CODENAME_TYPES, 'VAULTED')}</strong>
            </div>
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Personal identifiers</span>
              <strong>{groupState(PERSONAL_TYPES, 'MASKED')}</strong>
            </div>
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Live credentials & network</span>
              <strong>{groupState(CREDENTIAL_TYPES, 'REPLACED')}</strong>
            </div>
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Response rehydration</span>
              <strong>LOCAL ONLY</strong>
            </div>
          </div>

          <button
            type="button"
            className={`btn btn-full ${approved ? 'btn-committed' : leaking ? 'btn-danger' : 'btn-primary'}`}
            onClick={approveEgress}
            disabled={approved || leaking || revoked}
          >
            {approved ? (
              <Check size={14} strokeWidth={2.4} />
            ) : leaking || revoked ? (
              <ShieldAlert size={14} />
            ) : (
              <ShieldCheck size={14} strokeWidth={1.8} />
            )}
            {approved
              ? 'Egress approved · tokens only'
              : leaking
                ? 'Seal airlock before egress'
                : revoked
                  ? 'Tokens revoked · re-issue to egress'
                  : 'Approve sanitized egress'}
            {!approved && !leaking && !revoked ? <ArrowRight size={12} className="btn-tail" /> : null}
          </button>

          <div className="egress-foot">
            <LockKeyhole size={11} strokeWidth={1.7} />
            <span>Model response is rehydrated only on this node. No training, no retention.</span>
          </div>
        </Panel>
      </div>

      <div className="airlock-audit-strip">
        <div className="audit-item">
          <span className="audit-label">LOCAL PREPROCESSOR</span>
          <span className="audit-value"><StatusDot tone="acid" /> ACTIVE · 4ms</span>
        </div>
        <div className="audit-item">
          <span className="audit-label">NETWORK EGRESS</span>
          <span className="audit-value">{externalCalls === 0 ? '0 BYTES' : `${view.redactedCount} VAULT TOKENS`}</span>
        </div>
        <div className="audit-item">
          <span className="audit-label">VAULT SEAL</span>
          <span className="audit-value">SHA-256 · {profile.egressLock}</span>
        </div>
        <div className="audit-item">
          <span className="audit-label">MODEL</span>
          <span className="audit-value">SANDBOX · ZERO RETENTION</span>
        </div>
        <div className="audit-item audit-item--right">
          <CheckCircle2 size={12} />
          <span className="audit-value">POLICY ZT-04 SATISFIED</span>
        </div>
      </div>

      <div className="page-footline">
        <span><StatusDot tone="acid" /> AIRLOCK NOMINAL · NO RAW EGRESS</span>
        <span>{report.entities.length} ENTITIES</span>
        <span>{view.protectedCharacters} CHARACTERS PROTECTED</span>
        <span className="footline-right">LEDGER HEAD {shortHash(head.hash)}</span>
      </div>
    </div>
  );
}