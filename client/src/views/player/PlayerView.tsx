import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { MAX_NAME_LENGTH, MODE_INFO, type GameView, type MeView } from '../../../../shared/protocol';
import { formatSignedDiff, formatValue, numberToPlainString, parseGuess } from '../../../../shared/numbers';
import { PLAYER_AVATARS } from '../../../../shared/players';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConnectionBanner } from '../../components/ConnectionBanner';
import { Logo } from '../../components/Logo';
import { ModeBadge } from '../../components/ModeBadge';
import { PrefsControls } from '../../components/PrefsControls';
import { MessageScreen } from '../../components/Screen';
import { TimerBar } from '../../components/TimerRing';
import { contestantsOf, usePlayerMap } from '../../hooks/usePlayers';
import { LAST_AVATAR_KEY, LAST_NAME_KEY, storage } from '../../lib/storage';
import { requestWithError, useGame } from '../../store';

export function PlayerView({ code }: { code: string }) {
  const { connect, disconnect, view, status, welcomed } = useGame();

  useEffect(() => {
    connect(code, 'player');
    return () => disconnect();
  }, [code, connect, disconnect]);

  if (status === 'notFound') {
    return (
      <MessageScreen title={`No game called ${code}`} emoji="🤷">
        <p className="text-cream/80">Double-check the room code on the TV.</p>
      </MessageScreen>
    );
  }
  if (!view || !welcomed) return <MessageScreen title="Finding your seat…" emoji="⚙️" />;

  return (
    <div className="min-h-dvh bg-arena flex flex-col" data-testid="player" data-phase={view.phase}>
      {view.me ? <Header view={view} me={view.me} /> : null}
      <main className="flex-1 flex flex-col w-full max-w-lg mx-auto px-4 py-5 gap-5">
        {!view.me ? <JoinForm view={view} /> : <PlayerGame view={view} me={view.me} />}
      </main>
      <footer className="flex justify-center pb-4 text-sm">
        <PrefsControls showSound={false} />
      </footer>
      <ConnectionBanner />
      {view.paused && view.me?.status === 'contestant' && (
        <div className="fixed inset-0 z-30 bg-ink/85 flex flex-col items-center justify-center gap-3" role="status">
          <div className="font-display font-bold text-5xl text-sun">PAUSED</div>
          <p className="text-cream/80">The host hit pause. Hang tight!</p>
        </div>
      )}
    </div>
  );
}

function Header({ view, me }: { view: GameView; me: MeView }) {
  const self = view.players.find((p) => p.id === me.playerId);
  return (
    <header className="flex items-center gap-3 px-4 py-3 bg-black/25 border-b border-white/10">
      {self && <Avatar player={self} size={2.4} className="text-base" />}
      <div className="min-w-0">
        <div className="truncate text-lg" style={{ color: self?.color }} data-testid="my-name">
          {me.name}
        </div>
        <div className="text-xs text-cream/60">Room {view.code}</div>
      </div>
      <div className="ml-auto text-right">
        <div className="font-display font-bold text-2xl text-sun tabular" data-testid="my-score">
          {(self?.score ?? 0).toLocaleString('en-US')}
        </div>
        <div className="text-xs text-cream/60">points</div>
      </div>
    </header>
  );
}

function JoinForm({ view }: { view: GameView }) {
  const [name, setName] = useState(() => storage.get(LAST_NAME_KEY) ?? '');
  const taken = new Set(view.players.map((p) => p.avatar));
  const [avatar, setAvatar] = useState(() => {
    const last = storage.get(LAST_AVATAR_KEY);
    return last && !taken.has(last) ? last : (PLAYER_AVATARS.find((a) => !taken.has(a)) ?? PLAYER_AVATARS[0]);
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inProgress = view.phase !== 'lobby';

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await requestWithError({ type: 'join', name, avatar });
    setBusy(false);
    if (!res.ok) return setError(res.message);
    storage.set(LAST_NAME_KEY, name.trim());
    storage.set(LAST_AVATAR_KEY, avatar);
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 pt-4 animate-rise">
      <Logo className="text-4xl self-center" />
      <div className="text-center">
        <div className="text-cream/70">Joining room</div>
        <div className="font-display font-bold text-4xl text-sun tracking-widest">{view.code}</div>
      </div>
      {inProgress && (
        <p className="rounded-2xl bg-sky/20 border border-sky/50 p-3 text-center">
          A game is already running. Join now and you'll be in the <b>next</b> game!
        </p>
      )}
      <label className="flex flex-col gap-2 text-lg">
        Your name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="nickname"
          enterKeyHint="go"
          placeholder="e.g. Grandma Jo"
          aria-label="Your name"
          className="sticker rounded-2xl bg-cream text-ink text-2xl px-4 py-3 placeholder:text-ink/30"
        />
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend className="text-lg mb-2">Pick your avatar</legend>
        <div className="grid grid-cols-6 gap-2" role="radiogroup" aria-label="Avatar">
          {PLAYER_AVATARS.map((a) => {
            const isTaken = taken.has(a);
            const selected = avatar === a;
            return (
              <button
                key={a}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={`Avatar ${a}${isTaken ? ' (taken)' : ''}`}
                disabled={isTaken}
                onClick={() => setAvatar(a)}
                className={`aspect-square rounded-2xl text-3xl flex items-center justify-center transition-transform ${
                  selected ? 'bg-sun sticker scale-110' : 'bg-white/10 border-2 border-white/10'
                } ${isTaken ? 'opacity-25' : ''}`}
                data-testid="avatar-option"
              >
                {a}
              </button>
            );
          })}
        </div>
      </fieldset>
      {error && (
        <p className="text-white bg-tomato sticker rounded-xl px-3 py-2 animate-shake" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" tone="pink" big disabled={busy || !name.trim()} data-testid="join-button">
        {busy ? 'Joining…' : "Let's go!"}
      </Button>
    </form>
  );
}

function PlayerGame({ view, me }: { view: GameView; me: MeView }) {
  if (me.status === 'waiting') {
    return (
      <Centered emoji="⏳" title="You're on the list!">
        A game is in progress. You'll jump in when the next game starts — enjoy the show on the TV!
      </Centered>
    );
  }
  switch (view.phase) {
    case 'lobby':
      return <Lobby view={view} />;
    case 'question':
      return (
        <div className="flex flex-col gap-4 animate-rise">
          <RoundTag view={view} />
          <QuestionCard view={view} />
          <p className="text-center text-sun text-xl animate-pulse-fast">Get ready to guess…</p>
        </div>
      );
    case 'guessing':
      return <Guessing view={view} me={me} />;
    case 'guessReveal':
      return (
        <div className="flex flex-col gap-4 animate-rise">
          <RoundTag view={view} />
          <QuestionCard view={view} compact />
          <Centered emoji="👀" title="Guesses are in!">
            {me.guess !== null ? (
              <>
                Your guess: <b className="text-sun" data-testid="my-final-guess">{formatValue(me.guess, view.question!.unit, view.question!.precision)}</b>
              </>
            ) : (
              <span data-testid="my-final-guess">You didn't guess this time.</span>
            )}
            <div className="mt-2">Watch the TV for the answer…</div>
          </Centered>
        </div>
      );
    case 'answerReveal':
      return <MyResult view={view} me={me} />;
    case 'scoreboard':
      return <MyStanding view={view} me={me} />;
    case 'gameOver':
      return <GameOver view={view} me={me} />;
  }
}

function Centered({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6 animate-rise">
      <div className="text-7xl animate-float" aria-hidden="true">
        {emoji}
      </div>
      <h2 className="font-display font-bold text-2xl text-sun">{title}</h2>
      {children && <div className="text-lg text-cream/85 max-w-sm">{children}</div>}
    </div>
  );
}

function RoundTag({ view }: { view: GameView }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="rounded-full bg-pink sticker px-3 py-1 font-display font-bold text-sm text-white">
        Question {view.round} / {view.totalRounds}
      </span>
      {view.question && <ModeBadge mode={view.question.mode} className="text-sm" />}
    </div>
  );
}

function QuestionCard({ view, compact = false }: { view: GameView; compact?: boolean }) {
  const q = view.question;
  if (!q) return null;
  return (
    <div className={`sticker rounded-3xl bg-cream text-ink leading-snug ${compact ? 'p-4 text-base' : 'p-5 text-xl'}`} data-testid="question-text">
      {q.text}
      {!compact && q.hint && <div className="mt-2 text-base text-grape">💡 {q.hint}</div>}
    </div>
  );
}

function Lobby({ view }: { view: GameView }) {
  const players = contestantsOf(view);
  return (
    <Centered emoji="🎉" title="You're in!">
      <p>Watch the TV. The host will start when everyone's here.</p>
      <div className="flex flex-wrap justify-center gap-3 mt-5 text-base">
        {players.map((p) => (
          <Avatar key={p.id} player={p} size={2.6} showName className="animate-pop-in" />
        ))}
      </div>
      <p className="mt-5 text-sm text-cream/70">
        {MODE_INFO[view.settings.mode].emoji} {MODE_INFO[view.settings.mode].label}: {MODE_INFO[view.settings.mode].rule}
      </p>
    </Centered>
  );
}

// ---------------------------------------------------------------------------
// Guessing
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function Guessing({ view, me }: { view: GameView; me: MeView }) {
  const q = view.question!;
  const rules = { precision: q.precision, allowNegative: q.allowNegative };
  const [text, setText] = useState(() => (me.guess !== null ? numberToPlainString(me.guess) : ''));
  const [save, setSave] = useState<SaveState>(me.guess !== null ? 'saved' : 'idle');
  const [serverError, setServerError] = useState<string | null>(null);
  const [locking, setLocking] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  const parsed = text.trim() ? parseGuess(text, rules) : null;
  const localError = parsed && !parsed.ok ? parsed.message : null;

  useEffect(() => () => {
    if (debounce.current) clearTimeout(debounce.current);
  }, []);

  // Save a valid draft shortly after typing stops, so the timer can never eat a guess.
  function scheduleDraft(next: string) {
    if (debounce.current) clearTimeout(debounce.current);
    const p = next.trim() ? parseGuess(next, rules) : null;
    if (!p?.ok) {
      setSave('idle');
      return;
    }
    setSave('saving');
    const mine = ++seq.current;
    debounce.current = setTimeout(async () => {
      const res = await requestWithError({ type: 'guess', value: next, lock: false });
      if (mine !== seq.current) return;
      if (res.ok) {
        setSave('saved');
        setServerError(null);
      } else {
        setSave('error');
        setServerError(res.message);
      }
    }, 450);
  }

  async function lock(e: FormEvent) {
    e.preventDefault();
    if (!parsed?.ok) return;
    if (debounce.current) clearTimeout(debounce.current);
    seq.current++;
    setLocking(true);
    const res = await requestWithError({ type: 'guess', value: text, lock: true });
    setLocking(false);
    if (!res.ok) setServerError(res.message);
  }

  if (me.locked && me.guess !== null) {
    return (
      <div className="flex flex-col gap-4 animate-rise">
        <RoundTag view={view} />
        <TimerBar timer={view.timer} />
        <QuestionCard view={view} compact />
        <Centered emoji="🔒" title="Locked in!">
          Your guess: <b className="text-sun text-2xl" data-testid="locked-guess">{formatValue(me.guess, q.unit, q.precision)}</b>
          <div className="mt-3 text-base text-cream/70">
            {view.lockedIds.length} / {contestantsOf(view).length} players locked in
          </div>
        </Centered>
      </div>
    );
  }

  const prefix = q.unit === '$' ? '$' : null;
  const suffix = q.unit && q.unit !== '$' && q.unit !== 'year' ? q.unit : null;

  return (
    <form onSubmit={lock} className="flex flex-col gap-4 animate-rise" noValidate>
      <RoundTag view={view} />
      <TimerBar timer={view.timer} />
      <QuestionCard view={view} />
      <label className="flex flex-col gap-2">
        <span className="text-lg">
          Your guess{' '}
          <span className="text-cream/60 text-sm">
            {q.precision === 0 ? '(whole number)' : `(up to ${q.precision} decimal place${q.precision === 1 ? '' : 's'})`}
            {q.allowNegative ? ' · negatives OK' : ''}
          </span>
        </span>
        <div className="flex items-stretch gap-2">
          {q.allowNegative && (
            <button
              type="button"
              className="sticker rounded-2xl bg-white/10 px-4 text-2xl font-display font-bold"
              aria-label="Toggle negative"
              data-testid="toggle-sign"
              onClick={() => {
                const next = text.trim().startsWith('-') ? text.trim().slice(1) : `-${text.trim()}`;
                setText(next);
                scheduleDraft(next);
              }}
            >
              ±
            </button>
          )}
          <div className={`flex-1 flex items-center sticker rounded-2xl bg-cream text-ink px-4 focus-within:ring-4 ${localError ? 'ring-4 ring-tomato' : 'focus-within:ring-sky'}`}>
            {prefix && <span className="text-3xl font-display font-bold text-ink/60 mr-1">{prefix}</span>}
            <input
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setServerError(null);
                scheduleDraft(e.target.value);
              }}
              inputMode={q.allowNegative ? 'text' : 'decimal'}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              placeholder="0"
              aria-label="Your guess"
              aria-invalid={!!localError}
              maxLength={20}
              className="min-w-0 flex-1 bg-transparent text-4xl font-display font-bold py-3 outline-none focus-visible:outline-none placeholder:text-ink/25 tabular"
              data-testid="guess-input"
            />
            {suffix && <span className="text-lg text-ink/60 ml-2 shrink-0 max-w-[40%] truncate">{suffix}</span>}
          </div>
        </div>
      </label>
      <div className="min-h-[1.5rem] text-sm" aria-live="polite" data-testid="guess-status" data-save={save}>
        {localError ? (
          <span className="text-tomato" role="alert">{localError}</span>
        ) : serverError ? (
          <span className="text-tomato" role="alert">{serverError}</span>
        ) : save === 'saved' ? (
          <span className="text-mint">✓ Saved — counts when time runs out. Lock it in to finish early!</span>
        ) : save === 'saving' ? (
          <span className="text-cream/60">Saving…</span>
        ) : parsed?.ok ? (
          <span className="text-cream/80">That's {formatValue(parsed.value, q.unit, q.precision)}</span>
        ) : (
          <span className="text-cream/60">Type a number. You can change it until you lock it in.</span>
        )}
      </div>
      <Button type="submit" tone="pink" big disabled={!parsed?.ok || locking} data-testid="lock-guess">
        {locking ? 'Locking…' : '🔒 Lock it in'}
      </Button>
      <p className="text-center text-sm text-cream/70">{MODE_INFO[q.mode].rule}</p>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

function MyResult({ view, me }: { view: GameView; me: MeView }) {
  const q = view.question!;
  const reveal = view.reveal!;
  const r = reveal.results[me.playerId];
  const medal = r?.rank && r.placementPoints > 0 ? ['🥇', '🥈', '🥉'][r.rank - 1] : null;
  let emoji = '🤷';
  let title = 'No guess this time';
  if (r?.status === 'busted') {
    emoji = '💥';
    title = 'Bust! You went over.';
  } else if (r?.exact) {
    emoji = '🎯';
    title = 'EXACT! Bullseye!';
  } else if (r?.status === 'placed') {
    emoji = medal ?? '🎉';
    title = r.rank === 1 ? 'Closest! You win the round!' : `${r.rank === 2 ? '2nd' : '3rd'} place!`;
  } else if (r?.status === 'unplaced') {
    emoji = '😅';
    title = 'Not quite close enough';
  }
  return (
    <div className="flex flex-col gap-4 animate-rise" data-testid="my-result" data-status={r?.status} data-points={r?.total ?? 0}>
      <RoundTag view={view} />
      <div className="sticker rounded-3xl bg-sun text-ink p-4 text-center">
        <div className="text-sm uppercase tracking-wider">The answer</div>
        <div className="font-display font-bold text-4xl tabular" data-testid="answer">
          {formatValue(reveal.answer, q.unit, q.precision)}
        </div>
      </div>
      <Centered emoji={emoji} title={title}>
        {r && r.guess !== null && (
          <div>
            You guessed <b className="text-sun">{formatValue(r.guess, q.unit, q.precision)}</b>
            {r.signedDiff !== null && r.signedDiff !== 0 && <span className="text-cream/70"> ({formatSignedDiff(r.signedDiff, q.unit, q.precision)})</span>}
          </div>
        )}
        <div className="mt-3 font-display font-bold text-4xl text-mint tabular" data-testid="round-points">
          +{(r?.total ?? 0).toLocaleString('en-US')}
        </div>
        {r?.exact && <div className="text-pink">includes +250 exact bonus</div>}
        {reveal.everyoneBusted && <div className="mt-2 text-tomato">Everyone went over — nobody scores!</div>}
      </Centered>
      {reveal.fact && <p className="text-center text-sm text-cream/70">🤓 {reveal.fact}</p>}
    </div>
  );
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function MyStanding({ view, me }: { view: GameView; me: MeView }) {
  const row = view.standings.find((r) => r.playerId === me.playerId);
  const players = usePlayerMap(view);
  const leader = view.standings[0];
  return (
    <Centered emoji={row?.rank === 1 ? '👑' : '📊'} title={row ? `You're ${ordinal(row.rank)}!` : 'Scoreboard'}>
      <div data-testid="my-rank" data-rank={row?.rank}>
        {row && (
          <>
            <b className="text-sun text-2xl">{row.score.toLocaleString('en-US')}</b> points
            {row.delta > 0 && <span className="text-mint"> (+{row.delta.toLocaleString('en-US')} this round)</span>}
          </>
        )}
      </div>
      {leader && leader.playerId !== me.playerId && (
        <div className="mt-2 text-base text-cream/70">
          Leader: {players.get(leader.playerId)?.name} with {leader.score.toLocaleString('en-US')}
        </div>
      )}
      <div className="mt-4 text-base text-cream/70">Look at the TV for the full scoreboard.</div>
      <p className="mt-2 text-base text-cream/70">{view.round >= view.totalRounds ? 'Final results in…' : 'Next question in…'}</p>
      <div className="w-64 mt-1" data-testid="next-countdown">
        <TimerBar timer={view.timer} />
      </div>
    </Centered>
  );
}

function GameOver({ view, me }: { view: GameView; me: MeView }) {
  const players = usePlayerMap(view);
  const row = view.standings.find((r) => r.playerId === me.playerId);
  const winners = view.standings.filter((r) => r.rank === 1).map((r) => players.get(r.playerId)?.name);
  const st = view.stats?.players.find((p) => p.playerId === me.playerId);
  const won = row?.rank === 1;
  return (
    <Centered emoji={won ? '🏆' : '🎉'} title={won ? 'You won!' : `You finished ${row ? ordinal(row.rank) : ''}`}>
      <div data-testid="final-score">
        Final score: <b className="text-sun">{(row?.score ?? 0).toLocaleString('en-US')}</b>
      </div>
      {!won && <div className="mt-1">Winner: {winners.join(' & ')}</div>}
      {st && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
          <Stat label="Round wins" value={st.firstPlaces} />
          <Stat label="Exact hits" value={st.exactHits} />
          <Stat label="Busts" value={st.busts} />
        </div>
      )}
      <div className="mt-4 text-base text-cream/70">Stay here — the host can start a rematch!</div>
    </Centered>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-2 py-2">
      <div className="font-display font-bold text-2xl text-sun">{value}</div>
      <div className="text-cream/70">{label}</div>
    </div>
  );
}
