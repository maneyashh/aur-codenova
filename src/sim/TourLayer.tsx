import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, MousePointerClick, Sparkles } from 'lucide-react';
import { useStudio } from '../state/studio';
import { useSimulation } from './SimulationProvider';

type Anchor = {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

const CARD_WIDTH = 348;
const VIEWPORT_GUTTER = 16;
const ANCHOR_GAP = 18;
const SPOTLIGHT_PAD = 9;
const TOP_SAFE = 64;

const spring = { type: 'spring', stiffness: 260, damping: 28, mass: 0.7 } as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function TourLayer() {
  const {
    step,
    stepIndex,
    steps,
    tourActive,
    nextStep,
    skipTour,
    scanRequested,
    pipelineComplete,
  } = useSimulation();
  const { screen } = useStudio();

  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [viewport, setViewport] = useState(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }));
  const [settled, setSettled] = useState(false);
  const [cardHeight, setCardHeight] = useState(206);
  const targetRef = useRef<HTMLElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const frame = useRef<number | null>(null);

  const measure = useCallback(() => {
    const element = targetRef.current;
    if (!element) {
      setAnchor(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setAnchor({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    });
  }, []);

  const scheduleMeasure = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      measure();
    });
  }, [measure]);

  // Locate the step's target. Cross-screen steps may mount a beat after the
  // navigation, so the lookup retries briefly before falling back to a floating card.
  useLayoutEffect(() => {
    if (!tourActive || !step) {
      targetRef.current = null;
      setAnchor(null);
      setSettled(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retry: number | undefined;
    let settleTimer: number | undefined;
    const selector = `[data-tour="${step.target}"]`;

    const attach = (element: HTMLElement) => {
      targetRef.current = element;
      setSettled(false);
      element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      measure();
      settleTimer = window.setTimeout(() => {
        measure();
        setSettled(true);
      }, 520);
    };

    const first = document.querySelector<HTMLElement>(selector);
    if (first) {
      attach(first);
    } else {
      targetRef.current = null;
      setAnchor(null);
      setSettled(false);
      retry = window.setInterval(() => {
        if (cancelled) return;
        attempts += 1;
        const found = document.querySelector<HTMLElement>(selector);
        if (found) {
          window.clearInterval(retry);
          attach(found);
        } else if (attempts >= 8) {
          window.clearInterval(retry);
          setSettled(true);
        }
      }, 120);
    }

    return () => {
      cancelled = true;
      window.clearInterval(retry);
      window.clearTimeout(settleTimer);
    };
  }, [measure, step, tourActive, screen]);

  useEffect(() => {
    if (!tourActive) return;

    const onViewport = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      scheduleMeasure();
    };

    window.addEventListener('resize', onViewport);
    window.addEventListener('scroll', scheduleMeasure, true);

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(document.documentElement);

    return () => {
      window.removeEventListener('resize', onViewport);
      window.removeEventListener('scroll', scheduleMeasure, true);
      observer.disconnect();
      if (frame.current) window.cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [scheduleMeasure, tourActive]);

  useEffect(() => {
    if (!tourActive) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTour();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [skipTour, tourActive]);

  useLayoutEffect(() => {
    const node = cardRef.current;
    if (!node) return;
    const sync = () => {
      const height = node.offsetHeight;
      setCardHeight((current) => (Math.abs(current - height) > 1 ? height : current));
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(node);
    return () => observer.disconnect();
  }, [step?.id, viewport.width]);

  if (!tourActive || !step) return null;

  const scanning = step.id === 'run' && scanRequested && !pipelineComplete;
  const ready = step.id === 'run' ? pipelineComplete : true;
  const ctaLabel =
    step.id === 'run'
      ? scanning
        ? 'Scanning…'
        : ready
          ? step.doneCta
          : step.cta
      : step.cta;

  const spotlight = anchor
    ? {
        x: anchor.left - SPOTLIGHT_PAD,
        y: anchor.top - SPOTLIGHT_PAD,
        width: anchor.width + SPOTLIGHT_PAD * 2,
        height: anchor.height + SPOTLIGHT_PAD * 2,
      }
    : null;

  const preferTop = step.placement === 'top';
  const placeTop = anchor
    ? preferTop
      ? anchor.top > cardHeight + 56
      : viewport.height - anchor.bottom < cardHeight + 72
    : false;

  const cardLeft = anchor
    ? clamp(
        anchor.left + anchor.width / 2 - CARD_WIDTH / 2,
        VIEWPORT_GUTTER,
        Math.max(VIEWPORT_GUTTER, viewport.width - CARD_WIDTH - VIEWPORT_GUTTER),
      )
    : Math.max(VIEWPORT_GUTTER, (viewport.width - CARD_WIDTH) / 2);

  const rawTop = anchor
    ? placeTop
      ? anchor.top - ANCHOR_GAP - cardHeight
      : anchor.bottom + ANCHOR_GAP
    : Math.max(72, viewport.height / 2 - cardHeight / 2);

  // Tall targets (the DOM radar panel) may leave no room on either side; keep the card on screen.
  const cardTop = clamp(rawTop, TOP_SAFE, Math.max(TOP_SAFE, viewport.height - cardHeight - VIEWPORT_GUTTER));
  const coversTarget = anchor ? cardTop < anchor.bottom && cardTop + cardHeight > anchor.top : false;

  const arrowX = anchor
    ? clamp(anchor.left + anchor.width / 2 - cardLeft, 28, CARD_WIDTH - 28)
    : CARD_WIDTH / 2;

  return (
    <div className={`tour-layer ${settled ? 'is-settled' : ''}`} aria-live="polite">
      {spotlight ? (
        <motion.div
          className="tour-spotlight"
          initial={false}
          animate={spotlight}
          transition={spring}
          aria-hidden="true"
        >
          <span className="tour-spotlight-ring" />
          <span className="tour-spotlight-corner tour-spotlight-corner--tl" />
          <span className="tour-spotlight-corner tour-spotlight-corner--tr" />
          <span className="tour-spotlight-corner tour-spotlight-corner--bl" />
          <span className="tour-spotlight-corner tour-spotlight-corner--br" />
        </motion.div>
      ) : (
        <div className="tour-scrim tour-scrim--solid" aria-hidden="true" />
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={step.id}
          ref={cardRef}
          className={`tour-card ${placeTop ? 'tour-card--top' : 'tour-card--bottom'} ${
            anchor ? '' : 'tour-card--floating'
          }`}
          style={{ left: cardLeft, top: cardTop, width: CARD_WIDTH }}
          initial={{ opacity: 0, y: placeTop ? 10 : -10, scale: 0.972, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: placeTop ? 8 : -8, scale: 0.985, filter: 'blur(6px)' }}
          transition={spring}
          role="dialog"
          aria-label={`${step.title} — tour step ${stepIndex + 1} of ${steps.length}`}
        >
          {anchor && !coversTarget ? (
            <span className="tour-arrow" style={{ left: arrowX }} aria-hidden="true" />
          ) : null}

          <div className="tour-card-head">
            <span className="tour-eyebrow">
              <span className="tour-pulse" />
              {step.eyebrow}
            </span>
            <span className="tour-counter">
              {String(stepIndex + 1).padStart(2, '0')}
              <span>/</span>
              {String(steps.length).padStart(2, '0')}
            </span>
          </div>

          <h3 className="tour-title">{step.title}</h3>
          <p className="tour-body">{step.body}</p>

          <div className="tour-progress" aria-hidden="true">
            {steps.map((entry, index) => (
              <span
                key={entry.id}
                className={`tour-progress-dot ${index === stepIndex ? 'is-active' : ''} ${
                  index < stepIndex ? 'is-done' : ''
                }`}
              />
            ))}
          </div>

          <div className="tour-card-foot">
            <button type="button" className="tour-skip" onClick={skipTour}>
              Skip tour
            </button>
            <button type="button" className="tour-cta" onClick={nextStep} disabled={scanning}>
              {scanning ? <span className="tour-spinner" /> : null}
              {step.id === 'remediate' ? <Sparkles size={13} strokeWidth={1.9} /> : null}
              {ctaLabel}
              {!scanning ? <ArrowRight size={14} strokeWidth={2} /> : null}
            </button>
          </div>

          {step.id === 'run' && !scanRequested ? (
            <span className="tour-hint">
              <MousePointerClick size={11} strokeWidth={1.8} />
              or press the highlighted button
            </span>
          ) : null}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}