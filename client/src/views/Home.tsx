import { useState, type FormEvent } from 'react';
import { POINTS, ROOM_CODE_LENGTH, ROOM_CODE_PATTERN } from '../../../shared/protocol';
import { Button } from '../components/Button';
import { Logo } from '../components/Logo';
import { createRoom, roomExists } from '../net/api';
import { hostTokenKey, storage } from '../lib/storage';
import { navigate } from '../router';

export function Home({ initialCode }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? '');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'host' | 'join' | null>(null);
  const [hostError, setHostError] = useState<string | null>(null);

  async function host() {
    setBusy('host');
    setHostError(null);
    try {
      const room = await createRoom();
      storage.set(hostTokenKey(room.code), room.hostToken);
      navigate(`/host/${room.code}`);
    } catch (err) {
      setHostError(err instanceof Error ? err.message : 'Could not reach the game server.');
    } finally {
      setBusy(null);
    }
  }

  async function join(e: FormEvent) {
    e.preventDefault();
    const clean = code.toUpperCase().replace(/[^A-Z]/g, '');
    if (!ROOM_CODE_PATTERN.test(clean)) {
      setJoinError(`Room codes are ${ROOM_CODE_LENGTH} letters — check the TV!`);
      return;
    }
    setBusy('join');
    setJoinError(null);
    try {
      if (await roomExists(clean)) navigate(`/play/${clean}`);
      else setJoinError(`No game found with code ${clean}.`);
    } catch {
      setJoinError('Could not reach the game server.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="min-h-dvh bg-arena bg-rings flex flex-col items-center px-4 py-10 gap-10">
      <Logo className="text-5xl sm:text-7xl animate-pop-in" />
      <p className="text-center text-lg sm:text-xl max-w-xl text-cream/90">
        How tall? How many? How much? Nobody knows exactly — so get <span className="text-sun">closer than your family</span> and win.
      </p>

      <div className="grid gap-6 w-full max-w-3xl md:grid-cols-2">
        <form onSubmit={join} className="sticker rounded-3xl bg-plum p-6 flex flex-col gap-4 animate-rise" aria-labelledby="join-h">
          <h2 id="join-h" className="font-display font-bold text-2xl text-sun">
            📱 Join a game
          </h2>
          <label className="flex flex-col gap-2 text-base">
            Room code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, ROOM_CODE_LENGTH))}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              placeholder="ABCD"
              aria-label="Room code"
              className="sticker rounded-2xl bg-cream text-ink font-display font-bold text-4xl tracking-[0.3em] text-center py-3 uppercase placeholder:text-ink/25"
            />
          </label>
          {joinError && (
            <p className="text-tomato bg-black/30 rounded-xl px-3 py-2" role="alert">
              {joinError}
            </p>
          )}
          <Button type="submit" tone="sun" big disabled={busy !== null}>
            {busy === 'join' ? 'Checking…' : 'Join'}
          </Button>
        </form>

        <section className="sticker rounded-3xl bg-night p-6 flex flex-col gap-4 animate-rise [animation-delay:120ms]" aria-labelledby="host-h">
          <h2 id="host-h" className="font-display font-bold text-2xl text-pink">
            📺 Host a game
          </h2>
          <p className="text-cream/80 text-base">
            Use a computer. You'll get a host control panel and a TV display you can cast to the big screen. Everyone else joins on
            their phones — 2 to 10 players.
          </p>
          {hostError && (
            <p className="text-tomato bg-black/30 rounded-xl px-3 py-2" role="alert">
              {hostError}
            </p>
          )}
          <Button tone="pink" big onClick={host} disabled={busy !== null} className="mt-auto">
            {busy === 'host' ? 'Setting up…' : 'Create game'}
          </Button>
        </section>
      </div>

      <section className="w-full max-w-3xl grid gap-3 sm:grid-cols-3 text-center" aria-label="How to play">
        {[
          ['❓', 'Read', 'A number question pops up on the TV: a price, a height, a year, a record…'],
          ['🔢', 'Guess', 'Type your guess on your phone and lock it in. Nobody sees it until time is up.'],
          [
            '🏆',
            'Score',
            `Closest gets ${POINTS.placements[0].toLocaleString('en-US')}, then ${POINTS.placements[1]} and ${POINTS.placements[2]}. Exact = +${POINTS.exactBonus}! In "Without Going Over", going over = 0.`,
          ],
        ].map(([emoji, title, text]) => (
          <div key={title} className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="text-4xl" aria-hidden="true">
              {emoji}
            </div>
            <div className="font-display font-bold text-sun text-lg mt-1">{title}</div>
            <p className="text-sm text-cream/80 mt-1">{text}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
