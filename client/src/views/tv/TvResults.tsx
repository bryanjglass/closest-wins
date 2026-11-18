import { useEffect } from 'react';
import type { GameView } from '../../../../shared/protocol';
import { Avatar } from '../../components/Avatar';
import { Confetti } from '../../components/Confetti';
import { Leaderboard } from '../../components/Leaderboard';
import { usePlayerMap } from '../../hooks/usePlayers';
import { sfx } from '../../lib/sfx';
import { Banner } from './shared';

/** Phase "scoreboard": cumulative standings, animated from the previous order. */
export function TvScoreboard({ view }: { view: GameView }) {
  const players = usePlayerMap(view);
  const last = view.round >= view.totalRounds;
  const rowRem = view.standings.length > 8 ? 3.75 : view.standings.length > 6 ? 4.3 : 5.4;
  return (
    <div className="h-full flex flex-col px-[12rem] pt-[0.6rem] pb-[2rem] gap-[1rem]">
      <div className="flex items-center justify-between">
        <Banner tone="mint">Scoreboard</Banner>
        <div className="text-[1.8rem] text-cream/80" data-testid="tv-next-hint">
          {last ? 'Final results coming up…' : `After ${view.round} of ${view.totalRounds} questions`}
        </div>
      </div>
      <Leaderboard standings={view.standings} players={players} rowRem={rowRem} />
    </div>
  );
}

/** Phase "gameOver": the winner, final rankings, stats and awards. */
export function TvGameOver({ view }: { view: GameView }) {
  const players = usePlayerMap(view);
  const winners = view.standings.filter((s) => s.rank === 1);
  const stats = view.stats;
  useEffect(() => sfx.fanfare(), []);
  const statFor = (id: string) => stats?.players.find((p) => p.playerId === id);

  return (
    <div className="h-full grid grid-cols-[1fr_1.15fr] grid-rows-[minmax(0,1fr)] gap-[3rem] px-[4rem] pt-[1rem] pb-[3rem] overflow-hidden">
      <Confetti />
      <section className="flex flex-col items-center justify-center gap-[1rem] text-center z-20 min-h-0">
        <div className="font-display font-bold text-[2.4rem] text-cream/80">{winners.length > 1 ? "It's a tie!" : 'And the winner is…'}</div>
        <div className="flex gap-[2rem] justify-center" data-testid="tv-winner">
          {winners.map((w) => {
            const p = players.get(w.playerId);
            return p ? (
              <div key={w.playerId} className="flex flex-col items-center gap-[0.8rem] animate-pop-in [animation-delay:400ms]">
                <div className="text-[3rem] animate-float" aria-hidden="true">
                  👑
                </div>
                <Avatar player={p} size={winners.length > 2 ? 5 : 7} className="text-[1rem] animate-glow rounded-full" />
                <div className="font-display font-bold text-[3.2rem] leading-none text-sun text-outline shadow-pop" data-testid="tv-winner-name">
                  {p.name}
                </div>
                <div className="font-display font-bold text-[2rem] tabular">{w.score.toLocaleString('en-US')} pts</div>
              </div>
            ) : null;
          })}
        </div>
        {stats && stats.awards.length > 0 && (
          <div className="grid grid-cols-2 gap-[0.6rem] w-full mt-[0.6rem]" data-testid="tv-awards">
            {stats.awards.map((a, i) => (
              <div key={a.id} className="rounded-[1rem] bg-black/30 border-[0.12rem] border-white/15 px-[1rem] py-[0.4rem] text-left animate-rise" style={{ animationDelay: `${1 + i * 0.2}s` }}>
                <div className="font-display font-bold text-[1.5rem] text-sun">
                  {a.emoji} {a.title}
                </div>
                <div className="text-[1.3rem] truncate">{a.playerIds.map((id) => players.get(id)?.name).join(' & ')}</div>
                <div className="text-[1.05rem] text-cream/70">{a.description}</div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="flex flex-col gap-[0.8rem] z-20 min-h-0">
        <h2 className="font-display font-bold text-[2.4rem] text-sun">Final standings</h2>
        <ol className="flex flex-col gap-[0.5rem]" data-testid="tv-final-standings">
          {view.standings.map((row, i) => {
            const p = players.get(row.playerId);
            const st = statFor(row.playerId);
            if (!p) return null;
            return (
              <li
                key={row.playerId}
                className={`flex items-center gap-[0.9rem] rounded-[1rem] sticker px-[1rem] py-[0.35rem] animate-slide-in ${row.rank === 1 ? 'bg-sun text-ink' : 'bg-plum'}`}
                style={{ animationDelay: `${0.2 + i * 0.1}s` }}
                data-testid="tv-final-row"
                data-player={p.name}
                data-rank={row.rank}
                data-score={row.score}
              >
                <span className="font-display font-bold text-[1.8rem] w-[2.4rem] text-center">{row.rank}</span>
                <Avatar player={p} size={2.6} className="text-[1rem]" />
                <span className="text-[1.6rem] flex-1 truncate">{p.name}</span>
                {st && (
                  <span className="text-[1.05rem] opacity-80 text-right leading-tight w-[15rem]">
                    🥇 {st.firstPlaces} · 🎯 {st.exactHits} · 💥 {st.busts}
                    <br />
                    {st.avgErrorPct !== null ? `avg. off by ${st.avgErrorPct}%` : 'no guesses'}
                  </span>
                )}
                <span className="font-display font-bold text-[1.9rem] tabular w-[8rem] text-right">{row.score.toLocaleString('en-US')}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-auto pt-[0.6rem] text-[1.4rem] text-cream/70">Rematch? The host can start a new game with the same players.</div>
      </section>
    </div>
  );
}
