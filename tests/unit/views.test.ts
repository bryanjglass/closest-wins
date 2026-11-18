import { describe, expect, it } from 'vitest';
import * as game from '../../server/engine/game';
import { buildView } from '../../server/engine/views';
import { gameWithPlayers, testBank } from '../helpers';

function setup() {
  const g = gameWithPlayers(['Ann', 'Ben', 'Cat']);
  game.updateSettings(g.s, { questionCount: 5, categories: ['weird'], mode: 'closest' });
  game.startGame(g.s, g.ctx());
  return g;
}

const view = (g: ReturnType<typeof setup>, role: 'host' | 'display' | 'player', playerId: string | null = null) =>
  buildView(g.s, { role, playerId }, g.clock.now, testBank, true);

/** Recursively finds any key named `key` in a JSON value. */
function hasKey(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => hasKey(v, key));
  if (value && typeof value === 'object') {
    return Object.entries(value).some(([k, v]) => (k === key && v !== null) || hasKey(v, key));
  }
  return false;
}

describe('views keep secrets', () => {
  it('never includes the answer, fact, source or results before the answer reveal', () => {
    const g = setup();
    for (const phase of ['question', 'guessing', 'guessReveal'] as const) {
      expect(g.s.phase).toBe(phase);
      if (phase === 'guessing') {
        game.submitGuess(g.s, 'p1', '50', true, g.ctx());
        game.submitGuess(g.s, 'p2', '70', false, g.ctx());
      }
      for (const v of [view(g, 'host'), view(g, 'display'), view(g, 'player', 'p1'), view(g, 'player', 'p3')]) {
        expect(v.reveal).toBeNull();
        expect(hasKey(v, 'answer')).toBe(false);
        expect(hasKey(v, 'results')).toBe(false);
        expect(JSON.stringify(v)).not.toContain('A test fact');
        expect(JSON.stringify(v)).not.toContain('tok1');
        expect(JSON.stringify(v)).not.toContain('host-secret');
      }
      game.advance(g.s, g.ctx());
    }
    expect(g.s.phase).toBe('answerReveal');
    const v = view(g, 'display');
    expect(v.reveal!.answer).toBe(100);
    expect(v.reveal!.fact).toBe('A test fact.');
    expect(v.reveal!.results.p1!.guess).toBe(50);
  });

  it('hides other players\' guesses until guessing closes', () => {
    const g = setup();
    game.advance(g.s, g.ctx());
    game.submitGuess(g.s, 'p1', '42', false, g.ctx());
    game.submitGuess(g.s, 'p2', '77', true, g.ctx());

    const p1 = view(g, 'player', 'p1');
    expect(p1.me).toMatchObject({ guess: 42, locked: false });
    expect(p1.guesses).toBeNull();
    expect(JSON.stringify(p1)).not.toContain('77');

    const host = view(g, 'host');
    expect(host.me).toBeNull();
    expect(host.guesses).toBeNull();
    expect(host.lockedIds).toEqual(['p2']);
    expect(JSON.stringify(host)).not.toMatch(/\b(42|77)\b/);

    const tv = view(g, 'display');
    expect(tv.lockedIds).toEqual(['p2']);
    expect(JSON.stringify(tv)).not.toMatch(/\b(42|77)\b/);

    game.advance(g.s, g.ctx()); // close guessing
    const revealed = view(g, 'display');
    expect(revealed.guesses).toEqual([
      { playerId: 'p1', value: 42 },
      { playerId: 'p2', value: 77 },
    ]);
    expect(revealed.reveal).toBeNull();
  });

  it('shows the question, its unit, precision and round mode — but not the answer', () => {
    const g = setup();
    const v = view(g, 'display');
    expect(v.question).toMatchObject({ unit: 'things', precision: 0, mode: 'closest', category: 'weird', allowNegative: false });
    expect(v.round).toBe(1);
    expect(v.totalRounds).toBe(5);
    expect(v.timer?.durationMs).toBeGreaterThan(0);
  });

  it('host-only fields are only sent to the host', () => {
    const g = gameWithPlayers(['A', 'B']);
    const host = buildView(g.s, { role: 'host', playerId: null }, 0, testBank, true);
    const tv = buildView(g.s, { role: 'display', playerId: null }, 0, testBank, true);
    expect(host.canStart.ok).toBe(true);
    expect(host.availableQuestions).toBe(testBank.all.length);
    expect(tv.canStart.ok).toBe(false);
    expect(tv.availableQuestions).toBeNull();
  });

  it('includes standings with deltas after scoring, and stats at game over', () => {
    const g = setup();
    game.advance(g.s, g.ctx());
    game.submitGuess(g.s, 'p1', '100', true, g.ctx());
    game.submitGuess(g.s, 'p2', '90', true, g.ctx());
    game.submitGuess(g.s, 'p3', '200', true, g.ctx());
    game.advance(g.s, g.ctx());
    const v = view(g, 'display');
    expect(v.phase).toBe('answerReveal');
    expect(v.standings.map((r) => [r.playerId, r.rank, r.score, r.delta])).toEqual([
      ['p1', 1, 1250, 1250],
      ['p2', 2, 500, 500],
      ['p3', 3, 250, 250],
    ]);
    while (g.s.phase !== 'gameOver') game.advance(g.s, g.ctx());
    const over = view(g, 'display');
    expect(over.stats!.rounds).toBe(5);
    const ann = over.stats!.players.find((p) => p.playerId === 'p1')!;
    expect(ann).toMatchObject({ exactHits: 1, firstPlaces: 1, missed: 4, roundsGuessed: 1, avgErrorPct: 0 });
    expect(over.stats!.awards.find((a) => a.id === 'bullseye')!.playerIds).toEqual(['p1']);
  });
});
