import { useMemo } from 'react';
import type { PlayerRoundResult, PlayerView, RevealedGuess, ScoringMode } from '../../../shared/protocol';
import { layoutNumberLine } from '../../../shared/numberLine';
import { compactValue, shortUnit } from '../../../shared/numbers';
import { Avatar } from './Avatar';

interface Props {
  guesses: RevealedGuess[];
  players: Map<string, PlayerView>;
  unit: string;
  precision: number;
  mode: ScoringMode;
  /** Null until the answer reveal. */
  answer: number | null;
  results?: Record<string, PlayerRoundResult> | null;
  className?: string;
}

const LANE_REM = 4.8;
const MAX_LANES = 4;

/**
 * The TV number line. Guesses pop in left-to-right; at the answer reveal a flag
 * drops onto the exact value, the "bust zone" lights up in Without Going Over,
 * and winners glow. Sized in rem for the 1920×1080 TV layout.
 */
export function NumberLine({ guesses, players, unit, precision, mode, answer, results, className = '' }: Props) {
  const layout = useMemo(
    () =>
      layoutNumberLine(
        guesses.map((g) => ({ id: g.playerId, value: g.value })),
        answer,
        { minGapPct: 9, maxLanes: MAX_LANES, paddingPct: 6 },
      ),
    [guesses, answer],
  );

  // Lanes alternate above / below the line: 0 ↑, 1 ↓, 2 ↑↑, 3 ↓↓.
  const laneOffset = (lane: number) => {
    const level = Math.floor(lane / 2) + 1;
    return (lane % 2 === 0 ? -1 : 1) * level * LANE_REM;
  };

  const showAnswer = answer !== null && layout.answerPct !== null;
  // Only as tall as the lanes in use need: even lanes go up, odd lanes go down.
  const upRem = Math.ceil(layout.lanes / 2) * LANE_REM + 2.7;
  const downRem = Math.floor(layout.lanes / 2) * LANE_REM + 2.7;
  const heightRem = upRem + downRem;
  const lineTop = `${upRem}rem`;
  const order = new Map(layout.markers.map((m, i) => [m, i]));

  return (
    <div
      className={`relative w-full ${className}`}
      style={{ height: `${heightRem}rem` }}
      data-testid="number-line"
      data-scale={layout.scale}
    >
      {/* Bust zone (Without Going Over) */}
      {showAnswer && mode === 'withoutGoingOver' && (
        <div
          className="absolute top-[1rem] bottom-[1rem] right-0 rounded-r-[1rem] bg-tomato/15 border-l-[0.2rem] border-dashed border-tomato/60 animate-rise"
          style={{ left: `${layout.answerPct}%`, animationDelay: '0.9s' }}
          aria-hidden="true"
        >
          <span className="absolute top-[0.4rem] right-[0.8rem] font-display font-bold text-tomato text-[1.3rem] tracking-wider">
            BUST ZONE
          </span>
        </div>
      )}

      {/* The line */}
      <div className="absolute left-0 right-0 -translate-y-1/2 h-[0.6rem] rounded-full bg-cream/85 sticker" style={{ top: lineTop }} />
      {layout.ticks.map((t) => (
        <div key={t.value} className="absolute" style={{ left: `${t.pct}%`, top: lineTop }} aria-hidden="true">
          <div className="w-[0.2rem] h-[1.2rem] -translate-x-1/2 -translate-y-1/2 bg-cream/50" />
          <div className="absolute top-[0.9rem] -translate-x-1/2 text-[0.95rem] text-cream/55 whitespace-nowrap tabular">
            {compactValue(t.value, shortUnit(unit), precision)}
          </div>
        </div>
      ))}
      {layout.scale === 'log' && (
        <div className="absolute bottom-0 right-0 text-[0.95rem] text-cream/60">log scale — guesses were far apart!</div>
      )}

      {/* Guess markers */}
      {layout.markers.map((m) => {
        const offset = laneOffset(m.lane);
        const rs = m.ids.map((id) => results?.[id]).filter(Boolean) as PlayerRoundResult[];
        const busted = showAnswer && rs.length > 0 && rs.every((r) => r.status === 'busted');
        const winner = showAnswer && rs.some((r) => r.rank === 1);
        const exact = showAnswer && rs.some((r) => r.exact);
        const i = order.get(m) ?? 0;
        return (
          <div
            key={m.value}
            className={`absolute ${winner ? 'z-20' : 'z-[15]'}`}
            style={{ left: `${m.pct}%`, top: lineTop }}
            data-testid="line-marker"
            data-value={m.value}
          >
            {/* stem */}
            <div
              className={`absolute left-0 -translate-x-1/2 w-[0.25rem] ${busted ? 'bg-tomato/70' : 'bg-cream/70'}`}
              style={offset < 0 ? { bottom: 0, height: `${-offset}rem` } : { top: 0, height: `${offset}rem` }}
            />
            <div className={`absolute left-0 -translate-x-1/2 -translate-y-1/2 w-[1rem] h-[1rem] rounded-full sticker ${busted ? 'bg-tomato' : 'bg-cream'}`} />
            <div
              className="absolute left-0 animate-pop-in"
              style={{ top: `${offset}rem`, transform: 'translate(-50%, -50%)', animationDelay: `${0.25 + i * 0.18}s` }}
            >
              <div
                className={`flex flex-col items-center rounded-[1rem] px-[0.6rem] py-[0.3rem] sticker transition-all duration-500 ${
                  busted ? 'bg-ink/90 opacity-60' : winner ? 'bg-sun text-ink animate-glow' : 'bg-plum'
                }`}
              >
                <div className="flex -space-x-[0.8rem] text-[1rem]">
                  {m.ids.slice(0, 4).map((id) => {
                    const p = players.get(id);
                    return p ? <Avatar key={id} player={p} size={2.1} /> : null;
                  })}
                  {m.ids.length > 4 && <span className="self-center pl-[1rem] text-[1.2rem]">+{m.ids.length - 4}</span>}
                </div>
                <div className={`font-display font-bold text-[1.3rem] leading-tight whitespace-nowrap tabular ${busted ? 'line-through text-tomato' : ''}`}>
                  {compactValue(m.value, shortUnit(unit), precision)}
                </div>
                {exact && <div className="text-[0.95rem] font-display font-bold text-pink">EXACT!</div>}
                {busted && <div className="text-[0.95rem] font-display font-bold text-tomato">BUST</div>}
              </div>
            </div>
          </div>
        );
      })}

      {/* Answer flag */}
      {showAnswer && (
        <div className="absolute top-0 bottom-0 z-10 pointer-events-none" style={{ left: `${layout.answerPct}%` }} data-testid="line-answer">
          <div className="absolute top-[1.5rem] bottom-[1.5rem] left-0 -translate-x-1/2 w-[0.4rem] bg-sun shadow-[0_0_1.5rem_rgb(255_207_63/0.8)] animate-drop" />
          <div
            className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-[1.8rem] h-[1.8rem] rounded-full bg-sun sticker animate-drop"
            style={{ animationDelay: '0.1s', top: lineTop }}
          />
          <div className="absolute left-0 -translate-x-1/2 -translate-y-1/2 w-[1.8rem] h-[1.8rem] rounded-full border-[0.2rem] border-sun animate-ping-ring motion-only" style={{ top: lineTop }} />
        </div>
      )}
    </div>
  );
}
