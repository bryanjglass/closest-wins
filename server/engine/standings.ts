import type { Award, GameStatsView, PlayerGameStats, StandingRow } from '../../shared/protocol';
import { toScaled } from '../../shared/numbers';
import type { GameState, ServerPlayer } from './types';

interface Rankable {
  id: string;
  name: string;
  score: number;
}

/** Sort by score (desc), then name for a stable display order. */
export function sortForStandings<T extends Rankable>(players: readonly T[]): T[] {
  return players
    .slice()
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }) ||
        a.id.localeCompare(b.id),
    );
}

/** Competition ranking: equal scores share a rank and the next rank is skipped (1, 2, 2, 4). */
export function rankMap(players: readonly Rankable[]): Record<string, number> {
  const sorted = sortForStandings(players);
  const ranks: Record<string, number> = {};
  sorted.forEach((p, i) => {
    const prev = sorted[i - 1];
    ranks[p.id] = prev && prev.score === p.score ? ranks[prev.id]! : i + 1;
  });
  return ranks;
}

export function computeStandings(
  players: readonly ServerPlayer[],
  scoresBefore: Record<string, number> | null,
): StandingRow[] {
  const contestants = players.filter((p) => p.status === 'contestant');
  const ranks = rankMap(contestants);
  const prevRanks = scoresBefore
    ? rankMap(contestants.map((p) => ({ ...p, score: scoresBefore[p.id] ?? 0 })))
    : null;
  return sortForStandings(contestants).map((p) => ({
    playerId: p.id,
    rank: ranks[p.id]!,
    score: p.score,
    delta: scoresBefore ? p.score - (scoresBefore[p.id] ?? 0) : 0,
    previousRank: prevRanks ? prevRanks[p.id]! : null,
  }));
}

/** Per-player statistics and light-hearted awards for the game-over screen. */
export function computeGameStats(state: GameState): GameStatsView {
  const ids = state.players.filter((p) => p.status === 'contestant').map((p) => p.id);
  const stats = new Map<string, PlayerGameStats & { errSum: number; errCount: number }>(
    ids.map((id) => [
      id,
      { playerId: id, roundsGuessed: 0, firstPlaces: 0, podiums: 0, exactHits: 0, busts: 0, missed: 0, avgErrorPct: null, errSum: 0, errCount: 0 },
    ]),
  );
  for (const round of state.history) {
    for (const r of Object.values(round.results)) {
      const st = stats.get(r.playerId);
      if (!st) continue;
      if (r.status === 'missing') {
        st.missed += 1;
        continue;
      }
      st.roundsGuessed += 1;
      if (r.rank === 1) st.firstPlaces += 1;
      if (r.placementPoints > 0) st.podiums += 1;
      if (r.exact) st.exactHits += 1;
      if (r.status === 'busted') st.busts += 1;
      if (r.diff !== null && round.answer !== 0) {
        // Exact relative error from scaled integers.
        const pct = (toScaled(r.diff, round.precision) / Math.abs(toScaled(round.answer, round.precision))) * 100;
        st.errSum += pct;
        st.errCount += 1;
      }
    }
  }
  const players: PlayerGameStats[] = [...stats.values()].map(({ errSum, errCount, ...rest }) => ({
    ...rest,
    avgErrorPct: errCount ? Math.round((errSum / errCount) * 10) / 10 : null,
  }));

  const awards: Award[] = [];
  const best = (
    id: string,
    title: string,
    emoji: string,
    value: (p: PlayerGameStats) => number | null,
    describe: (v: number) => string,
    lowerIsBetter = false,
  ) => {
    const scored = players.map((p) => ({ p, v: value(p) })).filter((x): x is { p: PlayerGameStats; v: number } => x.v !== null);
    const meaningful = lowerIsBetter ? scored : scored.filter((x) => x.v > 0);
    if (!meaningful.length) return;
    const top = lowerIsBetter ? Math.min(...meaningful.map((x) => x.v)) : Math.max(...meaningful.map((x) => x.v));
    awards.push({
      id,
      title,
      emoji,
      description: describe(top),
      playerIds: meaningful.filter((x) => x.v === top).map((x) => x.p.playerId),
    });
  };
  const times = (n: number) => `${n} time${n === 1 ? '' : 's'}`;
  best('bullseye', 'Bullseye', '🎯', (p) => p.exactHits, (n) => `Nailed the exact answer ${times(n)}`);
  best('sharpshooter', 'Sharpshooter', '🏹', (p) => p.firstPlaces, (n) => `Won ${n} round${n === 1 ? '' : 's'} outright or tied`);
  best(
    'calibrated',
    'Human Calculator',
    '🧮',
    (p) => (p.roundsGuessed >= Math.max(1, Math.ceil(state.history.length / 2)) ? p.avgErrorPct : null),
    (v) => `Closest on average (off by ${v}%)`,
    true,
  );
  best('daredevil', 'Daredevil', '💥', (p) => p.busts, (n) => `Went over ${times(n)}`);
  return { rounds: state.history.length, players, awards };
}
