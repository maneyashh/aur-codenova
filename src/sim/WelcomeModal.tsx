import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Fingerprint,
  LockKeyhole,
  ScanEye,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { AuraMark } from '../components/Logo';
import { SCENARIO_LIST } from './scenarios';
import { useSimulation } from './SimulationProvider';
import type { Scenario, ScenarioId } from './types';

function VisualPreview() {
  return (
    <svg className="crisis-preview-svg" viewBox="0 0 320 150" aria-hidden="true">
      <defs>
        <radialGradient id="crisisGlow" cx="58%" cy="42%" r="62%">
          <stop offset="0%" stopColor="#FF4D6D" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#FF4D6D" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="crisisField" x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#1B0A12" />
          <stop offset="100%" stopColor="#080306" />
        </linearGradient>
      </defs>
      <rect width="320" height="150" fill="url(#crisisField)" />
      <rect width="320" height="150" fill="url(#crisisGlow)" />
      <ellipse cx="196" cy="62" rx="76" ry="22" fill="none" stroke="#FF4D6D" strokeOpacity="0.45" transform="rotate(-16 196 62)" />
      <circle cx="196" cy="62" r="44" fill="#0A0407" stroke="#FF4D6D" strokeOpacity="0.75" />
      <circle cx="196" cy="62" r="52" fill="none" stroke="#FF4D6D" strokeOpacity="0.18" strokeDasharray="1 4" />
      <circle cx="246" cy="34" r="2.4" fill="#FF4D6D" />
      <text x="22" y="30" fill="#FF4D6D" fontSize="6" fontFamily="'JetBrains Mono', monospace" letterSpacing="2">
        CAMPAIGN 07 / FLASH
      </text>
      <text x="20" y="98" fill="#F7EFEA" fontSize="30" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" letterSpacing="-1.4">
        BEYOND
      </text>
      <text x="20" y="128" fill="#F7EFEA" fontSize="30" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" letterSpacing="-1.4">
        HORIZON<tspan fill="#FF4D6D">.</tspan>
      </text>
      <g>
        <rect x="196" y="112" width="102" height="20" rx="10" fill="#FF4D6D" />
        <text x="247" y="125" textAnchor="middle" fill="#18040A" fontSize="5.4" fontFamily="'JetBrains Mono', monospace" fontWeight="600" letterSpacing="1">
          CLAIM 30% OFF
        </text>
      </g>
      <g>
        <rect x="196" y="88" width="102" height="16" rx="3" fill="none" stroke="#FF4D6D" strokeOpacity="0.6" strokeDasharray="3 2" />
        <text x="247" y="99" textAnchor="middle" fill="#FF8FA5" fontSize="4.8" fontFamily="'JetBrains Mono', monospace" letterSpacing="1">
          ORBIT30 · EXPIRED
        </text>
      </g>
      <path d="M0 142H320" stroke="#F7EFEA" strokeOpacity="0.08" />
    </svg>
  );
}

function PrivacyPreview() {
  const redactions = [
    { x: 20, y: 44, w: 74 },
    { x: 20, y: 58, w: 118 },
    { x: 20, y: 96, w: 88 },
    { x: 152, y: 110, w: 96 },
  ];
  return (
    <svg className="crisis-preview-svg" viewBox="0 0 320 150" aria-hidden="true">
      <defs>
        <linearGradient id="privacyField" x1="0" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor="#0E0B16" />
          <stop offset="100%" stopColor="#07050B" />
        </linearGradient>
        <linearGradient id="privacySheen" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C7A2FF" stopOpacity="0" />
          <stop offset="50%" stopColor="#C7A2FF" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#C7A2FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="320" height="150" fill="url(#privacyField)" />
      <rect width="320" height="150" fill="url(#privacySheen)" />
      <rect x="12" y="12" width="296" height="126" rx="5" fill="#0B0810" stroke="#C7A2FF" strokeOpacity="0.2" />
      <text x="24" y="30" fill="#C7A2FF" fontSize="5.6" fontFamily="'JetBrains Mono', monospace" letterSpacing="1.6">
        FOR IMMEDIATE RELEASE / PR-0011
      </text>
      <text x="24" y="44" fill="#EDE6F7" fontSize="7.4" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" letterSpacing="0.6">
        HELIOS DYNAMICS UNVEILS A
      </text>
      <text x="24" y="54" fill="#EDE6F7" fontSize="7.4" fontFamily="'Space Grotesk', sans-serif" fontWeight="600" letterSpacing="0.6">
        REVOLUTIONARY PLATFORM
      </text>
      {redactions.map((block, index) => (
        <g key={index}>
          <rect x={block.x} y={block.y} width={block.w} height="7" rx="1.5" fill="#FF5C7A" fillOpacity="0.22" />
          <rect x={block.x} y={block.y} width={block.w} height="7" rx="1.5" fill="none" stroke="#FF5C7A" strokeOpacity="0.55" strokeDasharray="2 2" />
          <text x={block.x + block.w - 3} y={block.y + 5.2} textAnchor="end" fill="#FF9FB0" fontSize="3.6" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.4">
            PII
          </text>
        </g>
      ))}
      <g>
        <rect x="196" y="18" width="100" height="17" rx="3" fill="#C7A2FF" fillOpacity="0.12" stroke="#C7A2FF" strokeOpacity="0.35" />
        <text x="246" y="29" textAnchor="middle" fill="#DCC8FF" fontSize="4.6" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.8">
          14 ENTITIES DETECTED
        </text>
      </g>
      <text x="24" y="80" fill="#8E7FA8" fontSize="5.2" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.5">
        “transformative… unparalleled… elevate…”
      </text>
      <text x="24" y="90" fill="#8E7FA8" fontSize="5.2" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.5">
        “innovative… best-in-class… synergistic…”
      </text>
      <text x="24" y="118" fill="#FF9FB0" fontSize="4.8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.6">
        sk_live_••••••••••••••••
      </text>
      <text x="24" y="128" fill="#FF9FB0" fontSize="4.8" fontFamily="'JetBrains Mono', monospace" letterSpacing="0.6">
        10.42.18.7 · +1 (415) 555-0142
      </text>
      <rect x="24" y="132" width="120" height="1" fill="#C7A2FF" fillOpacity="0.18" />
    </svg>
  );
}

const CARD_META: Record<
  ScenarioId,
  { icon: typeof ScanEye; preview: () => ReactElement; kicker: string }
> = {
  visual: {
    icon: ScanEye,
    preview: VisualPreview,
    kicker: 'PERCEPTUAL + TEMPORAL',
  },
  privacy: {
    icon: Fingerprint,
    preview: PrivacyPreview,
    kicker: 'PII + AUTHORSHIP',
  },
};

function ScenarioCard({
  scenario,
  focused,
  launching,
  disabled,
  buttonRef,
  onFocus,
  onSelect,
}: {
  scenario: Scenario;
  focused: boolean;
  launching: boolean;
  disabled: boolean;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onFocus: () => void;
  onSelect: () => void;
}) {
  const meta = CARD_META[scenario.id];
  const Icon = meta.icon;
  const Preview = meta.preview;

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      className={`crisis-card ${focused ? 'is-focused' : ''} ${launching ? 'is-launching' : ''}`}
      style={{ ['--card-accent' as string]: scenario.accent, ['--card-soft' as string]: scenario.accentSoft }}
      onMouseEnter={onFocus}
      onFocus={onFocus}
      onClick={onSelect}
      disabled={disabled}
      aria-label={`${scenario.code}: ${scenario.title}. ${scenario.summary}`}
      variants={{
        hidden: { opacity: 0, y: 22, scale: 0.985 },
        show: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { type: 'spring', stiffness: 210, damping: 24, mass: 0.9 },
        },
      }}
      whileHover={disabled ? undefined : { y: -5, transition: { type: 'spring', stiffness: 320, damping: 22 } }}
      whileTap={disabled ? undefined : { scale: 0.992 }}
    >
      <span className="crisis-card-sheen" aria-hidden="true" />
      <span className="crisis-card-top">
        <span className="crisis-card-code">
          <Icon size={13} strokeWidth={1.7} />
          {scenario.code}
        </span>
        <span className="crisis-card-kicker">{meta.kicker}</span>
        <span className="crisis-card-index">{scenario.index}</span>
      </span>

      <span className="crisis-card-preview">
        <Preview />
      </span>

      <span className="crisis-card-body">
        <span className="crisis-card-subtitle">{scenario.subtitle}</span>
        <strong className="crisis-card-title">{scenario.title}</strong>
        <span className="crisis-card-summary">{scenario.summary}</span>
        <span className="crisis-card-tags">
          {scenario.tags.map((tag) => (
            <span key={tag.label} className={`crisis-tag crisis-tag--${tag.tone}`}>
              {tag.label}
            </span>
          ))}
        </span>
      </span>

      <span className="crisis-card-foot">
        <span className="crisis-card-file">
          <span className="crisis-file-dot" />
          {scenario.asset.file}
        </span>
        <span className="crisis-card-cta">
          Initialize
          <ArrowRight size={13} strokeWidth={1.9} />
        </span>
      </span>

      {launching ? (
        <motion.span
          className="crisis-card-launch"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        >
          <span className="crisis-launch-spinner" />
          <span>Hydrating local state…</span>
        </motion.span>
      ) : null}
    </motion.button>
  );
}

export function WelcomeModal() {
  const { gatewayOpen, selectScenario } = useSimulation();
  const [focusIndex, setFocusIndex] = useState(0);
  const [launching, setLaunching] = useState<ScenarioId | null>(null);
  const launchTimer = useRef<number | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const launch = useCallback(
    (id: ScenarioId) => {
      if (launching) return;
      setLaunching(id);
      launchTimer.current = window.setTimeout(() => {
        selectScenario(id);
        setLaunching(null);
      }, 560);
    },
    [launching, selectScenario],
  );

  useEffect(
    () => () => {
      if (launchTimer.current) window.clearTimeout(launchTimer.current);
    },
    [],
  );

  useEffect(() => {
    if (!gatewayOpen) return;
    setFocusIndex(0);
    setLaunching(null);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => cardRefs.current[0]?.focus(), 260);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // The gateway is intentionally un-dismissible.
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        setFocusIndex((current) => {
          const next = (current + 1) % SCENARIO_LIST.length;
          cardRefs.current[next]?.focus();
          return next;
        });
        return;
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        setFocusIndex((current) => {
          const next = (current - 1 + SCENARIO_LIST.length) % SCENARIO_LIST.length;
          cardRefs.current[next]?.focus();
          return next;
        });
        return;
      }
      if (event.key === '1' || event.key === '2') {
        event.preventDefault();
        launch(SCENARIO_LIST[Number(event.key) - 1].id);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        setFocusIndex((current) => {
          const next = (current + (event.shiftKey ? -1 : 1) + SCENARIO_LIST.length) % SCENARIO_LIST.length;
          cardRefs.current[next]?.focus();
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
    };
  }, [gatewayOpen, launch]);

  return (
    <AnimatePresence>
      {gatewayOpen ? (
        <motion.div
          className="sim-gateway"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sim-gateway-ambient" aria-hidden="true">
            <span className="sim-aurora sim-aurora--a" />
            <span className="sim-aurora sim-aurora--b" />
            <span className="sim-aurora sim-aurora--c" />
            <span className="sim-gateway-grid" />
            <span className="sim-gateway-noise" />
          </div>

          <motion.div
            className="sim-gateway-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sim-gateway-title"
            initial={{ opacity: 0, y: 26, scale: 0.965, filter: 'blur(16px)' }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, scale: 0.98, filter: 'blur(10px)' }}
            transition={{ type: 'spring', stiffness: 190, damping: 26, mass: 0.9 }}
          >
            <span className="sim-gateway-hairline" aria-hidden="true" />

            <header className="sim-gateway-head">
              <div className="sim-gateway-brandrow">
                <span className="sim-gateway-brand">
                  <AuraMark size={26} />
                  <span className="sim-gateway-wordmark">AURA-GOV</span>
                  <span className="sim-gateway-build">SIM / 2.0</span>
                </span>
                <span className="sim-gateway-mode">
                  <LockKeyhole size={11} strokeWidth={1.9} />
                  JUDGE SIMULATION MODE
                </span>
              </div>

              <h1 className="sim-gateway-title" id="sim-gateway-title">
                Select a live <span>enterprise crisis.</span>
              </h1>
              <p className="sim-gateway-sub">
                Two incidents are staged on this node. Pick one and AURA-GOV will hydrate the
                compiler, run the deterministic scan, and hand you the remediation.
              </p>

              <div className="sim-gateway-meta">
                <span>
                  <ShieldCheck size={12} strokeWidth={1.8} /> Local execution
                </span>
                <span>
                  <Sparkles size={12} strokeWidth={1.8} /> Zero external models
                </span>
                <span>
                  <LockKeyhole size={12} strokeWidth={1.8} /> No data leaves this tab
                </span>
              </div>
            </header>

            <motion.div
              className="sim-scenario-grid"
              initial="hidden"
              animate="show"
              transition={{ staggerChildren: 0.09, delayChildren: 0.12 }}
            >
              {SCENARIO_LIST.map((scenario, index) => (
                <ScenarioCard
                  key={scenario.id}
                  scenario={scenario}
                  focused={focusIndex === index}
                  launching={launching === scenario.id}
                  disabled={launching !== null}
                  buttonRef={(element) => {
                    cardRefs.current[index] = element;
                  }}
                  onFocus={() => setFocusIndex(index)}
                  onSelect={() => launch(scenario.id)}
                />
              ))}
            </motion.div>

            <footer className="sim-gateway-foot">
              <span className="sim-gateway-foot-left">
                <span className="sim-gateway-live" />
                DETERMINISTIC SANDBOX · NO UPLOAD REQUIRED
              </span>
              <span className="sim-gateway-keys">
                <span><kbd>1</kbd><kbd>2</kbd> select</span>
                <span><kbd>↵</kbd> initialize</span>
              </span>
            </footer>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
