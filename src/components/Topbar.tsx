import { useEffect, useState } from 'react';
import { Bell, CircleHelp, Search } from 'lucide-react';
import { screenMeta } from '../state/navigation';
import { useStudio } from '../state/studio';
import { useSimulation } from '../sim/SimulationProvider';
import { Kbd, StatusDot } from './ui';

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
  const { scenario, openGateway } = useSimulation();
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

        <button
          type="button"
          className="sim-chip"
          onClick={openGateway}
          title="Open the judge simulation gateway"
          aria-label="Switch crisis scenario"
        >
          <span
            className="sim-chip-dot"
            style={{ background: scenario?.accent ?? 'var(--muted)' }}
          />
          <span>{scenario ? scenario.code : 'JUDGE SIM'}</span>
        </button>

        <div className="system-chip" title="Clearance engine status">
          <StatusDot tone="acid" pulse />
          <span className="system-chip-label">CLEARANCE ENGINE</span>
          <strong>ONLINE</strong>
        </div>

        <div className="topbar-clock" aria-label="Coordinated Universal Time">
          <span className="clock-date">{clock.date}</span>
          <span className="clock-time">{clock.time}</span>
          <span className="clock-zone">UTC</span>
        </div>

        <button type="button" className="icon-button icon-button--top" aria-label="Notifications">
          <Bell size={15} strokeWidth={1.7} />
          <span className="notification-dot" />
        </button>
        <button type="button" className="icon-button icon-button--top" aria-label="Help">
          <CircleHelp size={15} strokeWidth={1.7} />
        </button>
      </div>
    </header>
  );
}
