import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { useStudio } from '../state/studio';
import { SCENARIOS, TOUR_STEPS } from './scenarios';
import type { Scenario, ScenarioId, SimPhase, TourStep } from './types';

type SimulationContextValue = {
  phase: SimPhase;
  scenario: Scenario | null;
  steps: TourStep[];
  stepIndex: number;
  step: TourStep | null;
  gatewayOpen: boolean;
  tourActive: boolean;
  scanRequested: boolean;
  pipelineComplete: boolean;
  selectScenario: (id: ScenarioId) => void;
  /** One-click dataset switch from the topbar. Restarts the tour only if one is running. */
  switchScenario: (id: ScenarioId) => void;
  openGateway: () => void;
  closeGateway: () => void;
  nextStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
  markPipelineStarted: () => void;
  markPipelineComplete: () => void;
};

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const { navigate, runCompilation, pushToast, setPublishOffset, setHeatmap, setPaletteOpen } =
    useStudio();

  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [phase, setPhase] = useState<SimPhase>('gateway');
  const [stepIndex, setStepIndex] = useState(0);
  const [scanRequested, setScanRequested] = useState(false);
  const [pipelineComplete, setPipelineComplete] = useState(false);
  const completeTimer = useRef<number | null>(null);
  const scanTimer = useRef<number | null>(null);

  const scenario = scenarioId ? SCENARIOS[scenarioId] : null;

  useEffect(
    () => () => {
      if (completeTimer.current) window.clearTimeout(completeTimer.current);
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
    },
    [],
  );

  const selectScenario = useCallback(
    (id: ScenarioId) => {
      const next = SCENARIOS[id];
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      setScenarioId(id);
      setPhase('tour');
      setStepIndex(0);
      setScanRequested(false);
      setPipelineComplete(false);
      setPaletteOpen(false);
      setPublishOffset(next.publishOffset);
      setHeatmap(id === 'visual');
      navigate('command');
      pushToast({
        title: `${next.code} hydrated · ${next.asset.name}`,
        detail: 'Local state loaded. Deterministic engines armed. Nothing has been uploaded.',
        tone: 'clear',
      });
    },
    [navigate, pushToast, setHeatmap, setPaletteOpen, setPublishOffset],
  );

  const switchScenario = useCallback(
    (id: ScenarioId) => {
      if (id === scenarioId && phase !== 'gateway') return;
      if (phase === 'tour' || phase === 'gateway') {
        selectScenario(id);
        return;
      }
      // Free exploration: hydrate in place, stay on the current screen.
      const next = SCENARIOS[id];
      if (scanTimer.current) window.clearTimeout(scanTimer.current);
      setScenarioId(id);
      setScanRequested(false);
      setPipelineComplete(false);
      setPublishOffset(next.publishOffset);
      setHeatmap(id === 'visual');
      pushToast({
        title: `${next.code} hydrated · ${next.asset.name}`,
        detail: 'Dataset switched in place. Deterministic engines re-armed. Nothing has been uploaded.',
        tone: 'clear',
      });
    },
    [phase, pushToast, scenarioId, selectScenario, setHeatmap, setPublishOffset],
  );

  const openGateway = useCallback(() => {
    setPhase('gateway');
    setPaletteOpen(false);
  }, [setPaletteOpen]);

  const closeGateway = useCallback(() => {
    setPhase((current) => (current === 'gateway' && scenarioId ? 'free' : current));
  }, [scenarioId]);

  const markPipelineStarted = useCallback(() => {
    setScanRequested(true);
    setPipelineComplete(false);
    // Safety net: if the judge navigates away mid-scan the Command Deck
    // unmounts, so the tour must not stall on "Scanning…" forever.
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    scanTimer.current = window.setTimeout(() => setPipelineComplete(true), 5200);
  }, []);

  const markPipelineComplete = useCallback(() => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    setPipelineComplete(true);
  }, []);

  const nextStep = useCallback(() => {
    if (phase !== 'tour') return;

    // Step 01 gates on the real pipeline finishing.
    if (stepIndex === 0) {
      if (!scanRequested) {
        markPipelineStarted();
        runCompilation();
        return;
      }
      if (!pipelineComplete) return;
    }

    const upcoming = TOUR_STEPS[stepIndex + 1];
    if (upcoming) {
      setStepIndex(stepIndex + 1);
      navigate(upcoming.screen);
      return;
    }

    setPhase('free');
    navigate('voice');
    pushToast({
      title: 'Surgical patch staged · 94.8 fidelity',
      detail: 'Six lexical swaps, zero sentences regenerated. Authorise the patch to seal remediation.',
      tone: 'clear',
    });
  }, [
    navigate,
    phase,
    pipelineComplete,
    pushToast,
    runCompilation,
    scanRequested,
    stepIndex,
    markPipelineStarted,
  ]);

  const skipTour = useCallback(() => {
    setPhase('free');
  }, []);

  const restartTour = useCallback(() => {
    if (scanTimer.current) window.clearTimeout(scanTimer.current);
    if (!scenarioId) {
      setPhase('gateway');
      return;
    }
    setPhase('tour');
    setStepIndex(0);
    setScanRequested(false);
    setPipelineComplete(false);
    navigate('command');
  }, [navigate, scenarioId]);

  // Advance from step 01 only after the deterministic pipeline actually seals.
  useEffect(() => {
    if (phase !== 'tour' || stepIndex !== 0 || !pipelineComplete) return;
    completeTimer.current = window.setTimeout(() => {
      setStepIndex(1);
      pushToast({
        title: 'Scan sealed · 03.216s',
        detail: 'Six stages executed locally. Evidence hash written to the audit ledger.',
        tone: 'clear',
      });
    }, 650);
    return () => {
      if (completeTimer.current) window.clearTimeout(completeTimer.current);
    };
  }, [phase, pipelineComplete, pushToast, stepIndex]);

  const value = useMemo<SimulationContextValue>(
    () => ({
      phase,
      scenario,
      steps: TOUR_STEPS,
      stepIndex,
      step: phase === 'tour' ? TOUR_STEPS[stepIndex] ?? null : null,
      gatewayOpen: phase === 'gateway',
      tourActive: phase === 'tour',
      scanRequested,
      pipelineComplete,
      selectScenario,
      switchScenario,
      openGateway,
      closeGateway,
      nextStep,
      skipTour,
      restartTour,
      markPipelineStarted,
      markPipelineComplete,
    }),
    [
      phase,
      scenario,
      stepIndex,
      scanRequested,
      pipelineComplete,
      selectScenario,
      switchScenario,
      openGateway,
      closeGateway,
      nextStep,
      skipTour,
      restartTour,
      markPipelineStarted,
      markPipelineComplete,
    ],
  );

  return <SimulationContext.Provider value={value}>{children}</SimulationContext.Provider>;
}

export function useSimulation(): SimulationContextValue {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulation must be used inside SimulationProvider');
  return context;
}

/** Safe for screens that can render outside the simulation shell. */
export function useScenario(): Scenario | null {
  return useContext(SimulationContext)?.scenario ?? null;
}