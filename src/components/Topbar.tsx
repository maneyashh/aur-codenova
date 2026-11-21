import { useEffect, useState } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { screenMeta } from '../state/navigation';
import { useStudio } from '../state/studio';
import { useSimulation } from '../sim/SimulationProvider';
import type { ScenarioId } from '../sim/types';
import { Kbd, StatusDot } from './ui';

const DATASETS: Array<{ id: ScenarioId; code: string; label: string }> = [
  { id: 'visual', code: 'A', label: 'Visual crisis' },
  { id: 'privacy', code: 'B', label: 'Privacy breach' },
];

function utcClock() {
  const now = new Date();
  return {
    time: new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'UTC',
    }).format(now),
    date: new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: '2-digit',
      timeZone: 'UTC',
    })
      .format(now)
      .toUpperCase(),
  };
}

export function Topbar() {
  const { screen, setPaletteOpen } = useStudio();
  const { scenario, switchScenario, restartTour } = useSimulation();
  const meta = screenMeta(screen);
  const [clock, setClock] = useState(utcClock);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(utcClock()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar-context" aria-label="Current location">
        <span className="context-org">HELIOS</span>
        <span className="context-slash">/</span>
        <span className="context-campaign">CAMPAIGN-07</span>
        <span className="context-slash">/</span>
        <strong className="context-page">{meta.breadcrumb}</strong>
        <span className="context-index">{meta.index}</span>
      </div>

      <div className="topbar-tools">
        <button
          type="button"
          className="topbar-search"
          onClick={() => setPaletteOpen(true)}
          aria-label="Open command console"
        >
          <Search size={13} strokeWidth={1.8} />
          <span className="topbar-search-label">Search or jump to</span>
          <Kbd>CTRL</Kbd>
          <Kbd>K</Kbd>
        </button>

        <div className="dataset-switch" role="group" aria-label="Crisis dataset">
          {DATASETS.map((dataset) => {
            const active = scenario?.id === dataset.id;
            return (
              <button
                key={dataset.id}
                type="button"
                className={`dataset-switch-item ${active ? 'is-active' : ''}`}
                aria-pressed={active}
                onClick={() => switchScenario(dataset.id)}
                title={`Dataset ${dataset.code} · ${dataset.label}`}
              >
                <span className="dataset-code">{dataset.code}</span>
                <span className="dataset-label">{dataset.label}</span>
              </button>
            );
          })}
        </div>

        <div className="system-chip" title="Clearance engine status">
          <StatusDot tone="acid" pulse />
          <span className="system-chip-label">CLEARANCE ENGINE</span>
          <strong>ONLINE</strong>
        </div>

        <div className="topbar-clock" aria-label="Live coordinated universal time" title="Live UTC wall clock. The temporal engine evaluates a pinned simulation date.">
          <span className="clock-date">{clock.date}</span>
          <span className="clock-time">{clock.time}</span>
          <span className="clock-zone">UTC</span>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-small judge-btn"
          onClick={restartTour}
          title="Replay the five-step guided walkthrough"
        >
          <Sparkles size={12} strokeWidth={2} />
          <span className="judge-label">Guided walkthrough</span>
        </button>
      </div>
    </header>
  );
}