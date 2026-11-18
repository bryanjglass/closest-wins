import { CATEGORIES, MAX_PLAYERS, MIN_PLAYERS, MODE_INFO, POINTS, type GameView } from '../../../../shared/protocol';
import { Avatar } from '../../components/Avatar';
import { Logo } from '../../components/Logo';
import { QrCode } from '../../components/QrCode';
import { joinUrl, shortSiteLabel } from '../../config';
import { contestantsOf } from '../../hooks/usePlayers';
import { sfx } from '../../lib/sfx';
import { useOnIncrease } from './shared';

export function TvLobby({ view }: { view: GameView }) {
  const players = contestantsOf(view);
  useOnIncrease(players.length, sfx.pop);
  const needed = Math.max(0, MIN_PLAYERS - players.filter((p) => p.connected).length);
  const emptySlots = Math.max(0, MIN_PLAYERS - players.length);
  const big = players.length <= 6;
  const s = view.settings;
  const allCategories = s.categories.length === CATEGORIES.length;

  return (
    <div className="h-full flex flex-col px-[4rem] pt-[2.2rem] pb-[3.2rem] gap-[1.6rem]">
      <div className="flex-1 min-h-0 grid grid-cols-[1.25fr_1fr] gap-[4rem] items-center">
        <div className="flex flex-col gap-[1.4rem]">
          <Logo className="text-[4.2rem] animate-pop-in" />
          <p className="text-[2rem] leading-tight text-cream/90 max-w-[42rem] animate-rise [animation-delay:200ms]">
            Nobody knows the exact answer — just get <span className="text-sun">closer than everyone else!</span>
          </p>
          <div className="flex flex-col gap-[0.8rem] text-[2rem] animate-rise [animation-delay:350ms]">
            <div>
              <span className="text-cream/70">1. Go to </span>
              <span className="text-sky" data-testid="tv-site">
                {shortSiteLabel()}
              </span>
            </div>
            <div className="flex items-center gap-[1.2rem]">
              <span className="text-cream/70">2. Enter code</span>
              <span className="sticker rounded-[1rem] bg-ink px-[1.4rem] py-[0.2rem] font-display font-bold text-[4.4rem] text-sun tracking-[0.25em]" data-testid="tv-room-code">
                {view.code}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-center gap-[0.8rem] pt-[1.6rem] animate-pop-in [animation-delay:250ms]">
          <div className="relative">
            <QrCode value={joinUrl(view.code)} className="w-[14.5rem] h-[14.5rem]" />
            <span className="absolute -top-[1.6rem] -left-[2rem] bg-pink sticker rounded-[0.8rem] px-[1rem] py-[0.3rem] font-display font-bold text-[1.8rem] rotate-[-10deg] text-white">
              SCAN ME!
            </span>
          </div>
          <div className="flex flex-wrap justify-center gap-[0.6rem] text-[1.25rem] animate-rise [animation-delay:500ms]" data-testid="tv-settings">
            <span className="rounded-full bg-white/10 px-[1rem] py-[0.3rem]">
              {MODE_INFO[s.mode].emoji} {MODE_INFO[s.mode].label}
            </span>
            <span className="rounded-full bg-white/10 px-[1rem] py-[0.3rem]">{s.questionCount} questions</span>
            <span className="rounded-full bg-white/10 px-[1rem] py-[0.3rem]">⏱ {s.timerSeconds}s to guess</span>
            <span className="rounded-full bg-white/10 px-[1rem] py-[0.3rem]">
              {allCategories ? 'All categories' : s.categories.map((c) => CATEGORIES.find((x) => x.id === c)?.emoji).join(' ')}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-[0.6rem] text-center text-[1.1rem]" aria-label="Scoring">
            {[
              ['🥇', POINTS.placements[0]],
              ['🥈', POINTS.placements[1]],
              ['🥉', POINTS.placements[2]],
              ['🎯 exact', POINTS.exactBonus],
            ].map(([label, pts]) => (
              <div key={String(label)} className="rounded-[0.8rem] bg-black/30 px-[0.8rem] py-[0.2rem] leading-tight">
                <div>{label}</div>
                <div className="font-display font-bold text-sun text-[1.3rem]">+{Number(pts).toLocaleString('en-US')}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <section className="shrink-0 relative rounded-[2rem] bg-black/30 border-[0.15rem] border-white/10 px-[2rem] pt-[1.2rem] pb-[1.6rem]">
        <div className="flex items-baseline justify-between mb-[1rem]">
          <h2 className="font-display font-bold text-[2rem] text-sun">
            Players <span className="text-cream" data-testid="tv-player-count">{players.length}</span>
            <span className="text-cream/50">/{MAX_PLAYERS}</span>
          </h2>
          <div className="text-[1.8rem]" data-testid="tv-lobby-status">
            {needed > 0 ? (
              <span className="text-cream/80">
                Need {needed} more player{needed === 1 ? '' : 's'} to start
              </span>
            ) : (
              <span className="text-mint animate-pulse-fast inline-block">Ready! Waiting for the host to start…</span>
            )}
          </div>
        </div>
        <div className={`flex flex-wrap ${big ? 'gap-[1.6rem]' : 'gap-[1.1rem]'} min-h-[8.5rem] items-start text-[1rem]`} data-testid="tv-players">
          {players.map((p) => (
            <div key={p.id} className="animate-pop-in">
              <Avatar player={p} size={big ? 6 : 4} showName className="text-[1.5rem]" />
            </div>
          ))}
          {Array.from({ length: emptySlots }, (_, i) => (
            <div
              key={`empty-${i}`}
              className="w-[9rem] h-[9rem] rounded-full border-[0.2rem] border-dashed border-white/25 flex items-center justify-center text-white/30 font-display text-[2.5rem]"
            >
              ?
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
