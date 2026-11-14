# Economy simulator

Headless simulation of the game's economy, as called for in §11 of the design doc
("Theme and Board"). It exists to test the numbers before anything is built on them.

- **The resolver** is one pure function: state, all players' plans and a configuration in; new
  state and an event log out (`resolveRound` in `src/engine.ts`). It has no randomness of its
  own. The seed is used once, in `createGame`, for the map shuffle, the project order and the
  first priority marker. The same function can run a local prototype or a server.
- **Every rule number is a parameter** in `config/economy.json` at the repo root, shared with
  the prototype. Its `base` is v0.4 as written; presets `v0.5` and `v0.5-short` add imports, the
  round-0 bid and the 12-round format. `src/config.ts` holds only the shape of the rules.
- **Bots**: the six scripted bots of §11 (raw specialist, workshop builder, district founder,
  cash hoarder, free-rider, adaptive) and a searching bot that plays candidate plans forward to
  election day and keeps the best.
- **Reconciliation**: `src/audit.ts` replays the coin and goods transfers in an event log and
  checks at every phase boundary that nothing appears or vanishes outside a logged transfer.

## Running it

Needs Node 22.18 or later. No build step and no runtime dependencies.

```sh
cd sim
npm test                                      # 32 tests: rules, determinism, reconciliation
node src/cli.ts run --players 4 --games 300   # a batch with the six scripted bots, summary table
node src/cli.ts match --seed 7 --bots founder,workshop,adaptive,raw   # one match, round by round
node src/cli.ts report --games 300 --out reports/v0.4-baseline.md     # the full §11 report
node src/cli.ts sweep --grid grids/example.json --games 150 --out reports/sweep-example.csv
```

Flags shared by all commands:

| Flag | Meaning |
| --- | --- |
| `--preset v0.4 \| v0.5 \| v0.5-short` | Rule set to start from (default `v0.4`) |
| `--set path=value` | Override one number, repeatable: `--set cost.raw.coins=14 --set buildingCap.4=4` |
| `--config file.json` | A file of the same overrides, `{ "path": value }` |
| `--players`, `--games`, `--seed` | Player count, matches per setting, base seed |
| `--bots mixed \| a,b,c,d` | Draw seats from the six scripted bots, or name them (`search` is the searching bot) |
| `--json` | (`run`) print the whole summary as JSON |

A sweep grid is a JSON object of `path: [values]`; every combination is run at each player
count and written as one CSV row.

`npm run typecheck` needs `npm install` first (TypeScript is the only dev dependency).

## Changing the rules

Edit `config/economy.json` (then run `node config/sync.js` for the prototype, see
`config/README.md`), add a preset there, or pass overrides. A new rules version should be a
new preset, so that reports for the old one can still be reproduced. Rules that are not
just numbers live in `src/engine.ts`, one block per phase in the order of §8.

## What is in the reports

`reports/v0.4-baseline.md`, `reports/v0.5-draft.md` and `reports/v0.5-short.md` were produced by
the `report` command with 300 matches per setting. Each covers the targets of §11, how the
bots fare, the searching bot's edge, the questions of §11 one by one, and the variants.
`reports/FINDINGS.md` is a short reading of them.

## Which rules it runs

The resolver follows `docs/design/theme-and-board.md` including the 28 gap-review edits
(`docs/decisions/proposed/gap-review-v0.4.md`). The ones that shape results most:

- Plots are joined to the core by free city links from the start (G17).
- Stored goods have no location: a shipment takes the route with the fewest tolls from any of
  the player's buildings, and a works with no built path to the core makes nothing (G16).
- A new link must touch the core, the player's building or the player's link (G02).
- Districts are served oldest first and take all their goods or none (G10).
- Unpaid interest is debt, 1 vote per coin still owed on election day (G19).
- The city fund buys the first missing good in the project's listed order that is in stock (G21).
- Tolls a plan could incur are held back at lock (G08). Batches per workshop and the discard
  order can be set in the plan (G06, G07).

## Rulings: choices made where the rules are still silent

1. **Stall overflow.** Sellers are given room for the city's whole demand (§6.3), but a
   district that lacks one good now takes none (G10), so more can be sold into a stall than the
   city removes. Units that do not fit in the stall after the city has eaten are lost; the
   sellers keep their coins. The rules need a line for this.
2. **Lost claims (G25).** A player who loses a contested claim keeps the rest of the plan as
   submitted; the simulator does not look for other actions the loss made impossible.
3. **Link legality (G02)** is judged against the board at lock, so a link cannot chain off
   another link or building placed in the same plan.
4. **Tolls at lock (G08)** are reserved for the route as it stands at lock. If a route only
   exists because of a link laid this round, its tolls are charged without a reserve and can
   leave the player in debt.
5. **Board.** The rules fix counts, not geometry. Here the 7 plots ring the core, the 12 sites
   ring the plots, every site has a candidate link to its nearest plot, and the rest of the
   candidate links are drawn at random within 2 to 4 per node. The two starting districts and
   the order of the five projects are shuffled per match.
6. **Round 0.** Works nobody picked become free sites with no links.
7. **Imports.** The worst-case cost of a marked order is held back at lock.

## Not done yet

- The proposal's **price formula** variant: the formula is not in the design doc.
- **Plots open to player building**: the engine supports it
  (`variants.plotsOpenToPlayers`), but no bot knows when to use it, so there is no result.
- The **§7 modules** (events, electrification, council, backers).
- The scripted bots never idle a works by choice, never set batches or a discard order, never
  place a bid on a contested site, and size up demand only one class ahead. The searching bot's edge over them (section 3 of each
  report) shows how much that costs.
