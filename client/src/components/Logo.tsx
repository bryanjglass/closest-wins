/** A bullseye target. Size is driven by the parent's font-size. */
export function Target({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="#ff5a7a" stroke="#081430" strokeWidth="5" />
      <circle cx="50" cy="50" r="33" fill="#fff8ec" />
      <circle cx="50" cy="50" r="21" fill="#ff5a7a" />
      <circle cx="50" cy="50" r="9" fill="#ffcf3f" stroke="#081430" strokeWidth="3" />
    </svg>
  );
}

/** The Closest Wins wordmark. Size is driven by the parent's font-size. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-flex items-center gap-[0.3em] select-none ${className}`} aria-label="Closest Wins">
      <div className="relative w-[2.1em] h-[2.1em] shrink-0">
        <Target className="absolute inset-0 w-full h-full" />
        <span
          className="absolute left-[55%] top-[-12%] text-[0.95em] rotate-[35deg] origin-bottom-left motion-only"
          aria-hidden="true"
        >
          🎯
        </span>
      </div>
      <div className="leading-[0.9] font-display font-bold">
        <div className="text-cream text-outline shadow-pop">CLOSEST</div>
        <div className="text-sun text-outline shadow-pop">WINS!</div>
      </div>
    </div>
  );
}
