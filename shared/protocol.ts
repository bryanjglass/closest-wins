/**
 * Closest Wins wire protocol and shared constants.
 *
 * Everything in this file is safe to ship to browsers: it contains types and
 * game constants only — never question answers.
 */

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
/** Contestants plus people waiting to join the next game. */
export const MAX_ROOM_OCCUPANTS = 16;
export const QUESTION_COUNTS = [5, 10, 15, 20] as const;
export type QuestionCount = (typeof QUESTION_COUNTS)[number];
export const TIMER_SECONDS_OPTIONS = [15, 30, 45, 60] as const;
export type TimerSeconds = (typeof TIMER_SECONDS_OPTIONS)[number];
export const MAX_NAME_LENGTH = 16;
export const MAX_MESSAGE_BYTES = 4096;
/** Largest magnitude a guess may have. Keeps the math exact and the TV readable. */
export const MAX_GUESS_ABS = 1_000_000_000_000;
/** Longest guess string (digits, separators, sign) a client may send. */
export const MAX_GUESS_CHARS = 24;

export type ScoringMode = 'closest' | 'withoutGoingOver';
export type GameMode = ScoringMode | 'mixed';
export const GAME_MODES: readonly GameMode[] = ['mixed', 'closest', 'withoutGoingOver'];

export const MODE_INFO: Record<GameMode, { label: string; short: string; emoji: string; rule: string }> = {
  closest: {
    label: 'Closest Overall',
    short: 'Closest',
    emoji: '🎯',
    rule: 'Nearest guess wins — over or under.',
  },
  withoutGoingOver: {
    label: 'Without Going Over',
    short: "Don't go over",
    emoji: '🚫',
    rule: 'Highest guess that does NOT go over wins. Over = bust!',
  },
  mixed: {
    label: 'Mixed',
    short: 'Mixed',
    emoji: '🔀',
    rule: 'Rounds alternate between Closest Overall and Without Going Over.',
  },
};

export const CATEGORIES = [
  { id: 'prices', label: 'Prices & Products', emoji: '🛒' },
  { id: 'animals', label: 'Animals & Nature', emoji: '🦒' },
  { id: 'sports', label: 'Sports & Records', emoji: '🏅' },
  { id: 'entertainment', label: 'Movies & Entertainment', emoji: '🎬' },
  { id: 'weird', label: 'Weird Facts', emoji: '🤪' },
  { id: 'geography', label: 'Geography & History', emoji: '🗺️' },
] as const;
export type CategoryId = (typeof CATEGORIES)[number]['id'];
export const CATEGORY_IDS: readonly CategoryId[] = CATEGORIES.map((c) => c.id);

export function categoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) ?? { id, label: id, emoji: '❓' };
}

export const POINTS = {
  /** Points for 1st, 2nd and 3rd place (competition ranking). Everyone else scores 0. */
  placements: [1000, 500, 250] as const,
  /** Extra points for hitting the answer exactly. */
  exactBonus: 250,
} as const;

/** Phase timings that are not configurable by the host (milliseconds). */
export const TIMING = {
  questionIntroMs: 5000,
  guessRevealMs: 7000,
  answerRevealMs: 10000,
  /** How long the standings stay up before the next question (or the final results). */
  scoreboardMs: 10000,
} as const;

export const ROOM_CODE_ALPHABET = 'BCDFGHJKLMNPQRSTVWXZ';
export const ROOM_CODE_LENGTH = 4;
export const ROOM_CODE_PATTERN = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

/** Exact text for keep-alive pings; the server answers without waking up. */
export const PING_TEXT = '{"type":"ping"}';
export const PONG_TEXT = '{"type":"pong"}';

export type Phase = 'lobby' | 'question' | 'guessing' | 'guessReveal' | 'answerReveal' | 'scoreboard' | 'gameOver';

export interface GameSettings {
  mode: GameMode;
  questionCount: QuestionCount;
  timerSeconds: TimerSeconds;
  categories: CategoryId[];
}

export const DEFAULT_SETTINGS: GameSettings = {
  mode: 'mixed',
  questionCount: 10,
  timerSeconds: 30,
  categories: [...CATEGORY_IDS],
};

export type Role = 'host' | 'display' | 'player';
export type PlayerStatus = 'contestant' | 'waiting';

export interface PlayerView {
  id: string;
  name: string;
  color: string;
  avatar: string;
  score: number;
  connected: boolean;
  status: PlayerStatus;
}

export interface TimerView {
  /** Server epoch ms when the timer expires (null while paused). */
  endsAt: number | null;
  remainingMs: number;
  durationMs: number;
  paused: boolean;
}

export interface QuestionView {
  id: string;
  category: string;
  text: string;
  unit: string;
  /** Decimal places allowed in guesses (0 = whole numbers). */
  precision: number;
  allowNegative: boolean;
  /** Scoring mode for this round. */
  mode: ScoringMode;
  hint: string | null;
}

/** One revealed guess (from the guess reveal onward). */
export interface RevealedGuess {
  playerId: string;
  value: number;
}

export type ResultStatus = 'placed' | 'unplaced' | 'busted' | 'missing';

export interface PlayerRoundResult {
  playerId: string;
  guess: number | null;
  /** |guess − answer|, rounded to the question's precision. Null without a guess. */
  diff: number | null;
  /** Signed guess − answer. Null without a guess. */
  signedDiff: number | null;
  status: ResultStatus;
  /** Competition rank among eligible guesses (1, 1, 3…). Null when busted or missing. */
  rank: number | null;
  exact: boolean;
  placementPoints: number;
  exactBonus: number;
  total: number;
}

export interface AnswerRevealView {
  answer: number;
  fact: string | null;
  source: string;
  /** Results keyed by player id, for every contestant. */
  results: Record<string, PlayerRoundResult>;
  everyoneBusted: boolean;
}

export interface StandingRow {
  playerId: string;
  /** Competition ranking: tied scores share a rank (1, 2, 2, 4). */
  rank: number;
  score: number;
  delta: number;
  previousRank: number | null;
}

export interface Award {
  id: string;
  title: string;
  emoji: string;
  description: string;
  playerIds: string[];
}

export interface PlayerGameStats {
  playerId: string;
  roundsGuessed: number;
  firstPlaces: number;
  podiums: number;
  exactHits: number;
  busts: number;
  missed: number;
  /** Average |error| as a % of the answer (null if it could not be computed). */
  avgErrorPct: number | null;
}

export interface GameStatsView {
  rounds: number;
  players: PlayerGameStats[];
  awards: Award[];
}

export interface MeView {
  playerId: string;
  name: string;
  status: PlayerStatus;
  /** This player's current guess (draft or locked). Only ever sent to this player. */
  guess: number | null;
  locked: boolean;
}

export interface GameView {
  code: string;
  phase: Phase;
  gameNumber: number;
  settings: GameSettings;
  players: PlayerView[];
  hostConnected: boolean;
  /** 1-based round number; 0 in the lobby. */
  round: number;
  totalRounds: number;
  timer: TimerView | null;
  paused: boolean;
  question: QuestionView | null;
  /** Players who have locked in a guess (guessing phase only). */
  lockedIds: string[];
  /** All guesses, ascending — from the guess reveal onward. */
  guesses: RevealedGuess[] | null;
  /** The answer and results — only from the answer reveal onward. */
  reveal: AnswerRevealView | null;
  standings: StandingRow[];
  stats: GameStatsView | null;
  me: MeView | null;
  isHost: boolean;
  canStart: { ok: boolean; reason: string | null };
  /** Number of questions available for the current category selection (host only). */
  availableQuestions: number | null;
}

export type Expect = { phase: Phase; round: number };

export type HostAction =
  | { kind: 'updateSettings'; settings: Partial<GameSettings> }
  | { kind: 'start' }
  | { kind: 'advance'; expect?: Expect }
  | { kind: 'skip'; expect?: Expect }
  | { kind: 'pause' }
  | { kind: 'resume' }
  | { kind: 'rematch' }
  | { kind: 'restart' }
  | { kind: 'removePlayer'; playerId: string };

export type ClientMessage =
  | { type: 'hello'; role: 'host'; hostToken: string; requestId?: string }
  | { type: 'hello'; role: 'display'; requestId?: string }
  | { type: 'hello'; role: 'player'; playerToken?: string | null; requestId?: string }
  | { type: 'join'; name: string; avatar?: string; requestId?: string }
  | { type: 'guess'; value: string | number; lock: boolean; requestId?: string }
  | { type: 'host'; action: HostAction; requestId?: string }
  | { type: 'ping' };

export type ErrorCode =
  | 'BAD_MESSAGE'
  | 'ROOM_NOT_FOUND'
  | 'NOT_AUTHORIZED'
  | 'NOT_JOINED'
  | 'TOKEN_INVALID'
  | 'NAME_INVALID'
  | 'NAME_TAKEN'
  | 'AVATAR_INVALID'
  | 'ROOM_FULL'
  | 'GAME_IN_PROGRESS'
  | 'NOT_ENOUGH_PLAYERS'
  | 'NOT_ENOUGH_QUESTIONS'
  | 'INVALID_SETTINGS'
  | 'INVALID_TRANSITION'
  | 'STALE_ACTION'
  | 'WRONG_PHASE'
  | 'TIME_UP'
  | 'PAUSED'
  | 'NOT_A_CONTESTANT'
  | 'GUESS_INVALID'
  | 'ALREADY_LOCKED';

export type ServerMessage =
  | { type: 'welcome'; role: Role; playerId: string | null; requestId?: string }
  | { type: 'joined'; playerId: string; playerToken: string; requestId?: string }
  | { type: 'state'; state: GameView; serverNow: number }
  | { type: 'ack'; requestId: string }
  | { type: 'error'; code: ErrorCode; message: string; requestId?: string }
  | { type: 'pong' };

/** HTTP response from POST /api/rooms */
export interface CreateRoomResponse {
  code: string;
  hostToken: string;
}
