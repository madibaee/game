# Theme and Board — v0.4

Nov 11, 2026

An 18-round, turn-based economic engine builder for 2–4 players on iOS, set in an industrial city around 1900. Players are rival industrialists who build the city together and then stand for mayor; the player with the most votes after round 18 wins.

**Revision v0.4.** The flood, elevation bands and dikes of v0.3 are removed. The game is now multiplayer with simultaneous planning, asynchronous online play first and bots from day one. The pressure system is a shared market and a growing city: goods can be sold now or invested in neighbourhoods that create future demand. Four mechanics form the core (shares, toll links, neighbourhood class, municipal bonds) and four more are staged as later modules (§7). The board, gestures and art direction from v0.3 carry over. *The Living City — Game Design Concept v0.2* supplied the economy; its numbers are revised here where review found faults. Every number in this doc is a proposal to be set by simulation (§11).

## 1. The organising principle

v0.3 started from a problem: in a solo game the antagonist has no face, and a number on a HUD is hard to fear. v0.4 solves it the way Brass does. The antagonist is the other players, whose moves you watch and resent.

**The rule that survives from v0.3: everything the player must plan around is visible on the board.** Rivals' buildings and links, the next neighbourhood plots, how full each market stall is, and which districts are about to change class are all drawn on the map or in an always-visible strip. Nothing the player needs for a three-round plan sits behind a tap.

The second rule is new: **no player ever destroys what another has built.** Rivals take your customers, outbid you for a site and profit from your neighbourhood. They never remove your engine. The flood was dropped because its best outcome was losing nothing; here every change in the city is also an opening.

## 2. Mobile constraints that decide the board

| Constraint                                      | Consequence                                                                              |
|-------------------------------------------------|------------------------------------------------------------------------------------------|
| Whole board must fit one screen, no pan or zoom | ~390 × 480 pt of board area                                                              |
| 44 pt minimum touch target                      | Hard ceiling ~96 targets; **16–24 is the legibility limit**, a judgment not a derivation |
| No hover, no keyboard, no right-click           | Every action is tap or drag                                                              |
| Edges between tiles are ~4 pt wide              | **Grid edges are unhittable**                                                            |
| Thumb reach                                     | Primary actions belong in the lower third                                                |
| Interruptible sessions                          | Must save and restore mid-round                                                          |
| App Store discovery is a screenshot competition | The board must read at thumbnail size                                                    |

The pan/zoom rule is not a nice-to-have. This game is about evaluating global state and planning three rounds ahead. If the player can never see the whole board at once, planning degrades into local optimisation, which is exactly the failure mode of most cardboard-to-mobile ports.

The edge rule is the one that kills the hex grid proposed in v0.1 of the spec. "Lay a link" is a core action. On a grid, a link is an edge between two tiles, and an edge is a hairline. You would need a modal edge-picker: three taps for what should be one gesture.

## 3. Board topology options

| Option                    | Phone fit                            | What it costs you                        | Verdict                  |
|---------------------------|--------------------------------------|------------------------------------------|--------------------------|
| **A. Hex or square grid** | Workable at 36 (~65 pt hexes), dense | Link actions become unhittable edges     | Only if you cut links    |
| **B. Node graph**         | Very good                            | Slightly less "map" feeling              | **Recommended**          |
| **C. Vertical lanes**     | Excellent                            | All geography, all adjacency             | Becomes an idle game     |
| **D. Card tableau**       | Excellent                            | Placement decisions entirely             | TM-like; different game  |
| **E. Track / rondel**     | Good                                 | Simultaneity; you're always at one place | Interesting, higher risk |
| **F. Radial rings**       | Fair                                 | Legibility once buildings multiply       | Skip                     |

### A. Grid

The default instinct. The tiles themselves fit — a 6-wide hex row at 390 pt is ~65 pt per tile, above the touch minimum — but the edges do not, and links are edges. If you love literal geography, use 4×5 = 20 tiles at 78 pt each, and replace "lay a road" with "adjacency is automatic". That removes the edge-tapping problem by removing links as an action, at the cost of the Brass network layer.

### B. Node graph — recommended

18–20 discrete sites at ~56 pt diameter, laid out organically rather than on a lattice. Each site has a terrain type. Tap a node to build; drag from node to node to lay a link. The drag gesture is the whole argument: it's one motion, it's satisfying, and it maps exactly onto the mental action.

**Links are a predefined edge set, not any-pair.** Each site has 2–4 candidate links drawn as faint dashed paths. Any-pair linking turns a 20-node organic graph into spaghetti by round 10 and fails the thumbnail test. The faint paths are thin, but that no longer matters: the player drags node to node, and the drop target is a 56 pt circle, not the hairline.

**The core must stay reachable.** Every production site and district plot has at least one candidate path to the city core, and no single edge is the only way in for more than one starting site. A rival's link can cost you a toll but can never cut you off (§6.5).

This is also closer to Brass's real structure than a hex grid is. Brass is towns joined by canals and rails, not a tile map.

Each node must communicate three things at 56 pt:

1.  What building is here (single letter or a flat icon)

2.  What level it is (I / II / III, or pips)

3.  Whether it is running or starved — **colour and shape**: green fill with a solid ring when running, red fill with a broken ring and a pause glyph when starved. Red/green alone fails for roughly 1 in 12 male players; the ring carries the state on its own.

Terrain is shown only on **empty** sites, as the disc colour. Once a site is built, the node shows the building glyph, the tier numerals and the state ring, and the terrain colour goes away — what is built implies what was there. Tier carries **no colour** of its own: I / II / III only. So a built node has one colour system (state) and an empty node has one (terrain), and "running" green never sits beside forest green.

That third one matters more than it sounds. A starved smelter should be diagnosable at a glance, not by auditing stockpile numbers. Redundantly-coded node state is the single highest-value UI decision in the game.

**Multiplayer adds a fourth: who owns it.** Each player has a colour and a badge shape, and a built node carries both on its rim. Links are drawn in their owner's colour with the same badge at the midpoint. Colour is never the only cue.

### C. Vertical lanes

Chains as columns, resources flowing down, infinite scroll. This is the Lumber Inc shape. Perfectly mobile-native and it deletes the strategy layer, because without placement the only decision left is order of purchase. Listed for completeness; don't build it.

### D. Card tableau

No map. Buildings are cards in rows, and adjacency is replaced by tags — a card boosts other cards sharing its tag. This is Terraforming Mars's own solution to the same problem and it is extremely mobile-friendly. It's a legitimate alternative design, but it's a different game from the one specced.

### E. Track / rondel

Great Western Trail's shape. A path you advance along, building on the path itself, so movement and placement are the same decision. A vertical track scrolls naturally on a phone and your position is a single clear marker. Rare on mobile, which is a commercial argument in its favour. Higher design risk because the movement layer needs its own tuning pass.

## 4. Recommended board: 20-node graph

| Parameter               | Value                                                                                     |
|-------------------------|-------------------------------------------------------------------------------------------|
| Sites                   | 20                                                                                        |
| City core               | 1, at the centre; holds the market                                                        |
| District plots          | 7, ringed around the core; 2 are built districts at the start, 5 are visible growth plots |
| Production sites        | 12: three each of forest, clay bed, mountain and farmland                                 |
| Node diameter           | 56 pt                                                                                     |
| Candidate links         | 2–4 per site, predefined, drawn faint; every site has a path to the core                  |
| Players                 | 2–4                                                                                       |
| Buildings per player    | 5 with two players, 4 with three, 3 with four                                             |
| Link gesture            | Drag node → node                                                                          |
| Build / upgrade gesture | Tap node → bottom sheet (Build, Upgrade, Invest)                                          |
| Long-press              | Not used                                                                                  |

**Terrain decides what a site can extract.** Forest gives timber, clay bed gives brick, mountain gives iron and farmland gives food. A workshop can stand on any production site, but it wastes that site's terrain. With three sites per terrain, no table of three or four players can each own every raw good, so players must buy from each other through the market.

**Terrain is shuffled per match** among the 12 production sites, and the candidate link set is drawn from a pool. District plots and the core are fixed. The shuffle keeps site value fresh each match and gives the simulation something to vary.

**District plots are reserved.** Players cannot build on them and the city never builds on a production site. The elevation bands of v0.3 are gone; a site's value now comes from its terrain and its distance to the core.

**The building caps are deliberately low.** Twelve production sites cannot hold four full engines. Depth comes from three upgrade tiers and from using rivals' links and goods (§6), not from covering the map. The caps are the first thing to test in simulation.

Long-press stays retired. It collided with drag on iOS and is undiscoverable. The bottom sheet follows from the thumb-reach rule in §2 and never clips at the screen edge.

The balance spec (`engine-builder-balance-spec.md`) was tuned for a solo 36-tile board and no longer applies. §6 replaces its numbers.

### HUD layout, top to bottom

1.  **Status bar** — round counter, actions remaining, coin, open bonds, and who has locked a plan

2.  **City strip** — the next two neighbourhood projects with their missing goods, and rounds left to the election. Always visible, never behind a tap

3.  **Board** — the node graph, filling the middle

4.  **Market strip** — six stalls, each showing its price and how full it is; swipe up to open the trade basket

## 5. Story: the city and its first election

A small industrial city around 1900 has just won the right to elect its own mayor. The election is 18 rounds away. The players are the heads of rival industrial houses, and each of them intends to win it.

Votes are not bought with cash alone. A house earns votes from the neighbourhoods it helped found, the people its works employ and, last, the money it can spend on a campaign. **The winner is the house the city owes the most, not the richest one.** That is the scoring rule of §6 told as a story.

| Game element         | In the story                                                  |
|----------------------|---------------------------------------------------------------|
| Round 18             | Election day                                                  |
| Final score          | Votes                                                         |
| Shares in a district | That district's loyalty to its patrons                        |
| Neighbourhood class  | A working quarter becoming middle-class, then wealthy         |
| Links                | Tramlines and canals; rivals pay a toll to use yours          |
| Municipal bond       | Borrowing from the city, which spends your interest on growth |
| Era change (module)  | Gas light giving way to electricity                           |

**Why this setting.** Money, shares, loans and markets mean exactly what they appear to mean, so the player translates nothing. The election gives round 18 a climax instead of a cut-off. Electrification gives the map a visible arc: a dark board that lights up district by district.

**Risk.** Industrial settings are common in board games. The screenshot test in §10 decides whether the lit-city look is distinct enough.

Settings considered and set aside: river delta under rising water (v0.3), desert city and qanats, harbour town, fungal forest network, a city on a walking creature, and a world's fair as the round-18 goal.

## 6. Core rules (proposed; all numbers to be set by simulation)

Each round every player plans three actions in private, all plans lock together, and the round resolves in a fixed order (§8). The question each round is the same: sell goods for coin now, or put them into the city for shares, dividends and votes later.

### 6.1 Actions

| Action  | Effect                                                                                                       |
|---------|--------------------------------------------------------------------------------------------------------------|
| Build   | Place one tier-I building on a free production site                                                          |
| Upgrade | Raise one of your buildings a tier (I → II → III)                                                            |
| Link    | Build one link on a free candidate edge                                                                      |
| Trade   | Submit one basket of market orders, any number of goods; you may not buy and sell the same good in one round |
| Invest  | Send a bundle of goods to one neighbourhood project                                                          |
| Bond    | Take one municipal bond, or repay one                                                                        |

Production is automatic and costs no action. A player may pass any action.

### 6.2 Production

Six goods: four raw (timber, brick, iron, food) and two processed (tools, consumer goods).

| Building    | Where                 | Each round                                                                   |
|-------------|-----------------------|------------------------------------------------------------------------------|
| Raw works   | Matching terrain only | Produces 2 / 3 / 4 units at tier I / II / III                                |
| Tool works  | Any production site   | Turns 1 iron + 1 timber into 2 tools, up to 1 / 2 / 3 times by tier          |
| Goods works | Any production site   | Turns 1 food + 1 timber into 2 consumer goods, up to 1 / 2 / 3 times by tier |

| Item                     | Cost                                                           |
|--------------------------|----------------------------------------------------------------|
| Raw works                | 10 coins + 1 brick                                             |
| Workshop                 | 14 coins + 1 brick                                             |
| Upgrade to tier II / III | 8 / 12 coins + 1 brick                                         |
| Link                     | 2 coins                                                        |
| Upkeep                   | 1 coin per running building per round; a building may be idled |

- **Start.** Each player has 12 coins, 2 brick, one tier-I raw works and a link path to the core. Starting works are on different terrains at equal distance from the core.

- **Timing.** A building produces from the round after it is built. Recipes use goods held at the start of the round. This round's output can be sold or invested this round but cannot feed a recipe until the next.

- **Storage.** Each player holds at most 8 goods at the end of a round; the excess is discarded and previewed before locking.

- **Brick in every build** gives brick steady demand and makes a rival's brickworks useful to you.

The proposal's workshop made one unit from two, which lost money at its own prices. Two units from two is the correction.

### 6.3 The market

The core holds one stall per good with six slots. **The price is read from how full the stall is at the start of the round**, so every player knows this round's price before planning. What is uncertain is whether an order fills.

| Units in stall       | 0   | 1   | 2   | 3   | 4   | 5   | 6   |
|----------------------|-----|-----|-----|-----|-----|-----|-----|
| Raw good price       | 8   | 7   | 6   | 5   | 4   | 3   | 2   |
| Processed good price | 13  | 12  | 11  | 10  | 9   | 8   | 7   |

Each good clears on its own, for all players at once:

1.  Buy orders are filled from the stall. If stock is short, buyers share it in proportion.

2.  Sell orders are accepted up to the free slots plus the city's demand for that good this round. If more is offered, sellers share the room in proportion; unsold goods stay with their owners.

3.  The city consumes its demand from the stall. If the stall cannot cover it, the districts that went short are **unserved** this round, newest district first.

All trades settle at the round's posted price. Leftover units after a proportional split go by a priority marker that passes clockwise each round. Every stall starts with 3 units.

This replaces the proposal's price formula. That formula had no anchor: a balanced market held any price, an unfilled order could move it, and supply had to exceed demand by about two-thirds before the price fell a coin. Here the price is tied to stock, only a filled trade moves it, and the stall is a bar the player can read on a phone. The formula stays as a simulation variant (§11).

### 6.4 Neighbourhoods, shares and class

The city strip shows the next two projects. Each names a plot, a district type and the goods it needs. A project is founded at the end of the round in which its last good arrives, at most one per round, and its demand starts the next round.

| District    | Founding goods            | Demand at class I                   | Class II                   | Class III                 |
|-------------|---------------------------|-------------------------------------|----------------------------|---------------------------|
| Residential | 2 timber, 4 brick         | 2 food                              | 2 food, 1 consumer goods   | 1 food, 3 consumer goods  |
| Commercial  | 3 brick, 2 consumer goods | 1 timber, 1 consumer goods          | 1 timber, 2 consumer goods | 3 consumer goods, 1 tools |
| Industrial  | 2 brick, 4 iron           | 2 iron                              | 2 iron, 1 tools            | 1 iron, 3 tools           |
| City core   | Present from the start    | 1 each of timber, brick, iron, food | Does not change            | Does not change           |

The game starts with one residential and one commercial district at class I; their shares belong to the city.

**Shares.** Each raw unit a player invests earns one share in that district, each processed unit two. If a project is over-subscribed in a round, contributions are accepted in proportion and the rest returned. Units the city supplies itself (§6.6) earn shares for nobody.

**Dividends.** In every round a district is fully served, it pays 1 coin per share to its shareholders. A shareholder therefore wants the district supplied, even by a rival.

**Class.** A fully served round earns a district one pip. Three pips raise it a class and the pips reset. An unserved round earns nothing and removes nothing. A higher class is worth more votes and buys different goods: a residential district that reaches class III buys less food than before, so players can grow a district out of their own market.

Shares are the answer to the proposal's weakest point. There, the investor received end-game points equal to the cash given up at a price of 5, and the new demand was shared. In a two-player game that made investing a price check. Here the investor holds an income stream and a block of votes that rivals do not.

### 6.5 Links and tolls

A link belongs to the player who builds it. Its owner ships over it free. A rival whose goods cross it in a round pays the owner 1 coin, once per link per round, whatever the quantity.

Goods must travel over links from a producing site to the core to be sold, and to a project's plot to be invested. A site with no path cannot ship. No link can be closed to a rival, so a well-placed tramline is an income, not a wall.

### 6.6 Municipal bonds and the city fund

**Bond.** Taking a bond gives 12 coins now. Each open bond costs 1 coin of interest per round. Repaying costs 12 coins and an action. A player may hold two. Each bond still open on election day costs 4 votes.

**City fund.** Interest and winning site bids (§6.7) go into the city fund. At the end of each round, while the fund can afford it, the city buys one missing good for the first project in the queue from the market stall at the posted price.

This is the cross-axis action v0.3 asked for, on the Brass loan model: cash now against votes and income later. It also makes the city's own growth visible and earned. The city builds with the interest the players pay it, which replaces the proposal's free contribution every third round. With 12 starting coins and a 10-coin works, the first bond is the difference between one building and two in the opening rounds; whether that is a decision or a reflex is a simulation question.

### 6.7 Contested claims

When two players claim the same site or edge in one round, each plan carries a sealed bid of zero or more coins above the cost. The higher bid wins and goes to the city fund. Equal bids go to the holder of the priority marker. A loser's coins are refunded and that action is lost.

### 6.8 The election

| Source of votes          | Votes                           |
|--------------------------|---------------------------------|
| Each share in a district | 1 / 2 / 3 at class I / II / III |
| Each building            | 1 / 2 / 3 at tier I / II / III  |
| Campaign fund            | 1 per 10 coins held             |
| Each open bond           | −4                              |

Goods left in storage count for nothing. Ties go to the player with more shares, then more coins, then are shared. The app shows the four lines separately at all times so a player can see where a lead comes from.

## 7. Later modules

Four further mechanics are designed now and switched on one at a time after the core is stable. Adding all eight at once would make it impossible to tell which one helped or hurt.

| Order | Module           | What it adds                                        | Main risk                                        |
|-------|------------------|-----------------------------------------------------|--------------------------------------------------|
| 1     | Announced events | A shock to plan around, seen three rounds ahead     | Reads as arbitrary if the forecast is missed     |
| 2     | Electrification  | A second era from round 10 and a map that lights up | Late-game lead grows too fast                    |
| 3     | City council     | Votes on a city ordinance after rounds 6 and 12     | Ganging up on one player at four players         |
| 4     | Secret backers   | One hidden goal per player                          | Less of the open information that helps learning |

### 7.1 Announced events

A train is drawn at the railway edge of the map three rounds before it arrives, with its effect printed on it. Examples: a harvest failure empties three slots of the food stall; an army contract adds 3 tool demand for two rounds; a wave of new arrivals gives one residential district a free pip. The event deck is seeded per match and holds no hidden cards. Every event is a threat to one plan and an opening for another.

### 7.2 Electrification

From round 10 the city can electrify. Each district gets an electrification project (iron and tools) that pays shares like a founding. Class III and tier III both require electricity: a district must be electrified to reach class III, and a building must be linked to an electrified district to reach tier III. An electrified district is drawn lit.

The era unlocks the top tier instead of breaking the bottom one. Nothing built in the gas era stops working, which keeps the second rule of §1.

### 7.3 City council

After rounds 6 and 12 the council votes between two published ordinances, known three rounds ahead. Each player casts votes equal to the shares they hold. Examples: a subsidy that adds 2 demand for one good; a toll cap; rezoning one empty production site as a district plot. This gives shares a use before election day and rehearses the election itself.

### 7.4 Secret backers

At the start each player is dealt two backer cards and keeps one, face down. A backer pays bonus votes on election day for one condition, such as holding the most industrial shares or owning the longest tram network. This replaces the public contracts of the proposal, which are not in the core.

## 8. Multiplayer structure

The game is designed for 2–4 players from the start, played online asynchronously, with bots filling any seat.

- **Simultaneous planning.** Every player plans against the same public state. Plans stay private until all are locked. Connection speed and submission order never decide anything.

- **Public state.** Map, buildings, links, storage, coins, bonds, shares, stall levels and the project queue are visible to all. Only the current round's plan is hidden. Hidden storage is a later variant.

- **Asynchronous first.** A round resolves when every plan is locked, or at a 24-hour deadline. This suits a phone, needs no two players online together and softens the empty-lobby problem. Live play with a 90-second round is a later mode on the same resolver.

- **Bots from day one.** The scripted bots built for simulation (§11) also fill empty seats, take over a seat that misses two deadlines, and give a solo mode at no extra design cost.

- **Missed deadline.** The seat runs a safe default: idle what it cannot afford, hold goods, place no bids. The player sees exactly what was played for them.

- **Three and four players are where the design is strongest.** A shared benefit is worth little when there is only one rival. Two-player balance must be checked on its own and is not evidence for four.

### Resolution order

The same sequence applies to every player, every round.

1.  **Lock and validate.** Each plan is checked as a whole: no coin or good is spent twice.

2.  **Claims.** Contested sites and edges are settled by bid, then priority marker (§6.7).

3.  **Upkeep and production.** Buildings present at the start of the round run on goods held at the start of the round.

4.  **Construction.** New buildings and upgrades are placed and produce from next round. New links can carry goods this round.

5.  **Investments.** Goods sent to projects arrive.

6.  **Market.** Each stall clears (§6.3); the round's tolls are paid.

7.  **City.** Districts are marked served or unserved; dividends and pips are paid out; bond interest enters the city fund; the fund buys for the queue; at most one project is founded and its shares issued.

8.  **Close.** Storage caps apply, the priority marker passes, the next prices are posted and a settlement report is saved for replay.

**Match length.** Eighteen rounds at one a day is up to 18 days in the worst case, though rounds resolve early when everyone locks. A 12-round short format is an open question (§13).

## 9. Art direction a solo developer can ship

| Decision          | Recommendation                                                                                                                 |
|-------------------|--------------------------------------------------------------------------------------------------------------------------------|
| Perspective       | Flat top-down. Isometric needs a tileset artist and a depth-sorting renderer                                                   |
| Buildings         | Solid silhouettes, tier shown by numerals I / II / III, no tier colour, no interior detail                                     |
| Characters        | None. Character animation is where solo projects die                                                                           |
| Palette           | 4 terrain (empty sites only) + 2 state + 4 player + 1 lit-district glow. Eleven total                                          |
| Districts         | Type shown by silhouette, class by I / II / III, pips as dots on the rim. A served district glows warm; an unserved one is dim |
| State redundancy  | Running/starved carried by ring shape as well as colour (§3B)                                                                  |
| Text in the world | None. All numbers live in the HUD                                                                                              |
| Where to spend    | The production tick animation                                                                                                  |

That last row is the one thing worth real effort. The moment each round when resources visibly flow along links and outputs appear is the entire emotional payoff of an engine builder. One second of well-animated flow does more for retention than a month of building art.

## 10. The screenshot test

Before committing to any theme, mock a single App Store screenshot at thumbnail size, roughly 120 pt wide, and put it next to five competitors. If it doesn't read as a distinct object at that size, the theme has failed commercially no matter how good the mechanics are.

This is a one-day art task that runs **in parallel with** the grey-box prototype in §12, not before or after it. The prototype tests whether the game is tense; the screenshot tests whether anyone will download it. Neither result should wait on the other.

## 11. Simulate the economy before building anything

**Decision carried over from v0.3: the board and UI (§2–4) are ready to implement; the economy (§6) is not, and it gets a headless simulation first.** More writing will not settle the numbers, and hand play is too slow to tune them.

The simulator is one pure function: state, all players' plans, configuration and seed in; new state and an event log out. The same function later runs the local prototype and the server.

### Problems the simulation must answer

- **Is money scarce?** A 10-coin works that earns about 10 coins a round pays back at once. If coins pile up by round 6, costs, upkeep or city demand are wrong.

- **Do shares dominate?** A share is worth up to 3 votes plus dividends; the same goods sold are worth under 1 vote. If every spare good is invested, cap or reprice shares.

- **Does anyone free-ride?** A bot that never invests and only sells into districts others founded must not win.

- **Is the bond a decision?** Taken in every game in round 1 means it should be a rule; never taken means it is dead.

- **Do the building caps work?** Three buildings each at four players may be too thin to feel like an engine.

- **Is brick stranded late?** Its demand comes from building and founding, both of which fade.

- **Do tolls matter?** If links never change a plan, the spatial layer is decoration.

### Method

| Layer            | Method                                               | Why                                                                                    |
|------------------|------------------------------------------------------|----------------------------------------------------------------------------------------|
| Player decisions | Bots, sampled                                        | The space is too large to enumerate                                                    |
| Maps             | Terrain and link shuffles, a few hundred per setting | The game has no dice; the shuffle is what makes matches differ                         |
| Player count     | 2, 3 and 4, reported separately                      | Balance does not transfer between counts                                               |
| Design knobs     | Full grid                                            | Building costs, starting coins, stall size, dividend rate, votes per share, bond terms |

**Bots.** Six scripted: raw specialist, workshop builder, district founder, cash hoarder, free-rider, and an adaptive bot that follows the project queue. One searching bot tries many random continuations at each decision and keeps the best; a score far above every scripted bot means an exploit. Scripted bots need a little randomness in their choices, otherwise every match on one map is the same match.

**Variants to compare, one at a time:** stall-level pricing against the proposal's formula; shares against end-game contribution points; city fund against a free city contribution every third round; reserved district plots against plots a player may build on.

### Targets (proposed, not yet agreed)

- No seat wins more than 55% or less than 45% of mirrored two-player matches.

- The best bot's median vote total is within about 15% of the second best.

- The free-rider loses to the district founder in most matches, but not all.

- Shares supply between a quarter and a half of the winner's votes.

- At least four of the five plots are founded by round 15 in most matches.

- No stall sits empty or full for more than a quarter of all rounds.

- A player who falls behind by round 6 still has an affordable action every round.

For each module in §7, the same three measures v0.3 set for cross-axis actions: how often it is used, when, and whether its users win more. A small, map-dependent edge is the target.

## 12. Build order

The server comes last, after the economy is proven.

| Stage                   | What is built                                                                             | Done when                                                                                                             |
|-------------------------|-------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| 1\. Headless simulation | The resolver, the bots, the knob sweep (§11)                                              | Identical inputs give identical results, coins and goods reconcile every phase, and a configuration meets the targets |
| 2\. Grey-box on device  | 20 circles, the three HUD strips, plan builder, settlement report; one human against bots | Twenty matches played by hand; the sell-or-invest choice feels close at round 9                                       |
| 3\. Moderated play      | Five to eight outside players against bots                                                | Each can explain one price change and name an alternative they considered                                             |
| 4\. Online              | Authoritative server, locked plans, deadlines, reconnects, bot takeover                   | Every client reaches the same state each round; a repeated request never settles a round twice                        |
| 5\. Modules             | §7, one at a time, each through simulation first                                          | Each meets its use, timing and win-rate measures                                                                      |

The grey-box has no theme, art or animation. If grey circles and six grey bars are tense at round 9, the theme will make a good game better. If they are not, no theme will rescue it.

## 13. Open questions and what v0.4 dropped

### Open

1.  Does a 12-round short format keep the arc, and should it be the default for asynchronous play?

2.  Are three buildings each enough at four players, or does four players need a 24-node board?

3.  Should some district plots be open to player building, so land is contested between city and industry?

4.  Should the market import goods nobody produces, or is a standing shortage acceptable?

5.  Does the stall need more than six slots at four players?

6.  Should starting works be dealt or drafted?

7.  Is hidden storage worth testing once open play is understood?

8.  How are matches made: friends only at first, or open matchmaking with bots filling seats?

### Dropped from v0.3

- Rising water, elevation bands, dikes, reclaiming and the quota strip.

- The three flood-based cross-axis candidates (pawn the dike, open the sluice, salvage). The bond takes their place.

- Solo as the primary mode. Solo play against bots remains.

- The 13-site winning engine. Building caps by player count replace it.

- The river-channel terrain, replaced by farmland.

### Dropped from the Living City proposal

- The price formula, contribution points, the free city contribution every third round, the six-unit delivery cap and public contracts. §6 gives the replacement for each.
