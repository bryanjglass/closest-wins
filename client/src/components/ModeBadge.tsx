import { MODE_INFO, type ScoringMode } from '../../../shared/protocol';

/** Clear indicator of how this round is scored. Sized by the parent's font-size. */
export function ModeBadge({ mode, showRule = false, className = '' }: { mode: ScoringMode; showRule?: boolean; className?: string }) {
  const info = MODE_INFO[mode];
  const tone = mode === 'closest' ? 'bg-sky text-ink' : 'bg-tomato text-white';
  return (
    <div className={`inline-flex flex-col items-start gap-[0.2em] ${className}`} data-testid="mode-badge" data-mode={mode}>
      <span className={`sticker rounded-full px-[0.8em] py-[0.2em] font-display font-bold uppercase tracking-wide ${tone}`}>
        <span aria-hidden="true">{info.emoji}</span> {info.label}
      </span>
      {showRule && <span className="text-[0.8em] text-cream/85 pl-[0.4em]">{info.rule}</span>}
    </div>
  );
}
