import { useEffect } from 'react';
import type { GameView, PlayerRoundResult } from '../../../../shared/protocol';
import { formatSignedDiff, formatValue, shortUnit } from '../../../../shared/numbers';
import { Avatar } from '../../components/Avatar';
import { NumberLine } from '../../components/NumberLine';
import { usePlayerMap } from '../../hooks/usePlayers';
import { sfx } from '../../lib/sfx';
import { Banner, QuestionMeta } from './shared';

function CompactQuestion({ view }: { view: GameView }) {
  return (
    <div className="flex items-center gap-[1.2rem] min-w-0">
      <QuestionMeta view={view} showRule={false} className="text-[1.3rem] shrink-0" />
      <div className="text-[1.7rem] text-cream/90 truncate" data-testid="tv-question" title={view.question?.text}>
        {view.question?.text}
      </div>
    </div>
  );
}

/** Phase "guessReveal": every guess on the number line — but no answer yet. */
export function TvGuessReveal({ view }: { view: GameView }) {
  const players = usePlayerMap(view);
  const q = view.question!;
  const guesses = view.guesses ?? [];
  useEffect(() => sfx.whoosh(), []);
  return (
    <div className="h-full flex flex-col px-[4rem] pt-[1rem] pb-[2.5rem] gap-[0.6rem]">
      <CompactQuestion view={view} />
      <div className="flex items-center gap-[1.5rem] mt-[0.6rem]">
        <Banner tone="sky">Here's what you guessed…</Banner>
        <span className="text-[1.8rem] text-cream/80">Who's closest? 🤔</span>
      </div>
      {guesses.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[3rem] text-cream/70" data-testid="tv-no-guesses">
          Nobody guessed! 😶
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          <NumberLine guesses={guesses} players={players} unit={q.unit} precision={q.precision} mode={q.mode} answer={null} />
        </div>
      )}
      <div className="flex flex-wrap justify-center gap-[0.8rem]" data-testid="tv-guess-cards">
        {guesses.map((g, i) => {
          const p = players.get(g.playerId);
          if (!p) return null;
          return (
            <div
              key={g.playerId}
              className="flex items-center gap-[0.6rem] rounded-[1rem] bg-plum sticker px-[0.8rem] py-[0.3rem] animate-rise"
              style={{ animationDelay: `${0.3 + i * 0.12}s` }}
              data-testid="tv-guess-card"
              data-player={p.name}
              data-value={g.value}
            >
              <Avatar player={p} size={2.4} className="text-[1rem]" />
              <span className="text-[1.4rem]" style={{ color: p.color }}>
                {p.name}
              </span>
              <span className="font-display font-bold text-[1.6rem] tabular">{formatValue(g.value, q.unit, q.precision)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_ORDER: Record<PlayerRoundResult['status'], number> = { placed: 0, unplaced: 1, busted: 2, missing: 3 };

export function sortResults(results: PlayerRoundResult[]): PlayerRoundResult[] {
  return results.slice().sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.rank ?? 99) - (b.rank ?? 99) || (a.diff ?? 0) - (b.diff ?? 0));
}

/** Phase "answerReveal": the answer drops in, differences, winners and busts. */
export function TvAnswerReveal({ view }: { view: GameView }) {
  const players = usePlayerMap(view);
  const q = view.question!;
  const reveal = view.reveal!;
  const results = sortResults(Object.values(reveal.results));
  const crowded = results.length > 5;
  useEffect(() => {
    const t = setTimeout(() => (reveal.everyoneBusted ? sfx.buzz() : sfx.truth()), 600);
    return () => clearTimeout(t);
  }, [reveal.everyoneBusted]);

  return (
    <div className="h-full flex flex-col px-[4rem] pt-[0.6rem] pb-[1.6rem] gap-[0.4rem]">
      <CompactQuestion view={view} />
      <div className="flex items-center gap-[1.5rem] mt-[0.6rem]">
        <Banner tone="sun" small={crowded}>The answer is…</Banner>
        <span className={`font-display font-bold ${crowded ? 'text-[2.8rem]' : 'text-[3.4rem]'} text-sun animate-drop tabular`} data-testid="tv-answer">
          {formatValue(reveal.answer, q.unit, q.precision)}
        </span>
        {reveal.everyoneBusted && (
          <span className="ml-auto animate-shake [animation-delay:1s]" data-testid="tv-everyone-busted">
            <Banner tone="tomato" small={crowded}>💥 Everyone went over! No points.</Banner>
          </span>
        )}
      </div>
      <div className="flex-1 flex flex-col justify-center min-h-0">
        <NumberLine
          guesses={view.guesses ?? []}
          players={players}
          unit={q.unit}
          precision={q.precision}
          mode={q.mode}
          answer={reveal.answer}
          results={reveal.results}
        />
      </div>
      <div className="grid grid-cols-5 gap-[0.6rem]" data-testid="tv-results">
        {results.map((r, i) => {
          const p = players.get(r.playerId);
          if (!p) return null;
          const tone =
            r.status === 'placed' ? (r.rank === 1 ? 'bg-sun text-ink' : 'bg-mint/90 text-ink') : r.status === 'busted' ? 'bg-tomato/25' : 'bg-plum/80';
          return (
            <div
              key={r.playerId}
              className={`flex items-center gap-[0.6rem] rounded-[1rem] sticker px-[0.7rem] ${crowded ? 'py-0' : 'py-[0.35rem]'} animate-rise ${tone}`}
              style={{ animationDelay: `${1 + i * 0.12}s` }}
              data-testid="tv-result"
              data-player={p.name}
              data-status={r.status}
              data-points={r.total}
            >
              <Avatar player={p} size={crowded ? 2.1 : 2.6} className="text-[1rem]" />
              <div className="min-w-0 flex-1 leading-tight">
                <div className={`${crowded ? 'text-[1.15rem]' : 'text-[1.3rem]'} truncate`}>{p.name}</div>
                <div className={`${crowded ? 'text-[1rem]' : 'text-[1.15rem]'} opacity-80 tabular truncate`}>
                  {r.guess === null
                    ? 'No guess'
                    : r.status === 'busted'
                      ? `Over by ${formatSignedDiff(r.signedDiff!, shortUnit(q.unit), q.precision).slice(1)}`
                      : formatSignedDiff(r.signedDiff!, shortUnit(q.unit), q.precision)}
                </div>
              </div>
              <div className="text-right leading-none">
                {r.rank !== null && r.placementPoints > 0 && <div className="text-[1.1rem]">{['🥇', '🥈', '🥉'][r.rank - 1]}</div>}
                <div className={`font-display font-bold ${crowded ? 'text-[1.3rem]' : 'text-[1.6rem]'} tabular`}>{r.total > 0 ? `+${r.total.toLocaleString('en-US')}` : '0'}</div>
                {r.exact && <div className="text-[0.9rem] font-display font-bold">+250 EXACT</div>}
              </div>
            </div>
          );
        })}
      </div>
      {!crowded && (reveal.fact || reveal.source) && (
        <div className="text-[1.25rem] text-cream/75 truncate mt-[0.3rem]" data-testid="tv-fact">
          {reveal.fact && <span>🤓 {reveal.fact} </span>}
          <span className="text-cream/50">Source: {reveal.source}</span>
        </div>
      )}
    </div>
  );
}
