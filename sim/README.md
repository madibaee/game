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
npm test                                      # 29 tests: rules, determinism, reconciliation
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

## Rulings: choices made where the design doc is silent

These are assumptions of the simulator, not decisions. Each is worth settling in the rules.

1. **Bond timing.** A bond settles at lock, so its coins can pay for a building in the same
   round. Interest is charged from the round the bond is taken; a bond repaid in a round pays
   no interest that round.
2. **Running out of coins.** Coins committed in a plan must be in hand at lock; sale income
   cannot pay for this round's builds or purchases. Bond interest and tolls are charged even if
   that takes a player below zero (an "overdraft" in the log), because the doc gives no rule
   for a player who cannot pay.
3. **Upkeep.** Paid before construction. A works whose upkeep cannot be paid is idled. A
   workshop with no inputs does not run and pays no upkeep.
4. **Market order.** Buy orders fill from the stock the stall opened with; units sold this
   round cannot be bought this round. Sellers then share the free slots (after buys) plus the
   city's demand. The city eats last.
5. **Serving districts.** The core is served first, then districts oldest first. A district
   that cannot be fully served still consumes what the stall has.
6. **Bids.** A sealed bid is charged only when the claim is contested.
7. **Where goods are.** A player's goods are one pool, not tracked per site. Units of a good
   ship from that player's works making it (cheapest route first), or from the core if the
   player makes none (bought goods). Purchases are delivered free.
8. **Reaching a plot.** Investing needs a built link path to the project's plot. Nobody starts
   with one, so somebody has to lay the link from the core and then collects tolls on it.
9. **Shares.** Issued at founding. Units given to a project that is never founded earn nothing.
10. **City fund.** Buys one unit a round for the first project in the queue: the good it needs
    most among those in stock, at the round's posted price. If two projects complete together,
    the first in the queue is founded.
11. **Storage cap.** The excess is discarded cheapest first; the player does not choose.
12. **Board.** The doc fixes counts, not geometry. Here the 7 plots ring the core, the 12 sites
    ring the plots, every plot has a candidate link to the core, every site to its nearest
    plot, and the rest of the candidate links are drawn at random within 2 to 4 per node. The
    two starting districts and the order of the five projects are shuffled per match.
13. **Round 0.** Works nobody picked become free sites with no links.
14. **Imports.** The worst-case cost of a marked order is held back at lock.

## Not done yet

- The proposal's **price formula** variant: the formula is not in the design doc.
- **Plots open to player building**: the engine supports it
  (`variants.plotsOpenToPlayers`), but no bot knows when to use it, so there is no result.
- The **§7 modules** (events, electrification, council, backers).
- The scripted bots never idle a works by choice, never place a bid on a contested site, and
  size up demand only one class ahead. The searching bot's edge over them (section 3 of each
  report) shows how much that costs.
