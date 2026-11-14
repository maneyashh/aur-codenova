export function AuraMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className="aura-mark"
    >
      <path
        d="M3.5 8V3.5H8M24 3.5h4.5V8M3.5 24v4.5H8M28.5 24v4.5H24"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="square"
      />
      <path
        d="M16 6.5 25 26h-4.9L16 15.4 11.9 26H7Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="miter"
        fill="currentColor"
        fillOpacity="0.12"
      />
      <path d="M12.6 21.2h6.8" stroke="currentColor" strokeWidth="1.25" />
      <circle cx="16" cy="23.4" r="1.35" fill="currentColor" />
    </svg>
  );
}

export function AuraLogo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`aura-logo ${compact ? 'aura-logo--compact' : ''}`}>
      <span className="aura-mark-wrap">
        <AuraMark size={27} />
      </span>
      {!compact ? (
        <span className="aura-wordmark">
          <span className="aura-word">AURA</span>
          <span className="aura-gov">GOV</span>
        </span>
      ) : null}
    </div>
  );
}
