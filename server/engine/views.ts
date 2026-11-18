/**
 * Builds the per-viewer snapshot sent over the wire.
 *
 * This is the single choke point that keeps secrets secret:
 *  - the answer, fact, source and results are only included once the round has
 *    been scored and the game is in the answer reveal (or scoreboard);
 *  - other players' guesses are hidden until guessing has closed — during
 *    guessing a player only ever sees their own guess;
 *  - tokens are never included.
 */
import type { GameView, MeView, Phase, PlayerView, QuestionView, RevealedGuess, Role } from '../../shared/protocol';
import { availableQuestionCount, canStart } from './game';
import { everyoneBusted } from './scoring';
import { computeGameStats, computeStandings } from './standings';
import type { GameState, QuestionBank } from './types';

export interface Viewer {
  role: Role;
  playerId: string | null;
}

const QUESTION_PHASES = new Set<Phase>(['question', 'guessing', 'guessReveal', 'answerReveal', 'scoreboard']);
const GUESSES_VISIBLE = new Set<Phase>(['guessReveal', 'answerReveal', 'scoreboard']);
const ANSWER_VISIBLE = new Set<Phase>(['answerReveal', 'scoreboard']);

export function buildView(s: GameState, viewer: Viewer, now: number, bank: QuestionBank, hostConnected: boolean): GameView {
  const round = s.round;
  const q = round ? bank.get(round.questionId) : undefined;
  const showQuestion = QUESTION_PHASES.has(s.phase) && !!q && !!round;
  const showAnswer = ANSWER_VISIBLE.has(s.phase) && !!round?.scored && !!round.results && !!q;

  const players: PlayerView[] = s.players
    .slice()
    .sort((a, b) => a.joinedAt - b.joinedAt)
    .map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      avatar: p.avatar,
      score: p.score,
      connected: p.connected,
      status: p.status,
    }));

  const question: QuestionView | null = showQuestion
    ? {
        id: q!.id,
        category: q!.category,
        text: q!.text,
        unit: q!.unit,
        precision: q!.precision,
        allowNegative: !!q!.allowNegative,
        mode: round!.mode,
        hint: q!.hint ?? null,
      }
    : null;

  let guesses: RevealedGuess[] | null = null;
  if (round && GUESSES_VISIBLE.has(s.phase)) {
    guesses = Object.entries(round.guesses)
      .map(([playerId, g]) => ({ playerId, value: g.value }))
      .sort((a, b) => a.value - b.value || a.playerId.localeCompare(b.playerId));
  }

  let me: MeView | null = null;
  if (viewer.role === 'player' && viewer.playerId) {
    const p = s.players.find((x) => x.id === viewer.playerId);
    if (p) {
      const g = round && QUESTION_PHASES.has(s.phase) ? round.guesses[p.id] : undefined;
      me = { playerId: p.id, name: p.name, status: p.status, guess: g?.value ?? null, locked: g?.locked ?? false };
    }
  }

  const timer = s.timer
    ? {
        endsAt: s.timer.pausedRemainingMs === null ? s.timer.endsAt : null,
        remainingMs: s.timer.pausedRemainingMs ?? Math.max(0, s.timer.endsAt - now),
        durationMs: s.timer.durationMs,
        paused: s.timer.pausedRemainingMs !== null,
      }
    : null;

  const inGame = s.phase !== 'lobby';
  const isHost = viewer.role === 'host';

  return {
    code: s.code,
    phase: s.phase,
    gameNumber: s.gameNumber,
    settings: s.settings,
    players,
    hostConnected,
    round: inGame && s.phase !== 'gameOver' ? s.roundIndex + 1 : inGame ? s.history.length : 0,
    totalRounds: inGame ? s.deck.length : s.settings.questionCount,
    timer,
    paused: timer?.paused ?? false,
    question,
    lockedIds:
      round && s.phase === 'guessing'
        ? Object.entries(round.guesses)
            .filter(([, g]) => g.locked)
            .map(([id]) => id)
            .sort()
        : [],
    guesses,
    reveal: showAnswer
      ? {
          answer: q!.answer,
          fact: q!.fact ?? null,
          source: q!.source,
          results: round!.results!,
          everyoneBusted: everyoneBusted(round!.results!),
        }
      : null,
    standings: computeStandings(s.players, (s.phase === 'answerReveal' || s.phase === 'scoreboard') && round?.scored ? round.scoresBefore : null),
    stats: s.phase === 'gameOver' ? computeGameStats(s) : null,
    me,
    isHost,
    canStart: isHost ? canStart(s, { bank }) : { ok: false, reason: null },
    availableQuestions: isHost ? availableQuestionCount(s.settings, { bank }) : null,
  };
}
