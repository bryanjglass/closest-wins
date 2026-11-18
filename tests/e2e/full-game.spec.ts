import { devices, expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { QUESTIONS, type Question } from '../../server/questions';

/**
 * End-to-end: a host, a TV display and four phones play complete games against
 * the real Worker + Durable Object (wrangler dev). The test knows the answers
 * by looking up the question id that the TV shows — browsers never get them.
 */

const PHONE = { ...devices['Pixel 7'] };
const byId = new Map(QUESTIONS.map((q) => [q.id, q]));

interface Seat {
  name: string;
  ctx: BrowserContext;
  page: Page;
  frames: string[];
}

async function createGame(page: Page): Promise<string> {
  await page.goto('/');
  await page.getByRole('button', { name: 'Create game' }).click();
  const code = (await page.getByTestId('room-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z]{4}$/);
  return code;
}

async function joinPlayer(browser: Browser, code: string, name: string, avatarIndex: number): Promise<Seat> {
  const ctx = await browser.newContext(PHONE);
  const page = await ctx.newPage();
  const frames: string[] = [];
  page.on('websocket', (ws) => ws.on('framereceived', (f) => frames.push(String(f.payload))));
  await page.goto(`/#/play/${code}`);
  await page.getByLabel('Your name').fill(name);
  await page.getByTestId('avatar-option').nth(avatarIndex).click();
  await page.getByTestId('join-button').click();
  await expect(page.getByTestId('my-name')).toHaveText(name);
  return { name, ctx, page, frames };
}

const tvPhase = (tv: Page, phase: string, timeout?: number) =>
  expect(tv.getByTestId('tv')).toHaveAttribute('data-phase', phase, timeout ? { timeout } : undefined);

async function currentQuestion(tv: Page): Promise<Question> {
  const id = await tv.getByTestId('tv').getAttribute('data-question-id');
  const q = byId.get(id!);
  expect(q, `question ${id}`).toBeTruthy();
  return q!;
}

/** answer + k steps at the question's precision, as a string a person would type. */
function offset(q: Question, steps: number): string {
  const step = 10 ** -q.precision;
  return (q.answer + steps * step).toFixed(q.precision);
}

async function lockGuess(seat: Seat, value: string) {
  await seat.page.getByTestId('guess-input').fill(value);
  await seat.page.getByTestId('lock-guess').click();
  // The last player to lock ends the round at once, so they may go straight to the reveal.
  await expect(seat.page.getByTestId('locked-guess').or(seat.page.getByTestId('my-final-guess'))).toBeVisible();
}

async function draftGuess(seat: Seat, value: string) {
  await seat.page.getByTestId('guess-input').fill(value);
  await expect(seat.page.getByTestId('guess-status')).toHaveAttribute('data-save', 'saved');
}

async function hostNext(host: Page) {
  await host.getByTestId('host-next').click();
}

/**
 * Presses the host's Next button only if the game is still in `phase` (timed
 * phases also advance on their own). The click carries the phase it was meant
 * for, so a late click is rejected by the server instead of skipping ahead.
 */
async function hostNextFrom(host: Page, phase: string) {
  const current = await host.getByTestId('host-phase').getAttribute('data-phase');
  if (current === phase) await hostNext(host);
}

async function expectScores(tv: Page, seats: Seat[], expected: Record<string, number>) {
  for (const s of seats) {
    if (s.page.isClosed()) continue;
    await expect(s.page.getByTestId('my-score')).toHaveText(expected[s.name]!.toLocaleString('en-US'));
  }
  if ((await tv.getByTestId('tv').getAttribute('data-phase')) === 'scoreboard') {
    for (const [name, score] of Object.entries(expected)) {
      await expect(tv.locator(`[data-testid="leaderboard-row"][data-player="${name}"]`)).toHaveAttribute('data-score', String(score));
    }
  }
}

/** Moves from the question intro into guessing via the host's button. */
async function openGuessing(host: Page, tv: Page, round: number) {
  await tvPhase(tv, 'question');
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-round', String(round));
  await hostNextFrom(host, 'question');
  await tvPhase(tv, 'guessing');
}

/** Guess reveal → answer reveal → scoreboard, checking the reveal order on the way. */
async function revealAndScore(host: Page, tv: Page, q: Question) {
  await tvPhase(tv, 'guessReveal');
  // Guesses are shown before the answer.
  await expect(tv.getByTestId('number-line').or(tv.getByTestId('tv-no-guesses'))).toBeVisible();
  await expect(tv.getByTestId('tv-answer')).toHaveCount(0);
  await expect(tv.getByTestId('line-answer')).toHaveCount(0);
  await hostNextFrom(host, 'guessReveal');
  await tvPhase(tv, 'answerReveal');
  await expect(tv.getByTestId('tv-answer')).toBeVisible();
  await expect(host.getByTestId('host-answer')).toBeVisible();
  void q;
}

function checkSecrecy(frames: string[]) {
  let checked = 0;
  for (const raw of frames) {
    const msg = JSON.parse(raw);
    if (msg.type !== 'state') continue;
    const s = msg.state;
    if (['question', 'guessing', 'guessReveal'].includes(s.phase)) {
      checked++;
      expect(s.reveal).toBeNull();
      expect(raw).not.toMatch(/"answer"\s*:/);
      expect(raw).not.toMatch(/"results"\s*:/);
      expect(raw).not.toMatch(/"fact"\s*:/);
      expect(raw).not.toMatch(/token/i);
      if (s.phase !== 'guessReveal') expect(s.guesses).toBeNull();
    }
  }
  expect(checked).toBeGreaterThan(10);
}

test('host, TV and four players: both modes, ties, exact bonus, busts, timeouts, refresh, game over and rematch', async ({ browser }) => {
  test.setTimeout(300_000);
  const desk = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await desk.newPage();
  const code = await createGame(host);

  // The TV opens from the host controller in a separate tab, sized for 1080p.
  const [tv] = await Promise.all([desk.waitForEvent('page'), host.getByTestId('open-tv').click()]);
  await tv.setViewportSize({ width: 1920, height: 1080 });
  await expect(tv.getByTestId('tv-room-code')).toHaveText(code);
  await expect(tv.locator('[data-qr-value]')).toHaveAttribute('data-qr-value', new RegExp(`#/play/${code}$`));
  await expect(host.getByTestId('start-game')).toBeDisabled();

  const ann = await joinPlayer(browser, code, 'Ann', 3);
  const ben = await joinPlayer(browser, code, 'Ben', 5);

  // Unique names (case-insensitive).
  const dupeCtx = await browser.newContext(PHONE);
  const dupe = await dupeCtx.newPage();
  await dupe.goto(`/#/play/${code}`);
  await dupe.getByLabel('Your name').fill('ANN');
  await dupe.getByTestId('join-button').click();
  await expect(dupe.getByRole('alert')).toContainText('already called');
  await dupeCtx.close();

  const cat = await joinPlayer(browser, code, 'Cat', 7);
  const dan = await joinPlayer(browser, code, 'Dan', 9);
  const seats = [ann, ben, cat, dan];

  // Lobby updates live on the TV, with the chosen avatars.
  await expect(tv.getByTestId('tv-player-count')).toHaveText('4');
  for (const s of seats) await expect(tv.getByTestId('tv-players')).toContainText(s.name);
  for (const s of seats) {
    const overflow = await s.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  }

  // Settings: Mixed (default), 5 questions, 15-second timer.
  await expect(host.getByTestId('mode-mixed')).toHaveAttribute('aria-pressed', 'true');
  await host.getByTestId('questions-5').click();
  await host.getByTestId('timer-15').click();
  await expect(host.getByTestId('timer-15')).toHaveAttribute('aria-pressed', 'true');
  await expect(tv.getByTestId('tv-settings')).toContainText('5 questions');
  await host.getByTestId('start-game').click();

  const expected: Record<string, number> = { Ann: 0, Ben: 0, Cat: 0, Dan: 0 };
  const add = (pts: Record<string, number>) => {
    for (const [k, v] of Object.entries(pts)) expected[k]! += v;
  };
  const playedIds: string[] = [];

  // ---------------------------------------------------------------- Round 1
  // Closest Overall: exact answer + a tie for 2nd; Dan never guesses → timeout.
  await openGuessing(host, tv, 1);
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-mode', 'closest');
  let q = await currentQuestion(tv);
  playedIds.push(q.id);
  await expect(tv.getByTestId('tv-locked-count')).toContainText('0/4');
  await lockGuess(ann, offset(q, 0));
  await lockGuess(ben, offset(q, -1));
  await lockGuess(cat, offset(q, 1));
  await expect(tv.getByTestId('tv-locked-count')).toContainText('3/4');
  // Guesses are secret: the TV shows who locked, not what.
  await expect(tv.getByTestId('tv-guess-card')).toHaveCount(0);
  await expect(tv.getByTestId('number-line')).toHaveCount(0);
  await expect(tv.locator('[data-testid="tv-avatar"][data-locked="true"]')).toHaveCount(3);
  // Timer (15 s) expires on its own.
  await tvPhase(tv, 'guessReveal', 25_000);
  await revealAndScore(host, tv, q);
  await expect(ann.page.getByTestId('my-result')).toHaveAttribute('data-points', '1250');
  await expect(dan.page.getByTestId('my-result')).toHaveAttribute('data-status', 'missing');
  await expect(tv.locator('[data-testid="tv-result"][data-player="Ben"]')).toHaveAttribute('data-points', '500');
  await expect(tv.locator('[data-testid="tv-result"][data-player="Cat"]')).toHaveAttribute('data-points', '500');
  add({ Ann: 1250, Ben: 500, Cat: 500, Dan: 0 });
  await hostNextFrom(host, 'answerReveal');
  await tvPhase(tv, 'scoreboard');
  await expectScores(tv, seats, expected);
  await hostNext(host);

  // ---------------------------------------------------------------- Round 2
  // Without Going Over: everyone goes over → nobody scores. All lock → auto-advance.
  await openGuessing(host, tv, 2);
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-mode', 'withoutGoingOver');
  q = await currentQuestion(tv);
  playedIds.push(q.id);
  await lockGuess(ann, offset(q, 1));
  await lockGuess(ben, offset(q, 2));
  await lockGuess(cat, offset(q, 3));
  await lockGuess(dan, offset(q, 4));
  await revealAndScore(host, tv, q);
  await expect(tv.getByTestId('tv-everyone-busted')).toBeVisible();
  for (const s of seats) await expect(s.page.getByTestId('my-result')).toHaveAttribute('data-status', 'busted');
  await hostNextFrom(host, 'answerReveal');
  await tvPhase(tv, 'scoreboard');
  await expectScores(tv, seats, expected);
  await hostNext(host);

  // ---------------------------------------------------------------- Round 3
  // Closest: Ann saves a draft, refreshes her phone, never locks → the draft counts at timeout.
  // The host and the TV also refresh mid-round. Cat and Dan tie for 3rd with the same guess.
  await openGuessing(host, tv, 3);
  q = await currentQuestion(tv);
  playedIds.push(q.id);
  await draftGuess(ann, offset(q, 2));
  await ann.page.reload();
  await expect(ann.page.getByTestId('my-name')).toHaveText('Ann');
  await expect(ann.page.getByTestId('guess-input')).toHaveValue(String(Number(offset(q, 2))));
  await lockGuess(ben, offset(q, -1));
  await host.reload();
  await expect(host.getByTestId('host-phase')).toHaveAttribute('data-phase', 'guessing');
  await expect(host.getByTestId('host-progress')).toContainText('1 / 4');
  await tv.reload();
  await tvPhase(tv, 'guessing');
  await expect(tv.getByTestId('tv-locked-count')).toContainText('1/4');
  await lockGuess(cat, offset(q, 5));
  await lockGuess(dan, offset(q, 5));
  await tvPhase(tv, 'guessReveal', 25_000);
  // Identical guesses share one marker on the number line.
  await expect(tv.locator(`[data-testid="line-marker"][data-value="${Number(offset(q, 5))}"]`)).toHaveCount(1);
  await revealAndScore(host, tv, q);
  add({ Ann: 500, Ben: 1000, Cat: 250, Dan: 250 });
  await hostNextFrom(host, 'answerReveal');
  await tvPhase(tv, 'scoreboard');
  await expectScores(tv, seats, expected);
  await hostNext(host);

  // ---------------------------------------------------------------- Round 4
  // Without Going Over: exact answer, one bust, a tie for 2nd.
  await openGuessing(host, tv, 4);
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-mode', 'withoutGoingOver');
  q = await currentQuestion(tv);
  playedIds.push(q.id);
  await lockGuess(ann, offset(q, 0));
  await lockGuess(ben, offset(q, 1));
  await lockGuess(cat, offset(q, -1));
  await lockGuess(dan, offset(q, -1));
  await revealAndScore(host, tv, q);
  await expect(ben.page.getByTestId('my-result')).toHaveAttribute('data-status', 'busted');
  add({ Ann: 1250, Ben: 0, Cat: 500, Dan: 500 });
  await hostNextFrom(host, 'answerReveal');
  await tvPhase(tv, 'scoreboard');
  await expectScores(tv, seats, expected);
  await hostNext(host);

  // ---------------------------------------------------------------- Round 5
  // Closest: Dan's phone goes away — he must not block the others. Ann & Ben tie for 1st.
  await openGuessing(host, tv, 5);
  q = await currentQuestion(tv);
  playedIds.push(q.id);
  await dan.page.goto('about:blank');
  await lockGuess(ann, offset(q, 4));
  await lockGuess(ben, offset(q, 4));
  await lockGuess(cat, offset(q, 10));
  await revealAndScore(host, tv, q);
  add({ Ann: 1000, Ben: 1000, Cat: 250, Dan: 0 });
  await hostNextFrom(host, 'answerReveal');
  await tvPhase(tv, 'scoreboard');
  // Dan reconnects with his stored credentials and keeps his seat and score.
  await dan.page.goto(`/#/play/${code}`);
  await expect(dan.page.getByTestId('my-name')).toHaveText('Dan');
  await expectScores(tv, seats, expected);
  expect(expected).toEqual({ Ann: 4000, Ben: 2500, Cat: 1500, Dan: 750 });

  // ---------------------------------------------------------------- Game over
  await hostNext(host);
  await tvPhase(tv, 'gameOver');
  await expect(tv.getByTestId('tv-winner-name')).toHaveText('Ann');
  await expect(host.getByTestId('host-winner')).toContainText('Ann');
  for (const [name, score] of Object.entries(expected)) {
    await expect(tv.locator(`[data-testid="tv-final-row"][data-player="${name}"]`)).toHaveAttribute('data-score', String(score));
  }
  await expect(tv.locator('[data-testid="tv-final-row"][data-player="Ann"]')).toHaveAttribute('data-rank', '1');
  await expect(tv.getByTestId('tv-awards')).toContainText('Bullseye');
  await expect(ann.page.getByTestId('final-score')).toContainText('4,000');
  expect(new Set(playedIds).size).toBe(5);

  // No answers, results or tokens leaked to a phone before the reveal.
  checkSecrecy(ben.frames);

  // ---------------------------------------------------------------- Rematch
  await host.getByTestId('host-rematch').click();
  await tvPhase(tv, 'lobby');
  await expect(tv.getByTestId('tv-player-count')).toHaveText('4');
  for (const s of seats) await expect(s.page.getByTestId('my-score')).toHaveText('0');
  await host.getByTestId('start-game').click();
  await tvPhase(tv, 'question');
  const fresh = await currentQuestion(tv);
  expect(playedIds).not.toContain(fresh.id);
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-round', '1');

  for (const s of seats) await s.ctx.close();
  await desk.close();
});

test('pause/resume, skip, number validation, reduced motion and unauthorized clients', async ({ browser }) => {
  test.setTimeout(120_000);
  const desk = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await desk.newPage();
  const code = await createGame(host);
  const tvCtx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const tv = await tvCtx.newPage();
  await tv.goto(`/#/tv/${code}`);
  await expect(tv.getByTestId('tv-room-code')).toHaveText(code);

  const ann = await joinPlayer(browser, code, 'Ann', 0);
  const ben = await joinPlayer(browser, code, 'Ben', 1);

  // Only prices: currency guesses with cents.
  for (const c of ['animals', 'sports', 'entertainment', 'weird', 'geography']) {
    await host.getByTestId(`category-${c}`).click();
    await expect(host.getByTestId(`category-${c}`)).toHaveAttribute('aria-pressed', 'false');
  }
  await host.getByTestId('mode-closest').click();
  await host.getByTestId('questions-5').click();
  await host.getByTestId('start-game').click();
  await tvPhase(tv, 'question');
  const first = await currentQuestion(tv);
  expect(first.category).toBe('prices');

  // Skip replaces the question.
  await host.getByTestId('host-skip').click();
  await expect(tv.getByTestId('tv')).not.toHaveAttribute('data-question-id', first.id);
  await tvPhase(tv, 'question');
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-round', '1');
  await hostNext(host);
  await tvPhase(tv, 'guessing');
  const q = await currentQuestion(tv);
  expect(q.id).not.toBe(first.id);

  // Number validation on the phone (the server enforces the same rules).
  const input = ann.page.getByTestId('guess-input');
  const lock = ann.page.getByTestId('lock-guess');
  for (const bad of ['abc', 'NaN', 'Infinity', '1e5', '-5', '3.999']) {
    await input.fill(bad);
    await expect(ann.page.getByTestId('guess-status')).toContainText(/number|negative|decimal/i);
    await expect(lock).toBeDisabled();
  }
  await input.fill(`$${q.answer.toFixed(2)}`);
  await expect(lock).toBeEnabled();

  // Pause freezes the round everywhere.
  await host.getByTestId('host-pause').click();
  await expect(tv.getByTestId('tv-paused')).toBeVisible();
  await expect(ann.page.getByText('PAUSED', { exact: true })).toBeVisible();
  await expect(host.getByTestId('host-next')).toBeDisabled();
  await host.waitForTimeout(1500);
  await tvPhase(tv, 'guessing');
  await host.getByTestId('host-resume').click();
  await expect(tv.getByTestId('tv-paused')).toHaveCount(0);

  await lock.click();
  await expect(ann.page.getByTestId('locked-guess')).toBeVisible();
  await lockGuess(ben, offset(q, 1));
  await tvPhase(tv, 'guessReveal');
  await hostNextFrom(host, 'guessReveal');
  await tvPhase(tv, 'answerReveal');
  await expect(ann.page.getByTestId('my-result')).toHaveAttribute('data-points', '1250');
  await expect(ben.page.getByTestId('my-result')).toHaveAttribute('data-points', '500');

  // Reduced motion can be switched on from any screen.
  await tv.getByRole('button', { name: /Motion/ }).click({ force: true });
  await expect(tv.locator('html')).toHaveClass(/reduce-motion/);

  // Unauthorized clients cannot control the game or guess for anyone.
  const results = await ben.page.evaluate(async (roomCode) => {
    const url = `${location.origin.replace(/^http/, 'ws')}/api/rooms/${roomCode}/ws`;
    const collect = (hello: object, msgs: object[]) =>
      new Promise<{ errors: string[]; closeCode: number | null }>((resolve) => {
        const ws = new WebSocket(url);
        const errors: string[] = [];
        let closeCode: number | null = null;
        ws.onopen = () => {
          ws.send(JSON.stringify(hello));
          for (const m of msgs) ws.send(JSON.stringify(m));
        };
        ws.onmessage = (e) => {
          const m = JSON.parse(String(e.data));
          if (m.type === 'error') errors.push(m.code);
        };
        ws.onclose = (e) => (closeCode = e.code);
        setTimeout(() => {
          ws.close();
          resolve({ errors, closeCode });
        }, 1500);
      });
    return {
      fakeHost: await collect({ type: 'hello', role: 'host', hostToken: 'not-the-token' }, []),
      player: await collect({ type: 'hello', role: 'player' }, [
        { type: 'host', action: { kind: 'advance' }, requestId: 'a' },
        { type: 'host', action: { kind: 'restart' }, requestId: 'b' },
        { type: 'guess', value: 1, lock: true, requestId: 'c' },
      ]),
      display: await collect({ type: 'hello', role: 'display' }, [{ type: 'host', action: { kind: 'pause' }, requestId: 'd' }]),
    };
  }, code);
  expect(results.fakeHost.errors).toContain('NOT_AUTHORIZED');
  expect(results.fakeHost.closeCode).toBe(4003);
  expect(results.player.errors).toEqual(['NOT_AUTHORIZED', 'NOT_AUTHORIZED', 'NOT_JOINED']);
  expect(results.display.errors).toEqual(['NOT_AUTHORIZED']);
  // Nothing they sent changed the game (a restart would have gone back to the lobby).
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-phase', /answerReveal|scoreboard/);

  // A different browser can't take over the host controls.
  const intruderCtx = await browser.newContext();
  const intruder = await intruderCtx.newPage();
  await intruder.goto(`/#/host/${code}`);
  await expect(intruder.getByText("This browser isn't the host")).toBeVisible();

  // Unknown rooms are reported, and independent rooms don't see each other.
  await intruder.goto(`/#/play/ZZZZ`);
  await expect(intruder.getByText('No game called ZZZZ')).toBeVisible();
  const other = await desk.newPage();
  const otherCode = await createGame(other);
  expect(otherCode).not.toBe(code);
  await expect(other.getByTestId('host-players')).not.toContainText('Ann');
  await expect(tv.getByTestId('tv')).toHaveAttribute('data-phase', /answerReveal|scoreboard/);

  await intruderCtx.close();
  await tvCtx.close();
  await ann.ctx.close();
  await ben.ctx.close();
  await desk.close();
});
