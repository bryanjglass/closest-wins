/**
 * The Closest Wins game state machine.
 *
 *   lobby → question → guessing → guessReveal → answerReveal → scoreboard ─┬→ question (next round)
 *                                                                           └→ gameOver → (rematch) → lobby
 *
 * Every exported function mutates the given state in place. Callers (the room
 * controller) run them against a *clone* and only commit on success, so a
 * thrown GameError never leaves a half-applied change behind.
 */
import {
  CATEGORY_IDS,
  DEFAULT_SETTINGS,
  GAME_MODES,
  MAX_NAME_LENGTH,
  MAX_PLAYERS,
  MAX_ROOM_OCCUPANTS,
  MIN_PLAYERS,
  QUESTION_COUNTS,
  TIMER_SECONDS_OPTIONS,
  TIMING,
  type CategoryId,
  type Expect,
  type GameSettings,
  type Phase,
  type ScoringMode,
} from '../../shared/protocol';
import { parseGuess } from '../../shared/numbers';
import { PLAYER_AVATARS, PLAYER_COLORS, isAvatar } from '../../shared/players';
import { cleanText, compareKey } from '../../shared/text';
import type { Question } from '../questions';
import { fail } from './errors';
import { shuffle } from './random';
import { scoreRound } from './scoring';
import type { DeckEntry, EngineContext, GameState, ServerPlayer } from './types';

/**
 * Legal phase transitions. `advance`/`tick` follow these; anything else is rejected.
 * (lobby → question happens via `startGame`; gameOver → lobby via `rematch`.)
 */
export const TRANSITIONS: Record<Phase, readonly Phase[]> = {
  lobby: ['question'],
  question: ['guessing'],
  guessing: ['guessReveal'],
  guessReveal: ['answerReveal'],
  answerReveal: ['scoreboard'],
  scoreboard: ['question', 'gameOver'],
  gameOver: ['lobby'],
};

function goTo(s: GameState, next: Phase) {
  if (!TRANSITIONS[s.phase].includes(next)) {
    fail('INVALID_TRANSITION', `Cannot go from ${s.phase} to ${next}.`);
  }
  s.phase = next;
}

// ---------------------------------------------------------------------------
// Creation & helpers
// ---------------------------------------------------------------------------

export function createGame(code: string, hostToken: string, now: number): GameState {
  return {
    schema: 1,
    code,
    hostToken,
    createdAt: now,
    updatedAt: now,
    settings: { ...DEFAULT_SETTINGS, categories: [...DEFAULT_SETTINGS.categories] },
    phase: 'lobby',
    players: [],
    deck: [],
    roundIndex: 0,
    round: null,
    history: [],
    timer: null,
    gameNumber: 1,
    usedQuestionIds: [],
    skippedIds: [],
  };
}

export function contestants(s: GameState): ServerPlayer[] {
  return s.players.filter((p) => p.status === 'contestant');
}

function getPlayer(s: GameState, playerId: string): ServerPlayer {
  const p = s.players.find((x) => x.id === playerId);
  if (!p) fail('NOT_JOINED', 'You are not in this game.');
  return p;
}

function startTimer(s: GameState, ms: number, ctx: EngineContext) {
  s.timer = { endsAt: ctx.now + ms, durationMs: ms, pausedRemainingMs: null };
}

export function isPaused(s: GameState): boolean {
  return !!s.timer && s.timer.pausedRemainingMs !== null;
}

function timeIsUp(s: GameState, now: number): boolean {
  return !!s.timer && s.timer.pausedRemainingMs === null && now >= s.timer.endsAt;
}

/** The next moment the server must wake up to progress the game, if any. */
export function nextDeadline(s: GameState): number | null {
  if (!s.timer || s.timer.pausedRemainingMs !== null) return null;
  return s.timer.endsAt;
}

/** Scoring mode for round `index` (0-based) under the given game mode. */
export function modeForRound(mode: GameSettings['mode'], index: number): ScoringMode {
  if (mode === 'mixed') return index % 2 === 0 ? 'closest' : 'withoutGoingOver';
  return mode;
}

export function currentQuestion(s: GameState, ctx: Pick<EngineContext, 'bank'>): Question | undefined {
  return s.round ? ctx.bank.get(s.round.questionId) : undefined;
}

// ---------------------------------------------------------------------------
// Lobby
// ---------------------------------------------------------------------------

export function validateName(raw: unknown): string {
  if (typeof raw !== 'string') fail('NAME_INVALID', 'Please enter a name.');
  const name = cleanText(raw);
  if (!name) fail('NAME_INVALID', 'Please enter a name.');
  if ([...name].length > MAX_NAME_LENGTH) {
    fail('NAME_INVALID', `Names can be at most ${MAX_NAME_LENGTH} characters.`);
  }
  return name;
}

export function addPlayer(
  s: GameState,
  rawName: unknown,
  rawAvatar: unknown,
  ids: { id: string; token: string },
  ctx: EngineContext,
): ServerPlayer {
  const name = validateName(rawName);
  const key = compareKey(name);
  if (s.players.some((p) => compareKey(p.name) === key)) {
    fail('NAME_TAKEN', `Someone is already called "${name}". Try a different name.`);
  }
  if (rawAvatar !== undefined && rawAvatar !== null && rawAvatar !== '' && !isAvatar(rawAvatar)) {
    fail('AVATAR_INVALID', 'Pick one of the avatars.');
  }
  const inLobby = s.phase === 'lobby';
  if (inLobby && contestants(s).length >= MAX_PLAYERS) {
    fail('ROOM_FULL', `This game already has ${MAX_PLAYERS} players.`);
  }
  if (s.players.length >= MAX_ROOM_OCCUPANTS) fail('ROOM_FULL', 'This room is full.');

  const usedColors = new Set(s.players.map((p) => p.color));
  const usedAvatars = new Set(s.players.map((p) => p.avatar));
  // A wanted avatar that someone already has falls back to a free one (no dead ends on a phone).
  const avatar =
    isAvatar(rawAvatar) && !usedAvatars.has(rawAvatar)
      ? rawAvatar
      : (PLAYER_AVATARS.find((a) => !usedAvatars.has(a)) ?? PLAYER_AVATARS[0]);
  const player: ServerPlayer = {
    id: ids.id,
    token: ids.token,
    name,
    color: PLAYER_COLORS.find((c) => !usedColors.has(c)) ?? PLAYER_COLORS[0],
    avatar,
    score: 0,
    // Late arrivals wait on the sidelines and join the next game.
    status: inLobby ? 'contestant' : 'waiting',
    connected: true,
    joinedAt: ctx.now,
  };
  s.players.push(player);
  return player;
}

export function removePlayer(s: GameState, playerId: string) {
  const p = getPlayer(s, playerId);
  if (p.status === 'contestant' && s.phase !== 'lobby' && s.phase !== 'gameOver') {
    fail('GAME_IN_PROGRESS', 'Players can only be removed between games.');
  }
  s.players = s.players.filter((x) => x.id !== playerId);
}

export function setConnected(s: GameState, playerId: string, connected: boolean, ctx: EngineContext) {
  const p = s.players.find((x) => x.id === playerId);
  if (!p || p.connected === connected) return;
  p.connected = connected;
  // A player dropping out must never block the rest of the table.
  checkEarlyCompletion(s, ctx);
}

export function updateSettings(s: GameState, patch: Partial<GameSettings>) {
  if (s.phase !== 'lobby') fail('WRONG_PHASE', 'Settings can only be changed in the lobby.');
  if (typeof patch !== 'object' || patch === null) fail('INVALID_SETTINGS', 'Invalid settings.');
  const next = { ...s.settings, categories: [...s.settings.categories] };
  if (patch.mode !== undefined) {
    if (!GAME_MODES.includes(patch.mode)) fail('INVALID_SETTINGS', 'Unknown game mode.');
    next.mode = patch.mode;
  }
  if (patch.questionCount !== undefined) {
    if (!(QUESTION_COUNTS as readonly number[]).includes(patch.questionCount)) {
      fail('INVALID_SETTINGS', `Question count must be one of ${QUESTION_COUNTS.join(', ')}.`);
    }
    next.questionCount = patch.questionCount;
  }
  if (patch.timerSeconds !== undefined) {
    if (!(TIMER_SECONDS_OPTIONS as readonly number[]).includes(patch.timerSeconds)) {
      fail('INVALID_SETTINGS', `Timer must be one of ${TIMER_SECONDS_OPTIONS.join(', ')} seconds.`);
    }
    next.timerSeconds = patch.timerSeconds;
  }
  if (patch.categories !== undefined) {
    if (!Array.isArray(patch.categories)) fail('INVALID_SETTINGS', 'Invalid categories.');
    const unique = [...new Set(patch.categories)];
    if (unique.length === 0) fail('INVALID_SETTINGS', 'Pick at least one category.');
    if (!unique.every((c) => (CATEGORY_IDS as readonly string[]).includes(c))) {
      fail('INVALID_SETTINGS', 'Unknown category.');
    }
    // Keep a canonical order.
    next.categories = CATEGORY_IDS.filter((c) => unique.includes(c)) as CategoryId[];
  }
  s.settings = next;
}

/** Questions matching the selected categories that can be played in `mode`. */
export function eligibleQuestions(settings: GameSettings, ctx: Pick<EngineContext, 'bank'>, mode?: ScoringMode): Question[] {
  const cats = new Set<string>(settings.categories);
  return ctx.bank.all.filter((q) => cats.has(q.category) && (!mode || q.modes.includes(mode)));
}

/** How many questions the current settings can draw from. */
export function availableQuestionCount(settings: GameSettings, ctx: Pick<EngineContext, 'bank'>): number {
  return eligibleQuestions(settings, ctx, settings.mode === 'mixed' ? undefined : settings.mode).length;
}

export function canStart(s: GameState, ctx: Pick<EngineContext, 'bank'>): { ok: boolean; reason: string | null } {
  if (s.phase !== 'lobby') return { ok: false, reason: 'The game has already started.' };
  const all = contestants(s);
  const connected = all.filter((p) => p.connected).length;
  if (connected < MIN_PLAYERS) {
    const need = MIN_PLAYERS - connected;
    return { ok: false, reason: `Need ${need} more connected player${need === 1 ? '' : 's'} (minimum ${MIN_PLAYERS}).` };
  }
  if (all.length > MAX_PLAYERS) return { ok: false, reason: `At most ${MAX_PLAYERS} players.` };
  const available = availableQuestionCount(s.settings, ctx);
  if (available < s.settings.questionCount) {
    return {
      ok: false,
      reason: `Only ${available} questions match these categories — pick more categories or fewer questions.`,
    };
  }
  return { ok: true, reason: null };
}

/**
 * Picks one question for round `index`, honoring categories and the round's mode,
 * never repeating a question already in `taken`. Prefers questions this room has
 * not seen in earlier games. Returns null if nothing fits.
 */
function pickOne(
  s: GameState,
  index: number,
  taken: Set<string>,
  ctx: EngineContext,
): DeckEntry | null {
  const wanted = modeForRound(s.settings.mode, index);
  const used = new Set(s.usedQuestionIds);
  const tryMode = (mode: ScoringMode): DeckEntry | null => {
    const pool = eligibleQuestions(s.settings, ctx, mode).filter((q) => !taken.has(q.id));
    const fresh = pool.filter((q) => !used.has(q.id));
    const from = fresh.length ? fresh : pool;
    if (!from.length) return null;
    const q = shuffle(from, ctx.rng)[0]!;
    return { questionId: q.id, mode };
  };
  const first = tryMode(wanted);
  if (first || s.settings.mode !== 'mixed') return first;
  // Mixed games fall back to the other mode rather than running out of questions.
  return tryMode(wanted === 'closest' ? 'withoutGoingOver' : 'closest');
}

/** Builds the deck: `count` distinct questions, each with its scoring mode. */
export function buildDeck(s: GameState, count: number, ctx: EngineContext): DeckEntry[] {
  const unseen = eligibleQuestions(s.settings, ctx).filter((q) => !s.usedQuestionIds.includes(q.id));
  if (unseen.length === 0) {
    // Everything has been played: start the cycle again.
    s.usedQuestionIds = [];
  }
  // pickOne() takes unseen questions first, then tops up with the least fresh ones.
  const taken = new Set<string>();
  const deck: DeckEntry[] = [];
  for (let i = 0; i < count; i++) {
    const entry = pickOne(s, i, taken, ctx);
    if (!entry) fail('NOT_ENOUGH_QUESTIONS', 'Not enough questions for these settings.');
    taken.add(entry.questionId);
    deck.push(entry);
  }
  return deck;
}

export function startGame(s: GameState, ctx: EngineContext) {
  if (s.phase !== 'lobby') fail('INVALID_TRANSITION', 'The game has already started.');
  const check = canStart(s, ctx);
  if (!check.ok) {
    fail(check.reason?.includes('questions') ? 'NOT_ENOUGH_QUESTIONS' : 'NOT_ENOUGH_PLAYERS', check.reason!);
  }
  s.deck = buildDeck(s, s.settings.questionCount, ctx);
  s.usedQuestionIds = [...s.usedQuestionIds, ...s.deck.map((d) => d.questionId)];
  s.history = [];
  s.skippedIds = [];
  for (const p of s.players) p.score = 0;
  beginRound(s, 0, ctx);
}

// ---------------------------------------------------------------------------
// Rounds
// ---------------------------------------------------------------------------

function beginRound(s: GameState, index: number, ctx: EngineContext) {
  const entry = s.deck[index];
  if (!entry) throw new Error(`No question for round ${index}`);
  s.roundIndex = index;
  s.round = {
    index,
    questionId: entry.questionId,
    mode: entry.mode,
    guesses: {},
    scored: false,
    results: null,
    scoresBefore: {},
  };
  goTo(s, 'question');
  startTimer(s, TIMING.questionIntroMs, ctx);
}

function startGuessing(s: GameState, ctx: EngineContext) {
  goTo(s, 'guessing');
  startTimer(s, s.settings.timerSeconds * 1000, ctx);
}

/** Closes guessing. Every player's last valid guess (locked or not) becomes final. */
function startGuessReveal(s: GameState, ctx: EngineContext) {
  goTo(s, 'guessReveal');
  const round = s.round!;
  const ids = new Set(contestants(s).map((p) => p.id));
  for (const [pid, g] of Object.entries(round.guesses)) {
    if (!ids.has(pid)) delete round.guesses[pid];
    else g.locked = true;
  }
  startTimer(s, TIMING.guessRevealMs, ctx);
}

/** Scores the current round. Guarded so it can never run twice. */
export function scoreCurrentRound(s: GameState, ctx: EngineContext) {
  const round = s.round!;
  if (round.scored) return;
  const question = ctx.bank.get(round.questionId)!;
  const players = contestants(s);
  round.scoresBefore = Object.fromEntries(players.map((p) => [p.id, p.score]));
  round.results = scoreRound({
    answer: question.answer,
    precision: question.precision,
    mode: round.mode,
    playerIds: players.map((p) => p.id),
    guesses: Object.fromEntries(Object.entries(round.guesses).map(([pid, g]) => [pid, g.value])),
  });
  for (const p of players) p.score += round.results[p.id]?.total ?? 0;
  round.scored = true;
  s.history.push({
    questionId: round.questionId,
    mode: round.mode,
    answer: question.answer,
    precision: question.precision,
    results: round.results,
  });
}

function startAnswerReveal(s: GameState, ctx: EngineContext) {
  goTo(s, 'answerReveal');
  scoreCurrentRound(s, ctx);
  startTimer(s, TIMING.answerRevealMs, ctx);
}

function startScoreboard(s: GameState) {
  goTo(s, 'scoreboard');
  s.timer = null;
}

function nextRoundOrFinish(s: GameState, ctx: EngineContext) {
  if (s.roundIndex + 1 < s.deck.length) {
    beginRound(s, s.roundIndex + 1, ctx);
  } else {
    finishGame(s);
  }
}

function finishGame(s: GameState) {
  goTo(s, 'gameOver');
  s.timer = null;
}

/** Ends guessing early once every connected contestant has locked in. */
export function checkEarlyCompletion(s: GameState, ctx: EngineContext) {
  if (isPaused(s) || !s.round || s.phase !== 'guessing') return;
  const active = contestants(s).filter((p) => p.connected);
  if (active.length === 0) return; // nobody here: let the timer decide
  if (active.every((p) => s.round!.guesses[p.id]?.locked)) startGuessReveal(s, ctx);
}

/** One step forward through the state machine. */
function step(s: GameState, ctx: EngineContext) {
  switch (s.phase) {
    case 'question':
      return startGuessing(s, ctx);
    case 'guessing':
      return startGuessReveal(s, ctx);
    case 'guessReveal':
      return startAnswerReveal(s, ctx);
    case 'answerReveal':
      return startScoreboard(s);
    case 'scoreboard':
      return nextRoundOrFinish(s, ctx);
    default:
      fail('INVALID_TRANSITION', `Cannot advance from ${s.phase}.`);
  }
}

function checkExpect(s: GameState, expect?: Expect) {
  if (!expect) return;
  if (expect.phase !== s.phase || expect.round !== s.roundIndex + 1) {
    fail('STALE_ACTION', 'The game has already moved on.');
  }
}

/**
 * Host "Next" button. `expect` makes it idempotent: a double-click (or a
 * retried message) that was meant for a phase we've already left is rejected
 * instead of skipping ahead.
 */
export function advance(s: GameState, ctx: EngineContext, expect?: Expect) {
  checkExpect(s, expect);
  if (isPaused(s)) fail('PAUSED', 'Resume the game first.');
  step(s, ctx);
}

/**
 * Host "Skip question": throws away the current question (before any answer is
 * revealed) and replaces it with a fresh one. If no replacement is left, the
 * round is dropped instead.
 */
export function skipQuestion(s: GameState, ctx: EngineContext, expect?: Expect) {
  checkExpect(s, expect);
  if (s.phase !== 'question' && s.phase !== 'guessing') {
    fail('WRONG_PHASE', 'Questions can only be skipped before the guesses are revealed.');
  }
  const round = s.round!;
  s.skippedIds.push(round.questionId);
  // Never bring back a skipped question (or anything already in this game).
  const taken = new Set([...s.deck.map((d) => d.questionId), ...s.history.map((h) => h.questionId), ...s.skippedIds]);
  s.usedQuestionIds = [...new Set([...s.usedQuestionIds, round.questionId])];
  const replacement = pickOne(s, s.roundIndex, taken, ctx);
  // Re-entering the question phase from guessing is a deliberate reset, not a normal transition.
  s.phase = 'scoreboard';
  if (replacement) {
    s.deck[s.roundIndex] = replacement;
    s.usedQuestionIds.push(replacement.questionId);
    beginRound(s, s.roundIndex, ctx);
  } else {
    s.deck.splice(s.roundIndex, 1);
    s.round = null;
    if (s.roundIndex < s.deck.length) beginRound(s, s.roundIndex, ctx);
    else finishGame(s);
  }
}

/** Applies a timer expiry, if one is due. Returns true if the state changed. */
export function tick(s: GameState, ctx: EngineContext): boolean {
  if (!timeIsUp(s, ctx.now)) return false;
  // Exactly one transition per expiry; the next phase's timer starts from
  // `now`, so a late wake-up never skips a whole phase.
  step(s, ctx);
  return true;
}

export function pause(s: GameState, ctx: EngineContext) {
  if (!s.timer) fail('INVALID_TRANSITION', 'There is no timer running.');
  if (s.timer.pausedRemainingMs !== null) return; // already paused: idempotent
  s.timer.pausedRemainingMs = Math.max(0, s.timer.endsAt - ctx.now);
}

export function resume(s: GameState, ctx: EngineContext) {
  if (!s.timer || s.timer.pausedRemainingMs === null) return; // idempotent
  s.timer.endsAt = ctx.now + s.timer.pausedRemainingMs;
  s.timer.pausedRemainingMs = null;
  checkEarlyCompletion(s, ctx);
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------

function requireContestant(s: GameState, playerId: string): ServerPlayer {
  const p = getPlayer(s, playerId);
  if (p.status !== 'contestant') fail('NOT_A_CONTESTANT', 'You will join in when the next game starts.');
  return p;
}

/**
 * Saves (and optionally locks) a player's guess. A player has exactly one guess
 * per round: sending again replaces the draft until it is locked.
 */
export function submitGuess(s: GameState, playerId: string, raw: unknown, lock: unknown, ctx: EngineContext): number {
  requireContestant(s, playerId);
  if (s.phase !== 'guessing') fail('WRONG_PHASE', 'Guessing is closed.');
  if (timeIsUp(s, ctx.now)) fail('TIME_UP', "Time's up!");
  if (isPaused(s)) fail('PAUSED', 'The game is paused.');
  const round = s.round!;
  const existing = round.guesses[playerId];
  if (existing?.locked) fail('ALREADY_LOCKED', 'Your guess is locked in!');
  const question = ctx.bank.get(round.questionId)!;
  const parsed = parseGuess(raw, { precision: question.precision, allowNegative: !!question.allowNegative });
  if (!parsed.ok) fail('GUESS_INVALID', parsed.message);
  round.guesses[playerId] = { value: parsed.value, locked: lock === true, at: ctx.now };
  checkEarlyCompletion(s, ctx);
  return parsed.value;
}

// ---------------------------------------------------------------------------
// Game over / rematch
// ---------------------------------------------------------------------------

function resetToLobby(s: GameState) {
  s.phase = 'lobby';
  s.round = null;
  s.roundIndex = 0;
  s.deck = [];
  s.history = [];
  s.timer = null;
  s.gameNumber += 1;
  for (const p of s.players) p.score = 0;
  // Promote people who were waiting on the sidelines, up to the cap.
  let count = contestants(s).length;
  for (const p of s.players) {
    if (p.status === 'waiting' && count < MAX_PLAYERS) {
      p.status = 'contestant';
      count += 1;
    }
  }
}

/** Same roster, scores reset, back to the lobby; the next game draws fresh questions. */
export function rematch(s: GameState) {
  if (s.phase !== 'gameOver') fail('INVALID_TRANSITION', 'A rematch can start once the game is over.');
  resetToLobby(s);
}

/** Abandon the current game (any phase) and return to the lobby. */
export function restart(s: GameState) {
  if (s.phase === 'lobby') fail('INVALID_TRANSITION', 'Already in the lobby.');
  resetToLobby(s);
}
