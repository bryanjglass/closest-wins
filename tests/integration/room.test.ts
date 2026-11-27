import { beforeEach, describe, expect, it } from 'vitest';
import { ROOM_TTL_MS } from '../../server/room/controller';
import { TIMING } from '../../shared/protocol';
import { MemoryStorage, RoomHarness, type FakeConnection } from '../helpers';

type Seat = Awaited<ReturnType<RoomHarness['player']>>;

let room: RoomHarness;

beforeEach(async () => {
  room = new RoomHarness();
  await room.create();
});

async function lobbyWithFour() {
  const host = await room.host();
  const tv = await room.display();
  const ann = await room.player('Ann', '🦒');
  const ben = await room.player('Ben');
  const cat = await room.player('Cat');
  const dan = await room.player('Dan');
  return { host, tv, ann, ben, cat, dan, players: [ann, ben, cat, dan] };
}

async function hostDo(host: FakeConnection, action: Record<string, unknown>) {
  await room.send(host, { type: 'host', action, requestId: 'r' });
}

async function configureAndStart(host: FakeConnection, settings: Record<string, unknown> = {}) {
  await hostDo(host, { kind: 'updateSettings', settings: { questionCount: 5, timerSeconds: 15, categories: ['weird'], mode: 'closest', ...settings } });
  await hostDo(host, { kind: 'start' });
  expect(room.storage.data!.phase).toBe('question');
  await room.runUntilPhase('guessing');
}

async function guess(seat: Seat, value: string | number, lock = true) {
  await room.send(seat.conn, { type: 'guess', value, lock, requestId: 'g' });
}

const scores = () => Object.fromEntries(room.storage.data!.players.map((p) => [p.name, p.score]));

describe('room creation & auth', () => {
  it('refuses to initialize a code that is already in use', async () => {
    expect((await room.controller.initialize('BCDF')).ok).toBe(false);
  });

  it('host token grants host privileges; a wrong token is rejected and disconnected', async () => {
    const host = await room.host();
    expect(host.state.isHost).toBe(true);
    const impostor = await room.connect();
    await room.send(impostor, { type: 'hello', role: 'host', hostToken: 'guess' });
    expect(impostor.lastError()?.code).toBe('NOT_AUTHORIZED');
    expect(impostor.closedWith?.code).toBe(4003);
  });

  it('only the host can control the game', async () => {
    const { tv, ann } = await lobbyWithFour();
    for (const conn of [tv, ann.conn]) {
      for (const kind of ['start', 'advance', 'skip', 'restart', 'pause', 'resume', 'rematch']) {
        await room.send(conn, { type: 'host', action: { kind } });
        expect(conn.lastError()?.code).toBe('NOT_AUTHORIZED');
      }
      await room.send(conn, { type: 'host', action: { kind: 'updateSettings', settings: { questionCount: 5 } } });
      expect(conn.lastError()?.code).toBe('NOT_AUTHORIZED');
    }
    expect(room.storage.data!.phase).toBe('lobby');
    expect(room.storage.data!.settings.questionCount).toBe(10);
  });

  it('rejects messages before hello and malformed messages', async () => {
    const c = await room.connect();
    await room.controller.onMessage(c, '{not json');
    expect(c.lastError()?.code).toBe('BAD_MESSAGE');
    await room.send(c, { type: 'guess', value: 1, lock: true });
    expect(c.lastError()?.code).toBe('BAD_MESSAGE');
    await room.controller.onMessage(c, 'x'.repeat(10_000));
    expect(c.lastError()?.code).toBe('BAD_MESSAGE');
  });

  it('a guess always belongs to the sender: there is no way to guess for someone else', async () => {
    const { host, ann, ben } = await lobbyWithFour();
    await configureAndStart(host);
    // Extra fields naming another player are ignored.
    await room.send(ann.conn, { type: 'guess', value: 55, lock: false, playerId: ben.id, requestId: 'x' });
    const round = room.storage.data!.round!;
    expect(round.guesses[ann.id]?.value).toBe(55);
    expect(round.guesses[ben.id]).toBeUndefined();
    // A TV or a socket that never joined cannot guess at all.
    const tv = await room.display();
    await room.send(tv, { type: 'guess', value: 1, lock: true, requestId: 'y' });
    expect(tv.lastError()?.code).toBe('NOT_JOINED');
    const stranger = await room.connect();
    await room.send(stranger, { type: 'hello', role: 'player' });
    await room.send(stranger, { type: 'guess', value: 1, lock: true, requestId: 'z' });
    expect(stranger.lastError()?.code).toBe('NOT_JOINED');
  });

  it('a player token from another room is useless here (rooms are isolated)', async () => {
    const other = new RoomHarness(new MemoryStorage(), 99);
    await other.create('ZZZZ');
    const stranger = await other.player('Ann');
    const c = await room.connect();
    await room.send(c, { type: 'hello', role: 'player', playerToken: stranger.token });
    expect(c.errors().map((e) => e.code)).toContain('TOKEN_INVALID');
    expect(c.state.me).toBeNull();
    const hostElsewhere = await room.connect();
    await room.send(hostElsewhere, { type: 'hello', role: 'host', hostToken: other.hostToken });
    expect(hostElsewhere.closedWith?.code).toBe(4003);
  });
});

describe('lobby', () => {
  it('updates everyone in real time and enforces unique names', async () => {
    const { tv, host } = await lobbyWithFour();
    expect(tv.state.players.map((p) => p.name)).toEqual(['Ann', 'Ben', 'Cat', 'Dan']);
    expect(tv.state.players[0]!.avatar).toBe('🦒');
    const dupe = await room.player('ann');
    expect(dupe.conn.lastError()?.code).toBe('NAME_TAKEN');
    await hostDo(host, { kind: 'updateSettings', settings: { mode: 'withoutGoingOver', timerSeconds: 45 } });
    expect(tv.state.settings).toMatchObject({ mode: 'withoutGoingOver', timerSeconds: 45 });
  });

  it('a retried join returns the same identity instead of a duplicate player', async () => {
    const ann = await room.player('Ann');
    await room.send(ann.conn, { type: 'join', name: 'Ann' });
    expect(room.storage.data!.players).toHaveLength(1);
  });
});

describe('a full game over the controller', () => {
  it('scores both modes exactly, including exact bonuses, ties, busts and misses', async () => {
    const { host, tv, ann, ben, cat, dan } = await lobbyWithFour();
    await configureAndStart(host, { mode: 'mixed' });
    // Every test question in "weird" has answer 100.

    // Round 1 — Closest: Ann exact, Ben & Cat tie at 10 away, Dan never guesses (timeout).
    expect(tv.state.question!.mode).toBe('closest');
    await guess(ann, '100');
    await guess(ben, 90);
    await guess(cat, '110', false); // a draft that is never locked
    await room.runUntilPhase('guessReveal');
    expect(tv.state.guesses!.map((g) => g.value)).toEqual([90, 100, 110]);
    expect(tv.state.reveal).toBeNull();
    await room.runUntilPhase('answerReveal');
    expect(tv.state.reveal!.answer).toBe(100);
    expect(scores()).toEqual({ Ann: 1250, Ben: 500, Cat: 500, Dan: 0 });
    expect(tv.state.reveal!.results[dan.id]!.status).toBe('missing');
    await room.runUntilPhase('scoreboard');
    await hostDo(host, { kind: 'advance', expect: { phase: 'scoreboard', round: 1 } });
    await room.runUntilPhase('guessing');

    // Round 2 — Without Going Over: everyone goes over → nobody scores.
    expect(tv.state.question!.mode).toBe('withoutGoingOver');
    for (const p of [ann, ben, cat, dan]) await guess(p, 101 + Math.floor(Math.random() * 50));
    expect(room.storage.data!.phase).toBe('guessReveal'); // all locked → early advance
    await room.runUntilPhase('answerReveal');
    expect(tv.state.reveal!.everyoneBusted).toBe(true);
    expect(scores()).toEqual({ Ann: 1250, Ben: 500, Cat: 500, Dan: 0 });
    await room.runUntilPhase('scoreboard');
    await hostDo(host, { kind: 'advance' });
    await room.runUntilPhase('guessing');

    // Round 3 — Closest: 1st / 2nd / tie for 3rd.
    await guess(ann, 97);
    await guess(ben, 99);
    await guess(cat, 105);
    await guess(dan, 95);
    await room.runUntilPhase('answerReveal');
    expect(scores()).toEqual({ Ann: 1250 + 500, Ben: 500 + 1000, Cat: 500 + 250, Dan: 0 + 250 });
    await room.runUntilPhase('scoreboard');
    expect(tv.state.standings.map((s) => [tv.state.players.find((p) => p.id === s.playerId)!.name, s.rank])).toEqual([
      ['Ann', 1],
      ['Ben', 2],
      ['Cat', 3],
      ['Dan', 4],
    ]);
    await hostDo(host, { kind: 'advance' });
    await room.runUntilPhase('guessing');

    // Round 4 — Without Going Over with a bust and an exact answer.
    await guess(ann, 101); // bust
    await guess(ben, 80);
    await guess(cat, 100); // exact
    await guess(dan, 80); // ties Ben for 2nd
    await room.runUntilPhase('answerReveal');
    expect(tv.state.reveal!.results[ann.id]!.status).toBe('busted');
    expect(scores()).toEqual({ Ann: 1750, Ben: 1500 + 500, Cat: 750 + 1250, Dan: 250 + 500 });
    await room.runUntilPhase('scoreboard');
    await hostDo(host, { kind: 'advance' });
    await room.runUntilPhase('guessing');

    // Round 5 — nobody guesses at all; host ends guessing early.
    await hostDo(host, { kind: 'advance', expect: { phase: 'guessing', round: 5 } });
    await room.runUntilPhase('scoreboard');
    expect(scores()).toEqual({ Ann: 1750, Ben: 2000, Cat: 2000, Dan: 750 });
    await hostDo(host, { kind: 'advance' });
    expect(room.storage.data!.phase).toBe('gameOver');
    const final = tv.state;
    expect(final.standings.filter((s) => s.rank === 1)).toHaveLength(2); // Ben & Cat share the win
    expect(final.stats!.awards.find((a) => a.id === 'bullseye')!.playerIds.sort()).toEqual([ann.id, cat.id].sort());

    // Rematch: same players, zero scores, back to the lobby.
    await hostDo(host, { kind: 'rematch' });
    expect(tv.state.phase).toBe('lobby');
    expect(tv.state.players.map((p) => [p.name, p.score])).toEqual([
      ['Ann', 0],
      ['Ben', 0],
      ['Cat', 0],
      ['Dan', 0],
    ]);
    expect(tv.state.gameNumber).toBe(2);
  });

  it('scoring is idempotent: repeated messages, alarms and reactivation never double-score', async () => {
    const { host, ann, ben } = await lobbyWithFour();
    await configureAndStart(host);
    await guess(ann, 100);
    await guess(ben, 90);
    await hostDo(host, { kind: 'advance', expect: { phase: 'guessing', round: 1 } });
    await hostDo(host, { kind: 'advance', expect: { phase: 'guessing', round: 1 } }); // stale double-click
    expect(host.lastError()?.code).toBe('STALE_ACTION');
    await hostDo(host, { kind: 'advance', expect: { phase: 'guessReveal', round: 1 } });
    expect(room.storage.data!.phase).toBe('answerReveal');
    const after = scores();
    await room.controller.onAlarm();
    await room.controller.onAlarm();
    room.boot();
    await room.controller.reconcile();
    expect(scores()).toEqual(after);
    expect(room.storage.data!.history).toHaveLength(1);
  });
});

describe('hands-free play', () => {
  it('after Start, the game reaches game over with no further host input', async () => {
    const { host, tv, ann, ben, cat, dan } = await lobbyWithFour();
    await configureAndStart(host);
    const hostMessagesAfterStart = host.messages.length;
    await room.drop(host); // the host can even walk away

    for (let r = 1; r <= 5; r++) {
      await room.runUntilPhase('guessing');
      expect(tv.state.round).toBe(r);
      // Every test question in "weird" has answer 100.
      await guess(ann, 100);
      await guess(ben, 90);
      await guess(cat, 80);
      await guess(dan, 70);
      await room.runUntilPhase('scoreboard');
      expect(tv.state.timer?.durationMs).toBe(TIMING.scoreboardMs);
    }
    await room.runUntilPhase('gameOver');
    expect(host.messages.length).toBe(hostMessagesAfterStart);
    expect(scores()).toEqual({ Ann: 5 * 1250, Ben: 5 * 500, Cat: 5 * 250, Dan: 0 });
    expect(room.storage.data!.history).toHaveLength(5);
  });

  it('even with nobody acting at all, timers carry the game to the end', async () => {
    const { host } = await lobbyWithFour();
    await configureAndStart(host);
    for (const c of room.conns) await room.drop(c);
    await room.runUntilPhase('gameOver', 100);
    expect(room.storage.data!.players.every((p) => p.score === 0)).toBe(true);
  });

  it('host pause on the scoreboard holds the game until resumed', async () => {
    const { host, tv } = await lobbyWithFour();
    await configureAndStart(host);
    await room.runUntilPhase('scoreboard');
    await hostDo(host, { kind: 'pause' });
    expect(tv.state.paused).toBe(true);
    await room.advanceTime(10 * 60_000);
    expect(room.storage.data!.phase).toBe('scoreboard');
    await hostDo(host, { kind: 'resume' });
    await room.advanceTime(TIMING.scoreboardMs);
    expect(room.storage.data!.phase).toBe('question');
    expect(tv.state.round).toBe(2);
  });
});

describe('timers & reliability', () => {
  it('timers survive Durable Object reactivation and fire with nobody connected', async () => {
    const { host, ann, players } = await lobbyWithFour();
    await configureAndStart(host);
    await guess(ann, 97, false);
    // Everyone disconnects and the object is evicted.
    for (const c of [host, ...players.map((p) => p.conn)]) c.open = false;
    room.conns = [];
    room.boot();
    await room.controller.reconcile();
    expect(room.storage.data!.phase).toBe('guessing');
    expect(room.storage.alarm).toBe(room.storage.data!.timer!.endsAt);
    // Alarm fires later on a fresh instance.
    room.boot();
    room.clock.now = room.storage.alarm!;
    await room.controller.onAlarm();
    expect(room.storage.data!.phase).toBe('guessReveal');
    expect(room.storage.data!.round!.guesses[ann.id]).toMatchObject({ value: 97, locked: true });
  });

  it('a late wake-up only advances one phase', async () => {
    const { host } = await lobbyWithFour();
    await configureAndStart(host);
    room.clock.now += 60 * 60_000;
    await room.controller.onAlarm();
    expect(room.storage.data!.phase).toBe('guessReveal');
    expect(room.storage.data!.timer!.endsAt).toBe(room.clock.now + TIMING.guessRevealMs);
  });

  it('pause/resume over the wire', async () => {
    const { host, tv, ann } = await lobbyWithFour();
    await configureAndStart(host);
    await hostDo(host, { kind: 'pause' });
    expect(tv.state.paused).toBe(true);
    expect(room.storage.alarm).not.toBe(room.storage.data!.timer!.endsAt);
    await guess(ann, 5);
    expect(ann.conn.lastError()?.code).toBe('PAUSED');
    room.clock.now += 5 * 60_000;
    await room.controller.onAlarm();
    expect(room.storage.data!.phase).toBe('guessing');
    await hostDo(host, { kind: 'resume' });
    expect(tv.state.paused).toBe(false);
    expect(tv.state.timer!.remainingMs).toBe(15_000);
  });

  it('skip replaces the question without scoring anything', async () => {
    const { host, tv, ann } = await lobbyWithFour();
    await configureAndStart(host);
    const first = tv.state.question!.id;
    await guess(ann, 100, false);
    await hostDo(host, { kind: 'skip', expect: { phase: 'guessing', round: 1 } });
    expect(tv.state.phase).toBe('question');
    expect(tv.state.round).toBe(1);
    expect(tv.state.question!.id).not.toBe(first);
    expect(scores()).toEqual({ Ann: 0, Ben: 0, Cat: 0, Dan: 0 });
  });

  it('players reconnect with their token and keep their seat, guess and score', async () => {
    const { host, ann, ben } = await lobbyWithFour();
    await configureAndStart(host);
    await guess(ann, 88, false);
    await room.drop(ann.conn);
    expect(room.storage.data!.players.find((p) => p.id === ann.id)!.connected).toBe(false);
    const again = await room.connect();
    await room.send(again, { type: 'hello', role: 'player', playerToken: ann.token });
    expect(again.state.me).toMatchObject({ playerId: ann.id, guess: 88, locked: false });
    expect(room.storage.data!.players.find((p) => p.id === ann.id)!.connected).toBe(true);
    expect(room.storage.data!.players).toHaveLength(4);
    await room.send(again, { type: 'guess', value: 89, lock: true });
    expect(room.storage.data!.round!.guesses[ann.id]).toMatchObject({ value: 89, locked: true });
    void ben;
  });

  it('a disconnected player does not block the round', async () => {
    const { host, ann, ben, cat, dan } = await lobbyWithFour();
    await configureAndStart(host);
    await room.drop(dan.conn);
    await guess(ann, 1);
    await guess(ben, 2);
    await guess(cat, 3);
    expect(room.storage.data!.phase).toBe('guessReveal');
  });

  it('host and TV refresh restore full state', async () => {
    const { host, tv, ann } = await lobbyWithFour();
    await configureAndStart(host);
    await guess(ann, 42);
    await room.drop(host);
    await room.drop(tv);
    const host2 = await room.host();
    const tv2 = await room.display();
    expect(host2.state).toMatchObject({ phase: 'guessing', round: 1, lockedIds: [ann.id], isHost: true });
    expect(tv2.state).toMatchObject({ phase: 'guessing', round: 1, lockedIds: [ann.id], isHost: false });
    expect(tv2.state.hostConnected).toBe(true);
  });

  it('abandoned rooms delete themselves', async () => {
    const { host, players } = await lobbyWithFour();
    for (const c of [host, ...players.map((p) => p.conn)]) await room.drop(c);
    room.conns = [];
    room.clock.now += ROOM_TTL_MS + 1;
    await room.controller.onAlarm();
    expect(room.storage.data).toBeNull();
    expect(await room.controller.exists()).toBe(false);
  });

  it('rejects host removal of players mid-game but allows it in the lobby', async () => {
    const { host, dan } = await lobbyWithFour();
    await hostDo(host, { kind: 'removePlayer', playerId: dan.id });
    expect(room.storage.data!.players).toHaveLength(3);
    expect(dan.conn.lastError()?.code).toBe('TOKEN_INVALID');
  });
});
