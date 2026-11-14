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
  Meter,
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
} from '../core/airlock';

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

function EgressPayload({ sanitized }: { sanitized: string }) {
  const parts = sanitized.split(/(\[[A-Z]+_\d+\])/g);
  return (
    <>
      {parts.map((part, index) =>
        /^\[[A-Z]+_\d+\]$/.test(part) ? (
          <mark className="token-vault" key={`${part}-${index}`}>
            {part}
          </mark>
        ) : (
          <span key={`part-${index}`}>{part}</span>
        ),
      )}
    </>
  );
}

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
  const highlightRef = useRef<HTMLPreElement>(null);

  // Hydrate the ingress buffer whenever a new crisis dataset is selected.
  useEffect(() => {
    setPayload(scenario?.airlockPayload ?? AIRLOCK_SAMPLE);
    setApproved(false);
    setPreviewRaw(false);
    setReveal(false);
    setExternalCalls(0);
  }, [scenario?.id, scenario?.airlockPayload]);

  const report = useMemo(() => analyzePayload(payload), [payload]);
  const leaking = !armed || previewRaw;
  const uniqueTypes = Array.from(new Set(report.entities.map((entity) => entity.type)));

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

  const approveEgress = () => {
    if (leaking || approved) return;
    setApproved(true);
    setExternalCalls(1);
    pushToast({
      title: 'Sanitized egress approved',
      detail: `${report.entities.length} vault tokens released · 0 raw identifiers · response rehydration gated locally.`,
      tone: 'clear',
    });
  };

  const copyPayload = async () => {
    const value = leaking ? payload : report.sanitized;
    try {
      await navigator.clipboard.writeText(value);
      pushToast({
        title: leaking ? 'Unsafe payload copied' : 'Sanitized payload copied',
        detail: leaking
          ? 'Warning: this payload contains raw identifiers.'
          : `${report.entities.length} identifiers replaced with vault tokens.`,
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
                  detail: `${report.entities.length} redactions · ${report.protectedCharacters} protected characters · no network egress recorded.`,
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
                  <Toggle
                    checked={armed}
                    onChange={handleArmed}
                    label="Zero-trust"
                    compact
                  />
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
                <strong>{report.protectedCharacters}<small> CHAR</small></strong>
              </div>
              <div className="ingress-metric">
                <span>RISK INTERCEPTED</span>
                <strong className="text-amber">{report.riskScore}<small> / 99</small></strong>
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
              meta={`${report.entities.length} ENTITIES / ${uniqueTypes.length} CLASSES`}
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
                <span>Vault token</span>
                <span>Rule</span>
                <span>Conf.</span>
              </div>
              {report.entities.map((entity) => (
                <div className="entity-row" key={entity.id}>
                  <span className={`entity-type ${entityTypeMeta[entity.type].className}`}>
                    <i>{entityTypeMeta[entity.type].short}</i>
                    {entityTypeMeta[entity.type].label}
                  </span>
                  <span className="entity-raw">
                    {reveal ? entity.raw : maskValue(entity.raw)}
                  </span>
                  <span className="entity-token">{entity.token}</span>
                  <span className="entity-rule">{entity.rule}</span>
                  <span className="entity-confidence">
                    {(entity.confidence * 100).toFixed(1)}
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
              <span>LEXICON v9 + 4 REGEX PATTERNS</span>
            </div>
          </Panel>
        </div>

        <Panel className="egress-panel span-5" bracket>
          <PanelHead
            kicker="Egress manifest"
            title="External payload"
            meta="TARGET / SANDBOX MODEL"
            actions={
              <Badge tone={leaking ? 'red' : 'acid'} dot>
                {leaking ? 'LEAK' : 'SANITIZED'}
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
              <span className="flow-node-meta">{leaking ? 'bypassed' : '10 tokens'}</span>
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
              <span>PAYLOAD / {leaking ? 'RAW' : 'MASKED'}</span>
              <button type="button" className="icon-button" onClick={copyPayload} aria-label="Copy payload">
                <Copy size={12} strokeWidth={1.8} />
              </button>
            </div>
            <pre className="egress-code">
              {leaking ? <EntityHighlights report={report} /> : <EgressPayload sanitized={report.sanitized} />}
            </pre>
            <div className="egress-preview-foot">
              <span className={leaking ? 'text-red' : 'text-acid'}>
                {leaking ? 'RAW IDENTIFIERS EXPOSED' : '0 RAW IDENTIFIERS'}
              </span>
              <span>{leaking ? `${report.entities.length} SECRETS VISIBLE` : `${report.entities.length} TOKENS / ${report.protectedCharacters} CHARS MASKED`}</span>
            </div>
          </div>

          <div className="egress-stats">
            <div>
              <span>ENTITIES MASKED</span>
              <strong>{String(report.entities.length).padStart(2, '0')}</strong>
            </div>
            <div>
              <span>RAW CHARS</span>
              <strong>{leaking ? report.protectedCharacters : '00'}</strong>
            </div>
            <div>
              <span>RISK SCORE</span>
              <strong className={leaking ? 'text-red' : 'text-amber'}>{report.riskScore}</strong>
            </div>
            <div>
              <span>EXTERNAL CALLS</span>
              <strong>{String(externalCalls).padStart(2, '0')}</strong>
            </div>
          </div>

          <div className="egress-policies">
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Classified codenames</span>
              <strong>{leaking ? 'EXPOSED' : 'VAULTED'}</strong>
            </div>
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Personal identifiers</span>
              <strong>{leaking ? 'EXPOSED' : 'MASKED'}</strong>
            </div>
            <div className="egress-policy-row">
              <LockKeyhole size={11} />
              <span>Live credentials</span>
              <strong>{leaking ? 'EXPOSED' : 'REPLACED'}</strong>
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
            disabled={approved || leaking}
          >
            {approved ? <Check size={14} strokeWidth={2.4} /> : leaking ? <ShieldAlert size={14} /> : <ShieldCheck size={14} strokeWidth={1.8} />}
            {approved
              ? 'Egress approved · tokens only'
              : leaking
                ? 'Seal airlock before egress'
                : 'Approve sanitized egress'}
            {!approved && !leaking ? <ArrowRight size={12} className="btn-tail" /> : null}
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
          <span className="audit-value">{externalCalls === 0 ? '0 BYTES' : `${report.entities.length} VAULT TOKENS`}</span>
        </div>
        <div className="audit-item">
          <span className="audit-label">VAULT SEAL</span>
          <span className="audit-value">SHA-256 / LOCAL</span>
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
        <span>{report.protectedCharacters} CHARACTERS PROTECTED</span>
        <span className="footline-right">SESSION HASH 9F2C…C41A</span>
      </div>
    </div>
  );
}
