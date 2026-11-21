import { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  Download,
  Image as ImageIcon,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import {
  Badge,
  Meter,
  Panel,
  PanelHead,
  RingGauge,
  ScreenHead,
  StatusDot,
  Toggle,
} from '../components/ui';
import { useStudio } from '../state/studio';
import { brandProfile, type AccessibilityCheck } from '../data/brand';
import { useScenario } from '../sim/SimulationProvider';
import type { PosterTheme } from '../sim/types';
import { buildClearanceReport } from '../core/compiler';
import { downloadJson } from '../lib/download';
import {
  BRAND_BASELINE_HEX,
  BRAND_BASELINE_TOKEN,
  ROGUE_PRESETS,
  createDomRadar,
  type DomRadar,
  type DriftReading,
} from '../core/domRadar';

type PosterProps = {
  heatmap: boolean;
  geometry: boolean;
  probes: boolean;
  theme: PosterTheme;
  a11y: AccessibilityCheck[];
};

function PosterArtifact({ heatmap, geometry, probes, theme, a11y }: PosterProps) {
  const t = theme;
  return (
    <svg
      className="poster-svg"
      viewBox="0 0 720 900"
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={`${t.headline} ${t.headlineAccent} brand specimen`}
    >
      <defs>
        <linearGradient id="posterField" x1="0" y1="0" x2="0.65" y2="1">
          <stop offset="0%" stopColor={t.fieldTop} />
          <stop offset="52%" stopColor={t.fieldMid} />
          <stop offset="100%" stopColor={t.fieldBottom} />
        </linearGradient>
        <radialGradient id="posterGlow" cx="55%" cy="37%" r="52%">
          <stop offset="0%" stopColor={t.glow} stopOpacity="0.18" />
          <stop offset="42%" stopColor={t.glow} stopOpacity="0.06" />
          <stop offset="100%" stopColor={t.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="planetFade" cx="42%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#0B100D" />
          <stop offset="78%" stopColor="#030504" />
          <stop offset="100%" stopColor="#000000" />
        </radialGradient>
        <filter id="posterSoft" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="13" />
        </filter>
        <pattern id="posterGrid" width="45" height="45" patternUnits="userSpaceOnUse">
          <path d="M45 0H0V45" fill="none" stroke={t.grid} strokeOpacity="0.028" />
        </pattern>
        <pattern id="failHatch" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 8 8 0" stroke="#FF5C5C" strokeWidth="1" strokeOpacity="0.75" />
        </pattern>
        <clipPath id="posterClip">
          <rect width="720" height="900" rx="1.5" />
        </clipPath>
      </defs>

      <g clipPath="url(#posterClip)">
        <rect width="720" height="900" fill="url(#posterField)" />
        <rect width="720" height="900" fill="url(#posterGrid)" />
        <rect width="720" height="900" fill="url(#posterGlow)" />

        <g opacity="0.55">
          <path d="M44 88H676" stroke={t.ink} strokeOpacity="0.12" />
          <path d="M44 844H676" stroke={t.ink} strokeOpacity="0.1" />
        </g>

        {/* HELIOS lockup */}
        <g>
          <circle cx="53" cy="44" r="8.5" fill="none" stroke={t.accent} strokeWidth="1.2" />
          <circle cx="53" cy="44" r="3.3" fill={t.accent} />
          <path
            d="M43 35.5A12 12 0 0 1 63 35.5"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.42"
            strokeWidth="0.8"
          />
          <text
            x="71"
            y="42"
            fill={t.ink}
            fontSize="12.5"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="600"
            letterSpacing="2.2"
          >
            HELIOS
          </text>
          <text
            x="71"
            y="52.5"
            fill="#8A918C"
            fontSize="5.4"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="2.3"
          >
            DYNAMICS
          </text>
        </g>
        <g textAnchor="end">
          <text
            x="676"
            y="39"
            fill="#9AA29B"
            fontSize="6.2"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="1.7"
          >
            {t.campaign}
          </text>
          <text
            x="676"
            y="50"
            fill="#68716A"
            fontSize="5.4"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="1.5"
          >
            {t.dateLine}
          </text>
        </g>

        {/* Orbital field */}
        <g>
          <ellipse
            cx="400"
            cy="326"
            rx="302"
            ry="93"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.19"
            strokeDasharray="1 5"
            transform="rotate(-17 400 326)"
          />
          <ellipse
            cx="400"
            cy="326"
            rx="258"
            ry="72"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.12"
            transform="rotate(18 400 326)"
          />
          <circle cx="400" cy="326" r="242" fill={t.accent} fillOpacity="0.08" filter="url(#posterSoft)" />
          <circle cx="400" cy="326" r="201" fill="url(#planetFade)" />
          <circle
            cx="400"
            cy="326"
            r="201"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.55"
            strokeWidth="1.4"
            strokeDasharray="548 716"
            transform="rotate(-37 400 326)"
          />
          <circle
            cx="400"
            cy="326"
            r="188"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.1"
            strokeDasharray="1 4"
          />
          <circle cx="400" cy="326" r="212" fill="none" stroke={t.ink} strokeOpacity="0.06" />
          <path d="M400 104V548M178 326H622" stroke={t.ink} strokeOpacity="0.05" />
          <path d="M400 112v10M400 530v10M184 326h10M606 326h10" stroke={t.accent} strokeOpacity="0.4" />
        </g>

        {/* Satellite + telemetry */}
        <g>
          <path
            d="M560 258c16-9 29-12 43-10"
            fill="none"
            stroke={t.accent}
            strokeOpacity="0.35"
            strokeDasharray="2 4"
          />
          <circle cx="604" cy="248" r="3.2" fill={t.accent} />
          <circle cx="604" cy="248" r="8" fill="none" stroke={t.accent} strokeOpacity="0.25" />
          <text
            x="618"
            y="251"
            fill="#9AA29B"
            fontSize="5.8"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.8"
          >
            SOL-07
          </text>
        </g>
        <g textAnchor="end" fontFamily="'JetBrains Mono', monospace" fontSize="5.8" fill="#707A72">
          <text x="676" y="128">ALT 412 KM</text>
          <text x="676" y="139">V 7.66 KM/S</text>
          <text x="676" y="150">INC 18.2°</text>
          <path d="M622 118H676" stroke="#707A72" strokeOpacity="0.25" />
        </g>
        <text
          x="28"
          y="330"
          fill="#6C756E"
          fontSize="6.4"
          fontFamily="'JetBrains Mono', monospace"
          letterSpacing="2.2"
          transform="rotate(-90 28 330)"
        >
          {t.vertical}
        </text>

        {/* Verification decal (intentional contrast finding) */}
        <g>
          <rect x="548" y="486" width="132" height="30" fill={t.decal} />
          <text
            x="614"
            y="504"
            textAnchor="middle"
            fill={t.decalInk}
            fontSize="6"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="1.6"
          >
            {t.decal === 'OFF-BRAND' ? 'OFF-BRAND' : 'AURA VERIFIED'}
          </text>
          <path d="M559 501h4l2 2 4-4" fill="none" stroke={t.decalInk} strokeWidth="1" />
        </g>

        {/* Campaign typography */}
        <g>
          <text
            x="44"
            y="548"
            fill={t.accent}
            fontSize="7.6"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="2.6"
          >
            {t.eyebrow}
          </text>
          <path d="M44 560h78" stroke={t.accent} strokeOpacity="0.55" />
          <text
            x="40"
            y="633"
            fill={t.ink}
            fontSize="86"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="600"
            letterSpacing="-3.2"
          >
            {t.headline}
          </text>
          <text
            x="40"
            y="714"
            fill={t.ink}
            fontSize="86"
            fontFamily="'Space Grotesk', sans-serif"
            fontWeight="600"
            letterSpacing="-3.2"
          >
            {t.headlineAccent}
            <tspan fill={t.accent}>.</tspan>
          </text>
          <text
            x="44"
            y="748"
            fill={t.ink}
            fillOpacity="0.64"
            fontSize="11.5"
            fontFamily="'Inter', sans-serif"
            letterSpacing="0.1"
          >
            {t.subline}
          </text>

          <g>
            <rect x="44" y="770" width="218" height="40" rx="20" fill={t.accent} />
            <text
              x="70"
              y="794.5"
              fill={t.fieldBottom}
              fontSize="7"
              fontFamily="'JetBrains Mono', monospace"
              fontWeight="600"
              letterSpacing="1.5"
            >
              {t.cta}
            </text>
            <path d="M235 790h9m-4-4 4 4-4 4" fill="none" stroke={t.fieldBottom} strokeWidth="1.2" />
          </g>

          {t.promo ? (
            <g>
              <rect
                x="44"
                y="818"
                width="252"
                height="24"
                rx="4"
                fill="none"
                stroke={t.accent}
                strokeOpacity="0.6"
                strokeDasharray="4 3"
              />
              <text
                x="56"
                y="833.5"
                fill={t.accent}
                fontSize="6.2"
                fontFamily="'JetBrains Mono', monospace"
                fontWeight="600"
                letterSpacing="1.2"
              >
                CODE {t.promo.code} · {t.promo.expiry}
              </text>
            </g>
          ) : null}

          <text
            x="44"
            y="864"
            fill="#6E7870"
            fontSize="5.4"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.7"
          >
            {t.footerLeft}
          </text>
          <text
            x="676"
            y="864"
            textAnchor="end"
            fill="#6E7870"
            fontSize="5.4"
            fontFamily="'JetBrains Mono', monospace"
            letterSpacing="0.7"
          >
            {t.footerRight}
          </text>
        </g>

        {/* Geometry overlay */}
        {geometry ? (
          <g className="overlay-geometry">
            <rect
              x="16"
              y="2"
              width="198"
              height="80"
              fill="none"
              stroke={t.accent}
              strokeOpacity="0.3"
              strokeDasharray="2 4"
            />
            <rect
              x="22"
              y="8"
              width="186"
              height="68"
              fill="none"
              stroke="#FFB547"
              strokeOpacity="0.85"
              strokeDasharray="3 3"
            />
            <text x="232" y="14" fill="#FFB547" fontSize="9" fontFamily="'JetBrains Mono', monospace">
              CLEARSPACE / REQ 24px · ACT 18px
            </text>
            <path d="M220 24h-8v40h8" fill="none" stroke="#FFB547" strokeOpacity="0.5" />

            <path d="M44 568H676M44 714H676" stroke={t.accent} strokeOpacity="0.22" strokeDasharray="2 5" />
            <text x="590" y="565" fill={t.accent} fillOpacity="0.7" fontSize="9" fontFamily="'JetBrains Mono', monospace">
              CAP 84 / 76
            </text>

            <g stroke={t.accent} strokeOpacity="0.35">
              <circle cx="360" cy="326" r="7" fill="none" />
              <path d="M360 312v-8M360 340v8M346 326h-8M374 326h8" />
            </g>
            <text x="376" y="314" fill={t.accent} fillOpacity="0.7" fontSize="9" fontFamily="'JetBrains Mono', monospace">
              OPTICAL CENTRE Δ1.8°
            </text>

            <g stroke={t.ink} strokeOpacity="0.14">
              <path d="M44 740h-7M44 770h-7M262 810h7" />
            </g>
            <text x="548" y="532" fill="#FFB547" fontSize="9" fontFamily="'JetBrains Mono', monospace">
              G-01 · BREACH
            </text>
          </g>
        ) : null}

        {/* Probe markers */}
        {probes ? (
          <g className="overlay-probes">
            {[
              { id: 'P-01', x: 53, y: 44, dx: 14, dy: -10 },
              { id: 'P-02', x: 44, y: 600, dx: -2, dy: -12 },
              { id: 'P-03', x: 148, y: 790, dx: 10, dy: 18 },
              { id: 'P-04', x: 614, y: 501, dx: 14, dy: 16 },
            ].map((probe) => (
              <g key={probe.id}>
                <circle cx={probe.x} cy={probe.y} r="7" fill="none" stroke={t.ink} strokeOpacity="0.7" />
                <circle cx={probe.x} cy={probe.y} r="1.6" fill={t.ink} />
                <path
                  d={`M${probe.x - 10} ${probe.y}h20 M${probe.x} ${probe.y - 10}v20`}
                  stroke={t.ink}
                  strokeOpacity="0.25"
                />
                <text
                  x={probe.x + probe.dx}
                  y={probe.y + probe.dy}
                  fill={t.ink}
                  fillOpacity="0.85"
                  fontSize="9"
                  fontFamily="'JetBrains Mono', monospace"
                >
                  {probe.id}
                </text>
              </g>
            ))}
          </g>
        ) : null}

        {/* Accessibility heatmap */}
        {heatmap ? (
          <g className="overlay-heatmap">
            {a11y.map((check) => (
              <g key={check.id}>
                <rect
                  x={check.region.x}
                  y={check.region.y}
                  width={check.region.width}
                  height={check.region.height}
                  fill={check.pass ? t.accent : '#FF5C5C'}
                  fillOpacity={check.pass ? 0.11 : 0.2}
                  stroke={check.pass ? t.accent : '#FF5C5C'}
                  strokeOpacity={check.pass ? 0.4 : 0.8}
                  strokeWidth="0.8"
                />
                {!check.pass ? (
                  <rect
                    x={check.region.x}
                    y={check.region.y}
                    width={check.region.width}
                    height={check.region.height}
                    fill="url(#failHatch)"
                    fillOpacity="0.18"
                  />
                ) : null}
                <g>
                  <rect
                    x={check.region.x}
                    y={check.region.y + 3}
                    width={check.pass ? 104 : 114}
                    height={13}
                    fill={check.pass ? t.accent : '#FF5C5C'}
                    fillOpacity="0.92"
                  />
                  <text
                    x={check.region.x + 4}
                    y={check.region.y + 12.5}
                    fill={t.fieldBottom}
                    fontSize="9"
                    fontFamily="'JetBrains Mono', monospace"
                    fontWeight="600"
                    letterSpacing="0.2"
                  >
                    {check.id} · {check.ratio.toFixed(2)}:1 {check.pass ? 'PASS' : 'FAIL'}
                  </text>
                </g>
              </g>
            ))}
          </g>
        ) : null}
      </g>
    </svg>
  );
}

/**
 * Static sandbox card. memo() with no props means React never re-renders it, so
 * the MutationObserver's mutations are never overwritten by reconciliation.
 */
const RadarSandboxBody = memo(function RadarSandboxBody() {
  return (
    <>
      <div className="dr-card-head">
        <span>HELIOS · LIVE PREVIEW</span>
        <span>SANDBOX / ISOLATED</span>
      </div>
      <div className="dr-banner" data-radar-surface="banner">
        <strong>ORBITAL ENERGY — SERIES 07</strong>
        <span>Continuous power at the edge of the map.</span>
      </div>
      <div className="dr-cta-row">
        <div className="dr-cta" data-radar-surface="cta">
          REQUEST MISSION BRIEF
        </div>
        <span className="dr-contract">
          {BRAND_BASELINE_TOKEN} {BRAND_BASELINE_HEX}
        </span>
      </div>
    </>
  );
});

type RadarEvent = { id: number; text: string; tone: 'acid' | 'amber' | 'red' };

const verdictTone = { PASS: 'acid', REVIEW: 'amber', FAIL: 'red' } as const;

export function VisualForensics() {
  const { heatmap, setHeatmap, pushToast, publishOffset } = useStudio();
  const scenario = useScenario();
  const [geometry, setGeometry] = useState(true);
  const [probes, setProbes] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [autoQuarantine, setAutoQuarantine] = useState(true);
  const scanTimer = useRef<number | null>(null);
  const autoTimer = useRef<number | null>(null);

  const sandboxRef = useRef<HTMLDivElement | null>(null);
  const radarRef = useRef<DomRadar | null>(null);
  const autoQuarantineRef = useRef(autoQuarantine);
  const eventSeq = useRef(0);
  const [reading, setReading] = useState<DriftReading | null>(null);
  const [events, setEvents] = useState<RadarEvent[]>([]);

  const report = useMemo(
    () => buildClearanceReport(scenario, publishOffset),
    [scenario, publishOffset],
  );
  const theme = report.visual.theme;
  const activePalette = report.visual.palette;
  const findings = report.visual.findings;
  const a11y = report.visual.a11y;
  const geometryChecks = report.visual.geometry;
  const score = report.visual.score;
  const scoreTone: 'amber' | 'red' = score >= 90 ? 'amber' : 'red';
  const asset = report.asset;
  const readoutState = report.verdictLabel;
  const readoutCopy =
    report.visual.a11yFails > 0 || report.visual.geometryFails > 0
      ? `${report.visual.a11yFails} WCAG contrast failure${report.visual.a11yFails === 1 ? '' : 's'} and ${report.visual.geometryFails} geometry breach${report.visual.geometryFails === 1 ? '' : 'es'} measured against the stored contract. No generative inference was performed.`
      : 'Every sampled surface is inside the stored contract. No generative inference was performed.';
  const readoutStamp = `${report.stages.find((stage) => stage.id === 'visual')?.ms ?? 128}ms · ${activePalette.length + a11y.length + geometryChecks.length} RULES`;
  const passMs = readoutStamp.match(/\d+ms/)?.[0] ?? '128ms';

  useEffect(() => {
    autoQuarantineRef.current = autoQuarantine;
    // Turning autonomy off cancels any pending revert so the drift stays on
    // screen for inspection.
    if (!autoQuarantine && autoTimer.current) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
  }, [autoQuarantine]);

  useEffect(
    () => () => {
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    },
    [],
  );

  // Real MutationObserver bound to the sandboxed preview node.
  useEffect(() => {
    const root = sandboxRef.current;
    if (!root) return;
    const radar = createDomRadar(root, (next) => {
      setReading(next);
      eventSeq.current += 1;
      const id = eventSeq.current;
      const metric =
        next.trigger === 'QUARANTINE'
          ? `contract restored in ${next.detectMs.toFixed(2)}ms`
          : next.kind === 'dom-node'
            ? `caught in ${next.detectMs.toFixed(2)}ms · ${next.detail}`
            : next.kind === 'layout'
              ? `caught in ${next.detectMs.toFixed(2)}ms · geometry drift ${next.layoutDrift.toFixed(1)}px`
              : `caught in ${next.detectMs.toFixed(2)}ms · ΔE ${next.deltaE.toFixed(1)} · ${next.contrast.toFixed(2)}:1 ${next.wcagPass ? 'PASS' : 'FAIL'}`;
      setEvents((current) =>
        [{ id, text: `${next.trigger} · ${metric}`, tone: verdictTone[next.verdict] }, ...current].slice(0, 6),
      );
      if (
        autoQuarantineRef.current &&
        next.verdict === 'FAIL' &&
        next.trigger !== 'QUARANTINE'
      ) {
        // Hold the FAIL reading long enough to be inspected, then let the
        // surgical revert emit its own QUARANTINE event.
        if (autoTimer.current) window.clearTimeout(autoTimer.current);
        autoTimer.current = window.setTimeout(() => {
          autoTimer.current = null;
          radarRef.current?.quarantine();
        }, 1800);
      }
    });
    radarRef.current = radar;
    setReading(radar.measureNow());
    return () => {
      radar.disconnect();
      if (autoTimer.current) window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
      radarRef.current = null;
    };
  }, []);

  const quarantine = () => {
    if (autoTimer.current) {
      window.clearTimeout(autoTimer.current);
      autoTimer.current = null;
    }
    radarRef.current?.quarantine();
    pushToast({
      title: 'DOM quarantined · brand contract restored',
      detail: 'Rogue nodes removed and inline overrides reverted surgically. No full re-render was needed.',
      tone: 'clear',
    });
  };

  const rerunScan = () => {
    if (scanning) return;
    setScanning(true);
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    scanTimer.current = window.setTimeout(() => {
      setScanning(false);
      setGeometry(true);
      setProbes(true);
      pushToast({
        title: `Forensic pass complete · ${passMs}`,
        detail: `${activePalette.length} colour anchors, ${geometryChecks.length} geometry constraints and ${a11y.length} contrast regions evaluated.`,
        tone: 'watch',
      });
    }, 1800);
  };

  const drifting = reading !== null && reading.verdict !== 'PASS';

  return (
    <div className="page page--visual">
      <ScreenHead
        index="02"
        kicker="PERCEPTUAL FORENSICS"
        title={
          <>
            Pixel truth. <span className="title-accent">Not opinions.</span>
          </>
        }
        description="The specimen is measured, not interpreted. Perceptual colour difference, logo geometry and WCAG luminance are computed locally from the exact brand contract."
        badge={
          <span className="head-live">
            <StatusDot tone="acid" pulse /> CIEDE2000 / D65
          </span>
        }
        actions={
          <>
            <span className="asset-pill">
              <ImageIcon size={13} strokeWidth={1.7} />
              {asset.name}
              <ChevronDown size={12} strokeWidth={1.8} />
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                downloadJson(`aura-forensic-${asset.id.toLowerCase()}.json`, {
                  schema: 'aura-gov/visual-forensics/v2',
                  exportedAt: new Date().toISOString(),
                  asset,
                  scenario: report.scenario.id,
                  contract: brandProfile.policySet,
                  score,
                  verdict: report.verdictLabel,
                  palette: activePalette,
                  geometry: geometryChecks,
                  accessibility: a11y,
                  findings,
                  evidenceHash: report.traceHash,
                });
                pushToast({
                  title: 'Forensic report downloaded',
                  detail: `${asset.id} · ${findings.length} findings · ${a11y.length} WCAG regions · SHA-256 ${report.traceHashShort}.`,
                  tone: 'clear',
                });
              }}
            >
              <Download size={14} strokeWidth={1.7} />
              Export report
            </button>
            <button type="button" className="btn btn-primary" onClick={rerunScan} disabled={scanning}>
              {scanning ? <span className="btn-spinner" /> : <ScanLine size={14} strokeWidth={1.8} />}
              {scanning ? 'Scanning…' : 'Re-run pass'}
            </button>
          </>
        }
      />

      <div className="grid-12 visual-layout">
        <Panel className="specimen-panel span-7" bracket>
          <PanelHead
            kicker="Visual specimen"
            title={asset.name}
            meta={`${asset.dimensions} / ${asset.format}`}
            actions={
              <span className="meta-live">
                <StatusDot tone={scanning ? 'amber' : 'acid'} pulse={scanning} />
                {scanning ? 'MEASURING' : 'MEASURED'}
              </span>
            }
          />

          <div className="specimen-toolbar">
            <div className="tool-cluster">
              <button
                type="button"
                className={`tool-button ${heatmap ? 'is-active' : ''}`}
                onClick={() => setHeatmap(!heatmap)}
              >
                <ScanLine size={12} strokeWidth={1.8} />
                Heatmap
              </button>
              <button
                type="button"
                className={`tool-button ${geometry ? 'is-active' : ''}`}
                onClick={() => setGeometry(!geometry)}
              >
                <SlidersHorizontal size={12} strokeWidth={1.8} />
                Geometry
              </button>
              <button
                type="button"
                className={`tool-button ${probes ? 'is-active' : ''}`}
                onClick={() => setProbes(!probes)}
              >
                <span className="probe-icon" />
                Probes
              </button>
            </div>
            <div className="tool-cluster tool-cluster--right">
              <span className="zoom-readout">FIT · 42%</span>
              <button type="button" className="icon-button" onClick={rerunScan} aria-label="Re-run forensic pass">
                <RefreshCw size={12} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          <div className="specimen-stage">
            <div className="poster-frame">
              <PosterArtifact heatmap={heatmap} geometry={geometry} probes={probes} theme={theme} a11y={a11y} />
              {scanning ? (
                <div className="scan-overlay" aria-hidden="true">
                  <span className="scan-line" />
                  <span className="scan-corner scan-corner--tl" />
                  <span className="scan-corner scan-corner--tr" />
                  <span className="scan-corner scan-corner--bl" />
                  <span className="scan-corner scan-corner--br" />
                </div>
              ) : null}
              <span className="frame-label frame-label--tl">SPECIMEN / 01</span>
              <span className="frame-label frame-label--br">sRGB · 300 DPI</span>
            </div>
          </div>

          <div className="specimen-foot">
            <div className="specimen-foot-group">
              <span className="foot-key">ENGINE</span>
              <span>CIEDE2000 · D65</span>
            </div>
            <div className="specimen-foot-group">
              <span className="foot-key">SAMPLED</span>
              <span>14,400 px</span>
            </div>
            <div className="specimen-foot-group">
              <span className="foot-key">STATUS</span>
              <span className="foot-amber">{findings.length} FINDINGS</span>
            </div>
            <div className="specimen-foot-group specimen-foot-group--right">
              <span className="heat-legend"><i className="heat-swatch heat-swatch--pass" /> PASS</span>
              <span className="heat-legend"><i className="heat-swatch heat-swatch--fail" /> FAIL</span>
            </div>
          </div>
        </Panel>

        <Panel className="readout-panel span-5" bracket>
          <PanelHead
            kicker="Deterministic readout"
            title="Forensic report"
            meta={`CONTRACT ${brandProfile.policySet}`}
            actions={<Badge tone={scoreTone} dot>{score.toFixed(1)}</Badge>}
          />

          <div className="readout-verdict">
            <RingGauge
              value={score}
              display={score.toFixed(1)}
              label="INTEGRITY"
              tone={scoreTone}
              size={104}
            />
            <div className="readout-verdict-copy">
              <span className="readout-state">{readoutState}</span>
              <strong>
                {findings.length} deterministic {findings.length === 1 ? 'finding' : 'findings'}
              </strong>
              <p>{readoutCopy}</p>
              <span className="readout-stamp">{readoutStamp}</span>
            </div>
          </div>

          <div className="readout-section">
            <div className="readout-section-head">
              <span className="section-label">PALETTE DRIFT</span>
              <span className="section-meta">CIEDE2000 / {activePalette.length} ANCHORS</span>
            </div>
            <div className="palette-list">
              {activePalette.map((color) => (
                <div className="palette-row" key={color.token}>
                  <span className="swatch-pair" aria-hidden="true">
                    <span className="swatch swatch--target" style={{ background: color.target }} />
                    <span className="swatch swatch--actual" style={{ background: color.actual }} />
                  </span>
                  <span className="palette-copy">
                    <strong>{color.name}</strong>
                    <span>{color.token} · {color.role}</span>
                  </span>
                  <span className="palette-metric">
                    <strong>ΔE {color.deltaE.toFixed(2)}</strong>
                    <span className={`metric-state metric-state--${color.verdict.toLowerCase()}`}>
                      {color.verdict}
                    </span>
                  </span>
                  <span className="palette-bar">
                    <Meter
                      value={Math.min(100, (color.deltaE / 6) * 100)}
                      tone={color.verdict === 'PASS' ? 'acid' : color.verdict === 'REVIEW' ? 'amber' : 'red'}
                      height={2}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="readout-section">
            <div className="readout-section-head">
              <span className="section-label">GEOMETRY</span>
              <span className="section-meta">4 CONSTRAINTS</span>
            </div>
            <div className="check-list">
              {geometryChecks.map((check) => (
                <div className={`check-row ${check.verdict === 'FAIL' ? 'is-fail' : ''}`} key={check.id}>
                  <span className="check-mark">{check.verdict === 'PASS' ? '✓' : '!'}</span>
                  <span className="check-copy">
                    <strong>{check.label}</strong>
                    <span>{check.note}</span>
                  </span>
                  <span className="check-measure">
                    {check.measured}
                    <small>/ {check.requirement}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="readout-section">
            <div className="readout-section-head">
              <span className="section-label">ACCESSIBILITY FORENSICS</span>
              <span className="section-meta">WCAG 2.2</span>
            </div>
            <div className="a11y-list">
              {a11y.map((check) => (
                <button
                  type="button"
                  className={`a11y-row ${check.pass ? '' : 'is-fail'}`}
                  key={check.id}
                  onClick={() => setHeatmap(true)}
                  title="Reveal region on heatmap"
                >
                  <span className="a11y-swatch" style={{ background: check.background }}>
                    <span style={{ color: check.foreground }}>Aa</span>
                  </span>
                  <span className="a11y-copy">
                    <strong>{check.label}</strong>
                    <span>{check.id} · {check.note}</span>
                  </span>
                  <span className="a11y-ratio">
                    {check.ratio.toFixed(2)}:1
                    <small className={check.pass ? 'is-pass' : 'is-fail'}>{check.level}</small>
                  </span>
                  <ArrowUpRight size={11} strokeWidth={1.7} />
                </button>
              ))}
            </div>
          </div>

          <div className="readout-findings">
            <div className="readout-section-head">
              <span className="section-label">OPEN FINDINGS</span>
              <span className="section-meta">{String(findings.length).padStart(2, '0')}</span>
            </div>
            {findings.map((finding) => (
              <div className="finding-row" key={finding.id}>
                <span className={`finding-severity finding-severity--${finding.severity.toLowerCase()}`}>
                  {finding.severity}
                </span>
                <span className="finding-copy">
                  <strong>{finding.id} · {finding.title}</strong>
                  <span>{finding.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="dr-wrap" data-tour="dom-radar">
        <Panel className="dr-panel" bracket>
          <PanelHead
            kicker="Continuous defense · live MutationObserver"
            title="DOM Drift Radar"
            meta={`BASELINE ${BRAND_BASELINE_TOKEN} ${BRAND_BASELINE_HEX}`}
            actions={
              <>
                <Toggle
                  checked={autoQuarantine}
                  onChange={setAutoQuarantine}
                  label="Auto-quarantine"
                  compact
                />
                <span className="meta-live">
                  <StatusDot tone={drifting ? 'red' : 'acid'} pulse />
                  {drifting ? 'DRIFT DETECTED' : 'WATCHING'}
                </span>
              </>
            }
          />

          <div className="dr-body">
            <div className="dr-stage">
              <div className={`dr-sandbox ${drifting ? 'is-drifting' : ''}`} ref={sandboxRef}>
                <RadarSandboxBody />
              </div>
              <div className="dr-presets">
                {ROGUE_PRESETS.map((preset) => (
                  <button
                    type="button"
                    className="tool-button"
                    key={preset.id}
                    title={preset.summary}
                    onClick={() => radarRef.current?.inject(preset.id)}
                  >
                    {preset.id} · {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="dr-readout">
              <div className="dr-actions">
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => radarRef.current?.inject('MUT-01')}
                >
                  Inject Rogue Color Drift
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-small"
                  onClick={() => radarRef.current?.inject('MUT-03')}
                >
                  Inject Unauthorized DOM Node
                </button>
                <button type="button" className="btn btn-primary btn-small" onClick={quarantine}>
                  <ShieldCheck size={12} strokeWidth={2} />
                  Auto-Quarantine & Revert DOM
                </button>
              </div>

              <div className="dr-metrics">
                <div className="dr-metric">
                  <span>LIVE ΔE2000</span>
                  <strong className={drifting ? 'text-red' : 'text-acid'}>
                    {reading ? reading.deltaE.toFixed(1) : '—'}
                  </strong>
                  <em>vs {BRAND_BASELINE_HEX}</em>
                </div>
                <div className="dr-metric">
                  <span>WCAG 2.2 CONTRAST</span>
                  <strong className={reading && !reading.wcagPass ? 'text-red' : 'text-acid'}>
                    {reading ? `${reading.contrast.toFixed(2)}:1` : '—'}
                  </strong>
                  <em>{reading ? (reading.wcagPass ? 'PASS ≥ 4.5' : 'FAIL < 4.5') : ''}</em>
                </div>
                <div className="dr-metric">
                  <span>DETECTION</span>
                  <strong>{reading && reading.detectMs > 0 ? `${reading.detectMs.toFixed(2)}ms` : '—'}</strong>
                  <em>{reading && reading.detectMs > 0 ? (reading.detectMs < 4 ? 'UNDER 4ms' : 'OVER 4ms') : 'awaiting mutation'}</em>
                </div>
                <div className="dr-metric">
                  <span>ROGUE NODES</span>
                  <strong className={reading && reading.rogueNodes > 0 ? 'text-red' : ''}>
                    {reading ? reading.rogueNodes : 0}
                  </strong>
                  <em>
                    {reading ? (
                      <Badge tone={verdictTone[reading.verdict]} dot>
                        {reading.verdict}
                      </Badge>
                    ) : null}
                  </em>
                </div>
                <div className="dr-metric">
                  <span>LAYOUT DRIFT</span>
                  <strong className={reading && reading.layoutDrift > 2 ? 'text-red' : ''}>
                    {reading ? `${reading.layoutDrift.toFixed(1)}px` : '—'}
                  </strong>
                  <em>tolerance 2px</em>
                </div>
                <div className="dr-metric">
                  <span>WORST SURFACE</span>
                  <strong className="dr-surface">
                    {reading ? reading.worstContrast.offender : '—'}
                  </strong>
                  <em>
                    {reading
                      ? `${reading.worstContrast.contrast.toFixed(2)}:1 ${reading.wcagPass ? 'PASS' : 'FAIL'}`
                      : ''}
                  </em>
                </div>
              </div>

              <div className="dr-log" aria-live="polite">
                <div className="dr-log-head">
                  <span>MUTATION LOG</span>
                  <span>{reading?.detail ?? 'Within brand contract'}</span>
                </div>
                {events.length === 0 ? (
                  <div className="dr-log-line is-muted">Observer attached · no mutations yet.</div>
                ) : (
                  events.map((event) => (
                    <div className={`dr-log-line is-${event.tone}`} key={event.id}>
                      {event.text}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="page-footline">
        <span>
          <StatusDot tone={report.verdictTone === 'red' ? 'red' : report.verdictTone === 'amber' ? 'amber' : 'acid'} />
          {report.verdictLabel} · NO VISION MODEL INVOKED
        </span>
        <span>ICC sRGB v4</span>
        <span>THRESHOLD ΔE ≤ 2.5 PASS / ≤ 5 REVIEW</span>
        <span className="footline-right">SHA-256 {report.traceHashShort}</span>
      </div>
    </div>
  );
}