import React, { useId } from 'react';
import type { ReactNode } from 'react';

export function Panel({
  children,
  className = '',
  bracket = false,
}: {
  children: ReactNode;
  className?: string;
  bracket?: boolean;
}) {
  return (
    <section className={`panel ${bracket ? 'panel--bracket' : ''} ${className}`.trim()}>
      {children}
    </section>
  );
}

export function PanelHead({
  kicker,
  title,
  meta,
  actions,
}: {
  kicker?: string;
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="panel-head">
      <div className="panel-head-copy">
        {kicker ? <span className="panel-kicker">{kicker}</span> : null}
        <h2 className="panel-title">{title}</h2>
      </div>
      <div className="panel-head-tools">
        {meta ? <span className="panel-meta">{meta}</span> : null}
        {actions ? <div className="panel-actions">{actions}</div> : null}
      </div>
    </header>
  );
}

export type BadgeTone = 'acid' | 'amber' | 'red' | 'blue' | 'muted' | 'bone';

export function Badge({
  children,
  tone = 'muted',
  dot = false,
  className = '',
}: {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span className={`badge badge--${tone} ${className}`.trim()}>
      {dot ? <span className="badge-dot" /> : null}
      {children}
    </span>
  );
}

export function StatusDot({
  tone = 'acid',
  pulse = false,
}: {
  tone?: 'acid' | 'amber' | 'red' | 'muted' | 'blue';
  pulse?: boolean;
}) {
  return <span className={`status-dot status-dot--${tone} ${pulse ? 'is-pulsing' : ''}`} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Meter({
  value,
  tone = 'acid',
  height = 4,
}: {
  value: number;
  tone?: 'acid' | 'amber' | 'red' | 'blue' | 'bone' | 'muted';
  height?: number;
}) {
  return (
    <div
      className={`meter meter--${tone}`}
      style={{ height }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Sparkline({
  values,
  tone = 'acid',
  height = 32,
  width = 108,
}: {
  values: number[];
  tone?: 'acid' | 'amber' | 'red' | 'blue' | 'bone';
  height?: number;
  width?: number;
}) {
  const rawId = useId();
  const gradientId = `spark-${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * width;
    const y = height - 3 - ((value - min) / span) * (height - 8);
    return [x, y] as const;
  });
  const line = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const area = `0,${height} ${line} ${width},${height}`;

  return (
    <svg
      className={`sparkline sparkline--${tone}`}
      viewBox={`0 0 ${width} ${height}`}
      height={height}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#${gradientId})`} />
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle
        cx={points[points.length - 1][0]}
        cy={points[points.length - 1][1]}
        r="1.8"
        fill="currentColor"
      />
    </svg>
  );
}

export function RingGauge({
  value,
  display,
  label,
  sub,
  size = 132,
  tone = 'acid',
  showTicks = true,
}: {
  value: number;
  display?: string;
  label?: string;
  sub?: string;
  size?: number;
  tone?: 'acid' | 'amber' | 'red' | 'blue';
  showTicks?: boolean;
}) {
  const stroke = size >= 110 ? 5 : 4;
  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
  const dash = (clamped / 100) * circumference;

  return (
    <div className={`ring ring--${tone}`} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
        <circle
          className="ring-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        {showTicks ? (
          <circle
            className="ring-ticks"
            cx={size / 2}
            cy={size / 2}
            r={radius - 8}
            fill="none"
            strokeWidth="1"
            strokeDasharray="1 7"
          />
        ) : null}
        <circle
          className="ring-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={`${dash} ${circumference - dash}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="ring-center">
        <span className="ring-number">{display ?? clamped.toFixed(1)}</span>
        {label ? <span className="ring-label">{label}</span> : null}
        {sub ? <span className="ring-sub">{sub}</span> : null}
      </div>
    </div>
  );
}

export function ScreenHead({
  index,
  kicker,
  title,
  description,
  actions,
  badge,
}: {
  index: string;
  kicker: string;
  title: ReactNode;
  description: string;
  actions?: ReactNode;
  badge?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        <div className="eyebrow">
          <span className="eyebrow-index">{index}</span>
          <span>{kicker}</span>
          {badge ? <span className="eyebrow-badge">{badge}</span> : null}
        </div>
        <h1 className="page-title">{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`segmented segmented--${size}`} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          role="tab"
          aria-selected={value === option.value}
          className={`segmented-item ${value === option.value ? 'is-active' : ''}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' ? (
            <span className="segmented-count">{String(option.count).padStart(2, '0')}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  compact = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      className={`toggle ${checked ? 'is-on' : ''} ${compact ? 'toggle--compact' : ''}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </button>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaTone = 'acid',
  spark,
  sparkTone = 'acid',
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone?: 'acid' | 'amber' | 'red' | 'muted';
  spark?: number[];
  sparkTone?: 'acid' | 'amber' | 'red' | 'blue' | 'bone';
  note?: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        {delta ? <span className={`stat-delta stat-delta--${deltaTone}`}>{delta}</span> : null}
      </div>
      <div className="stat-card-mid">
        <span className="stat-value">
          {value}
          {unit ? <span className="stat-unit">{unit}</span> : null}
        </span>
        {spark ? <Sparkline values={spark} tone={sparkTone} height={30} /> : null}
      </div>
      <div className="stat-card-foot">{note ?? '\u00A0'}</div>
    </div>
  );
}

export function CornerTicks() {
  return (
    <>
      <span className="corner corner--tl" />
      <span className="corner corner--tr" />
      <span className="corner corner--bl" />
      <span className="corner corner--br" />
    </>
  );
}
