import type { GameView } from '../../../../shared/protocol';
import { TimerRing } from '../../components/TimerRing';
import { contestantsOf } from '../../hooks/usePlayers';
import { sfx } from '../../lib/sfx';
import { AvatarRow, QuestionMeta, TvQuestionCard, useOnIncrease } from './shared';

/** Phase "question": the question is read out before guessing opens. */
export function TvQuestion({ view }: { view: GameView }) {
  return (
    <div className="h-full flex flex-col justify-center px-[6rem] pb-[4rem] gap-[2.4rem]">
      <div className="flex items-center gap-[1.5rem] text-[1.8rem] animate-slide-in">
        <span className="font-display font-bold text-sun text-[2.4rem]">
          Question {view.round} <span className="text-cream/50">of {view.totalRounds}</span>
        </span>
      </div>
      <QuestionMeta view={view} className="text-[1.9rem] animate-rise" />
      <div className="animate-pop-in [animation-delay:150ms]">
        <TvQuestionCard view={view} />
      </div>
      <div className="flex items-center gap-[1.5rem] text-[2rem] text-cream/85 animate-rise [animation-delay:500ms]">
        <TimerRing timer={view.timer} className="text-[0.9rem]" />
        Phones out — guessing opens in a moment…
      </div>
    </div>
  );
}

/** Phase "guessing": countdown + who has locked in. Guesses stay secret. */
export function TvGuessing({ view }: { view: GameView }) {
  const players = contestantsOf(view);
  useOnIncrease(view.lockedIds.length, sfx.pop);
  const hint = view.question?.hint;
  return (
    <div className="h-full grid grid-cols-[1fr_auto] gap-[3rem] px-[5rem] pt-[1.5rem] pb-[3rem]">
      <div className="flex flex-col gap-[1.6rem] min-w-0">
        <QuestionMeta view={view} className="text-[1.6rem]" />
        <TvQuestionCard view={view} size="md" />
        {hint && (
          <div className="self-start rounded-[1rem] bg-sky/20 border-[0.15rem] border-sky/60 px-[1.2rem] py-[0.5rem] text-[1.7rem] animate-rise" data-testid="tv-hint">
            💡 Hint: {hint}
          </div>
        )}
        <div className="mt-auto">
          <AvatarRow players={players} doneIds={view.lockedIds} size={players.length > 6 ? 4.4 : 5.4} />
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-[1.6rem] w-[24rem]">
        <TimerRing timer={view.timer} className="text-[3.6rem]" onTick={(s) => s <= 5 && sfx.tick()} />
        <div className="text-center">
          <div className="font-display font-bold text-[4.2rem] leading-none tabular" data-testid="tv-locked-count">
            {view.lockedIds.length}
            <span className="text-cream/50">/{players.length}</span>
          </div>
          <div className="text-[1.6rem] text-cream/80">locked in 🔒</div>
        </div>
        <div className="text-[1.3rem] text-cream/60 text-center">Guesses stay secret until time is up!</div>
      </div>
    </div>
  );
}
