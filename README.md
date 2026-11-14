# Game

An 18-round economic engine builder for 2 to 4 players: rival industrialists build a city around 1900 and stand for mayor.

## Where things are

| Path | What it holds |
| --- | --- |
| `docs/design/theme-and-board.md` | The rules: one living document, currently v0.5 (draft) |
| `docs/design/CHANGELOG.md` | What each rules version changed and why |
| `docs/decisions/` | One short note per design choice; `proposed/` holds edits not yet accepted |
| `docs/sim-reports/` | Simulator results that drove a rule or number change |
| `config/economy.json` | Every rule number, shared by the simulator and the prototype |
| `sim/` | Headless economy simulator (§11 of the rules) |
| `prototype/` | Grey-box prototype, playable against bots |

## How the rules are versioned

- **Git holds the versions.** There is one rules file. Each release is tagged (`rules-v0.4`, `rules-v0.5`); read an old one with `git show rules-v0.4:docs/design/theme-and-board.md` and compare two with `git diff rules-v0.4 rules-v0.5 -- docs/design`.
- **One source for the numbers.** Change a number in `config/economy.json`, run `node config/sync.js`, and change the rules text in the same commit.
- **Commit by topic,** with the area first: `rules: links must touch own network`, `config: raise workshop cost to 16`, `sim: ...`, `prototype: ...`. The history then reads as a design log.
- **A rule change comes with its reason.** Add a line to the changelog, and a decision note when the choice was a real fork.

## Grey-box prototype

`prototype/` is stage 2 of the build order in §12 of the design doc: plain circles and bars, real rules, one human against scripted bots. It is a static web page with no build step.

- Play: open `prototype/index.html` in a browser, or serve the folder (`npx serve prototype`) and open it on a phone.
- Change the numbers: every cost, price, demand and vote value is in `config/economy.json`. Run `node config/sync.js` afterwards; see `config/README.md`. The prototype plays the v0.4 numbers and rules.
- Check the rules engine: `node prototype/test/sim.js 100` plays all-bot matches at 2, 3 and 4 players and checks that coins, goods and stalls stay in range.

| File | What it holds |
| --- | --- |
| `config.js` | Maps the shared numbers in `config/economy.json` to the names the engine uses; holds the board geometry |
| `economy.js` | Generated copy of `config/economy.json` for the browser. Do not edit |
| `engine.js` | Map setup, plan validation, round resolution (§8 order), election score. Pure functions, no DOM |
| `bots.js` | One heuristic planner with five personas from §11 |
| `ui.js`, `style.css`, `index.html` | Board, HUD strips, plan builder, settlement report |

### Readings of the rules where v0.4 is silent

- Goods ship from the works that make them, or from any of your works if you make none. Each rival link on the cheapest route is paid once per round.
- Only selling and investing need a link route. Buying does not.
- This round's output can pay for a build, be sold or be invested. Recipe inputs must be held at the start of the round.
- A bond's coins can be spent in the round it is taken. Coins from sales cannot fund the same round's builds or buy orders.
- A starved or idled building pays no upkeep. A building that cannot pay upkeep idles.
- Both visible projects accept investment. The city fund buys one unit a round for the first project, cheapest missing good first.
- Storage overflow discards the cheapest goods first.
- Unpaid bond interest is forgiven when a player has no coins.
- The candidate link pool is: every plot to the core, every site to its nearest plot, and a shuffled set of second-plot and neighbour links.

Not in the prototype: the four later modules (§7), online play, animation and art.
