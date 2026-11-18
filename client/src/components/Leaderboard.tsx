import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerView, StandingRow } from '../../../shared/protocol';
import { usePrefs } from '../lib/prefs';
import { Avatar } from './Avatar';

/** Counts from `from` to `to` (instantly with reduced motion). */
export function CountUp({ from, to, delayMs = 0, durationMs = 1200 }: { from: number; to: number; delayMs?: number; durationMs?: number }) {
  const reduce = usePrefs((s) => s.reduceMotion);
  const [value, setValue] = useState(reduce ? to : from);
  useEffect(() => {
    if (reduce || from === to) {
      setValue(to);
      return;
    }
    setValue(from);
    let raf = 0;
    let t0 = 0;
    const timeout = setTimeout(() => {
      const frame = (t: number) => {
        t0 ||= t;
        const p = Math.min(1, (t - t0) / durationMs);
        setValue(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))));
        if (p < 1) raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }, delayMs);
    return () => {
      clearTimeout(timeout);
      cancelAnimationFrame(raf);
    };
  }, [from, to, delayMs, durationMs, reduce]);
  return <>{value.toLocaleString('en-US')}</>;
}

interface Props {
  standings: StandingRow[];
  players: Map<string, PlayerView>;
  /** Animate rows from their previous positions (scoreboard). */
  animate?: boolean;
  /** Row height in rem (TV scale). */
  rowRem?: number;
  className?: string;
}

/**
 * Leaderboard with FLIP-style movement: each row starts at its previous rank's
 * position and slides to its new one while the score counts up.
 */
export function Leaderboard({ standings, players, animate = true, rowRem = 5.2, className = '' }: Props) {
  const reduce = usePrefs((s) => s.reduceMotion);
  // Previous order: by score before this round.
  const prevOrder = standings
    .slice()
    .sort((a, b) => b.score - b.delta - (a.score - a.delta) || standings.indexOf(a) - standings.indexOf(b))
    .map((r) => r.playerId);
  const [settled, setSettled] = useState(!animate || reduce);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (!animate || reduce) return setSettled(true);
    if (!first.current) return;
    first.current = false;
    const t = setTimeout(() => setSettled(true), 900);
    return () => clearTimeout(t);
  }, [animate, reduce]);

  return (
    <ol className={`relative ${className}`} style={{ height: `${standings.length * rowRem}rem` }} data-testid="leaderboard">
      {standings.map((row, i) => {
        const p = players.get(row.playerId);
        if (!p) return null;
        const from = prevOrder.indexOf(row.playerId);
        const index = settled ? i : from;
        const leader = row.rank === 1;
        return (
          <li
            key={row.playerId}
            className="absolute inset-x-0 flex items-center gap-[1rem] px-[1.2rem] rounded-[1.2rem] sticker"
            style={{
              top: `${index * rowRem}rem`,
              height: `${rowRem - 0.8}rem`,
              transition: 'top 0.9s cubic-bezier(0.3, 1.2, 0.4, 1)',
              background: leader ? 'var(--color-sun)' : 'var(--color-plum)',
              color: leader ? 'var(--color-ink)' : 'var(--color-cream)',
            }}
            data-testid="leaderboard-row"
            data-player={p.name}
            data-rank={row.rank}
            data-score={row.score}
          >
            <span className="font-display font-bold text-[2rem] w-[3rem] text-center tabular">{row.rank}</span>
            <Avatar player={p} size={Math.min(3.2, rowRem - 1.4)} className="text-[1rem]" />
            <span className="text-[1.9rem] truncate flex-1" style={leader ? undefined : { color: p.color }}>
              {p.name}
            </span>
            {row.delta > 0 && (
              <span className="font-display font-bold text-[1.5rem] rounded-full bg-mint text-ink px-[0.8rem] animate-fly-up" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                +{row.delta.toLocaleString('en-US')}
              </span>
            )}
            <span className="font-display font-bold text-[2.3rem] tabular w-[9rem] text-right">
              <CountUp from={row.score - row.delta} to={row.score} delayMs={400} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
