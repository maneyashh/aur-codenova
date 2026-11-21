import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  AudioWaveform,
  CalendarClock,
  CornerDownLeft,
  FileDown,
  FlaskConical,
  Play,
  Radar,
  RotateCcw,
  ScanEye,
  Search,
  ShieldCheck,
  Waypoints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AuraMark } from './Logo';
import { useStudio } from '../state/studio';
import { useSimulation } from '../sim/SimulationProvider';
import { SCREENS, type ScreenId } from '../state/navigation';
import { PUBLISH_OFFSET_MAX, TODAY, addDays, formatLongDate } from '../core/claims';
import { buildClearanceReport } from '../core/compiler';
import { downloadJson } from '../lib/download';

const screenIcons: Record<ScreenId, LucideIcon> = {
  command: Radar,
  visual: ScanEye,
  temporal: Waypoints,
  voice: AudioWaveform,
  airlock: ShieldCheck,
};

type PaletteItem = {
  id: string;
  group: 'NAVIGATE' | 'ACTIONS' | 'SIMULATION';
  label: string;
  hint: string;
  icon: LucideIcon;
  shortcut?: string;
  run: () => void;
};

export function CommandPalette() {
  const {
    paletteOpen,
    setPaletteOpen,
    navigate,
    runCompilation,
    publishOffset,
    setPublishOffset,
    heatmap,
    setHeatmap,
    pushToast,
  } = useStudio();
  const { openGateway, restartTour, scenario } = useSimulation();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!paletteOpen) return;
    setQuery('');
    setActive(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(timer);
  }, [paletteOpen]);

  const items = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = SCREENS.map((screen) => ({
      id: `nav-${screen.id}`,
      group: 'NAVIGATE',
      label: screen.label,
      hint: screen.kicker,
      icon: screenIcons[screen.id],
      shortcut: screen.shortcut,
      run: () => navigate(screen.id),
    }));

    const nextOffset = Math.min(PUBLISH_OFFSET_MAX, publishOffset + 14);

    const actions: PaletteItem[] = [
      {
        id: 'action-compile',
        group: 'ACTIONS',
        label: 'Run brand compilation',
        hint: 'Re-execute the six-stage clearance pipeline',
        icon: Play,
        shortcut: 'R C',
        run: () => {
          runCompilation();
          pushToast({
            title: 'Compilation pipeline started',
            detail: 'Deterministic stages are executing on the local node.',
            tone: 'info',
          });
        },
      },
      {
        id: 'action-time',
        group: 'ACTIONS',
        label: 'Advance publish window +14 days',
        hint: 'Stress-test claim validity against a future date',
        icon: CalendarClock,
        shortcut: 'T +',
        run: () => {
          setPublishOffset(nextOffset);
          navigate('temporal');
          pushToast({
            title: `Publish window advanced to ${formatLongDate(addDays(TODAY, nextOffset))}`,
            detail: 'Temporal ledger re-evaluated against the new publication date.',
            tone: 'watch',
          });
        },
      },
      {
        id: 'action-heatmap',
        group: 'ACTIONS',
        label: heatmap ? 'Disable accessibility heatmap' : 'Enable accessibility heatmap',
        hint: 'Render pixel-level WCAG contrast regions',
        icon: ScanEye,
        shortcut: 'V H',
        run: () => {
          setHeatmap(!heatmap);
          navigate('visual');
          pushToast({
            title: heatmap ? 'Accessibility heatmap disabled' : 'Accessibility heatmap enabled',
            detail: 'Computed against WCAG 2.2 relative luminance.',
            tone: 'info',
          });
        },
      },
      {
        id: 'action-airlock',
        group: 'ACTIONS',
        label: 'Load airlock test payload',
        hint: scenario
          ? `Sanitize the ${scenario.code} payload containing raw identifiers`
          : 'Sanitize a sample containing sensitive entities',
        icon: ShieldCheck,
        shortcut: 'A L',
        run: () => {
          navigate('airlock');
          pushToast({
            title: 'Airlock test payload loaded',
            detail: 'Local preprocessor armed. No external request will be made.',
            tone: 'clear',
          });
        },
      },
      {
        id: 'action-memo',
        group: 'ACTIONS',
        label: 'Export clearance memo',
        hint: 'Signed JSON + human-readable audit record',
        icon: FileDown,
        shortcut: 'E M',
        run: () => {
          const report = buildClearanceReport(scenario, publishOffset);
          downloadJson(`aura-clearance-${report.asset.id.toLowerCase()}.json`, {
            schema: 'aura-gov/clearance/v2',
            runId: report.runId,
            scenario: report.scenario.id,
            asset: report.asset,
            publishDate: report.publishDate,
            verdict: {
              score: report.score,
              label: report.verdictLabel,
              tone: report.verdictTone,
              copy: report.verdictCopy,
            },
            domains: report.domains,
            openNotes: report.notes,
            evidenceHash: report.traceHash,
            pipeline: report.stages,
            arbiter: report.arbiter,
            generatedAt: new Date().toISOString(),
          });
          setPaletteOpen(false);
          pushToast({
            title: 'Clearance memo downloaded',
            detail: `${report.asset.id} · integrity ${report.score.toFixed(1)} · ${report.notes.length} open notes · SHA-256 attached.`,
            tone: 'clear',
          });
        },
      },
    ];

    const simulationItems: PaletteItem[] = [
      {
        id: 'sim-scenario',
        group: 'SIMULATION',
        label: 'Switch crisis scenario',
        hint: 'Re-open the sandbox gateway and hydrate a different dataset',
        icon: FlaskConical,
        shortcut: 'S S',
        run: () => openGateway(),
      },
      {
        id: 'sim-tour',
        group: 'SIMULATION',
        label: 'Restart guided tour',
        hint: 'Replay the five-step deterministic walkthrough',
        icon: RotateCcw,
        shortcut: 'S T',
        run: () => restartTour(),
      },
    ];

    return [...navItems, ...actions, ...simulationItems];
  }, [
    navigate,
    runCompilation,
    publishOffset,
    setPublishOffset,
    heatmap,
    setHeatmap,
    pushToast,
    setPaletteOpen,
    openGateway,
    restartTour,
    scenario,
  ]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      `${item.label} ${item.hint} ${item.group}`.toLowerCase().includes(normalized),
    );
  }, [items, query]);

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  if (!paletteOpen) return null;

  const runItem = (item: PaletteItem | undefined) => {
    if (!item) return;
    setPaletteOpen(false);
    item.run();
  };

  const groups: PaletteItem['group'][] = ['NAVIGATE', 'ACTIONS', 'SIMULATION'];

  return (
    <div
      className="palette-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) setPaletteOpen(false);
      }}
    >
      <div className="palette" role="dialog" aria-modal="true" aria-label="Command console">
        <div className="palette-input-row">
          <Search size={17} strokeWidth={1.7} className="palette-search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActive((current) => (current + 1) % Math.max(filtered.length, 1));
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActive(
                  (current) =>
                    (current - 1 + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1),
                );
              }
              if (event.key === 'Enter') {
                event.preventDefault();
                runItem(filtered[active]);
              }
              if (event.key === 'Escape') {
                setPaletteOpen(false);
              }
            }}
            placeholder="Search modules, run a compile, simulate time…"
            aria-label="Search commands"
          />
          <span className="palette-brand">
            <AuraMark size={17} />
            <span>COMMAND</span>
          </span>
        </div>

        <div className="palette-list">
          {groups.map((group) => {
            const groupItems = filtered.filter((item) => item.group === group);
            if (groupItems.length === 0) return null;
            return (
              <div className="palette-group" key={group}>
                <div className="palette-group-label">{group}</div>
                {groupItems.map((item) => {
                  const index = filtered.indexOf(item);
                  const Icon = item.icon;
                  return (
                    <button
                      type="button"
                      key={item.id}
                      className={`palette-item ${index === active ? 'is-active' : ''}`}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => runItem(item)}
                    >
                      <span className="palette-item-icon">
                        <Icon size={15} strokeWidth={1.6} />
                      </span>
                      <span className="palette-item-copy">
                        <strong>{item.label}</strong>
                        <span>{item.hint}</span>
                      </span>
                      {item.shortcut ? <span className="palette-shortcut">{item.shortcut}</span> : null}
                      <ArrowRight size={13} className="palette-enter" />
                    </button>
                  );
                })}
              </div>
            );
          })}
          {filtered.length === 0 ? (
            <div className="palette-empty">
              No command matches “{query}”. Try “compile”, “claim”, or “airlock”.
            </div>
          ) : null}
        </div>

        <footer className="palette-footer">
          <span className="palette-footer-brand">AURA // NEURO-SYMBOLIC COMMAND</span>
          <span className="palette-keygroup">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>navigate</span>
          </span>
          <span className="palette-keygroup">
            <kbd>
              <CornerDownLeft size={9} />
            </kbd>
            <span>select</span>
          </span>
          <span className="palette-keygroup">
            <kbd>ESC</kbd>
            <span>close</span>
          </span>
        </footer>
      </div>
    </div>
  );
}
