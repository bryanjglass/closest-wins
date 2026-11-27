import { describe, expect, it } from 'vitest';
import * as game from '../../server/engine/game';
import { GameError } from '../../server/engine/errors';
import type { GameState } from '../../server/engine/types';
import { TIMING, type Phase } from '../../shared/protocol';
import { gameWithPlayers, testBank } from '../helpers';

function expectCode(fn: () => unknown, code: string) {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(GameError);
    expect((err as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameError ${code}`);
}

function setup(names = ['Ann', 'Ben', 'Cat', 'Dan'], settings: Partial<GameState['settings']> = {}) {
  const g = gameWithPlayers(names);
  game.updateSettings(g.s, { questionCount: 5, timerSeconds: 15, categories: ['weird'], mode: 'closest', ...settings });
  return g;
}

/** Start and move into guessing. */
function toGuessing(g: ReturnType<typeof setup>) {
  game.startGame(g.s, g.ctx());
  expect(g.s.phase).toBe('question');
  game.advance(g.s, g.ctx());
  expect(g.s.phase).toBe('guessing');
}

const answer = (s: GameState) => testBank.get(s.round!.questionId)!.answer;

describe('lobby', () => {
  it('enforces unique names (case-insensitive) and lets players pick an avatar', () => {
    const { s, ctx } = gameWithPlayers(['Ann']);
    expectCode(() => game.addPlayer(s, ' ann ', undefined, { id: 'x', token: 'y' }, ctx()), 'NAME_TAKEN');
    const p = game.addPlayer(s, 'Ben', '🦒', { id: 'b', token: 't' }, ctx());
    expect(p.avatar).toBe('🦒');
    // Taken avatar falls back to a free one; junk is rejected.
    const q = game.addPlayer(s, 'Cat', '🦒', { id: 'c', token: 't2' }, ctx());
    expect(q.avatar).not.toBe('🦒');
    expectCode(() => game.addPlayer(s, 'Dan', '<script>', { id: 'd', token: 't3' }, ctx()), 'AVATAR_INVALID');
    expectCode(() => game.addPlayer(s, '   ', undefined, { id: 'e', token: 't4' }, ctx()), 'NAME_INVALID');
    expectCode(() => game.addPlayer(s, 'x'.repeat(17), undefined, { id: 'e', token: 't4' }, ctx()), 'NAME_INVALID');
  });

  it('supports 2–10 players', () => {
    const one = gameWithPlayers(['Solo']);
    expect(game.canStart(one.s, { bank: testBank }).ok).toBe(false);
    expectCode(() => game.startGame(one.s, one.ctx()), 'NOT_ENOUGH_PLAYERS');
    const two = gameWithPlayers(['A', 'B']);
    expect(game.canStart(two.s, { bank: testBank }).ok).toBe(true);
    const ten = gameWithPlayers(Array.from({ length: 10 }, (_, i) => `P${i}`));
    expectCode(() => game.addPlayer(ten.s, 'Eleven', undefined, { id: 'z', token: 'z' }, ten.ctx()), 'ROOM_FULL');
  });

  it('validates settings', () => {
    const { s } = gameWithPlayers(['A', 'B']);
    expect(s.settings).toMatchObject({ mode: 'mixed', questionCount: 10, timerSeconds: 30 });
    expect(s.settings.categories).toHaveLength(6);
    expectCode(() => game.updateSettings(s, { questionCount: 7 as never }), 'INVALID_SETTINGS');
    expectCode(() => game.updateSettings(s, { timerSeconds: 20 as never }), 'INVALID_SETTINGS');
    expectCode(() => game.updateSettings(s, { mode: 'chaos' as never }), 'INVALID_SETTINGS');
    expectCode(() => game.updateSettings(s, { categories: [] }), 'INVALID_SETTINGS');
    expectCode(() => game.updateSettings(s, { categories: ['nope' as never] }), 'INVALID_SETTINGS');
    game.updateSettings(s, { mode: 'withoutGoingOver', questionCount: 20, timerSeconds: 60, categories: ['weird', 'prices', 'weird'] });
    expect(s.settings).toEqual({ mode: 'withoutGoingOver', questionCount: 20, timerSeconds: 60, categories: ['prices', 'weird'] });
  });

  it('refuses to start without enough questions for the categories and mode', () => {
    const g = gameWithPlayers(['A', 'B']);
    // Only 4 "geography" questions, all closest-only.
    game.updateSettings(g.s, { categories: ['geography'], questionCount: 5, mode: 'closest' });
    expect(game.canStart(g.s, g.ctx()).reason).toMatch(/Only 4 questions/);
    expectCode(() => game.startGame(g.s, g.ctx()), 'NOT_ENOUGH_QUESTIONS');
    game.updateSettings(g.s, { categories: ['geography', 'prices'], mode: 'withoutGoingOver' });
    expect(game.availableQuestionCount(g.s.settings, g.ctx())).toBe(2);
  });
});

describe('question selection', () => {
  it('draws distinct questions from the selected categories', () => {
    const g = setup(['A', 'B'], { categories: ['weird', 'prices'], questionCount: 10, mode: 'closest' });
    game.startGame(g.s, g.ctx());
    const ids = g.s.deck.map((d) => d.questionId);
    expect(new Set(ids).size).toBe(10);
    for (const id of ids) expect(['weird', 'prices']).toContain(testBank.get(id)!.category);
  });

  it('only uses questions that support the selected mode', () => {
    const g = setup(['A', 'B'], { categories: ['weird', 'geography', 'prices'], questionCount: 10, mode: 'withoutGoingOver' });
    game.startGame(g.s, g.ctx());
    for (const d of g.s.deck) {
      expect(d.mode).toBe('withoutGoingOver');
      expect(testBank.get(d.questionId)!.modes).toContain('withoutGoingOver');
    }
  });

  it('mixed mode alternates Closest and Without Going Over', () => {
    const g = setup(['A', 'B'], { mode: 'mixed', questionCount: 5, categories: ['weird'] });
    game.startGame(g.s, g.ctx());
    expect(g.s.deck.map((d) => d.mode)).toEqual(['closest', 'withoutGoingOver', 'closest', 'withoutGoingOver', 'closest']);
    for (const d of g.s.deck) expect(testBank.get(d.questionId)!.modes).toContain(d.mode);
  });

  it('a rematch prefers questions the room has not seen yet', () => {
    const g = setup(['A', 'B'], { questionCount: 5, mode: 'closest', categories: ['weird', 'geography', 'prices', 'animals'] });
    game.startGame(g.s, g.ctx());
    const first = new Set(g.s.deck.map((d) => d.questionId));
    game.restart(g.s);
    game.startGame(g.s, g.ctx());
    for (const d of g.s.deck) expect(first.has(d.questionId)).toBe(false);
  });
});

describe('state machine', () => {
  it('follows Lobby → Question → Guessing → Guess Reveal → Answer Reveal → Scoreboard → … → Game Over', () => {
    const g = setup(['A', 'B'], { questionCount: 5 });
    const seen: Phase[] = [g.s.phase];
    game.startGame(g.s, g.ctx());
    seen.push(g.s.phase);
    while (g.s.phase !== 'gameOver') {
      game.advance(g.s, g.ctx());
      if (seen.at(-1) !== g.s.phase) seen.push(g.s.phase);
    }
    expect(seen.slice(0, 7)).toEqual(['lobby', 'question', 'guessing', 'guessReveal', 'answerReveal', 'scoreboard', 'question']);
    expect(seen.filter((p) => p === 'question')).toHaveLength(5);
    expect(seen.at(-2)).toBe('scoreboard');
    expect(seen.at(-1)).toBe('gameOver');
    expect(g.s.history).toHaveLength(5);
  });

  it('declares exactly the allowed transitions', () => {
    expect(game.TRANSITIONS.guessing).toEqual(['guessReveal']);
    expect(game.TRANSITIONS.guessReveal).toEqual(['answerReveal']);
    expect(game.TRANSITIONS.scoreboard).toEqual(['question', 'gameOver']);
  });

  it('rejects invalid transitions', () => {
    const g = setup(['A', 'B']);
    expectCode(() => game.advance(g.s, g.ctx()), 'INVALID_TRANSITION'); // lobby: use start
    expectCode(() => game.rematch(g.s), 'INVALID_TRANSITION');
    expectCode(() => game.restart(g.s), 'INVALID_TRANSITION');
    game.startGame(g.s, g.ctx());
    expectCode(() => game.startGame(g.s, g.ctx()), 'INVALID_TRANSITION');
    expectCode(() => game.rematch(g.s), 'INVALID_TRANSITION');
    expectCode(() => game.updateSettings(g.s, { questionCount: 5 }), 'WRONG_PHASE');
    while (g.s.phase !== 'gameOver') game.advance(g.s, g.ctx());
    expectCode(() => game.advance(g.s, g.ctx()), 'INVALID_TRANSITION');
  });

  it('rejects stale "next" presses (double-click protection)', () => {
    const g = setup(['A', 'B']);
    game.startGame(g.s, g.ctx());
    game.advance(g.s, g.ctx(), { phase: 'question', round: 1 });
    expect(g.s.phase).toBe('guessing');
    expectCode(() => game.advance(g.s, g.ctx(), { phase: 'question', round: 1 }), 'STALE_ACTION');
    expect(g.s.phase).toBe('guessing');
  });
});

describe('guessing', () => {
  it('saves editable drafts, then locks; one guess per player', () => {
    const g = setup();
    toGuessing(g);
    const [a] = g.players;
    game.submitGuess(g.s, a!.id, '50', false, g.ctx());
    expect(g.s.round!.guesses[a!.id]).toMatchObject({ value: 50, locked: false });
    game.submitGuess(g.s, a!.id, 60, false, g.ctx());
    expect(g.s.round!.guesses[a!.id]).toMatchObject({ value: 60, locked: false });
    game.submitGuess(g.s, a!.id, '70', true, g.ctx());
    expect(g.s.round!.guesses[a!.id]).toMatchObject({ value: 70, locked: true });
    expectCode(() => game.submitGuess(g.s, a!.id, '80', true, g.ctx()), 'ALREADY_LOCKED');
    expect(Object.keys(g.s.round!.guesses)).toEqual([a!.id]);
  });

  it('rejects invalid numbers without changing the saved guess', () => {
    const g = setup();
    toGuessing(g);
    const id = g.players[0]!.id;
    game.submitGuess(g.s, id, '42', false, g.ctx());
    for (const bad of ['NaN', 'Infinity', 'abc', '', '-5', '4.5', null]) {
      expectCode(() => game.submitGuess(g.s, id, bad, true, g.ctx()), 'GUESS_INVALID');
    }
    expect(g.s.round!.guesses[id]).toMatchObject({ value: 42, locked: false });
  });

  it('allows negatives and decimals only where the question does', () => {
    const neg = gameWithPlayers(['A', 'B']);
    game.updateSettings(neg.s, { categories: ['animals', 'prices'], questionCount: 5, mode: 'closest' });
    // Only 3 questions in those categories: shrink the deck by hand for this test.
    neg.s.deck = [{ questionId: 'n1', mode: 'closest' }, { questionId: 'm1', mode: 'closest' }];
    neg.s.phase = 'scoreboard';
    neg.s.roundIndex = -1;
    game.advance(neg.s, neg.ctx()); // → question for n1
    game.advance(neg.s, neg.ctx());
    expect(game.submitGuess(neg.s, 'p1', '-40', false, neg.ctx())).toBe(-40);
    expect(game.submitGuess(neg.s, 'p1', '-40.0', false, neg.ctx())).toBe(-40);
    expectCode(() => game.submitGuess(neg.s, 'p1', '-40.5', false, neg.ctx()), 'GUESS_INVALID');
    while ((neg.s.phase as Phase) !== 'guessing' || neg.s.round!.questionId !== 'm1') game.advance(neg.s, neg.ctx());
    expect(game.submitGuess(neg.s, 'p1', '$3.99', false, neg.ctx())).toBe(3.99);
    expectCode(() => game.submitGuess(neg.s, 'p1', '3.999', false, neg.ctx()), 'GUESS_INVALID');
    expectCode(() => game.submitGuess(neg.s, 'p1', '-1', false, neg.ctx()), 'GUESS_INVALID');
  });

  it('rejects guesses outside the guessing phase, while paused, and after time is up', () => {
    const g = setup();
    game.startGame(g.s, g.ctx());
    expectCode(() => game.submitGuess(g.s, 'p1', '1', true, g.ctx()), 'WRONG_PHASE');
    game.advance(g.s, g.ctx());
    game.pause(g.s, g.ctx());
    expectCode(() => game.submitGuess(g.s, 'p1', '1', true, g.ctx()), 'PAUSED');
    game.resume(g.s, g.ctx());
    g.clock.now += 15_000;
    expectCode(() => game.submitGuess(g.s, 'p1', '1', true, g.ctx()), 'TIME_UP');
  });

  it('advances automatically once everyone connected has locked', () => {
    const g = setup();
    toGuessing(g);
    for (const p of g.players.slice(0, 3)) game.submitGuess(g.s, p.id, '10', true, g.ctx());
    expect(g.s.phase).toBe('guessing');
    game.submitGuess(g.s, 'p4', '20', false, g.ctx()); // draft only
    expect(g.s.phase).toBe('guessing');
    game.submitGuess(g.s, 'p4', '20', true, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
  });

  it('disconnected players do not block progression', () => {
    const g = setup();
    toGuessing(g);
    game.setConnected(g.s, 'p4', false, g.ctx());
    for (const p of g.players.slice(0, 3)) game.submitGuess(g.s, p.id, '10', true, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
  });

  it('a player dropping out can complete the round for everyone else', () => {
    const g = setup();
    toGuessing(g);
    for (const p of g.players.slice(0, 3)) game.submitGuess(g.s, p.id, '10', true, g.ctx());
    expect(g.s.phase).toBe('guessing');
    game.setConnected(g.s, 'p4', false, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
  });

  it('late joiners wait for the next game and cannot guess', () => {
    const g = setup();
    toGuessing(g);
    const late = game.addPlayer(g.s, 'Late', undefined, { id: 'late', token: 'lt' }, g.ctx());
    expect(late.status).toBe('waiting');
    expectCode(() => game.submitGuess(g.s, 'late', '1', true, g.ctx()), 'NOT_A_CONTESTANT');
  });
});

describe('timers', () => {
  it('timer expiry advances exactly one phase, and the next timer starts from now', () => {
    const g = setup();
    game.startGame(g.s, g.ctx());
    expect(game.tick(g.s, g.ctx())).toBe(false);
    g.clock.now += TIMING.questionIntroMs;
    expect(game.tick(g.s, g.ctx())).toBe(true);
    expect(g.s.phase).toBe('guessing');
    // Wake up very late: still only one step.
    g.clock.now += 10 * 60_000;
    game.tick(g.s, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
    expect(g.s.timer!.endsAt).toBe(g.clock.now + TIMING.guessRevealMs);
    expect(game.nextDeadline(g.s)).toBe(g.clock.now + TIMING.guessRevealMs);
  });

  it('on timeout the last valid guess (locked or not) is final; missing guesses score zero', () => {
    const g = setup();
    toGuessing(g);
    game.submitGuess(g.s, 'p1', '90', false, g.ctx()); // draft never locked
    game.submitGuess(g.s, 'p2', '120', true, g.ctx());
    game.submitGuess(g.s, 'p3', '70', false, g.ctx());
    game.submitGuess(g.s, 'p3', '99', false, g.ctx()); // edited draft
    // p4 never guesses
    g.clock.now += 15_000;
    game.tick(g.s, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
    expect(Object.values(g.s.round!.guesses).every((x) => x.locked)).toBe(true);
    g.clock.now += TIMING.guessRevealMs;
    game.tick(g.s, g.ctx());
    expect(g.s.phase).toBe('answerReveal');
    expect(answer(g.s)).toBe(100);
    const r = g.s.round!.results!;
    expect(r.p3).toMatchObject({ guess: 99, rank: 1, total: 1000 });
    expect(r.p1).toMatchObject({ guess: 90, rank: 2, total: 500 });
    expect(r.p2).toMatchObject({ guess: 120, rank: 3, total: 250 });
    expect(r.p4).toMatchObject({ status: 'missing', total: 0 });
  });

  it('pause freezes the timer and resume restores the remaining time', () => {
    const g = setup();
    toGuessing(g);
    g.clock.now += 5_000;
    game.pause(g.s, g.ctx());
    expect(g.s.timer!.pausedRemainingMs).toBe(10_000);
    expect(game.nextDeadline(g.s)).toBeNull();
    g.clock.now += 60_000;
    expect(game.tick(g.s, g.ctx())).toBe(false);
    expect(g.s.phase).toBe('guessing');
    expectCode(() => game.advance(g.s, g.ctx()), 'PAUSED');
    game.pause(g.s, g.ctx()); // idempotent
    game.resume(g.s, g.ctx());
    expect(g.s.timer!.endsAt).toBe(g.clock.now + 10_000);
    game.resume(g.s, g.ctx()); // idempotent
    g.clock.now += 10_000;
    expect(game.tick(g.s, g.ctx())).toBe(true);
    expect(g.s.phase).toBe('guessReveal');
  });

  it('resuming completes the round if everyone locked while paused... is impossible (guesses are rejected while paused)', () => {
    const g = setup(['A', 'B']);
    toGuessing(g);
    game.submitGuess(g.s, 'p1', '1', true, g.ctx());
    game.pause(g.s, g.ctx());
    game.setConnected(g.s, 'p2', false, g.ctx()); // would complete, but paused
    expect(g.s.phase).toBe('guessing');
    game.resume(g.s, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
  });

  it('times the scoreboard and moves on to the next question by itself', () => {
    const g = setup(['A', 'B']);
    toGuessing(g);
    game.submitGuess(g.s, 'p1', '100', true, g.ctx());
    game.submitGuess(g.s, 'p2', '90', true, g.ctx());
    while (g.s.phase !== 'scoreboard') {
      g.clock.now = game.nextDeadline(g.s)!;
      expect(game.tick(g.s, g.ctx())).toBe(true);
    }
    expect(game.nextDeadline(g.s)).toBe(g.clock.now + TIMING.scoreboardMs);
    g.clock.now += TIMING.scoreboardMs - 1;
    expect(game.tick(g.s, g.ctx())).toBe(false);
    g.clock.now += 1;
    expect(game.tick(g.s, g.ctx())).toBe(true);
    expect(g.s.phase).toBe('question');
    expect(g.s.roundIndex).toBe(1);
  });

  it('plays every question to game over with timers alone, then stops', () => {
    const g = setup(['A', 'B', 'C'], { questionCount: 5 });
    game.startGame(g.s, g.ctx());
    const phases: Phase[] = [];
    for (let i = 0; i < 100 && g.s.phase !== 'gameOver'; i++) {
      g.clock.now = game.nextDeadline(g.s)!;
      expect(game.tick(g.s, g.ctx())).toBe(true);
      phases.push(g.s.phase);
    }
    expect(g.s.phase).toBe('gameOver');
    expect(phases.filter((p) => p === 'question')).toHaveLength(4); // rounds 2-5 (round 1 began at start)
    expect(phases.filter((p) => p === 'scoreboard')).toHaveLength(5);
    expect(g.s.history).toHaveLength(5);
    expect(game.nextDeadline(g.s)).toBeNull(); // game over waits for a rematch
  });

  it('the host can pause on the scoreboard to linger', () => {
    const g = setup(['A', 'B']);
    toGuessing(g);
    while (g.s.phase !== 'scoreboard') game.advance(g.s, g.ctx());
    game.pause(g.s, g.ctx());
    g.clock.now += 60 * 60_000;
    expect(game.tick(g.s, g.ctx())).toBe(false);
    expect(g.s.phase).toBe('scoreboard');
    game.resume(g.s, g.ctx());
    g.clock.now += TIMING.scoreboardMs;
    expect(game.tick(g.s, g.ctx())).toBe(true);
    expect(g.s.phase).toBe('question');
  });
});

describe('scoring integration', () => {
  it('scores exactly once per round and accumulates totals', () => {
    const g = setup(['A', 'B', 'C']);
    toGuessing(g);
    game.submitGuess(g.s, 'p1', '100', true, g.ctx());
    game.submitGuess(g.s, 'p2', '90', true, g.ctx());
    game.submitGuess(g.s, 'p3', '80', true, g.ctx());
    game.advance(g.s, g.ctx()); // → answerReveal (scores)
    expect(g.s.players.map((p) => p.score)).toEqual([1250, 500, 250]);
    game.scoreCurrentRound(g.s, g.ctx()); // second call is a no-op
    expect(g.s.players.map((p) => p.score)).toEqual([1250, 500, 250]);
    expect(g.s.history).toHaveLength(1);
    game.advance(g.s, g.ctx()); // scoreboard
    game.advance(g.s, g.ctx()); // round 2
    game.advance(g.s, g.ctx()); // guessing
    game.submitGuess(g.s, 'p1', '0', true, g.ctx());
    game.submitGuess(g.s, 'p2', '101', true, g.ctx());
    game.submitGuess(g.s, 'p3', '99', true, g.ctx());
    game.advance(g.s, g.ctx());
    expect(g.s.players.map((p) => p.score)).toEqual([1250 + 250, 500 + 1000, 250 + 1000]);
  });

  it('Without Going Over: everyone over means nobody scores', () => {
    const g = setup(['A', 'B', 'C'], { mode: 'withoutGoingOver' });
    toGuessing(g);
    for (const p of g.players) game.submitGuess(g.s, p.id, '101', true, g.ctx());
    game.advance(g.s, g.ctx());
    expect(g.s.round!.results!.p1!.status).toBe('busted');
    expect(g.s.players.map((p) => p.score)).toEqual([0, 0, 0]);
  });

  it('players who leave mid-game keep their seat; their missing guesses score zero', () => {
    const g = setup(['A', 'B']);
    toGuessing(g);
    game.setConnected(g.s, 'p2', false, g.ctx());
    game.submitGuess(g.s, 'p1', '5', true, g.ctx());
    expect(g.s.phase).toBe('guessReveal');
    game.advance(g.s, g.ctx());
    expect(g.s.round!.results!.p2).toMatchObject({ status: 'missing', total: 0 });
    expect(g.s.round!.results!.p1!.total).toBe(1000);
  });
});

describe('skipping questions', () => {
  it('replaces the current question with a fresh one and clears guesses', () => {
    const g = setup(['A', 'B'], { questionCount: 5, categories: ['weird', 'prices'] });
    toGuessing(g);
    const before = g.s.round!.questionId;
    game.submitGuess(g.s, 'p1', '5', false, g.ctx());
    game.skipQuestion(g.s, g.ctx(), { phase: 'guessing', round: 1 });
    expect(g.s.phase).toBe('question');
    expect(g.s.roundIndex).toBe(0);
    expect(g.s.round!.questionId).not.toBe(before);
    expect(g.s.round!.guesses).toEqual({});
    expect(new Set(g.s.deck.map((d) => d.questionId)).size).toBe(5);
    expect(g.s.deck.map((d) => d.questionId)).not.toContain(before);
    expect(g.s.players.every((p) => p.score === 0)).toBe(true);
  });

  it('drops the round when no replacement is left', () => {
    const g = gameWithPlayers(['A', 'B']);
    game.updateSettings(g.s, { categories: ['prices'], questionCount: 5, mode: 'closest' });
    // Only 2 price questions exist: build a 2-round game by hand.
    g.s.deck = [{ questionId: 'm1', mode: 'closest' }, { questionId: 'm2', mode: 'closest' }];
    g.s.phase = 'scoreboard';
    g.s.roundIndex = -1;
    game.advance(g.s, g.ctx());
    game.skipQuestion(g.s, g.ctx());
    expect(g.s.deck).toHaveLength(1);
    expect(g.s.round!.questionId).toBe('m2');
    game.skipQuestion(g.s, g.ctx());
    expect(g.s.phase).toBe('gameOver');
  });

  it('cannot skip after guesses are revealed', () => {
    const g = setup(['A', 'B']);
    toGuessing(g);
    game.advance(g.s, g.ctx());
    expectCode(() => game.skipQuestion(g.s, g.ctx()), 'WRONG_PHASE');
  });
});

describe('game over & rematch', () => {
  it('rematch keeps players, resets scores and questions, and promotes waiting players', () => {
    const g = setup(['A', 'B', 'C'], { questionCount: 5 });
    game.startGame(g.s, g.ctx());
    const firstDeck = g.s.deck.map((d) => d.questionId);
    game.addPlayer(g.s, 'Late', undefined, { id: 'late', token: 'lt' }, g.ctx());
    while (g.s.phase !== 'gameOver') {
      if (g.s.phase === 'guessing') game.submitGuess(g.s, 'p1', '100', true, g.ctx());
      if ((g.s.phase as Phase) !== 'gameOver') game.advance(g.s, g.ctx());
    }
    expect(g.s.players.find((p) => p.id === 'p1')!.score).toBe(5 * 1250);
    game.rematch(g.s);
    expect(g.s.phase).toBe('lobby');
    expect(g.s.gameNumber).toBe(2);
    expect(g.s.players.map((p) => p.name)).toEqual(['A', 'B', 'C', 'Late']);
    expect(g.s.players.every((p) => p.score === 0 && p.status === 'contestant')).toBe(true);
    expect(g.s.deck).toEqual([]);
    expect(g.s.history).toEqual([]);
    game.startGame(g.s, g.ctx());
    // 8 "weird" questions, 5 used: all 3 unseen ones are in the new game, topped up with 2 replays.
    const deck = g.s.deck.map((d) => d.questionId);
    expect(new Set(deck).size).toBe(5);
    const unseen = testBank.all.filter((q) => q.category === 'weird' && !firstDeck.includes(q.id)).map((q) => q.id);
    expect(unseen).toHaveLength(3);
    for (const id of unseen) expect(deck).toContain(id);
  });
});
