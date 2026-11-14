# Game

An 18-round economic engine builder for 2 to 4 players: rival industrialists build a city around 1900 and stand for mayor. The design lives in the doc "Theme and Board v0.4".

## Grey-box prototype

`prototype/` is stage 2 of the build order in §12 of the design doc: plain circles and bars, real rules, one human against scripted bots. It is a static web page with no build step.

- Play: open `prototype/index.html` in a browser, or serve the folder (`npx serve prototype`) and open it on a phone.
- Change the numbers: every cost, price, demand and vote value is in `prototype/config.js`.
- Check the rules engine: `node prototype/test/sim.js 100` plays all-bot matches at 2, 3 and 4 players and checks that coins, goods and stalls stay in range.

| File | What it holds |
| --- | --- |
| `config.js` | All tunable numbers from §4 and §6 |
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
