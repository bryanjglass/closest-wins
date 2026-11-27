# Closest Wins 🎯

A browser-based family party game for 2–10 players (ages 9 to adult). Everyone sees a numerical trivia
question — a price, a height, a year, a record — and secretly types a guess on their phone. Closest guess wins.

- **Host controller**: a desktop Chrome tab that creates the game and runs it.
- **TV display**: a second tab you cast to the television. Lobby QR code, questions, countdowns, the number line, reveals and scores.
- **Players**: everyone's phones. No app, no account — scan the QR code or type the 4-letter room code.

The multiplayer infrastructure (Worker + Durable Object room server, hibernating WebSockets, reconnecting
client, alarm-driven timers) is reused from **Fib Factory** and adapted for this game.

---

## How to play

1. **Host:** open the site on a computer and click **Create game**. Click **Open TV display**, then cast that tab
   (Chrome menu **⋮ → Cast… → Cast tab**).
2. **Players:** scan the QR code on the TV (or enter the room code), type a name and pick an avatar.
   The host can join too, from their phone.
3. **Host:** choose the scoring mode, 5/10/15/20 questions, the categories and a 15/30/45/60-second timer, then **Start game**.
   From here the game runs itself to the final results. Every step advances on a timer, and the host only needs to
   touch the controller to **pause** (or to skip ahead).
4. Each round:
   1. **Question** — the TV shows the question, its unit and how this round is scored.
   2. **Guessing** — type a number on your phone. It saves automatically and you can change it until you press
      **Lock it in**. Guesses stay hidden. The round ends when everyone connected has locked in or time runs out
      (your last saved guess counts).
   3. **Guess reveal** — every guess appears on an animated number line. No answer yet!
   4. **Answer reveal** — the answer drops onto the line, with each player's difference, the winners and any busts.
   5. **Scoreboard** — points are awarded and the leaderboard slides into its new order. It counts down for
      10 seconds, then the next question starts automatically.
5. After the last question the TV crowns the winner, with final standings, stats and awards. The host can start a
   **rematch**: same players, scores reset, fresh questions.

### Game modes

| Mode | Rule |
| --- | --- |
| 🎯 **Closest Overall** | Smallest absolute difference wins, over or under. |
| 🚫 **Without Going Over** | Highest guess that does **not** exceed the answer wins. Over = bust = 0 points. If everyone goes over, nobody scores. |
| 🔀 **Mixed** (default) | Rounds alternate: Closest, Without Going Over, Closest, … |

### Scoring

| Placement | Points |
| --- | --- |
| 1st | 1,000 |
| 2nd | 500 |
| 3rd | 250 |
| Everyone else | 0 |
| Exact answer | +250 bonus |

- Ties share a placement and its points, with competition ranking: two players tied for 1st both get 1,000 and the
  next player is 3rd (250).
- In Without Going Over only guesses at or under the answer are ranked; busts get 0 and don't take a placement.
- No guess = 0 points.
- The server scores each round exactly once (guarded by a `scored` flag). Differences are computed on integers
  scaled to the question's precision, so `0.1` vs `0.5` around `0.3` is an exact tie and money is exact to the cent.

---

## Architecture

```
┌──────────────┐   ┌──────────────┐   ┌───────────────┐
│ Host (Chrome)│   │  TV (Chrome) │   │ Phones (2–10) │     React + TypeScript + Zustand + Tailwind
└──────┬───────┘   └──────┬───────┘   └──────┬────────┘     static site on GitHub Pages
       │  WebSocket: typed JSON actions in, per-viewer redacted snapshots out
       └──────────────────┼──────────────────┘
                 ┌────────▼──────────┐
                 │ Cloudflare Worker │  POST /api/rooms · GET /api/rooms/:code · /ws upgrade
                 └────────┬──────────┘
                 ┌────────▼──────────────────────────────────┐
                 │ Durable Object "RoomObject" (one per room) │  authoritative state, timers (alarms),
                 │  RoomController → pure game engine         │  persistence, WebSocket hibernation
                 └───────────────────────────────────────────┘
```

| Path | Contents |
| --- | --- |
| `shared/` | Wire protocol and constants (`protocol.ts`), number parsing/exact arithmetic/formatting (`numbers.ts`), number-line layout (`numberLine.ts`), player palette. Browser-safe — no answers. |
| `server/engine/` | Pure game logic: `game.ts` (state machine, question selection, guesses, skip, pause), `scoring.ts`, `standings.ts` (ranks, stats, awards), `views.ts` (the single place that decides what each viewer may see). |
| `server/room/` | `controller.ts` — message handling, auth, presence, persistence and alarms against small interfaces; `durable-object.ts` — the thin Cloudflare adapter. |
| `server/questions.ts`, `server/moreQuestions/` | The question bank: 116 hand-written core questions plus 500 more in a compact row format (616 total). **Server-only.** |
| `server/index.ts` | Worker routes, room-code allocation, CORS/origin allow-list. |
| `client/` | Vite + React app: `views/host`, `views/tv`, `views/player`, `components/NumberLine.tsx`, `components/Leaderboard.tsx`, `net/connection.ts` (self-healing socket), `store.ts` (Zustand). |
| `tests/` | `unit/` and `integration/` (Vitest), `e2e/` (Playwright). |

### State machine

```
lobby → question → guessing → guessReveal → answerReveal → scoreboard ─┬→ question (next round)
  ▲                                                                     └→ gameOver ── rematch ─┐
  └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

- Legal transitions are declared in `TRANSITIONS` (`server/engine/game.ts`); anything else is rejected with `INVALID_TRANSITION`.
- **Every in-game phase is timed by the server**, so after **Start** a game plays to `gameOver` with no host input:
  `question` (5 s), `guessing` (host-configured), `guessReveal` (7 s), `answerReveal` (10 s) and `scoreboard` (10 s).
  Guessing also ends early once every *connected* contestant has locked in. All fixed durations live in `TIMING`
  in `shared/protocol.ts`.
- The host can still **pause/resume** any phase (including the scoreboard, to linger), press **Next** to move on
  early, or return to the lobby. `gameOver` waits for the host to start a rematch.
- Every host **Next**/**Skip** carries the phase and round it was meant for. A double-click or a retried message
  that arrives after the game moved on is rejected (`STALE_ACTION`) instead of skipping ahead.
- **Skip question** (during the intro or guessing) swaps in an unused question for the same round; skipped questions
  never return in that game. **Pause** freezes the timer everywhere and blocks guesses; **Resume** restores the remaining time.

### Secrecy and authorization

- Clients send actions, never state. Answers, facts and sources live only in the Worker bundle. `views.ts` includes
  the answer and results only in `answerReveal`/`scoreboard`; other players' guesses only after guessing closes.
  The host controller doesn't see the answer early either (the host may be playing).
- Host powers need the 256-bit host token, which only the creating browser holds. Player reconnect tokens are
  192-bit. Both are compared in constant time and never appear in any snapshot.
- A guess always belongs to the player bound to the socket that sent it — the protocol has no way to name someone else.
- Each room code maps to its own Durable Object (`idFromName`) with its own storage, so rooms can't interfere.

### Reliability

- Timer deadlines live in Durable Object storage and are enforced with a DO **alarm**, so rounds advance with nobody
  connected and after the object is evicted. A late wake-up makes exactly one transition and the next timer starts
  from *now*.
- Clients reconnect with backoff (and immediately when a phone wakes up), send their stored token in `hello` and get
  a full snapshot back. Refreshing the host, TV or a phone restores the exact state, including an unlocked draft guess.
- Early completion only counts **connected** players, so a phone that dies never holds up the round; its last saved
  guess still counts when the timer ends.
- Rooms with no activity for 12 hours delete themselves.

### UI notes

- The TV is laid out in `rem` units that scale with the window (1 rem = 20 px at 1920×1080).
- The number line merges identical guesses into one marker, spreads close guesses over up to four lanes, switches to
  a log scale when guesses span several orders of magnitude, and shades the "bust zone" in Without Going Over.
- Phones use a decimal keypad, live validation (same parser as the server), and a ± key for questions that allow negatives.
- **Reduced motion** follows the OS setting and can be toggled on every screen. **Sound** is synthesized, optional,
  and nothing depends on it — the game is fully playable muted.

---

## Questions

The bank holds **616** family-friendly questions across six categories (Prices & Products, Animals & Nature,
Sports & Records, Movies & Entertainment, Weird Facts, Geography & History): 116 in `server/questions.ts` and 500 more
in `server/moreQuestions/` (one file per category, 78–88 each). Every question has:

```ts
interface Question {
  id: string;
  category: CategoryId;
  text: string;
  answer: number;
  unit: string;        // "$", "ft", "year", "hearts", …
  precision: number;   // decimal places allowed in guesses and used for exact scoring
  modes: ('closest' | 'withoutGoingOver')[];
  source: string;      // named reference for the fact
  hint?: string;
  fact?: string;       // shown after the reveal
  allowNegative?: boolean;
}
```

Questions were chosen to be stable and unambiguous: definitions, rules, completed careers and historical events, with
the year stated for every price or changing statistic. Year questions are Closest Overall only. Each question names its
source; it's worth re-checking any fact you edit. `tests/unit/questions.test.ts` validates the bank (count, categories,
precision, valid answers, no duplicate questions, no answer in the text or hint, never imported by browser code).

### Adding questions

The files in `server/moreQuestions/` use one line per question:

```ts
['How many feet are in one mile?', 5280, 'ft', 'NIST Handbook 44'],
['In what year did the Berlin Wall fall?', 1989, 'year', 'Berlin Wall Foundation'],
['What is absolute zero in °C? (to two decimal places)', -273.15, '°C', 'BIPM', { hint: 'Negative numbers allowed!' }],
```

Defaults: `$` amounts under $1,000 allow cents; other answers allow as many decimals as the answer has; `year` questions
and negative answers are Closest Overall only (negatives are then allowed); everything else plays both modes. Override with
`{ p, modes, hint, fact }`. Ids come from a row's position, so **append** new rows rather than inserting them.

Games draw questions at random without repetition, honoring the selected categories and each round's mode, and a
rematch prefers questions the room hasn't seen yet.

---

## Local development

**Requirements:** Node.js 20+ (22 recommended). No Cloudflare account is needed locally — `wrangler dev` runs the
Worker and Durable Object on your machine.

```bash
npm install
npm run dev
```

This starts the Worker + Durable Object at `http://127.0.0.1:8787` and the frontend at `http://localhost:5173`
(Vite proxies `/api`, including WebSockets, to the Worker). Open `http://localhost:5173`, click **Create game**, then
**Open TV display**.

**Real phones on your Wi-Fi:** open the host page at your computer's LAN address (Vite prints it as "Network", for example
`http://192.168.1.20:5173`). The QR code uses the address the host page was opened with.

Run the halves separately with `npm run dev:server` and `npm run dev:client`.

## Tests

| Command | What it does |
| --- | --- |
| `npm test` | Vitest unit + integration suites (122 tests, ~1 s): scoring and ties, number validation and exact arithmetic, number-line layout, state transitions, timers (fake clock), pause/skip, views/secrecy, the question bank, the room controller over fake sockets (auth, reconnection, DO reactivation, idempotent scoring, room isolation) and Worker routing. |
| `npm run test:e2e` | Playwright. Starts `wrangler dev` and Vite on ports 8799/5179 and plays real games: a host, a TV tab and **four** phone-sized players complete a 5-question Mixed game covering both scoring modes, an exact-answer bonus, ties, everyone going over, a missing guess, a timeout that finalizes an unlocked draft, player/host/TV refresh, a dropped phone that reconnects, exact cumulative scores every round, game over, and a rematch with fresh questions. A second test covers skip, pause/resume, number validation, reduced motion, unauthorized clients and unknown rooms. About 1 minute. |
| `npm run typecheck` | TypeScript for the client/tests and the Worker. |
| `npm run test:all` | All of the above. |

On a fresh machine install a browser first with `npx playwright install chromium`.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | Frontend, **build time** | URL of the deployed Worker, e.g. `https://closest-wins.<you>.workers.dev`. WebSockets use the matching `wss://` URL. If unset, the app uses its own origin (local dev, via the Vite proxy). |
| `ALLOWED_ORIGINS` | Worker var (`wrangler.jsonc`, or `.dev.vars` locally) | Comma-separated origins allowed to create rooms and open sockets, e.g. `https://you.github.io`. `*` allows any. |
| `CW_BACKEND_ORIGIN` | Dev only | Where the Vite dev proxy forwards `/api`. Default `http://127.0.0.1:8787`. |
| `E2E_API_PORT`, `E2E_WEB_PORT` | E2E only | Ports for the Playwright web servers (default 8799 / 5179). |
| `?server=https://…` | Page URL | Runtime override of the backend URL, remembered in `localStorage` and carried into QR codes. |

There are no secrets in the frontend, no external APIs and no paid dependencies: Durable Objects with SQLite storage
are available on the Workers free plan.

## Deploying

### Backend — Cloudflare Workers

```bash
npx wrangler login
# optional: set "ALLOWED_ORIGINS": "https://<you>.github.io" in wrangler.jsonc
npm run deploy:server
curl https://closest-wins.<your-subdomain>.workers.dev/api/health   # → ok
```

The `migrations` entry in `wrangler.jsonc` creates the SQLite-backed `RoomObject` Durable Object class on first deploy.

### Frontend — GitHub Pages

With the included workflow (`.github/workflows/deploy.yml`):

1. **Settings → Pages → Build and deployment → Source:** GitHub Actions.
2. **Settings → Secrets and variables → Actions → Variables:** add `VITE_SERVER_URL` = your Worker URL.
3. Push to `main` (or run **Deploy** manually). The site appears at `https://<you>.github.io/<repo>/`.
4. Optional: to deploy the Worker from CI too, add the variable `DEPLOY_WORKER=true` and the secrets
   `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

Manual alternative: `VITE_SERVER_URL=https://closest-wins.<you>.workers.dev npm run build` and publish `dist/`. The build
uses a relative base path and hash routes (`#/play/ABCD`), so it works from any sub-path without rewrites.

`.github/workflows/ci.yml` runs the typecheck, unit/integration tests and E2E tests on every push and pull request.

---

## Known limitations

- Room creation isn't rate-limited; add a Cloudflare rate-limiting rule in front of `POST /api/rooms` for a public deployment.
- The question bank is fixed at build time; adding questions means editing `server/moreQuestions/` and redeploying the Worker.
- Player reconnect tokens are per browser: clearing site data or switching browsers means joining again under a new name.
- The host token lives in the creating browser's `localStorage`; opening the host link elsewhere shows a "not the host" screen.
- E2E tests run Chromium with phone emulation, not real iOS Safari.
