# 0007. Technical architecture: web client, one TypeScript rules engine, a server per match

- **Status:** proposed. Waiting for the owner's choice between the recommended stack and the alternatives below. Nothing is built on it yet.
- **Date:** 2026-11-14
- **Rules section:** §8, §11, §12

## Context

v0.4 named iOS as the platform and said nothing else about technology. Since then two things exist: a grey-box prototype in plain JavaScript (`prototype/`) and a simulator in TypeScript (`sim/`), each with its own resolver, both reading `config/economy.json`. The owner is now open to a web app in place of iOS, wants an online architecture behind an API, and wants high-performance technology.

What the rules ask of the technology:

- Two to four players plan at the same time against public state. Only the current round's plan is hidden, and it stays hidden until every plan is locked (§8).
- Play is asynchronous. A round resolves when every plan is locked or at a 24-hour deadline. A match is 18 rounds (or 12), so it can run for weeks.
- Bots fill empty seats, take over a seat that misses two deadlines in a row, and give a solo mode.
- Matches start from an invite link among friends (decision 0006).
- "Every client reaches the same state each round; a repeated request never settles a round twice" (§12, stage 4).
- The resolver is one pure function: state, plans and configuration in; new state and an event log out. §11 already says the same function should run the prototype and the server.
- One developer builds and runs all of it.

What the measurements say about performance. On this machine the TypeScript resolver plays 300 four-player matches, 5,400 rounds including four scripted bot plans each, in about 4.4 CPU-seconds: under a millisecond per round. The searching bot takes about 30 ms per plan. A match resolves at most 19 times in its life, so ten thousand live matches are roughly one resolution every eight seconds. The server's rule work will never be the bottleneck in any language. Where speed is felt is the client (load time, a smooth board on a mid-range phone) and the round trip to the API.

## Decision (recommended)

**TypeScript from end to end, with the existing resolver as the single rules engine, a web client first, and one small stateful server object per match.**

| Area | Choice |
| --- | --- |
| Client platform | A web app, built phone-first and installable (PWA). No native iOS app now. If the App Store matters later, the same web app is wrapped in a native shell (Capacitor). |
| Client stack | TypeScript, Vite, React, the board drawn in SVG. Twenty nodes and six bars do not need a game engine or canvas. |
| Rules engine | `sim/src` (engine, board, config, rng, bots) becomes a package, `packages/rules`, with no Node or browser dependency (only `cli.ts` touches Node today). The simulator, the client and the server all import it. The prototype's own `engine.js` is retired when the real client replaces the grey-box. |
| Server | TypeScript on Cloudflare Workers, with the Hono router. Each match is one Durable Object: it holds the match, accepts plans, and is the only place a round is resolved. |
| Transport | A plain HTTPS JSON API. Every write carries an idempotency key. No live connection is required to play. A WebSocket from the match object is added only for nice-to-haves (seeing who has locked) and for the later 90-second live mode. |
| Deadlines | An alarm on the match object, set to the round's deadline. When it fires, missing seats get the safe default or a bot, and the round resolves. |
| Persistence | Each match object stores its own data in its built-in SQLite: the rules preset and engine version, the seed, each round's locked plans, the state after each round and the event log. A small shared database (Cloudflare D1) holds accounts, the list of a player's matches and invite links. |
| Bots | The scripted bots run inside the match object at resolution, from the same package. In solo play they run in the browser with no server at all, and the searching bot runs in a Web Worker. |
| Accounts | A guest account created silently on first visit (a signed token on the device), which is all an invite link needs. Sign-in by passkey or emailed link is added so a player can move to a second device. |
| Notifications | Web Push for "the round has resolved" and "you are the last to lock", with email as the fallback. |
| Deployment | Client and API deploy to Cloudflare from GitHub Actions on push to `main`, with a staging environment. The grey-box stays on GitHub Pages. |
| Repo | npm workspaces: `packages/rules`, `apps/web`, `apps/server`, and `sim` as the CLI over the rules package. |

### How a round works

1. The client fetches the public state and builds a plan. It runs the same resolver locally to check that the plan is legal and to preview production and costs, so there is no round trip while planning.
2. The player locks. The client sends the plan to the match object, which validates it with the same code and stores it. Nobody else can read it.
3. When the last plan arrives, or the alarm fires, the match object asks the bots for their plans, calls `resolveRound` once, stores the new state and events in the same transaction, and sets the next alarm.
4. Clients fetch the new state and the event log and play the settlement report from the log. Players who are away get a push.

A match object handles one request at a time, so two late plans or a retried request cannot settle a round twice. That is the stage 4 acceptance test met by construction, not by locking code.

## Why

- **One rules engine is the decision that matters most.** A second implementation of 780 lines of rules, in another language, has to match the first exactly in every tie-break, forever, while the rules are still changing weekly. TypeScript is the one language that runs in the browser, on the server and in the simulator, and the engine already exists and is tested in it.
- **A web app fits the game and the plan.** An invite link opens straight into the match with no install, which is what friends-first play (0006) depends on. Moderated play tests (§12, stage 3) need a URL, not TestFlight. There is no App Store review, fee or 30% cut while the game is being found. A turn-based board of 20 nodes loses nothing by being drawn by a browser.
- **A match is a natural actor.** It has private state, a few writers, a deadline and a strict order of events. A Durable Object is that shape: storage, single-threaded execution and a timer in one place. On a conventional server the same guarantees need a database transaction, a row lock and a job queue.
- **It is small enough for one person.** No servers to patch, no database to back up by hand, nothing running while no one plays. The free and entry tiers should cover friend matches for a long time (to be checked against current Cloudflare pricing before committing).
- **It is fast where speed is felt.** The API runs close to each player, the client is static files on a CDN, and planning never waits on the network.
- **The same parts carry the later modes.** Live play with a 90-second round is the same match object with a shorter alarm and a WebSocket. Open matchmaking is one more table and one more endpoint.

## What this costs

- **Tied to one vendor.** Durable Objects exist only on Cloudflare. The rules package and the client do not care; the server is the part that would be rewritten. Keeping the match logic (accept plan, resolve, default a seat) in plain functions behind a small storage interface makes that rewrite a few hundred lines, and makes it testable without Cloudflare.
- **Request CPU limits.** Scripted bots are far inside them. The searching bot at about 30 ms a plan should be, but that needs checking on the platform before it is offered as an online opponent. Until then it is a solo-play bot.
- **iOS as a web app.** Web Push on iPhone works only after the player adds the app to the home screen. Email covers players who do not. A wrapped native app removes the limit if it proves to matter.
- **Matches outlive deploys.** A match can last weeks, so each match records its rules preset and engine version, and a change to resolver behaviour must not alter a match in flight. The simulator's determinism tests are the guard: stored plans replayed from the seed must give the stored state.
- **The client is a rewrite of the grey-box UI.** The prototype is plain JavaScript with no build step and its own engine. It stays as the thing to learn from; it is not the base of the app.

## Alternatives considered

**A. A conventional server: Node (or Bun) with Hono or Fastify, PostgreSQL, one container on Fly.io or a small VPS.** The same client and the same rules package. Round resolution runs in a transaction with a row lock on the match; deadlines come from a job table (pg-boss). This is the most portable and best-known option and can be run entirely on a laptop. It costs a few dollars a month from day one, and the locking, the job queue and the database upkeep are the developer's to get right. This is the choice if avoiding vendor lock-in outweighs having less to run. The match logic is written the same way in both, so moving from the recommended stack to this one later is cheap.

**B. A server in Go or Rust.** This is what "high-performance technology" usually means, and it is the wrong tool here. The server's work is under a millisecond per round, so there is no speed to gain. The cost is either a second rules engine that must agree with the TypeScript one exactly, or the TypeScript engine embedded in a JavaScript runtime inside the Go or Rust server, which is slower and more complex than running it directly. Worth revisiting only if the server gains work that is actually heavy, such as large-scale matchmaking or server-side search bots at volume.

**C. A native iOS app in Swift.** The best feel on an iPhone and reliable notifications. It reaches only iPhone owners, needs an install before a friend can join a match, puts App Store review between a fix and the players, and needs the rules either rewritten in Swift or run inside JavaScriptCore. Deferred, not rejected: if the web app finds players and they are mostly on iPhone, wrap it first and go native only if the wrap falls short.

**D. A hosted backend (Supabase or Firebase).** Quick accounts and storage, but hidden plans, deadlines and resolution still need custom server functions, and that is the whole server. It adds a platform without removing the work.

## What would change this

- The owner wants an App Store presence at launch: keep everything and add the Capacitor shell to the plan, or choose C.
- Avoiding lock-in matters more than running less: choose A.
- The searching bot or a later module does not fit in a request's CPU budget: move bots to a queue, or choose A.
- Live play becomes the main mode: the recommended stack still fits, but the WebSocket work moves from "later" to the first server milestone.

## If adopted, the order of work

This does not change §12: the server still comes last. The first two steps need no server and no account anywhere.

1. Extract `packages/rules` from `sim/src` and point the simulator at it. No behaviour change; the 32 tests stay green.
2. Build `apps/web` as the real client for solo play against bots, on the rules package. This becomes the stage 2 and stage 3 build.
3. Build `apps/server`: match object, plan submission, deadline alarm, invite links, guest accounts.
4. Push notifications, sign-in across devices, then the live mode.
