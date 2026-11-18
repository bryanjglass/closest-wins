import type { GameSettings, Phase, PlayerRoundResult, PlayerStatus, ScoringMode } from '../../shared/protocol';
import type { Question } from '../questions';

export interface ServerPlayer {
  id: string;
  /** Secret reconnect token. Never included in any view. */
  token: string;
  name: string;
  color: string;
  avatar: string;
  score: number;
  status: PlayerStatus;
  connected: boolean;
  joinedAt: number;
}

export interface GuessEntry {
  value: number;
  locked: boolean;
  at: number;
}

export interface DeckEntry {
  questionId: string;
  mode: ScoringMode;
}

export interface RoundState {
  index: number;
  questionId: string;
  mode: ScoringMode;
  /** playerId -> latest valid guess (draft or locked). Secret until guessing closes. */
  guesses: Record<string, GuessEntry>;
  /** Set exactly once, when the round is scored. */
  scored: boolean;
  results: Record<string, PlayerRoundResult> | null;
  scoresBefore: Record<string, number>;
}

export interface TimerState {
  endsAt: number;
  durationMs: number;
  /** When non-null, the timer is paused with this much time left. */
  pausedRemainingMs: number | null;
}

export interface HistoryEntry {
  questionId: string;
  mode: ScoringMode;
  answer: number;
  precision: number;
  results: Record<string, PlayerRoundResult>;
}

export interface GameState {
  schema: 1;
  code: string;
  hostToken: string;
  createdAt: number;
  updatedAt: number;
  settings: GameSettings;
  phase: Phase;
  players: ServerPlayer[];
  /** Questions chosen for the current game, in play order, with their scoring mode. */
  deck: DeckEntry[];
  roundIndex: number;
  round: RoundState | null;
  /** Completed (scored) rounds of the current game. */
  history: HistoryEntry[];
  timer: TimerState | null;
  gameNumber: number;
  /** Questions used by earlier games (and skips) in this room, so rematches feel fresh. */
  usedQuestionIds: string[];
  /** Questions the host skipped in the current game; they never come back this game. */
  skippedIds: string[];
}

export interface QuestionBank {
  all: readonly Question[];
  get(id: string): Question | undefined;
}

export interface EngineContext {
  now: number;
  /** Uniform random number in [0, 1). Injected so tests are deterministic. */
  rng: () => number;
  bank: QuestionBank;
}
