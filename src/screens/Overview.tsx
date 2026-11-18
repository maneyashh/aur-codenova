import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  AudioWaveform,
  BadgeCheck,
  Check,
  Cpu,
  FileText,
  Film,
  Image as ImageIcon,
  Layers,
  LayoutDashboard,
  LockKeyhole,
  Play,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Waypoints,
  Zap,
} from 'lucide-react';
import {
  Badge,
  Meter,
  Panel,
  PanelHead,
  RingGauge,
  ScreenHead,
  Segmented,
  Sparkline,
  StatCard,
  StatusDot,
} from '../components/ui';
import { useStudio } from '../state/studio';
import { useSimulation } from '../sim/SimulationProvider';
import {
  clearanceNotes,
  initialCompileLogs,
  pipelineStages,
  radarAxes,
  stageLogs,
  telemetryDeltas,
  traceSummary,
  verdictFeed,
  type FeedStatus,
} from '../data/overview';
import { brandProfile } from '../data/brand';
import { TODAY, addDays, formatShortDate } from '../core/claims';
import { ARBITER_THRESHOLD, runArbiterPass } from '../core/arbiter';

type Phase = 'complete' | 'running';
type FeedFilter = 'ALL' | 'FLAGGED' | 'CLEARED';
type ArbiterLog = { time: string; text: string; fallback: boolean };

const stageIcons = [Layers, ShieldCheck, ScanEye, Waypoints, AudioWaveform, BadgeCheck];

const feedIcons = {
  image: ImageIcon,
  text: FileText,
  deck: FileText,
  film: Film,
  ui: LayoutDashboard,
};

const statusTone: Record<FeedStatus, 'acid' | 'amber' | 'red'> = {
  CLEAR: 'acid',
  REVIEW: 'amber',
  BLOCKED: 'red',
};

const stageToneClass = {
  acid: 'is-acid',
  amber: 'is-amber',
  red: 'is-red',
} as const;

const utcStamp = () => new Date().toISOString().slice(11, 23);

function RadarChart() {
  const size = 320;
  const center = size / 2;
  const radius = 94;
  const count = radarAxes.length;
  const point = (value: number, index: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const;
  };

  const ring = (value: number) =>
    radarAxes.map((_, index) => point(value, index).join(',')).join(' ');

  const baseline = radarAxes.map((axis, index) => point(axis.baseline, index).join(',')).join(' ');
  const current = radarAxes.map((axis, index) => point(axis.value, index).join(',')).join(' ');

  return (
    <svg className="radar-chart" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Brand drift radar">
      <defs>
        <linearGradient id="radar-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#D8FF4F" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#D8FF4F" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      {[25, 50, 75, 100].map((value) => (
        <polygon
          key={value}
          points={ring(value)}
          className={`radar-grid ${value === 100 ? 'radar-grid--outer' : ''}`}
        />
      ))}
      {radarAxes.map((axis, index) => {
        const [x, y] = point(100, index);
        return <line key={axis.label} x1={center} y1={center} x2={x} y2={y} className="radar-spoke" />;
      })}
      <polygon points={baseline} className="radar-baseline" />
      <polygon points={current} className="radar-current" />
      {radarAxes.map((axis, index) => {
        const [x, y] = point(axis.value, index);
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
        const labelX = center + Math.cos(angle) * (radius + 28);
        const labelY = center + Math.sin(angle) * (radius + 28);
        const anchor = Math.abs(Math.cos(angle)) < 0.25 ? 'middle' : Math.cos(angle) > 0 ? 'start' : 'end';
        return (
          <g key={axis.label}>
            <circle cx={x} cy={y} r="2.2" className="radar-dot" />
            <text x={labelX} y={labelY + 2.5} textAnchor={anchor} className="radar-label">
              {axis.label}
            </text>
            <text x={labelX} y={labelY + 12} textAnchor={anchor} className="radar-value">
              {axis.value}
            </text>
          </g>
        );
      })}
      <circle cx={center} cy={center} r="1.4" className="radar-centre" />
    </svg>
  );
}

export function Overview() {
  const { navigate, compileToken, runCompilation, pushToast, publishOffset } = useStudio();
  const { scenario, tourActive, step, nextStep, markPipelineStarted, markPipelineComplete } =
    useSimulation();
  const [phase, setPhase] = useState<Phase>('complete');
  const [stageIndex, setStageIndex] = useState(pipelineStages.length);
  const [logs, setLogs] = useState(initialCompileLogs);
  const [filter, setFilter] = useState<FeedFilter>('ALL');
  const [stress, setStress] = useState(false);
  const [arbiterLogs, setArbiterLogs] = useState<ArbiterLog[]>([]);
  const previousToken = useRef(compileToken);

  const asset = scenario?.asset;
  const command = scenario?.command;
  const notes = command?.notes ?? clearanceNotes;
  const verdictScore = command?.verdictScore ?? 91.4;
  const verdictLabel = command?.verdictLabel ?? 'CLEAR WITH NOTES';
  const verdictTone = command?.verdictTone ?? 'amber';
  const verdictCopy =
    command?.verdictCopy ??
    'Publishable once two deterministic findings are resolved. No model judgement was used.';
  const verdictSignature = command?.signature ?? 'AURA-CORE / SHA-9F2C';
  const accent = scenario?.accent ?? '#D8FF4F';
  const riskRows =
    scenario?.id === 'visual'
      ? [
          { label: 'Perceptual drift', value: '26.9', note: 'max ΔE 73.1', tone: 'red' as const },
          { label: 'Claim validity', value: '74.0', note: '1 expiry block', tone: 'red' as const },
          { label: 'Voice fidelity', value: '94.6', note: '6 tokens patched', tone: 'acid' as const },
        ]
      : scenario?.id === 'privacy'
        ? [
            { label: 'Perceptual drift', value: '97.7', note: 'max ΔE 2.28', tone: 'acid' as const },
            { label: 'Claim validity', value: '100.0', note: '0 expiry blocks', tone: 'acid' as const },
            { label: 'Voice fidelity', value: '50.9', note: 'generative rewrite', tone: 'red' as const },
          ]
        : telemetryDeltas;
  const [titleMain, ...titleRestParts] = (asset?.title ?? 'Orbital Launch — Hero 07').split(' — ');
  const titleRest = titleRestParts.join(' — ');

  const arbiter = useMemo(
    () => runArbiterPass(scenario?.id ?? null, stress),
    [scenario?.id, stress],
  );
  const lowestPrimary = Math.min(...arbiter.routes.map((route) => route.primaryConfidence));

  useEffect(() => {
    if (compileToken === previousToken.current) return;
    previousToken.current = compileToken;
    setPhase('running');
    setStageIndex(0);
    setLogs([]);
    setStress(false);
    setArbiterLogs([]);
  }, [compileToken]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (stageIndex >= pipelineStages.length) {
      setPhase('complete');
      markPipelineComplete();
      pushToast({
        title: `Clearance issued · ${verdictScore.toFixed(1)}`,
        detail: `Verdict ${verdictLabel}. ${notes.length} deterministic findings require resolution.`,
        tone: verdictTone === 'red' ? 'block' : 'watch',
      });
      return;
    }

    const stage = pipelineStages[stageIndex];
    setLogs((current) => [...current, stageLogs[stage.id]]);
    const timer = window.setTimeout(() => {
      setStageIndex((current) => current + 1);
    }, 580);
    return () => window.clearTimeout(timer);
  }, [
    phase,
    stageIndex,
    pushToast,
    markPipelineComplete,
    verdictScore,
    verdictLabel,
    notes.length,
    verdictTone,
  ]);

  const progress = phase === 'running' ? (stageIndex / pipelineStages.length) * 100 : 100;

  const filteredFeed = verdictFeed.filter((asset) => {
    if (filter === 'ALL') return true;
    if (filter === 'FLAGGED') return asset.status !== 'CLEAR';
    return asset.status === 'CLEAR';
  });

  const publishDate = formatShortDate(addDays(TODAY, publishOffset));

  const openAsset = (status: FeedStatus, kind: string) => {
    if (status === 'BLOCKED') navigate('airlock');
    else if (kind === 'image') navigate('visual');
    else if (kind === 'deck') navigate('temporal');
    else navigate('voice');
  };

  const startCompilation = () => {
    markPipelineStarted();
    runCompilation();
  };

  const openNote = (domain: string) => {
    if (domain === 'TEMPORAL') navigate('temporal');
    else if (domain === 'VOICE') navigate('voice');
    else if (domain === 'AIRLOCK') navigate('airlock');
    else navigate('visual');
  };

  const openRemediation = () => {
    if (tourActive && step?.id === 'remediate') {
      nextStep();
      return;
    }
    navigate('voice');
  };

  const toggleEdgeCase = () => {
    if (stress) {
      setStress(false);
      setArbiterLogs([]);
      return;
    }
    const pass = runArbiterPass(scenario?.id ?? null, true);
    setStress(true);
    setArbiterLogs(
      pass.traceLines.map((line) => ({
        time: utcStamp(),
        text: line.replace(/^\[ARBITER\]\s*/, ''),
        fallback: !line.includes('no fallback'),
      })),
    );
    pushToast({
      title: `Arbiter resolved ${pass.fallbacksTriggered} edge cases · 0 external calls`,
      detail: `Confidence below ${ARBITER_THRESHOLD.toFixed(2)} rerouted to local AST/WASM engines → ${(pass.overallConfidence * 100).toFixed(1)}% in ${pass.totalMs.toFixed(1)}ms. Zero external model leakage.`,
      tone: 'clear',
    });
  };

  return (
    <div className="page page--overview">
      <ScreenHead
        index="01"
        kicker="COMPILER COMMAND"
        title={
          <>
            Brand governance, <span className="title-accent">compiled.</span>
          </>
        }
        description="A deterministic security clearance for every asset before it reaches the world. Exact math, temporal validity, authorial preservation — zero external inference."
        badge={
          <span className="head-live">
            <StatusDot tone="acid" pulse /> COMPILER ONLINE
          </span>
        }
        actions={
          <>
            <button type="button" className="btn btn-ghost" onClick={() => navigate('temporal')}>
              <Waypoints size={14} strokeWidth={1.7} />
              Open claim ledger
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={startCompilation}
              disabled={phase === 'running'}
              data-tour="run"
            >
              {phase === 'running' ? (
                <span className="btn-spinner" />
              ) : (
                <Play size={13} strokeWidth={2} fill="currentColor" />
              )}
              {phase === 'running' ? 'Compiling…' : 'Run compilation'}
            </button>
          </>
        }
      />

      {scenario ? (
        <div className="ingest-strip" style={{ ['--ingest-accent' as string]: accent }}>
          <span className="ingest-code">{scenario.code}</span>
          <span className="ingest-title">{scenario.title}</span>
          <span className="ingest-sep">/</span>
          <span className="ingest-file">{scenario.asset.file}</span>
          <span className="ingest-state">
            <StatusDot tone="red" pulse /> CRISIS LOADED
          </span>
        </div>
      ) : null}

      <div className="stats-row">
        <StatCard
          label="Portfolio integrity"
          value="98.2"
          unit="%"
          delta="+0.6%"
          spark={[94.1, 94.8, 95.2, 96.4, 96.1, 97.2, 97.8, 98.2]}
          note="Across 1,284 cleared assets"
        />
        <StatCard
          label="Assets cleared"
          value="1,284"
          delta="+34"
          spark={[62, 68, 64, 76, 82, 79, 91, 96]}
          sparkTone="blue"
          note="This week · 5 channels"
        />
        <StatCard
          label="Open drift flags"
          value="03"
          delta="−2"
          deltaTone="amber"
          spark={[8, 7, 9, 6, 6, 5, 4, 3]}
          sparkTone="amber"
          note="2 visual · 1 temporal"
        />
        <StatCard
          label="Median clearance"
          value="284"
          unit="ms"
          delta="−18ms"
          spark={[382, 364, 372, 342, 322, 310, 298, 284]}
          note="P95 412ms · local deterministic"
        />
      </div>

      <div className="grid-12 overview-hero">
        <Panel className="compile-panel span-8" bracket>
          <header className="compile-head">
            <div className="compile-head-copy">
              <div className="compile-runline">
                <StatusDot tone={phase === 'running' ? 'amber' : 'acid'} pulse={phase === 'running'} />
                <span>{phase === 'running' ? 'ACTIVE COMPILATION' : 'RUN COMPLETE'}</span>
                <span className="compile-run-id">{traceSummary.runId}</span>
                <span className="compile-sep">/</span>
                <span className="compile-mono">{phase === 'running' ? `${Math.round(progress)}%` : '03.216s'}</span>
              </div>
              <div className="compile-title-row">
                <h2 className="compile-title">
                  {titleMain} {titleRest ? <span>— {titleRest}</span> : null}
                </h2>
                <span className="asset-tag">{asset?.id ?? 'AST-2291'}</span>
              </div>
              <p className="compile-sub">
                {asset?.subtitle ?? 'Visual specimen + campaign copy'} · publish window NOV{' '}
                {publishDate} · 0 bytes external
              </p>
            </div>
            <div className="compile-thumb" aria-hidden="true">
              <svg viewBox="0 0 64 50">
                <rect width="64" height="50" fill="#080B09" />
                <ellipse cx="32" cy="24" rx="26" ry="8" fill="none" stroke={accent} strokeOpacity="0.34" transform="rotate(-18 32 24)" />
                <circle cx="32" cy="24" r="12" fill="#050706" stroke={accent} strokeOpacity="0.7" />
                <circle cx="32" cy="24" r="15.5" fill="none" stroke={accent} strokeOpacity="0.2" strokeDasharray="1 3" />
                <circle cx="53" cy="17" r="1.7" fill={accent} />
                <text x="32" y="45" textAnchor="middle" fill="#7C857E" fontSize="5" fontFamily="JetBrains Mono" letterSpacing="1">07</text>
              </svg>
            </div>
          </header>

          <div
            className={`pipeline ${phase === 'running' ? 'is-running' : ''}`}
            style={{ ['--chain-progress' as string]: `${progress}%` }}
          >
            {pipelineStages.map((stage, index) => {
              const Icon = stageIcons[index];
              const isComplete = phase === 'complete' || index < stageIndex;
              const isRunning = phase === 'running' && index === stageIndex;
              const isQueued = phase === 'running' && index > stageIndex;
              const toneClass = stageToneClass[stage.tone];
              return (
                <div
                  key={stage.id}
                  className={`pipeline-stage ${isComplete ? 'is-complete' : ''} ${
                    isRunning ? 'is-running' : ''
                  } ${isQueued ? 'is-queued' : ''} ${isComplete ? toneClass : ''}`}
                >
                  <div className="stage-rail">
                    <span className="stage-index">{stage.index}</span>
                    <span className="stage-node">
                      {isRunning ? <span className="stage-pulse" /> : null}
                      <Icon size={14} strokeWidth={1.6} />
                      {isComplete ? (
                        <span className={`stage-check ${toneClass}`}>
                          <Check size={7} strokeWidth={3} />
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="stage-copy">
                    <strong>{stage.label}</strong>
                    <span className="stage-detail">{isQueued ? 'queued' : stage.detail}</span>
                    <span className="stage-ms">{isQueued ? '—' : `${stage.ms}ms`}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="compile-console" data-tour="trace">
            <div className="console-head">
              <span className="console-title">
                <span className="console-glyph">▚</span> NEURO-SYMBOLIC TRACE
              </span>
              <span className="console-meta">STDOUT / LOCAL NODE</span>
            </div>
            <div className="console-body">
              {logs.length === 0 ? (
                <div className="console-line console-line--muted">
                  <span className="log-time">--:--:--.---</span>
                  <span className="log-stage">PIPELINE</span>
                  <span className="log-text">initialising deterministic execution graph…</span>
                </div>
              ) : null}
              {logs.map((log) => (
                <div className="console-line" key={`${log.stage}-${log.time}`}>
                  <span className="log-time">{log.time}</span>
                  <span className="log-stage">[{log.stage}]</span>
                  <span className="log-text">{log.text}</span>
                </div>
              ))}
              {arbiterLogs.map((log, index) => (
                <div
                  className={`console-line console-line--arbiter ${log.fallback ? 'is-fallback' : ''}`}
                  key={`arbiter-${index}`}
                >
                  <span className="log-time">{log.time}</span>
                  <span className="log-stage">[ARBITER]</span>
                  <span className="log-text">{log.text}</span>
                </div>
              ))}
              {phase === 'running' ? (
                <div className="console-line console-line--active">
                  <span className="log-time">··:··:··.···</span>
                  <span className="log-stage">[EXEC]</span>
                  <span className="log-text">
                    {pipelineStages[Math.min(stageIndex, pipelineStages.length - 1)]?.label.toLowerCase()} stage running
                  </span>
                  <span className="console-cursor" />
                </div>
              ) : (
                <div className="console-line console-line--muted">
                  <span className="log-time">14:31:03.217</span>
                  <span className="log-stage">[SEAL]</span>
                  <span className="log-text">audit record hashed · sha256:9f2c…c41a · awaiting note resolution</span>
                  <span className="console-cursor" />
                </div>
              )}
            </div>
            <div className="console-foot">
              <span className="console-foot-item">
                <LockKeyhole size={10} strokeWidth={1.8} /> TRACE SEALED
              </span>
              <span className="console-foot-item">
                {String(logs.length + arbiterLogs.length).padStart(2, '0')} EVENTS
              </span>
              <span className="console-foot-item">SHA-256 9F2C…C41A</span>
              <span className="console-foot-right">0 MODEL CALLS</span>
            </div>
          </div>
        </Panel>

        <Panel className="clearance-panel span-4" bracket>
          <PanelHead
            kicker="Clearance verdict"
            title="Final integrity"
            meta={<span className="meta-live"><StatusDot tone={verdictTone} /> ISSUED</span>}
          />
          <div className="verdict-hero">
            <RingGauge
              value={verdictScore}
              display={verdictScore.toFixed(1)}
              label="INTEGRITY"
              sub={verdictLabel}
              tone={verdictTone}
              size={112}
            />
            <div className="verdict-copy">
              <Badge tone={verdictTone} dot>
                {verdictLabel}
              </Badge>
              <p>{verdictCopy}</p>
              <span className="verdict-signature">{verdictSignature}</span>
            </div>
          </div>

          <div className="risk-block">
            <div className="risk-head">
              <span>RISK DECOMPOSITION</span>
              <span>3 DOMAINS</span>
            </div>
            {riskRows.map((delta) => (
              <div className="risk-row" key={delta.label}>
                <div className="risk-row-top">
                  <span>{delta.label}</span>
                  <span className={`risk-value risk-value--${delta.tone}`}>{delta.value}</span>
                </div>
                <Meter value={Number(delta.value)} tone={delta.tone} height={3} />
                <span className="risk-note">{delta.note}</span>
              </div>
            ))}
          </div>

          <div className="notes-block">
            <div className="notes-head">
              <span>OPEN NOTES</span>
              <span className="notes-count">{String(notes.length).padStart(2, '0')}</span>
            </div>
            {notes.map((note) => (
              <button
                type="button"
                className="note-row"
                key={note.code}
                onClick={() => openNote(note.domain)}
              >
                <span className={`note-code note-code--${note.tone}`}>{note.code}</span>
                <span className="note-label">{note.label}</span>
                <ArrowUpRight size={12} strokeWidth={1.7} />
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-ghost btn-full" onClick={() => navigate('visual')}>
            <ScanEye size={14} strokeWidth={1.7} />
            Open forensic readout
            <ArrowUpRight size={12} className="btn-tail" />
          </button>
        </Panel>
      </div>

      <div className="arbiter-wrap" data-tour="arbiter">
        <Panel className="arbiter-panel" bracket>
          <PanelHead
            kicker="Round 3 · Improvement 01"
            title="Autonomous Multi-Model Arbiter"
            meta={`CUTOFF ${ARBITER_THRESHOLD.toFixed(2)} · 0 EXTERNAL LLM CALLS`}
            actions={
              <button
                type="button"
                className={`btn btn-small ${stress ? 'btn-ghost' : 'btn-primary'}`}
                onClick={toggleEdgeCase}
              >
                <Zap size={12} strokeWidth={2} />
                {stress ? 'Reset to nominal' : 'Simulate <0.85 Edge Case'}
              </button>
            }
          />

          <div className="arbiter-body">
            <div className="arbiter-gauge">
              <div className="arbiter-gauge-top">
                <span className="arbiter-gauge-label">CONFIDENCE GAUGE</span>
                <strong className={arbiter.fallbacksTriggered > 0 ? 'is-resolved' : ''}>
                  {(arbiter.overallConfidence * 100).toFixed(1)}%
                </strong>
              </div>
              <div
                className="arbiter-track"
                role="img"
                aria-label={`Overall confidence ${(arbiter.overallConfidence * 100).toFixed(1)} percent, cutoff ${ARBITER_THRESHOLD}`}
              >
                <i className="arbiter-fill" style={{ width: `${arbiter.overallConfidence * 100}%` }} />
                <i className="arbiter-low" style={{ left: `${lowestPrimary * 100}%` }} />
                <i className="arbiter-cutoff" style={{ left: `${ARBITER_THRESHOLD * 100}%` }}>
                  <span>{ARBITER_THRESHOLD.toFixed(2)}</span>
                </i>
              </div>
              <div className="arbiter-gauge-foot">
                <span>LOWEST PRIMARY {lowestPrimary.toFixed(2)}</span>
                <span>
                  {arbiter.fallbacksTriggered} FALLBACKS · {arbiter.totalMs.toFixed(1)}ms
                </span>
              </div>
            </div>

            <div className="arbiter-lanes">
              <div className="arbiter-lane arbiter-lane--head">
                <span>LANE</span>
                <span>PRIMARY ENGINE</span>
                <span>CONFIDENCE</span>
                <span />
                <span>SECONDARY AST/WASM FALLBACK</span>
                <span>RESOLVED</span>
              </div>
              {arbiter.routes.map((route) => (
                <div
                  className={`arbiter-lane ${route.fellBack ? 'is-fallback' : ''}`}
                  key={route.lane}
                  title={route.edgeCase}
                >
                  <span className="arbiter-lane-name">{route.lane}</span>
                  <span className="arbiter-cell">
                    <strong>{route.primaryEngine}</strong>
                    <em>{route.fellBack ? route.edgeCase : 'nominal'}</em>
                  </span>
                  <span className="arbiter-cell">
                    <strong className={route.fellBack ? 'is-low' : ''}>
                      {route.primaryConfidence.toFixed(2)}
                    </strong>
                    <span className="arbiter-mini">
                      <i style={{ width: `${route.primaryConfidence * 100}%` }} />
                      <b style={{ left: `${ARBITER_THRESHOLD * 100}%` }} />
                    </span>
                  </span>
                  <ArrowRight size={12} strokeWidth={1.8} className="arbiter-arrow" />
                  <span className="arbiter-cell">
                    <strong>{route.fellBack ? route.secondaryEngine : 'not required'}</strong>
                    <em>{route.fellBack ? `${route.ms}ms · local` : 'primary accepted'}</em>
                  </span>
                  <span className="arbiter-resolved">
                    {(route.resolvedConfidence * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="arbiter-foot">
            <span>
              <Cpu size={11} strokeWidth={1.7} /> DETERMINISTIC LOCAL FALLBACK · NO NETWORK
            </span>
            <span>{arbiter.routes.reduce((sum, route) => sum + route.externalLlmCalls, 0)} EXTERNAL LLM CALLS</span>
          </div>
        </Panel>
      </div>

      <div className="remediation-strip" data-tour="remediate" style={{ ['--ingest-accent' as string]: accent }}>
        <span className="remediation-mark" aria-hidden="true">
          <Sparkles size={18} strokeWidth={1.6} />
        </span>
        <div className="remediation-copy">
          <span className="panel-kicker">Remediation ready</span>
          <h2>
            {scenario?.id === 'privacy'
              ? 'Restore the author. Redact the payload.'
              : 'Patch the signal. Expire the claim.'}
          </h2>
          <p>
            {scenario?.id === 'privacy'
              ? 'Fourteen identifiers are vaulted locally and the model paragraph is replaced by a minimum-edit patch. The author’s cadence survives intact.'
              : 'Solar Lime replaces the off-brand magenta, the ORBIT30 claim is expired before publish, and the lockup regains its 24px clearspace. No sentence is regenerated.'}
          </p>
        </div>
        <div className="remediation-actions">
          <span className="remediation-metric">
            <strong>94.8</strong>
            <span>FIDELITY · 6 TOKENS</span>
          </span>
          <button type="button" className="btn btn-primary" onClick={openRemediation}>
            <Sparkles size={14} strokeWidth={1.8} />
            Apply surgical patch
            <ArrowUpRight size={12} className="btn-tail" />
          </button>
        </div>
      </div>

      <div className="grid-12 overview-lower">
        <Panel className="feed-panel span-7">
          <PanelHead
            kicker="Live clearance"
            title="Verdict feed"
            meta={`${filteredFeed.length} ASSETS`}
            actions={
              <Segmented
                value={filter}
                onChange={setFilter}
                ariaLabel="Filter verdict feed"
                size="sm"
                options={[
                  { value: 'ALL', label: 'All', count: verdictFeed.length },
                  { value: 'FLAGGED', label: 'Flagged', count: 3 },
                  { value: 'CLEARED', label: 'Cleared', count: 3 },
                ]}
              />
            }
          />
          <div className="feed-table">
            <div className="feed-row feed-row--head">
              <span>Asset</span>
              <span>Channel</span>
              <span>Integrity</span>
              <span>Verdict</span>
              <span className="feed-age">Age</span>
            </div>
            {filteredFeed.map((asset) => {
              const Icon = feedIcons[asset.kind];
              return (
                <button
                  type="button"
                  className="feed-row feed-row--item"
                  key={asset.id}
                  onClick={() => openAsset(asset.status, asset.kind)}
                >
                  <span className="feed-asset">
                    <span className="feed-thumb" style={{ ['--asset-tint' as string]: asset.tint }}>
                      <Icon size={12} strokeWidth={1.6} />
                    </span>
                    <span className="feed-asset-copy">
                      <strong>{asset.name}</strong>
                      <span>{asset.id}</span>
                    </span>
                  </span>
                  <span className="feed-channel">{asset.channel}</span>
                  <span className="feed-score">{asset.score}</span>
                  <span>
                    <Badge tone={statusTone[asset.status]} dot>
                      {asset.status}
                    </Badge>
                  </span>
                  <span className="feed-age">{asset.age}</span>
                </button>
              );
            })}
          </div>
          <div className="feed-foot">
            <span>
              <StatusDot tone="amber" /> 3 assets awaiting deterministic note resolution
            </span>
            <span className="feed-foot-right">QUEUE 02:41:08 · AUTO-REVIEW OFF</span>
          </div>
        </Panel>

        <Panel className="radar-panel span-5">
          <PanelHead
            kicker="Signal telemetry"
            title="Drift radar"
            meta={<span className="meta-live"><StatusDot tone="acid" pulse /> LIVE</span>}
          />
          <div className="radar-wrap">
            <RadarChart />
            <div className="radar-legend">
              <span><i className="legend-dot legend-dot--acid" /> Current</span>
              <span><i className="legend-dash" /> Contract baseline</span>
            </div>
          </div>
          <div className="radar-mini">
            {riskRows.map((delta) => (
              <div className="radar-mini-item" key={delta.label}>
                <span className={`radar-mini-mark radar-mini-mark--${delta.tone}`} />
                <span className="radar-mini-label">{delta.label}</span>
                <strong className={`radar-mini-value radar-mini-value--${delta.tone}`}>
                  {delta.value}
                </strong>
              </div>
            ))}
          </div>
          <div className="radar-foot">
            <span>6 AXES / 41 SYMBOLIC RULES</span>
            <span className="radar-foot-right">
              <Sparkline values={[88, 86, 84, 82, 85, 88, 91]} tone="amber" height={16} width={62} />
              Δ vs contract
            </span>
          </div>
        </Panel>
      </div>

      <div className="page-footline">
        <span>
          <StatusDot tone="acid" /> ALL DETERMINISTIC ENGINES NOMINAL
        </span>
        <span>POLICY {brandProfile.policySet}</span>
        <span>OPERATOR {brandProfile.operator}</span>
        <span className="footline-right">NO EXTERNAL INFERENCE IN THIS SESSION</span>
      </div>
    </div>
  );
}