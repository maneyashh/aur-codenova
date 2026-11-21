import { useMemo } from 'react';
import {
  AudioWaveform,
  ChevronsUpDown,
  Command,
  Cpu,
  GitBranch,
  LockKeyhole,
  Radar,
  ScanEye,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuraLogo } from './Logo';
import { SCREENS, type ScreenId } from '../state/navigation';
import { useStudio } from '../state/studio';
import { useScenario } from '../sim/SimulationProvider';
import { analyzePayload } from '../core/airlock';
import { claims, evaluateClaim, addDays, TODAY } from '../core/claims';
import { StatusDot } from './ui';

const navIcons: Record<ScreenId, LucideIcon> = {
  command: Radar,
  visual: ScanEye,
  temporal: Waypoints,
  voice: AudioWaveform,
  airlock: ShieldCheck,
};

export function Sidebar() {
  const { screen, navigate, setPaletteOpen, publishOffset } = useStudio();
  const scenario = useScenario();

  const badges = useMemo(() => {
    const publishDate = addDays(TODAY, publishOffset);
    const temporalFlags = claims.filter((claim) => {
      const evaluation = evaluateClaim(claim, publishDate);
      return evaluation.severity === 'blocked';
    }).length;

    if (!scenario) {
      return {
        command: 0,
        visual: 0,
        temporal: temporalFlags,
        voice: 0,
        airlock: 0,
      } as Record<ScreenId, number>;
    }

    return {
      command: 0,
      visual: scenario.visual.findings.length,
      temporal: temporalFlags,
      voice: scenario.voiceVariant === 'llm' ? 1 : 6,
      airlock: analyzePayload(scenario.airlockPayload).entities.length,
    } as Record<ScreenId, number>;
  }, [publishOffset, scenario]);

  return (
    <aside className="sidebar">
      <div className="brand-block">
        <AuraLogo />
        <div className="brand-build">
          <span>v3.0</span>
          <span className="brand-build-sep">/</span>
          <span>DETERMINISTIC CORE</span>
        </div>
      </div>

      <button
        className="workspace-switch"
        type="button"
        onClick={() => setPaletteOpen(true)}
        aria-label="Switch workspace"
      >
        <span className="workspace-monogram">HD</span>
        <span className="workspace-copy">
          <strong>HELIOS DYNAMICS</strong>
          <span>Enterprise / Production</span>
        </span>
        <ChevronsUpDown size={13} strokeWidth={1.6} className="workspace-chevron" />
      </button>

      <nav className="primary-nav" aria-label="Compiler modules">
        <div className="nav-section-label">
          <span>Compiler</span>
          <span className="nav-section-count">05</span>
        </div>
        {SCREENS.map((item) => {
          const Icon = navIcons[item.id];
          const count = badges[item.id];
          const active = screen === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${active ? 'is-active' : ''}`}
              onClick={() => navigate(item.id)}
              aria-current={active ? 'page' : undefined}
            >
              <span className="nav-icon">
                <Icon size={17} strokeWidth={1.55} />
              </span>
              <span className="nav-copy">
                <span className="nav-label">{item.label}</span>
                <span className="nav-kicker">{item.kicker}</span>
              </span>
              {count > 0 ? <span className="nav-badge">{String(count).padStart(2, '0')}</span> : null}
              <span className="nav-shortcut">{item.index}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="system-block">
        <div className="nav-section-label">
          <span>Systems</span>
          <span className="nav-section-count">05</span>
        </div>
        <div className="system-row system-row--round3">
          <StatusDot tone="acid" pulse />
          <span className="system-name">Arbiter · Radar · Vault</span>
          <span className="system-state">ACTIVE</span>
        </div>
        <div className="system-row">
          <StatusDot tone="acid" pulse />
          <span className="system-name">Deterministic Core</span>
          <span className="system-state">42ms</span>
        </div>
        <div className="system-row">
          <StatusDot tone="blue" />
          <span className="system-name">Air-gapped Link</span>
          <span className="system-state">SEALED</span>
        </div>
        <div className="system-row">
          <span className="system-glyph">
            <GitBranch size={11} strokeWidth={1.6} />
          </span>
          <span className="system-name">Policy Graph</span>
          <span className="system-state">4.2.1</span>
        </div>
        <div className="system-row">
          <span className="system-glyph">
            <Cpu size={11} strokeWidth={1.6} />
          </span>
          <span className="system-name">Inference Budget</span>
          <span className="system-state">0.00</span>
        </div>
      </div>

      <button className="palette-trigger" type="button" onClick={() => setPaletteOpen(true)}>
        <Command size={13} strokeWidth={1.7} />
        <span>Command console</span>
        <span className="palette-trigger-keys">
          <kbd>CTRL</kbd>
          <kbd>K</kbd>
        </span>
      </button>

      <div className="operator-card">
        <span className="operator-avatar">AK</span>
        <span className="operator-copy">
          <strong>A. Kaur</strong>
          <span>Brand Integrity Lead</span>
        </span>
        <span className="operator-lock" title="Session hardware-bound">
          <LockKeyhole size={12} strokeWidth={1.7} />
        </span>
      </div>
      <div className="sidebar-foot">
        <span>PROD / S-01</span>
        <span>EU-WEST-2</span>
      </div>
    </aside>
  );
}