import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Download,
  LockKeyhole,
  ShieldAlert,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import { Badge, Panel, PanelHead, ScreenHead, StatCard, StatusDot } from '../components/ui';
import { useStudio } from '../state/studio';
import {
  PUBLISH_OFFSET_MAX,
  TIMELINE_END,
  TIMELINE_START,
  TODAY,
  addDays,
  claims,
  daysBetween,
  evaluateClaim,
  formatLongDate,
  formatShortDate,
  type Claim,
  type TemporalEvaluation,
} from '../core/claims';

const dateTicks = [
  '2026-11-01',
  '2026-11-15',
  '2026-12-01',
  '2026-12-15',
  '2027-01-01',
  '2027-01-15',
  '2027-02-01',
];

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

const stateTone: Record<string, 'acid' | 'amber' | 'red'> = {
  VALID: 'acid',
  AT_RISK: 'amber',
  UNVERIFIED: 'amber',
  EXPIRES_BEFORE_PUBLISH: 'red',
};

const stateShort: Record<string, string> = {
  VALID: 'VALID',
  AT_RISK: 'AT RISK',
  UNVERIFIED: 'HOLD',
  EXPIRES_BEFORE_PUBLISH: 'BLOCKED',
};

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (`${line} ${word}`.trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function EvidenceGraph({
  claim,
  evaluation,
  publishDate,
}: {
  claim: Claim;
  evaluation: TemporalEvaluation;
  publishDate: string;
}) {
  const evidence = claim.evidence;
  const positions =
    evidence.length === 1
      ? [160]
      : evidence.length === 2
        ? [86, 194]
        : [50, 145, 240];
  const tone =
    evaluation.severity === 'blocked' ? '#FF5C5C' : evaluation.severity === 'watch' ? '#FFB547' : '#D8FF4F';
  const gateOpen = evaluation.severity !== 'blocked';

  return (
    <svg className="evidence-graph" viewBox="0 0 690 320" role="img" aria-label="Claim evidence graph">
      <defs>
        <pattern id="graphDots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.7" fill="#F2F4EC" fillOpacity="0.08" />
        </pattern>
        <marker id="arrowAcid" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 8 4 0 8Z" fill="#D8FF4F" fillOpacity="0.7" />
        </marker>
        <marker id="arrowAmber" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 8 4 0 8Z" fill="#FFB547" fillOpacity="0.8" />
        </marker>
      </defs>
      <rect width="690" height="320" fill="url(#graphDots)" />
      <text x="24" y="28" fill="#5D665F" fontSize="6.5" fontFamily="'JetBrains Mono', monospace" letterSpacing="1.5">
        EVIDENCE TOPOLOGY / {claim.id}
      </text>
      <text x="666" y="28" textAnchor="end" fill="#5D665F" fontSize="6" fontFamily="'JetBrains Mono', monospace">
        NODES {evidence.length + 2} · EDGES {evidence.length + 1}
      </text>

      <g>
        <rect x="32" y="108" width="196" height="96" fill="#0C100E" stroke="#2A3029" />
        <rect x="32" y="108" width="3" height="96" fill={tone} />
        <text x="48" y="128" fill={tone} fontSize="6.2" fontFamily="'JetBrains Mono', monospace" letterSpacing="1.2">
          CLAIM NODE · {claim.id}
        </text>
        {wrapText(claim.text, 38).map((line, index) => (
          <text
            key={line}
            x="48"
            y={148 + index * 11}
            fill="#E9ECE4"
            fontSize="7.4"
            fontFamily="'Inter', sans-serif"
          >
            {line}
          </text>
        ))}
        <text x="48" y="193" fill="#6F7871" fontSize="5.8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.7">
          {claim.category} · {claim.source}
        </text>
      </g>

      {evidence.map((node, index) => {
        const y = positions[index] - 32;
        const nodeColor = node.status === 'VERIFIED' ? '#D8FF4F' : node.status === 'PENDING' ? '#FFB547' : '#FF5C5C';
        const path = `M228 156 C300 156 320 ${y + 32} 396 ${y + 32}`;
        return (
          <g key={node.id}>
            <path
              d={path}
              fill="none"
              stroke={nodeColor}
              strokeOpacity="0.5"
              strokeWidth="1"
              strokeDasharray={node.status === 'PENDING' ? '3 5' : undefined}
              markerEnd="url(#arrowAcid)"
            />
            <circle cx="228" cy="156" r="2.5" fill={tone} />
            <rect x="396" y={y} width="262" height="64" fill="#0C100E" stroke="#262C27" />
            <rect x="396" y={y} width="3" height="64" fill={nodeColor} />
            <text x="412" y={y + 17} fill={nodeColor} fontSize="5.9" fontFamily="'JetBrains Mono', monospace" letterSpacing="1">
              {node.id} · {node.status}
            </text>
            {wrapText(node.label, 38).slice(0, 2).map((line, lineIndex) => (
              <text
                key={line}
                x="412"
                y={y + 33 + lineIndex * 11}
                fill="#D6DAD2"
                fontSize="8"
                fontFamily="'Inter', sans-serif"
              >
                {line}
              </text>
            ))}
            <text x="412" y={y + 55} fill="#6F7871" fontSize="5.6" fontFamily="'JetBrains Mono', monospace">
              {node.source}
            </text>
          </g>
        );
      })}

      <g>
        <path d="M130 204V244" stroke={gateOpen ? '#D8FF4F' : '#FF5C5C'} strokeOpacity="0.45" strokeDasharray="2 4" />
        <rect x="32" y="244" width="196" height="48" fill={gateOpen ? '#11160E' : '#180E0F'} stroke={gateOpen ? '#39452A' : '#4A2528'} />
        <LockKeyhole
          x="46"
          y="260"
          width="11"
          height="11"
          color={gateOpen ? '#D8FF4F' : '#FF5C5C'}
          strokeWidth={1.5}
        />
        <text x="64" y="262" fill="#C9CEC5" fontSize="6.2" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.8">
          PUBLISH GATE · {gateOpen ? 'OPEN' : 'HELD'}
        </text>
        <text x="46" y="280" fill="#6F7871" fontSize="6" fontFamily="'JetBrains Mono', monospace">
          {formatLongDate(publishDate)} / 08:00 UTC
        </text>
      </g>
    </svg>
  );
}

export function TemporalTruth() {
  const { publishOffset, setPublishOffset, pushToast } = useStudio();
  const [selectedId, setSelectedId] = useState('C-109');

  const publishDate = addDays(TODAY, publishOffset);
  const evaluations = useMemo(
    () =>
      claims.map((claim) => ({
        claim,
        evaluation: evaluateClaim(claim, publishDate),
      })),
    [publishDate],
  );

  const selectedPair =
    evaluations.find((pair) => pair.claim.id === selectedId) ?? evaluations[0];
  const selectedClaim = selectedPair.claim;
  const selectedEvaluation = selectedPair.evaluation;

  const blocked = evaluations.filter((pair) => pair.evaluation.severity === 'blocked').length;
  const watch = evaluations.filter((pair) => pair.evaluation.severity === 'watch').length;
  const valid = evaluations.filter((pair) => pair.evaluation.severity === 'clear').length;
  const totalEvidence = claims.reduce((sum, claim) => sum + claim.evidence.length, 0);
  const verifiedEvidence = claims.reduce(
    (sum, claim) => sum + claim.evidence.filter((node) => node.status === 'VERIFIED').length,
    0,
  );

  const totalDays = daysBetween(TIMELINE_START, TIMELINE_END);
  const pct = (iso: string) =>
    clampPercent((daysBetween(TIMELINE_START, iso) / totalDays) * 100);

  const todayPct = pct(TODAY);
  const publishPct = pct(publishDate);

  return (
    <div className="page page--temporal">
      <ScreenHead
        index="03"
        kicker="TEMPORAL TRUTH ENGINE"
        title={
          <>
            Claims that know when <span className="title-accent">they expire.</span>
          </>
        }
        description="A graph-based validity ledger that evaluates every promotional claim at the future publication instant — not at the moment it was written."
        badge={
          <span className="head-live">
            <StatusDot tone="acid" pulse /> UTC / DETERMINISTIC
          </span>
        }
        actions={
          <>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                pushToast({
                  title: 'Temporal ledger exported',
                  detail: `${claims.length} claims · ${totalEvidence} evidence edges · publish gate ${formatLongDate(publishDate)}.`,
                  tone: 'clear',
                })
              }
            >
              <Download size={14} strokeWidth={1.7} />
              Export ledger
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setPublishOffset(Math.min(PUBLISH_OFFSET_MAX, publishOffset + 14))}
            >
              <CalendarClock size={14} strokeWidth={1.8} />
              Advance +14 days
            </button>
          </>
        }
      />

      <div className="stats-row temporal-stats">
        <StatCard
          label="Valid at publish"
          value={String(valid).padStart(2, '0')}
          delta="CLEAR"
          note="C-121 · C-102"
          spark={[3, 3, 2, 2, 2, 2, 2, valid]}
        />
        <StatCard
          label="Advisory holds"
          value={String(watch).padStart(2, '0')}
          delta="WATCH"
          deltaTone="amber"
          note="Evidence pending at gate"
          spark={[1, 2, 1, 1, 2, 1, 1, watch]}
          sparkTone="amber"
        />
        <StatCard
          label="Invalidated claims"
          value={String(blocked).padStart(2, '0')}
          delta="BLOCKED"
          deltaTone="red"
          note="Expiry precedes publish"
          spark={[0, 0, 1, 1, 2, 2, 2, blocked]}
          sparkTone="red"
        />
        <StatCard
          label="Evidence nodes"
          value={String(totalEvidence).padStart(2, '0')}
          unit={` / ${String(verifiedEvidence).padStart(2, '0')}`}
          delta="GRAPH"
          deltaTone="muted"
          note="Verified / registered"
          spark={[4, 4, 5, 5, 6, 6, 6, verifiedEvidence]}
          sparkTone="blue"
        />
      </div>

      <Panel className="time-machine-panel" bracket>
        <div className="time-machine">
          <div className="tm-anchor">
            <span className="section-label">SCHEDULED PUBLISH</span>
            <div className="tm-date">
              {formatLongDate(publishDate)}
              <span className="tm-offset">T+{String(publishOffset).padStart(2, '0')}D</span>
            </div>
            <span className="tm-sub">All 5 claims evaluated at 08:00 UTC on this date.</span>
          </div>

          <div className="tm-control">
            <div className="tm-scale-labels">
              <span>NOV 12</span>
              <span className="tm-scale-mid">PUBLISH WINDOW</span>
              <span>JAN 26</span>
            </div>
            <input
              type="range"
              min={0}
              max={PUBLISH_OFFSET_MAX}
              value={publishOffset}
              onChange={(event) => setPublishOffset(Number(event.target.value))}
              className="tm-slider"
              aria-label="Simulated publish offset in days"
            />
            <div className="tm-ticks" aria-hidden="true">
              {Array.from({ length: 16 }, (_, index) => (
                <span key={index} className={index % 5 === 0 ? 'is-major' : ''} />
              ))}
            </div>
            <div className="tm-quick">
              {[
                { label: 'Today', value: 0 },
                { label: '+7D', value: 7 },
                { label: '+9D', value: 9 },
                { label: '+30D', value: 30 },
                { label: '+60D', value: 60 },
              ].map((quick) => (
                <button
                  type="button"
                  key={quick.label}
                  className={`tm-quick-btn ${publishOffset === quick.value ? 'is-active' : ''}`}
                  onClick={() => setPublishOffset(quick.value)}
                >
                  {quick.label}
                </button>
              ))}
            </div>
          </div>

          <div className={`tm-alert ${blocked > 0 ? 'is-blocked' : 'is-clear'}`}>
            {blocked > 0 ? <AlertTriangle size={15} strokeWidth={1.8} /> : <ShieldCheck size={15} strokeWidth={1.8} />}
            <div>
              <strong>
                {blocked > 0
                  ? `${blocked} claims invalidate before publish`
                  : 'All claims survive this publish window'}
              </strong>
              <span>
                {blocked > 0
                  ? 'Publication gate held until expiry or evidence is resolved.'
                  : `Gate open · ${watch} advisory hold${watch === 1 ? '' : 's'} remain.`}
              </span>
            </div>
            <span className="tm-gate">{blocked > 0 ? 'GATE HELD' : 'GATE OPEN'}</span>
          </div>
        </div>
      </Panel>

      <Panel className="ledger-panel" bracket>
        <PanelHead
          kicker="Claim validity ledger"
          title="Publication truth graph"
          meta={`${claims.length} CLAIMS / ${totalEvidence} EDGES`}
          actions={
            <span className="ledger-legend">
              <span><i className="legend-dot legend-dot--acid" /> VALID</span>
              <span><i className="legend-dot legend-dot--amber" /> WATCH</span>
              <span><i className="legend-dot legend-dot--red" /> BLOCKED</span>
            </span>
          }
        />

        <div className="ledger-ruler">
          <span className="ledger-ruler-label">CLAIM / SOURCE</span>
          <div className="ruler-track">
            {dateTicks.map((tick, index) => (
              <span
                key={tick}
                className={`ruler-tick ${index === 0 ? 'is-first' : ''} ${
                  index === dateTicks.length - 1 ? 'is-last' : ''
                }`}
                style={{ left: `${pct(tick)}%` }}
              >
                {formatShortDate(tick)}
              </span>
            ))}
            <span className="ruler-today" style={{ left: `${todayPct}%` }}>
              TODAY
            </span>
          </div>
          <span className="ledger-ruler-label ledger-ruler-label--right">STATE</span>
        </div>

        <div className="ledger-rows">
          {evaluations.map(({ claim, evaluation }) => {
            const start = pct(claim.issued);
            const end = pct(claim.expires);
            const clipped = daysBetween(TIMELINE_END, claim.expires) > 0;
            const tone = stateTone[evaluation.state];
            return (
              <button
                type="button"
                key={claim.id}
                className={`ledger-row ${selectedId === claim.id ? 'is-selected' : ''}`}
                onClick={() => setSelectedId(claim.id)}
              >
                <span className="claim-cell">
                  <span className="claim-code-line">
                    <strong>{claim.id}</strong>
                    <span className={`claim-category claim-category--${claim.category.toLowerCase()}`}>
                      {claim.category}
                    </span>
                  </span>
                  <span className="claim-text">{claim.text}</span>
                  <span className="claim-meta">
                    {claim.source} · EXP {formatShortDate(claim.expires)}
                  </span>
                </span>

                <span className="claim-track-cell">
                  <span className="track-line" />
                  <span className="claim-track">
                    <span className="claim-today" style={{ left: `${todayPct}%` }} />
                    <span className="claim-publish" style={{ left: `${publishPct}%` }} />
                    <span
                      className={`claim-bar claim-bar--${tone} ${clipped ? 'is-clipped' : ''}`}
                      style={{ left: `${start}%`, width: `${Math.max(1.2, end - start)}%` }}
                    >
                      {clipped ? <span className="claim-bar-arrow">→</span> : null}
                    </span>
                    <span
                      className={`claim-expiry claim-expiry--${tone}`}
                      style={{ left: `${end}%` }}
                    />
                  </span>
                </span>

                <span className="claim-state">
                  <Badge tone={tone} dot>
                    {stateShort[evaluation.state]}
                  </Badge>
                  <span className="claim-days">
                    {evaluation.daysToExpiry < 0
                      ? `${Math.abs(evaluation.daysToExpiry)}d ago`
                      : `${evaluation.daysToExpiry}d left`}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="ledger-foot">
          <span>BARS = VALIDITY WINDOW · DIAMOND = EXPIRY · DASHED = PUBLISH GATE</span>
          <span className="ledger-foot-right">
            <StatusDot tone="acid" /> EVALUATION PINNED TO {formatLongDate(publishDate)}
          </span>
        </div>
      </Panel>

      <div className="grid-12 temporal-lower">
        <Panel className="graph-panel span-7">
          <PanelHead
            kicker="Cross-check topology"
            title={`Claim ${selectedClaim.id} · evidence chain`}
            meta={<span className="meta-live"><StatusDot tone="acid" pulse /> GRAPH LIVE</span>}
          />
          <div className="graph-canvas">
            <EvidenceGraph
              claim={selectedClaim}
              evaluation={selectedEvaluation}
              publishDate={publishDate}
            />
          </div>
          <div className="graph-foot">
            <span><i className="legend-line legend-line--solid" /> VERIFIED EDGE</span>
            <span><i className="legend-line legend-line--dashed" /> PENDING EDGE</span>
            <span className="graph-foot-right">DETERMINISTIC CROSS-CHECK / NO MODEL CALL</span>
          </div>
        </Panel>

        <Panel className="inspector-panel span-5" bracket>
          <PanelHead
            kicker="Claim inspector"
            title={selectedClaim.id}
            meta={selectedClaim.category}
            actions={<Badge tone={stateTone[selectedEvaluation.state]} dot>{selectedEvaluation.label}</Badge>}
          />

          <blockquote className="claim-quote">“{selectedClaim.text}”</blockquote>

          <div className="claim-meta-grid">
            <div>
              <span>ISSUED</span>
              <strong>{formatLongDate(selectedClaim.issued)}</strong>
            </div>
            <div>
              <span>EXPIRES</span>
              <strong>{formatLongDate(selectedClaim.expires)}</strong>
            </div>
            <div>
              <span>PUBLISH</span>
              <strong>{formatLongDate(publishDate)}</strong>
            </div>
            <div>
              <span>VALIDITY</span>
              <strong className={selectedEvaluation.severity === 'blocked' ? 'text-red' : ''}>
                {selectedEvaluation.daysToExpiry < 0
                  ? `${Math.abs(selectedEvaluation.daysToExpiry)}D AGO`
                  : `${selectedEvaluation.daysToExpiry}D LEFT`}
              </strong>
            </div>
          </div>

          <div className={`temporal-verdict temporal-verdict--${selectedEvaluation.severity}`}>
            <span className="tv-icon">
              {selectedEvaluation.severity === 'blocked' ? (
                <ShieldAlert size={16} strokeWidth={1.8} />
              ) : selectedEvaluation.severity === 'watch' ? (
                <AlertTriangle size={16} strokeWidth={1.8} />
              ) : (
                <ShieldCheck size={16} strokeWidth={1.8} />
              )}
            </span>
            <div>
              <strong>{selectedEvaluation.label}</strong>
              <p>{selectedEvaluation.reason}</p>
            </div>
          </div>

          <div className="inspector-evidence">
            <div className="readout-section-head">
              <span className="section-label">EVIDENCE CHAIN</span>
              <span className="section-meta">{selectedClaim.evidence.length} NODES</span>
            </div>
            {selectedClaim.evidence.map((node) => (
              <div className="inspector-evidence-row" key={node.id}>
                <StatusDot
                  tone={node.status === 'VERIFIED' ? 'acid' : node.status === 'PENDING' ? 'amber' : 'red'}
                />
                <span className="evidence-copy">
                  <strong>{node.label}</strong>
                  <span>{node.source}{node.delta ? ` · ${node.delta}` : ''}</span>
                </span>
                <span className="evidence-status">{node.status}</span>
              </div>
            ))}
          </div>

          <div className="inspector-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                pushToast({
                  title: `Evidence requested for ${selectedClaim.id}`,
                  detail: 'Owner notified. Claim remains at the current temporal gate.',
                  tone: 'info',
                })
              }
            >
              <Waypoints size={14} strokeWidth={1.7} />
              Request evidence
            </button>
            <button
              type="button"
              className={`btn ${selectedEvaluation.severity === 'blocked' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() =>
                pushToast(
                  selectedEvaluation.severity === 'blocked'
                    ? {
                        title: `Claim ${selectedClaim.id} quarantined`,
                        detail: 'Removed from the publish bundle. Gate remains held for the campaign.',
                        tone: 'block',
                      }
                    : {
                        title: `Claim ${selectedClaim.id} cleared for ${formatShortDate(publishDate)}`,
                        detail: 'Validity window and evidence chain verified against the publish instant.',
                        tone: 'clear',
                      },
                )
              }
            >
              {selectedEvaluation.severity === 'blocked' ? (
                <ShieldAlert size={14} strokeWidth={1.8} />
              ) : (
                <ShieldCheck size={14} strokeWidth={1.8} />
              )}
              {selectedEvaluation.severity === 'blocked' ? 'Quarantine claim' : 'Clear for publish'}
              <ArrowRight size={12} className="btn-tail" />
            </button>
          </div>

          <div className="inspector-foot">
            <LockKeyhole size={11} strokeWidth={1.7} />
            <span>Decisions are written to the signed temporal ledger.</span>
          </div>
        </Panel>
      </div>

      <div className="page-footline">
        <span><StatusDot tone="acid" /> TEMPORAL ENGINE NOMINAL</span>
        <span>TF-01 PUBLISH &gt; EXPIRY → BLOCK</span>
        <span>TF-02 PENDING EVIDENCE → HOLD</span>
        <span className="footline-right">GATE {blocked > 0 ? 'HELD' : 'OPEN'} / {claimCountLabel()}</span>
      </div>
    </div>
  );
}

function claimCountLabel() {
  return `${claims.length} CLAIMS EVALUATED`;
}
