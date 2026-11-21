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
import { verdictFeed, type CompileLog, type FeedStatus } from '../data/overview';
import { brandProfile } from '../data/brand';
import { formatShortDate } from '../core/claims';
import { ARBITER_THRESHOLD, runArbiterPass } from '../core/arbiter';
import { buildClearanceReport } from '../core/compiler';

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

function RadarChart({ axes }: { axes: { label: string; value: number; baseline: number }[] }) {
  const size = 320;
  const center = size / 2;
  const radius = 94;
  const count = axes.length;
  const point = (value: number, index: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const;
  };

  const ring = (value: number) =>
    axes.map((_, index) => point(value, index).join(',')).join(' ');

  const baseline = axes.map((axis, index) => point(axis.baseline, index).join(',')).join(' ');
  const current = axes.map((axis, index) => point(axis.value, index).join(',')).join(' ');

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
      {axes.map((axis, index) => {
        const [x, y] = point(100, index);
        return <line key={axis.label} x1={center} y1={center} x2={x} y2={y} className="radar-spoke" />;
      })}
      <polygon points={baseline} className="radar-baseline" />
      <polygon points={current} className="radar-current" />
      {axes.map((axis, index) => {
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
  const report = useMemo(
    () => buildClearanceReport(scenario, publishOffset),
    [scenario, publishOffset],
  );

  const [phase, setPhase] = useState<Phase>('complete');
  const [stageIndex, setStageIndex] = useState(report.stages.length);
  const [logs, setLogs] = useState<CompileLog[]>(report.logs);
  const [filter, setFilter] = useState<FeedFilter>('ALL');
  const [stress, setStress] = useState(false);
  const [arbiterLogs, setArbiterLogs] = useState<ArbiterLog[]>([]);
  const previousToken = useRef(compileToken);
  const previousScenario = useRef(report.scenario.id);

  const asset = report.asset;
  const accent = report.scenario.accent;
  const notes = report.notes;

  const arbiter = useMemo(
    () => (stress ? runArbiterPass(report.signals, true) : report.arbiter),
    [report.arbiter, report.signals, stress],
  );
  const lowestPrimary = Math.min(...arbiter.routes.map((route) => route.primaryConfidence));

  const feedRows = useMemo(() => {
    const [head, ...rest] = verdictFeed;
    const status: FeedStatus =
      report.verdictTone === 'acid' ? 'CLEAR' : report.verdictTone === 'amber' ? 'REVIEW' : 'BLOCKED';
    return [
      {
        ...head,
        id: report.asset.id,
        name: report.asset.name,
        channel: report.asset.channel,
        score: report.score.toFixed(1),
        status,
        tint: accent,
      },
      ...rest,
    ];
  }, [accent, report]);

  const flaggedCount = feedRows.filter((entry) => entry.status !== 'CLEAR').length;
  const clearedCount = feedRows.length - flaggedCount;

  // Reset the local pipeline view when the dataset changes.
  useEffect(() => {
    if (previousScenario.current === report.scenario.id) return;
    previousScenario.current = report.scenario.id;
    setPhase('complete');
    setStageIndex(report.stages.length);
    setLogs(report.logs);
    setStress(false);
    setArbiterLogs([]);
  }, [report]);

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
    if (stageIndex >= report.stages.length) {
      setPhase('complete');
      setLogs(report.logs);
      markPipelineComplete();
      pushToast({
        title: `Clearance issued · ${report.score.toFixed(1)}`,
        detail: `Verdict ${report.verdictLabel}. ${notes.length} deterministic findings require resolution.`,
        tone: report.verdictTone === 'red' ? 'block' : report.verdictTone === 'amber' ? 'watch' : 'clear',
      });
      return;
    }

    const stage = report.stages[stageIndex];
    setLogs((current) => [...current, report.logByStage[stage.id]]);
    const timer = window.setTimeout(() => {
      setStageIndex((current) => current + 1);
    }, 520);
    return () => window.clearTimeout(timer);
  }, [
    phase,
    stageIndex,
    pushToast,
    markPipelineComplete,
    notes.length,
    report,
  ]);

  const progress = phase === 'running' ? (stageIndex / report.stages.length) * 100 : 100;

  const filteredFeed = feedRows.filter((entry) => {
    if (filter === 'ALL') return true;
    if (filter === 'FLAGGED') return entry.status !== 'CLEAR';
    return entry.status === 'CLEAR';
  });

  const publishDate = formatShortDate(report.publishDate);

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
    const pass = runArbiterPass(report.signals, true);
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
      detail: `Confidence below ${ARBITER_THRESHOLD.toFixed(2)} rerouted to independent symbolic cross-checks → ${(pass.overallConfidence * 100).toFixed(1)}% in ${pass.totalMs.toFixed(1)}ms.`,
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
          label="Asset integrity"
          value={report.score.toFixed(1)}
          unit="%"
          delta={report.verdictTone === 'acid' ? 'CLEAR' : report.verdictTone === 'amber' ? 'REVIEW' : 'BLOCK'}
          deltaTone={report.verdictTone === 'acid' ? 'acid' : report.verdictTone === 'amber' ? 'amber' : 'red'}
          spark={[report.score - 6, report.score - 4, report.score - 3, report.score - 1, report.score]}
          sparkTone={report.verdictTone === 'red' ? 'red' : report.verdictTone === 'amber' ? 'amber' : 'acid'}
          note={`${notes.length} open notes · ${report.verdictLabel}`}
        />
        <StatCard
          label="Entities vaulted"
          value={String(report.airlock.entities.length).padStart(2, '0')}
          delta="LOCAL"
          spark={[2, 3, 3, 4, report.airlock.entities.length]}
          sparkTone="blue"
          note={`${report.airlock.protectedCharacters} chars protected`}
        />
        <StatCard
          label="Claims blocked"
          value={String(report.temporal.blocked).padStart(2, '0')}
          delta={`${report.temporal.watch} WATCH`}
          deltaTone="amber"
          spark={[0, 1, 1, 2, report.temporal.blocked]}
          sparkTone="amber"
          note={`Evaluated at ${publishDate}`}
        />
        <StatCard
          label="Pipeline latency"
          value={String(Math.round(report.totalMs))}
          unit="ms"
          delta="LOCAL"
          spark={[310, 298, 302, 290, report.totalMs]}
          note={`${report.stages.length} stages · 0 model calls`}
        />
      </div>

      <div className="grid-12 overview-hero">
        <Panel className="compile-panel span-8" bracket>
          <header className="compile-head">
            <div className="compile-head-copy">
              <div className="compile-runline">
                <StatusDot tone={phase === 'running' ? 'amber' : 'acid'} pulse={phase === 'running'} />
                <span>{phase === 'running' ? 'ACTIVE COMPILATION' : 'RUN COMPLETE'}</span>
                <span className="compile-run-id">{report.runId}</span>
                <span className="compile-sep">/</span>
                <span className="compile-mono">
                  {phase === 'running' ? `${Math.round(progress)}%` : `${(report.totalMs / 1000).toFixed(3)}s`}
                </span>
              </div>
              <div className="compile-title-row">
                <h2 className="compile-title">
                  {report.headline.main}{' '}
                  {report.headline.rest ? <span>— {report.headline.rest}</span> : null}
                </h2>
                <span className="asset-tag">{asset.id}</span>
              </div>
              <p className="compile-sub">
                {asset.subtitle} · publish window {publishDate} · 0 bytes external
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
            {report.stages.map((stage, index) => {
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
                    {report.stages[Math.min(stageIndex, report.stages.length - 1)]?.label.toLowerCase()} stage running
                  </span>
                  <span className="console-cursor" />
                </div>
              ) : (
                <div className="console-line console-line--muted">
                  <span className="log-time">{report.logs[report.logs.length - 1].time}</span>
                  <span className="log-stage">[SEAL]</span>
                  <span className="log-text">audit record hashed · sha256:{report.traceHashShort} · awaiting note resolution</span>
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
              <span className="console-foot-item">SHA-256 {report.traceHashShort}</span>
              <span className="console-foot-right">0 MODEL CALLS</span>
            </div>
          </div>
        </Panel>

        <Panel className="clearance-panel span-4" bracket>
          <PanelHead
            kicker="Clearance verdict"
            title="Final integrity"
            meta={<span className="meta-live"><StatusDot tone={report.verdictTone} /> ISSUED</span>}
          />
          <div className="verdict-hero">
            <RingGauge
              value={report.score}
              display={report.score.toFixed(1)}
              label="INTEGRITY"
              sub={report.verdictShort}
              tone={report.verdictTone}
              size={112}
            />
            <div className="verdict-copy">
              <Badge tone={report.verdictTone} dot>
                {report.verdictLabel}
              </Badge>
              <p>{report.verdictCopy}</p>
              <span className="verdict-signature">{report.signature}</span>
            </div>
          </div>

          <div className="risk-block">
            <div className="risk-head">
              <span>DOMAIN INTEGRITY</span>
              <span>4 DOMAINS</span>
            </div>
            {report.domains.map((domain) => (
              <div className="risk-row" key={domain.key}>
                <div className="risk-row-top">
                  <span>{domain.label}</span>
                  <span className={`risk-value risk-value--${domain.tone}`}>{domain.value.toFixed(1)}</span>
                </div>
                <Meter value={domain.value} tone={domain.tone} height={3} />
                <span className="risk-note">{domain.note}</span>
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
            kicker="Adaptive routing · symbolic ensemble"
            title="Autonomous Multi-Engine Arbiter"
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
                <span className="arbiter-gauge-label">FUSED CONFIDENCE</span>
                <strong className={arbiter.fallbacksTriggered > 0 ? 'is-resolved' : ''}>
                  {(arbiter.overallConfidence * 100).toFixed(1)}%
                </strong>
              </div>
              <div
                className="arbiter-track"
                role="img"
                aria-label={`Fused confidence ${(arbiter.overallConfidence * 100).toFixed(1)} percent, cutoff ${ARBITER_THRESHOLD}`}
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
                <span>SECONDARY CROSS-CHECK</span>
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
                    <em>{route.fellBack ? route.secondaryNote : 'primary accepted'}</em>
                  </span>
                  <span
                    className={`arbiter-resolved ${
                      route.resolvedConfidence < ARBITER_THRESHOLD ? 'is-marginal' : ''
                    }`}
                    title={
                      route.fellBack
                        ? `Cross-check ${(route.secondaryConfidence * 100).toFixed(1)}% discounted by disagreement with the primary`
                        : 'Primary pass accepted without escalation'
                    }
                  >
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
            {report.voice.variant === 'llm'
              ? 'Restore the author. Redact the payload.'
              : 'Patch the signal. Expire the claim.'}
          </h2>
          <p>
            {report.voice.variant === 'llm'
              ? `${report.airlock.entities.length} identifiers are vaulted locally and the model paragraph is replaced by a minimum-edit patch. The author’s cadence survives intact.`
              : 'Solar Lime replaces the off-brand magenta, the ORBIT30 claim is expired before publish, and the lockup regains its 24px clearspace. No sentence is regenerated.'}
          </p>
        </div>
        <div className="remediation-actions">
          <span className="remediation-metric">
            <strong>{report.voice.score.toFixed(1)}</strong>
            <span>FIDELITY · {report.voice.patches} TOKENS</span>
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
                  { value: 'ALL', label: 'All', count: feedRows.length },
                  { value: 'FLAGGED', label: 'Flagged', count: flaggedCount },
                  { value: 'CLEARED', label: 'Cleared', count: clearedCount },
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
            {filteredFeed.map((entry) => {
              const Icon = feedIcons[entry.kind];
              return (
                <button
                  type="button"
                  className="feed-row feed-row--item"
                  key={entry.id}
                  onClick={() => openAsset(entry.status, entry.kind)}
                >
                  <span className="feed-asset">
                    <span className="feed-thumb" style={{ ['--asset-tint' as string]: entry.tint }}>
                      <Icon size={12} strokeWidth={1.6} />
                    </span>
                    <span className="feed-asset-copy">
                      <strong>{entry.name}</strong>
                      <span>{entry.id}</span>
                    </span>
                  </span>
                  <span className="feed-channel">{entry.channel}</span>
                  <span className="feed-score">{entry.score}</span>
                  <span>
                    <Badge tone={statusTone[entry.status]} dot>
                      {entry.status}
                    </Badge>
                  </span>
                  <span className="feed-age">{entry.age}</span>
                </button>
              );
            })}
          </div>
          <div className="feed-foot">
            <span>
              <StatusDot tone="amber" /> {flaggedCount} assets awaiting deterministic note resolution
            </span>
            <span className="feed-foot-right">SESSION QUEUE · AUTO-REVIEW OFF</span>
          </div>
        </Panel>

        <Panel className="radar-panel span-5">
          <PanelHead
            kicker="Signal telemetry"
            title="Drift radar"
            meta={<span className="meta-live"><StatusDot tone="acid" pulse /> LIVE</span>}
          />
          <div className="radar-wrap">
            <RadarChart axes={report.radarAxes} />
            <div className="radar-legend">
              <span><i className="legend-dot legend-dot--acid" /> Current</span>
              <span><i className="legend-dash" /> Contract baseline</span>
            </div>
          </div>
          <div className="radar-mini">
            {report.domains.map((domain) => (
              <div className="radar-mini-item" key={domain.key}>
                <span className={`radar-mini-mark radar-mini-mark--${domain.tone}`} />
                <span className="radar-mini-label">{domain.label}</span>
                <strong className={`radar-mini-value radar-mini-value--${domain.tone}`}>
                  {domain.value.toFixed(1)}
                </strong>
              </div>
            ))}
          </div>
          <div className="radar-foot">
            <span>6 AXES / {report.airlock.ruleCount} SYMBOLIC RULES</span>
            <span className="radar-foot-right">
              <Sparkline values={report.radarAxes.map((axis) => axis.value)} tone="amber" height={16} width={62} />
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
        <span className="footline-right">NO EXTERNAL INFERENCE · {report.traceHashShort}</span>
      </div>
    </div>
  );
}
