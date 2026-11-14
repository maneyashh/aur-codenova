import { useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { CommandPalette } from './components/CommandPalette';
import { StudioProvider, ToastViewport, useStudio } from './state/studio';
import { SimulationProvider } from './sim/SimulationProvider';
import { WelcomeModal } from './sim/WelcomeModal';
import { TourLayer } from './sim/TourLayer';
import { Overview } from './screens/Overview';
import { VisualForensics } from './screens/VisualForensics';
import { TemporalTruth } from './screens/TemporalTruth';
import { VoiceDNA } from './screens/VoiceDNA';
import { Airlock } from './screens/Airlock';

function Shell() {
  const { screen, paletteOpen, setPaletteOpen, navigate } = useStudio();
  const lastKey = useRef<{ key: string; at: number } | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(!paletteOpen);
        return;
      }

      if (event.key === 'Escape' && paletteOpen) {
        setPaletteOpen(false);
        return;
      }

      if (typing) return;

      if (event.key.toLowerCase() === 'g') {
        lastKey.current = { key: 'g', at: Date.now() };
        return;
      }

      if (lastKey.current?.key === 'g' && Date.now() - lastKey.current.at < 900) {
        const map = ['command', 'visual', 'temporal', 'voice', 'airlock'] as const;
        const index = Number(event.key) - 1;
        if (index >= 0 && index < map.length) {
          event.preventDefault();
          navigate(map[index]);
        }
        lastKey.current = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigate, paletteOpen, setPaletteOpen]);

  const screens = {
    command: <Overview />,
    visual: <VisualForensics />,
    temporal: <TemporalTruth />,
    voice: <VoiceDNA />,
    airlock: <Airlock />,
  } as const;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to compiler
      </a>
      <Sidebar />
      <div className="app-frame">
        <Topbar />
        <main className="app-main" id="main-content">
          <div className="screen-enter" key={screen}>
            {screens[screen]}
          </div>
        </main>
      </div>
      <CommandPalette />
      <ToastViewport />
      <TourLayer />
      <WelcomeModal />
    </div>
  );
}

export default function App() {
  return (
    <StudioProvider>
      <SimulationProvider>
        <Shell />
      </SimulationProvider>
    </StudioProvider>
  );
}
