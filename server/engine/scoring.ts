/**
 * Round scoring. Pure and deterministic: the same inputs always give the same result.
 *
 * Closest Overall:     every guess is eligible; ranked by |guess − answer|.
 * Without Going Over:  only guesses ≤ answer are eligible; ranked by answer − guess.
 *                      Guesses over the answer are "busted" and score 0.
 *
 * Eligible guesses are ranked with competition ranking (1, 1, 3): tied players get
 * the same placement and the same points, and the next placement is skipped.
 * 1st/2nd/3rd earn 1,000/500/250; an exact answer adds +250. No guess = 0.
 *
 * All comparisons use integers scaled by 10^precision so ties are exact.
 */
import { POINTS, type PlayerRoundResult, type ScoringMode } from '../../shared/protocol';
import { fromScaled, toScaled } from '../../shared/numbers';

export interface ScoreInput {
  answer: number;
  precision: number;
  mode: ScoringMode;
  /** Every contestant in the round, guess or not. */
  playerIds: readonly string[];
  /** playerId -> final guess. Players without an entry missed the round. */
  guesses: Readonly<Record<string, number>>;
}

export function placementPoints(rank: number): number {
  return POINTS.placements[rank - 1] ?? 0;
}

export function scoreRound(input: ScoreInput): Record<string, PlayerRoundResult> {
  const { answer, precision, mode, playerIds, guesses } = input;
  const answerScaled = toScaled(answer, precision);
  const results: Record<string, PlayerRoundResult> = {};

  const eligible: { id: string; distance: number }[] = [];
  for (const id of playerIds) {
    const guess = guesses[id];
    if (guess === undefined || guess === null || !Number.isFinite(guess)) {
      results[id] = {
        playerId: id,
        guess: null,
        diff: null,
        signedDiff: null,
        status: 'missing',
        rank: null,
        exact: false,
        placementPoints: 0,
        exactBonus: 0,
        total: 0,
      };
      continue;
    }
    const signedScaled = toScaled(guess, precision) - answerScaled;
    const busted = mode === 'withoutGoingOver' && signedScaled > 0;
    results[id] = {
      playerId: id,
      guess,
      diff: fromScaled(Math.abs(signedScaled), precision),
      signedDiff: fromScaled(signedScaled, precision),
      status: busted ? 'busted' : 'unplaced',
      rank: null,
      exact: signedScaled === 0,
      placementPoints: 0,
      exactBonus: 0,
      total: 0,
    };
    if (!busted) eligible.push({ id, distance: Math.abs(signedScaled) });
  }

  // Competition ranking on exact integer distances.
  eligible.sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
  let prevDistance = -1;
  let prevRank = 0;
  eligible.forEach((e, i) => {
    const rank = e.distance === prevDistance ? prevRank : i + 1;
    prevDistance = e.distance;
    prevRank = rank;
    const r = results[e.id]!;
    r.rank = rank;
    r.placementPoints = placementPoints(rank);
    r.status = r.placementPoints > 0 ? 'placed' : 'unplaced';
    r.exactBonus = r.exact ? POINTS.exactBonus : 0;
    r.total = r.placementPoints + r.exactBonus;
  });

  return results;
}

/** True when at least one player guessed and every guess went over. */
export function everyoneBusted(results: Record<string, PlayerRoundResult>): boolean {
  const guessed = Object.values(results).filter((r) => r.status !== 'missing');
  return guessed.length > 0 && guessed.every((r) => r.status === 'busted');
}
