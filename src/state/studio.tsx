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
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';
import type { ScreenId } from './navigation';
import { SCREENS } from './navigation';
import { DEFAULT_PUBLISH_OFFSET, PUBLISH_OFFSET_MAX } from '../core/claims';

export type ToastTone = 'clear' | 'watch' | 'block' | 'info';

export type Toast = {
  id: number;
  title: string;
  detail?: string;
  tone: ToastTone;
};

type ToastInput = {
  title: string;
  detail?: string;
  tone?: ToastTone;
};

type StudioContextValue = {
  screen: ScreenId;
  navigate: (screen: ScreenId) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;
  publishOffset: number;
  setPublishOffset: (offset: number) => void;
  heatmap: boolean;
  setHeatmap: (enabled: boolean) => void;
  compileToken: number;
  runCompilation: () => void;
  toasts: Toast[];
  pushToast: (toast: ToastInput) => void;
  dismissToast: (id: number) => void;
};

const StudioContext = createContext<StudioContextValue | null>(null);

function readScreenHash(): ScreenId {
  const value = window.location.hash.replace(/^#\/?/, '');
  return SCREENS.some((screen) => screen.id === value) ? (value as ScreenId) : 'command';
}

export function StudioProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<ScreenId>(readScreenHash);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [publishOffset, setPublishOffsetState] = useState(DEFAULT_PUBLISH_OFFSET);
  const [heatmap, setHeatmap] = useState(false);
  const [compileToken, setCompileToken] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const navigate = useCallback((next: ScreenId) => {
    setScreen(next);
    setPaletteOpen(false);
    if (window.location.hash !== `#/${next}`) {
      window.history.pushState(null, '', `#/${next}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onHashChange = () => setScreen(readScreenHash());
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  const pushToast = useCallback((input: ToastInput) => {
    const id = toastId.current + 1;
    toastId.current = id;
    setToasts((current) => [
      ...current.slice(-3),
      { id, title: input.title, detail: input.detail, tone: input.tone ?? 'info' },
    ]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4600);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const setPublishOffset = useCallback((offset: number) => {
    setPublishOffsetState(Math.max(0, Math.min(PUBLISH_OFFSET_MAX, Math.round(offset))));
  }, []);

  const runCompilation = useCallback(() => {
    setScreen('command');
    setCompileToken((token) => token + 1);
  }, []);

  const value = useMemo(
    () => ({
      screen,
      navigate,
      paletteOpen,
      setPaletteOpen,
      publishOffset,
      setPublishOffset,
      heatmap,
      setHeatmap,
      compileToken,
      runCompilation,
      toasts,
      pushToast,
      dismissToast,
    }),
    [
      screen,
      navigate,
      paletteOpen,
      publishOffset,
      setPublishOffset,
      heatmap,
      compileToken,
      runCompilation,
      toasts,
      pushToast,
      dismissToast,
    ],
  );

  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio(): StudioContextValue {
  const context = useContext(StudioContext);
  if (!context) throw new Error('useStudio must be used inside StudioProvider');
  return context;
}

const toastIcon = {
  clear: CheckCircle2,
  watch: AlertTriangle,
  block: AlertTriangle,
  info: Info,
};

export function ToastViewport() {
  const { toasts, dismissToast } = useStudio();
  if (toasts.length === 0) return null;

  return (
    <div className="toast-viewport" role="status" aria-live="polite">
      {toasts.map((toast) => {
        const Icon = toastIcon[toast.tone];
        return (
          <div key={toast.id} className={`toast toast--${toast.tone}`}>
            <span className="toast-icon">
              <Icon size={16} strokeWidth={1.8} />
            </span>
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.detail ? <span>{toast.detail}</span> : null}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={13} />
            </button>
            <span className="toast-timer" />
          </div>
        );
      })}
    </div>
  );
}
