import { useEffect, useRef } from 'react';
import { categoryInfo, type GameView, type PlayerView } from '../../../../shared/protocol';
import { Avatar } from '../../components/Avatar';
import { ModeBadge } from '../../components/ModeBadge';

export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

/** Plays `fn` when `count` goes up. */
export function useOnIncrease(count: number, fn: () => void) {
  const prev = usePrevious(count);
  useEffect(() => {
    if (prev !== undefined && count > prev) fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
}

/** Category chip + scoring mode badge, shown above every question. */
export function QuestionMeta({ view, showRule = true, className = '' }: { view: GameView; showRule?: boolean; className?: string }) {
  if (!view.question) return null;
  const cat = categoryInfo(view.question.category);
  return (
    <div className={`flex items-start gap-[1.2rem] ${className}`}>
      <span className="sticker rounded-full bg-cream text-ink px-[0.9em] py-[0.2em] font-display font-bold" data-testid="tv-category">
        {cat.emoji} {cat.label}
      </span>
      <ModeBadge mode={view.question.mode} showRule={showRule} />
    </div>
  );
}

export function TvQuestionCard({ view, size = 'lg' }: { view: GameView; size?: 'lg' | 'md' | 'sm' }) {
  const q = view.question;
  if (!q) return null;
  const sizes = { lg: 'text-[3.4rem] p-[2.6rem]', md: 'text-[2.5rem] p-[1.8rem]', sm: 'text-[1.8rem] px-[1.6rem] py-[1rem]' };
  return (
    <div className={`sticker rounded-[2rem] bg-cream text-ink leading-[1.2] font-black ${sizes[size]}`} data-testid="tv-question">
      {q.text}
      {q.unit && size !== 'sm' && (
        <div className="mt-[0.4em] text-[0.55em] font-display font-bold text-grape" data-testid="tv-unit">
          Answer in: {unitLabel(q.unit, q.precision)}
        </div>
      )}
    </div>
  );
}

export function unitLabel(unit: string, precision: number): string {
  if (unit === '$') return precision > 0 ? 'dollars & cents ($)' : 'dollars ($)';
  if (unit === 'year') return 'a year';
  const decimals = precision > 0 ? ` (up to ${precision} decimal place${precision === 1 ? '' : 's'})` : '';
  return `${unit || 'a number'}${decimals}`;
}

export function AvatarRow({ players, doneIds, size = 5 }: { players: PlayerView[]; doneIds?: string[]; size?: number }) {
  const done = new Set(doneIds ?? []);
  return (
    <div className={`flex flex-wrap justify-center text-[1rem] ${players.length > 6 ? 'gap-[1rem]' : 'gap-[1.6rem]'}`}>
      {players.map((p, i) => (
        <div key={p.id} className="animate-pop-in" style={{ animationDelay: `${i * 60}ms` }} data-testid="tv-avatar" data-locked={done.has(p.id)}>
          <Avatar
            player={p}
            size={size}
            showName
            dim={doneIds !== undefined && !done.has(p.id)}
            badge={doneIds === undefined ? null : done.has(p.id) ? 'check' : p.connected ? 'typing' : null}
            className="text-[1.3rem]"
          />
        </div>
      ))}
    </div>
  );
}

export function Banner({ children, tone = 'pink', small = false }: { children: React.ReactNode; tone?: 'pink' | 'sun' | 'mint' | 'sky' | 'tomato'; small?: boolean }) {
  const bg = { pink: 'bg-pink text-white', sun: 'bg-sun text-ink', mint: 'bg-mint text-ink', sky: 'bg-sky text-ink', tomato: 'bg-tomato text-white' }[tone];
  return (
    <div className={`inline-block sticker rounded-[1rem] ${small ? 'px-[1.2rem] py-[0.2rem] text-[1.6rem]' : 'px-[1.6rem] py-[0.5rem] text-[2rem]'} font-display font-bold rotate-[-2deg] animate-slide-in ${bg}`}>
      {children}
    </div>
  );
}
