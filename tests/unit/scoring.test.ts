import { describe, expect, it } from 'vitest';
import { everyoneBusted, placementPoints, scoreRound } from '../../server/engine/scoring';

const ids = ['a', 'b', 'c', 'd'];
const points = (r: ReturnType<typeof scoreRound>) => Object.fromEntries(Object.values(r).map((x) => [x.playerId, x.total]));
const ranks = (r: ReturnType<typeof scoreRound>) => Object.fromEntries(Object.values(r).map((x) => [x.playerId, x.rank]));

describe('placement points', () => {
  it('awards 1,000 / 500 / 250 and nothing below 3rd', () => {
    expect([1, 2, 3, 4, 5].map(placementPoints)).toEqual([1000, 500, 250, 0, 0]);
  });
});

describe('Closest Overall', () => {
  it('ranks by absolute difference, over or under', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 90, b: 105, c: 130, d: 40 } });
    expect(ranks(r)).toEqual({ a: 2, b: 1, c: 3, d: 4 });
    expect(points(r)).toEqual({ a: 500, b: 1000, c: 250, d: 0 });
    expect(r.b!.diff).toBe(5);
    expect(r.b!.signedDiff).toBe(5);
    expect(r.a!.signedDiff).toBe(-10);
    expect(r.d!.status).toBe('unplaced');
    expect(r.b!.status).toBe('placed');
  });

  it('gives tied players equal points with competition ranking (1, 1, 3)', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 90, b: 110, c: 80, d: 150 } });
    expect(ranks(r)).toEqual({ a: 1, b: 1, c: 3, d: 4 });
    expect(points(r)).toEqual({ a: 1000, b: 1000, c: 250, d: 0 });
  });

  it('handles a tie for 2nd (1, 2, 2, 4)', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 99, b: 95, c: 105, d: 200 } });
    expect(ranks(r)).toEqual({ a: 1, b: 2, c: 2, d: 4 });
    expect(points(r)).toEqual({ a: 1000, b: 500, c: 500, d: 0 });
  });

  it('handles a tie for 3rd: both get 250', () => {
    const r = scoreRound({ answer: 10, precision: 0, mode: 'closest', playerIds: [...ids, 'e'], guesses: { a: 10, b: 11, c: 13, d: 7, e: 50 } });
    expect(ranks(r)).toEqual({ a: 1, b: 2, c: 3, d: 3, e: 5 });
    expect(points(r)).toEqual({ a: 1250, b: 500, c: 250, d: 250, e: 0 });
  });

  it('everyone tied: everybody is 1st', () => {
    const r = scoreRound({ answer: 50, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 40, b: 60, c: 40, d: 60 } });
    expect(points(r)).toEqual({ a: 1000, b: 1000, c: 1000, d: 1000 });
  });

  it('adds +250 for an exact answer, on top of 1st place', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 100, b: 101, c: 97, d: 0 } });
    expect(r.a).toMatchObject({ exact: true, rank: 1, placementPoints: 1000, exactBonus: 250, total: 1250 });
    expect(points(r)).toEqual({ a: 1250, b: 500, c: 250, d: 0 });
  });

  it('two exact answers tie for 1st and both get the bonus', () => {
    const r = scoreRound({ answer: 7, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 7, b: 7, c: 8, d: 9 } });
    expect(points(r)).toEqual({ a: 1250, b: 1250, c: 250, d: 0 });
  });

  it('gives missing guesses zero and does not let them take a placement', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'closest', playerIds: ids, guesses: { a: 50, c: 10 } });
    expect(r.b).toMatchObject({ status: 'missing', guess: null, diff: null, rank: null, total: 0 });
    expect(r.d!.status).toBe('missing');
    expect(points(r)).toEqual({ a: 1000, b: 0, c: 500, d: 0 });
  });

  it('nobody guessed: nobody scores', () => {
    const r = scoreRound({ answer: 1, precision: 0, mode: 'closest', playerIds: ids, guesses: {} });
    expect(Object.values(r).every((x) => x.total === 0 && x.status === 'missing')).toBe(true);
    expect(everyoneBusted(r)).toBe(false);
  });

  it('uses exact decimal arithmetic for ties (0.1 / 0.5 around 0.3)', () => {
    // Naive floats: 0.3 - 0.1 = 0.19999999999999998 but 0.5 - 0.3 = 0.2.
    const r = scoreRound({ answer: 0.3, precision: 1, mode: 'closest', playerIds: ['a', 'b'], guesses: { a: 0.1, b: 0.5 } });
    expect(ranks(r)).toEqual({ a: 1, b: 1 });
    expect(r.a!.diff).toBe(0.2);
    expect(r.b!.diff).toBe(0.2);
  });

  it('handles currency to the cent', () => {
    const r = scoreRound({ answer: 3.99, precision: 2, mode: 'closest', playerIds: ids, guesses: { a: 3.98, b: 4, c: 3.99, d: 4.5 } });
    expect(ranks(r)).toEqual({ a: 2, b: 2, c: 1, d: 4 });
    expect(points(r)).toEqual({ a: 500, b: 500, c: 1250, d: 0 });
    expect(r.a!.diff).toBe(0.01);
    expect(r.d!.signedDiff).toBe(0.51);
  });

  it('handles negative answers', () => {
    const r = scoreRound({ answer: -89.2, precision: 1, mode: 'closest', playerIds: ['a', 'b', 'c'], guesses: { a: -90, b: -80, c: 10 } });
    expect(ranks(r)).toEqual({ a: 1, b: 2, c: 3 });
    expect(r.a!.diff).toBe(0.8);
  });

  it('handles very large values exactly', () => {
    const r = scoreRound({ answer: 384400, precision: 0, mode: 'closest', playerIds: ['a', 'b'], guesses: { a: 999_999_999_999, b: 1 } });
    expect(ranks(r)).toEqual({ a: 2, b: 1 });
    expect(r.a!.diff).toBe(999_999_615_599);
  });
});

describe('Without Going Over', () => {
  it('ranks the highest guess that does not exceed the answer', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 99, b: 101, c: 80, d: 50 } });
    expect(r.b).toMatchObject({ status: 'busted', rank: null, total: 0 });
    expect(ranks(r)).toEqual({ a: 1, b: null, c: 2, d: 3 });
    expect(points(r)).toEqual({ a: 1000, b: 0, c: 500, d: 250 });
  });

  it('busted guesses get zero even if they were closest', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'withoutGoingOver', playerIds: ['a', 'b'], guesses: { a: 100.0, b: 10 } });
    expect(points(r)).toEqual({ a: 1250, b: 500 });
    const r2 = scoreRound({ answer: 100, precision: 0, mode: 'withoutGoingOver', playerIds: ['a', 'b'], guesses: { a: 101, b: 10 } });
    expect(points(r2)).toEqual({ a: 0, b: 1000 });
  });

  it('exact answers are eligible and get the bonus', () => {
    const r = scoreRound({ answer: 3.99, precision: 2, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 3.99, b: 3.98, c: 4, d: 1 } });
    expect(points(r)).toEqual({ a: 1250, b: 500, c: 0, d: 250 });
  });

  it('if everyone goes over, nobody scores', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 101, b: 500, c: 1000, d: 102 } });
    expect(Object.values(r).every((x) => x.status === 'busted' && x.total === 0)).toBe(true);
    expect(everyoneBusted(r)).toBe(true);
  });

  it('everyone who guessed went over, others missed: still nobody scores', () => {
    const r = scoreRound({ answer: 100, precision: 0, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 101, b: 150 } });
    expect(points(r)).toEqual({ a: 0, b: 0, c: 0, d: 0 });
    expect(everyoneBusted(r)).toBe(true);
  });

  it('ties among eligible guesses share placement', () => {
    const r = scoreRound({ answer: 50, precision: 0, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 45, b: 45, c: 40, d: 51 } });
    expect(ranks(r)).toEqual({ a: 1, b: 1, c: 3, d: null });
    expect(points(r)).toEqual({ a: 1000, b: 1000, c: 250, d: 0 });
  });

  it('only eligible guesses take placements (a bust does not push others down)', () => {
    const r = scoreRound({ answer: 10, precision: 0, mode: 'withoutGoingOver', playerIds: ids, guesses: { a: 11, b: 9, c: 8, d: 7 } });
    expect(points(r)).toEqual({ a: 0, b: 1000, c: 500, d: 250 });
  });

  it('is deterministic', () => {
    const input = { answer: 100, precision: 0, mode: 'withoutGoingOver' as const, playerIds: ids, guesses: { a: 1, b: 2, c: 3, d: 4 } };
    expect(scoreRound(input)).toEqual(scoreRound(input));
  });
});
