# Theme and Board — v0.5

Nov 14, 2026

An 18-round, turn-based economic engine builder for 2–4 players on iOS, set in an industrial city around 1900. Players are rival industrialists who build the city together and then stand for mayor; the player with the most votes after round 18 wins.

**Revision v0.5.** This version answers six of the eight open questions in v0.4 and leaves two to the simulation. One 20-node board serves every player count. The stall keeps six slots. The market gains a capped, expensive import so no player can be locked out of brick. Starting works are chosen in one sealed bid for pick order. Hidden storage is parked. Online play starts with invited friends and bots. The 12-round short format is now defined as a testable variant, and whether district plots open to players stays a simulation variant. §13 lists each answer with its reason; passages changed since v0.4 begin **New in v0.5**. Everything else is v0.4 unchanged, and v0.4 remains available as its own document. Every number in this doc is a proposal to be set by simulation (§11).

## 1. The organising principle

v0.3 started from a problem: in a solo game the antagonist has no face, and a number on a HUD is hard to fear. v0.4 solves it the way Brass does. The antagonist is the other players, whose moves you watch and resent.

**The rule that survives from v0.3: everything the player must plan around is visible on the board.** Rivals' buildings and links, the next neighbourhood plots, how full each market stall is, and which districts are about to change class are all drawn on the map or in an always-visible strip. Nothing the player needs for a three-round plan sits behind a tap.

The second rule is new: **no player ever destroys what another has built.** Rivals take your customers, outbid you for a site and profit from your neighbourhood. They never remove your engine. The flood was dropped because its best outcome was losing nothing; here every change in the city is also an opening.

**New in v0.5.** Both rules were used to settle open questions. The first parks hidden storage (§8). The second is why a shortage is allowed to cost a district its dividends but is never allowed to stop a player from building (§6.3).

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
| Sites                   | 20, at every player count                                                                 |
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

**District plots are reserved.** Players cannot build on them and the city never builds on a production site. The elevation bands of v0.3 are gone; a site's value now comes from its terrain and its distance to the core. Whether some plots should open to players is still a simulation variant (§11, §13).

**The building caps are deliberately low.** Twelve production sites cannot hold four full engines. Depth comes from three upgrade tiers and from using rivals' links and goods (§6), not from covering the map. The caps are the first thing to test in simulation.

**New in v0.5: one board for every player count.** v0.4 asked whether four players need a 24-node board. They do not, for three reasons.

- The caps already hold the city's total industry nearly constant: 10 buildings with two players, 12 with three and 12 with four. A bigger board at four players would break that and call for its own price table and district demand.
- Twenty-four sites is the top of the legibility range in §2, and four players is the count with the most owner colours and badges on screen. The largest board would meet the busiest table.
- A second board is a second layout, a second link pool and a second tuning pass, for one player count.

What stays open is narrower: whether three buildings feel like an engine. At four players the cap of three fills the 12 sites exactly, so the cap is a statement about land. The simulation therefore tests a cap of four at four players on the same board, where 16 wanted buildings compete for 12 sites and the sealed bid of §6.7 decides who gets them. Buildings per player joins the knob grid in §11.

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

| Game element          | In the story                                                         |
|-----------------------|----------------------------------------------------------------------|
| Round 0 (new in v0.5) | The houses bid for the best works in town before the campaign begins |
| Round 18              | Election day                                                         |
| Final score           | Votes                                                                |
| Shares in a district  | That district's loyalty to its patrons                               |
| Neighbourhood class   | A working quarter becoming middle-class, then wealthy                |
| Links                 | Tramlines and canals; rivals pay a toll to use yours                 |
| Imports (new in v0.5) | Goods brought in by rail at a price no local works would charge      |
| Municipal bond        | Borrowing from the city, which spends your interest on growth        |
| Era change (module)   | Gas light giving way to electricity                                  |

**Why this setting.** Money, shares, loans and markets mean exactly what they appear to mean, so the player translates nothing. The election gives round 18 a climax instead of a cut-off. Electrification gives the map a visible arc: a dark board that lights up district by district.

**Risk.** Industrial settings are common in board games. The screenshot test in §10 decides whether the lit-city look is distinct enough.

Settings considered and set aside: river delta under rising water (v0.3), desert city and qanats, harbour town, fungal forest network, a city on a walking creature, and a world's fair as the round-18 goal.

## 6. Core rules (proposed; all numbers to be set by simulation)

Each round every player plans three actions in private, all plans lock together, and the round resolves in a fixed order (§8). The question each round is the same: sell goods for coin now, or put them into the city for shares, dividends and votes later.

### 6.1 Actions

| Action  | Effect                                                                                                       |
|---------|--------------------------------------------------------------------------------------------------------------|
| Build   | Place one tier-I building on a free production site, up to your building cap (§4); the starting works counts towards it                                                          |
| Upgrade | Raise one of your buildings a tier (I → II → III)                                                            |
| Link    | Build one link on a free candidate edge that touches the core, one of your buildings or one of your links                                                                      |
| Trade   | Submit one basket of market orders, any number of goods; you may not buy and sell the same good in one round |
| Invest  | Send a bundle of goods to one neighbourhood project                                                          |
| Bond    | Take one municipal bond, or repay one                                                                        |

Production is automatic and costs no action. A player may pass any action.

The three actions may be any mix, and an action may be repeated, except Trade: one basket per round. Upgrade applies only to a building that stood at the start of the round, one tier per building per round.

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
| Upkeep                   | 1 coin per running building per round; a building may be idled in the plan at no action. An idle building, or one that makes nothing, pays no upkeep |

- **Start.** Each player has 12 coins, 2 brick, one tier-I raw works and a link path to the core, which that player owns. **New in v0.5:** the works is chosen in round 0 (§6.9), and any bid a player pays there comes out of the 12 coins.
- **Timing.** A building produces from the round after it is built. Recipes use goods held at the start of the round. This round's output can be sold or invested this round but cannot feed a recipe until the next.
- **Workshops.** The plan sets how many batches each workshop runs, up to its tier and the inputs held. Goods the plan sells or invests cannot also feed a recipe.
- **Storage.** Each player holds at most 8 goods at the end of a round; the excess is discarded and previewed before locking. The plan ranks goods for discard, cheapest first by default.
- **Paying.** A plan must be payable from coins held at lock plus any bond taken that round. Sale income, dividends and tolls received do not count. Buy orders, bids and the tolls a plan could incur are reserved in full and the unused part returned.
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
2.  Sell orders are accepted up to the free slots left after step 1 plus the city's demand for that good this round. If more is offered, sellers share the room in proportion; unsold goods stay with their owners.
3.  The city consumes its demand from the stall. If the stall cannot cover it, the districts that went short are **unserved** this round. Districts are served oldest first, the core before any district and the residential before the commercial of the two starting ones. A district takes its goods only when all of them are in stock; otherwise it takes none.

All trades settle at the round's posted price. Leftover units after a proportional split go by a priority marker that passes clockwise each round. Leftovers are dealt one at a time from the marker holder clockwise. Seat order and the first holder come from the match seed. Every stall starts with 3 units.

This replaces the proposal's price formula. That formula had no anchor: a balanced market held any price, an unfilled order could move it, and supply had to exceed demand by about two-thirds before the price fell a coin. Here the price is tied to stock, only a filled trade moves it, and the stall is a bar the player can read on a phone. The formula stays as a simulation variant (§11).

**New in v0.5: six slots at every player count.** v0.4 asked whether four players need a bigger stall. They do not. A stall is loaded by buildings, not by seats, and the caps hold the table at 10 to 12 buildings at every count (§4). The city's demand does not grow with seats either. What four players add is more orders competing for the same room, which is the fill uncertainty the market is meant to have. The price ladder is also built on six slots, so a larger stall would mean a second price table. Stall size stays in the knob grid as one number for all counts.

**New in v0.5: imports.** v0.4 asked whether the market should import goods nobody produces. The answer is in two parts.

- **Districts never import.** If nobody makes food, the residential districts go unserved and pay no dividends. That costs their shareholders income and takes nothing away, and a raw price of 8 with a hungry district is the clearest invitation the game can give a player to build that works. A standing shortage of what the city eats is acceptable.
- **Players can, at a price.** Every build and upgrade needs a brick, and workshops need two inputs. With three buildings each, a table of four can easily leave one raw good unmade. If that good is brick and the stall is empty, nobody at the table can build again. That is a locked game, not a shortage, so players get a valve.

The import rule: a buy order may be marked *import if short*. Any part of it the stall cannot fill arrives by rail at 10 coins for a raw good and 16 for a processed good. A player may import at most 2 units a round across all goods. Imported units go straight to the buyer, never enter the stall and do not move the price. The city fund (§6.6) does not import.

The import price sits above the top of each price ladder (8 and 13), so an import never undercuts a local producer. The cap of 2 keeps it a valve and not a supply. Both numbers go to the simulation, with a target that imports stay a small part of all units bought (§11).

### 6.4 Neighbourhoods, shares and class

The city strip shows the next two projects. Each names a plot, a district type and the goods it needs. A project is founded at the end of the round in which its last good arrives, at most one per round, and its demand starts the next round.

The five projects, each a plot and a district type, are put in order by the match seed, and the next is revealed when one is founded. Players may invest in either project shown. If both are completed in one round, the first in the queue is founded and the other is founded the round after.

| District    | Founding goods            | Demand at class I                   | Class II                   | Class III                 |
|-------------|---------------------------|-------------------------------------|----------------------------|---------------------------|
| Residential | 2 timber, 4 brick         | 2 food                              | 2 food, 1 consumer goods   | 1 food, 3 consumer goods  |
| Commercial  | 3 brick, 2 consumer goods | 1 timber, 1 consumer goods          | 1 timber, 2 consumer goods | 3 consumer goods, 1 tools |
| Industrial  | 2 brick, 4 iron           | 2 iron                              | 2 iron, 1 tools            | 1 iron, 3 tools           |
| City core   | Present from the start    | 1 each of timber, brick, iron, food | Does not change            | Does not change           |

The game starts with one residential and one commercial district at class I; their shares belong to the city.

**Shares.** Each raw unit a player invests earns one share in that district, each processed unit two. If a project is over-subscribed in a round, contributions are accepted in proportion and the rest returned. Units the city supplies itself (§6.6) earn shares for nobody. Shares are issued when the project is founded; goods in a project still unfounded on election day earn nothing.

**Dividends.** In every round a district is fully served, it pays 1 coin per share to its shareholders. A shareholder therefore wants the district supplied, even by a rival.

**Class.** A fully served round earns a district one pip. Three pips raise it a class and the pips reset. The new demand applies from the next round. Class III is the top and earns no more pips. An unserved round earns nothing and removes nothing. A higher class is worth more votes and buys different goods: a residential district that reaches class III buys less food than before, so players can grow a district out of their own market.

Shares are the answer to the proposal's weakest point. There, the investor received end-game points equal to the cash given up at a price of 5, and the new demand was shared. In a two-player game that made investing a price check. Here the investor holds an income stream and a block of votes that rivals do not.

### 6.5 Links and tolls

A link belongs to the player who builds it. Its owner ships over it free. A rival whose goods cross it in a round pays the owner 1 coin, once per link per round, whatever the quantity. Each rival who crosses pays separately.

Goods must travel over links from a producing site to the core to be sold, and to a project's plot to be invested. A site with no path cannot ship. No link can be closed to a rival, so a well-placed tramline is an income, not a wall.

**Routes.** Stored goods have no location; each player has one stockpile. A building whose site has no path of built links to the core at the start of the round makes nothing and is shown starved. A sale ships to the core, and an investment to the plot, from whichever of the player's buildings gives the route with the fewest tolls, chosen automatically. Goods bought at the market reach the stockpile without crossing a link.

**City links.** The seven district plots are joined to the core from the start by city links, which everyone uses free.

### 6.6 Municipal bonds and the city fund

**Bond.** Taking a bond gives 12 coins now. Each open bond costs 1 coin of interest per round. Repaying costs 12 coins and an action. A player may hold two. Bonds are taken and repaid at the start of resolution, so the 12 coins can be spent in the same plan. Interest is charged in the City step on every bond open then, including one taken that round. Each bond still open on election day costs 4 votes. A player who cannot pay interest holds the shortfall as debt, which is cleared from the next coins received and costs 1 vote per coin still owed on election day.

**City fund.** Interest, winning claim bids (§6.7) and round-0 bids (§6.9) go into the city fund. At the end of each round, while the fund can afford it, the city buys one missing good for the first project in the queue from the market stall at the posted price. It buys the first missing good, in the order the project lists them, that the stall has in stock; if none is in stock it buys nothing.

This is the cross-axis action v0.3 asked for, on the Brass loan model: cash now against votes and income later. It also makes the city's own growth visible and earned. The city builds with the interest the players pay it, which replaces the proposal's free contribution every third round. With 12 starting coins and a 10-coin works, the first bond is the difference between one building and two in the opening rounds; whether that is a decision or a reflex is a simulation question.

### 6.7 Contested claims

When two or more players claim the same site or edge in one round, each plan carries a sealed bid of zero or more coins above the cost. An uncontested claim pays no bid. The higher bid wins and goes to the city fund. Equal bids go to the holder of the priority marker, or to the tied player nearest clockwise from the holder. A loser's coins are refunded and that action is lost. Any other action in the plan that the loss makes impossible is cancelled and its coins and goods returned.

### 6.8 The election

| Source of votes          | Votes                           |
|--------------------------|---------------------------------|
| Each share in a district | 1 / 2 / 3 at class I / II / III |
| Each building            | 1 / 2 / 3 at tier I / II / III  |
| Campaign fund            | 1 per 10 coins held             |
| Each open bond           | −4                              |

Goods left in storage count for nothing. Buildings count whether running or idle, and the campaign fund rounds down. Ties go to the player with more shares, then more coins, then are shared. The app shows the four lines separately at all times so a player can see where a lead comes from.

### 6.9 Round 0: starting works (new in v0.5)

v0.4 asked whether starting works should be dealt or drafted. Neither: they are chosen in one sealed step that reuses the bid of §6.7.

1.  The app marks four starting works on the shuffled map, one on each terrain, at equal distance from the core, each with its link path. Four are offered at every player count.
2.  The priority marker is dealt at random.
3.  Every player ranks the four works and bids zero or more of their 12 coins. All plans lock together, as in any round.
4.  The highest bidder receives their first choice, the next bidder their best remaining choice, and so on. Equal bids go by the priority marker.
5.  Every player pays their bid to the city fund, except the last to pick, who pays nothing. Works nobody took become ordinary free sites.

A seat that misses the deadline, a bot on its simplest setting and the tutorial all play a bid of zero with the app's suggested ranking, which makes round 0 a plain deal for anyone who wants one.

Why not a deal. Terrain is shuffled, so starts are not equal. Food has two hungry districts from round 1 and brick is in every build, while iron waits for an industrial district. A deal hands that difference out at random and offers no remedy.

Why not a draft. Picks in turn cost up to one 24-hour deadline each in asynchronous play, so four players could wait four days for round 1. Round 0 is one deadline.

What the bid adds. The table prices the imbalance itself, so no start has to be tuned to be equal. Players meet the sealed bid before a contested site depends on it. And the coins land in the city fund, so a hot round 0 brings the first project forward.

What it costs. A works costs 10 of the 12 starting coins, so a bid of 3 or more delays the second building unless a bond covers it. That is a real opening decision, and one more thing for a new player to judge on a map they cannot yet read. The suggested ranking and the zero-bid default are the answer to that; whether they are enough is a question for moderated play (§12).

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
- **Public state.** Map, buildings, links, storage, coins, bonds, shares, stall levels and the project queue are visible to all. Only the current round's plan is hidden. **New in v0.5:** hidden storage is parked; see below.
- **Asynchronous first.** A round resolves when every plan is locked, or at a 24-hour deadline. This suits a phone, needs no two players online together and softens the empty-lobby problem. Live play with a 90-second round is a later mode on the same resolver.
- **Bots from day one.** The scripted bots built for simulation (§11) also fill empty seats, take over a seat that misses two deadlines in a row, until the player returns, and give a solo mode at no extra design cost.
- **Missed deadline.** The seat runs a safe default: idle what it cannot afford, hold goods, place no bids. The player sees exactly what was played for them.
- **Three and four players are where the design is strongest.** A shared benefit is worth little when there is only one rival. Two-player balance must be checked on its own and is not evidence for four.

### How matches are made (new in v0.5)

Online play opens with invited friends only. A player starts a match, shares a link, and bots fill any seat still empty when the match begins. Open matchmaking with strangers waits until friend matches show there are enough players to fill a lobby.

- An open lobby at launch would be mostly bots, and solo play already offers a match against bots.
- Strangers need what friends do not: ratings, reporting, names that are safe to show and rules for players who walk away. That is server work with no bearing on whether the game is good.
- An 18-round asynchronous match needs every seat to keep coming back. Friends do; strangers leave, and a match that ends as one human against three takeover bots is a poor first experience.
- Friend matches still exercise everything in stage 4 of §12: locked plans, deadlines, reconnects and bot takeover.

### Hidden storage is parked (new in v0.5)

v0.4 listed hidden storage as a later variant and asked whether it is worth testing. It is not planned. The first rule of §1 says everything a player plans around is visible, and a rival's stock is exactly what a player reads to judge whether an order will fill. The game already has one well-placed secret, the current round's plan. Hiding storage as well would turn that read into a guess. It comes back only if moderated play (§12) shows that open storage lets players work out each other's orders exactly, so that planning feels solved.

### Resolution order

The same sequence applies to every player, every round. Round 0 (§6.9) runs once before it and uses only the first step and a pick in bid order.

1.  **Lock and validate.** Each plan is checked as a whole: no coin or good is spent twice. Bonds are taken and repaid here.
2.  **Claims.** Contested sites and edges are settled by bid, then priority marker (§6.7).
3.  **Upkeep and production.** Buildings present at the start of the round run on goods held at the start of the round.
4.  **Construction.** New buildings and upgrades are placed and produce from next round. New links can carry goods this round.
5.  **Investments.** Goods sent to projects arrive.
6.  **Market.** Each stall clears (§6.3); orders marked for import are topped up; the round's tolls are paid.
7.  **City.** Districts are marked served or unserved; dividends and pips are paid out; bond interest enters the city fund; the fund buys for the queue; at most one project is founded and its shares issued.
8.  **Close.** Storage caps apply, the priority marker passes, the next prices are posted and a settlement report is saved for replay.

### Match length and the short format

Eighteen rounds at one a day is up to 18 days in the worst case, though rounds resolve early when everyone locks. Round 0 adds at most one more day.

**New in v0.5.** v0.4 asked whether a 12-round short format keeps the arc and whether it should be the asynchronous default. Design reasoning cannot settle that, but it can say what the short format is, so the simulation can test it. Cutting six rounds and changing nothing else would not work: a district needs six served rounds to reach class III, so anything founded after round 6 could never get there.

| Setting                         | Standard              | Short                |
|---------------------------------|-----------------------|----------------------|
| Rounds                          | 18                    | 12                   |
| Pips to raise a class           | 3                     | 2                    |
| Starting coins                  | 12                    | 18                   |
| Electrification begins (module) | Round 10              | Round 7              |
| Council votes (module)          | After rounds 6 and 12 | After rounds 4 and 8 |

The board, prices, costs, caps and bond terms are the same in both. The extra starting coins stand in for the two slowest opening rounds. The bond's 4-vote penalty is unchanged, which makes a bond held to the end slightly cheaper in the short format; the simulation should check that.

The standard 18 rounds stay the reference that all numbers are tuned on. The short format becomes the asynchronous default only if it meets the same targets in §11 and passes the two arc checks listed there. That decision stays open (§13).

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
- **Do the building caps work?** Three buildings each at four players may be too thin to feel like an engine. **New in v0.5:** compare a cap of three against a cap of four at four players on the same 20-node board (§4).
- **Is brick stranded late?** Its demand comes from building and founding, both of which fade.
- **Do tolls matter?** If links never change a plan, the spatial layer is decoration.
- **Is the import a valve or a supply?** (New in v0.5.) Imports should rescue a locked table and otherwise go unused. If bots import every round, the price or the cap is too soft; if a table still locks, it is too hard (§6.3).
- **Does round 0 price the starts?** (New in v0.5.) If winning bids stay near zero, the starts are equal enough to deal. If the first pick wins far more often even after paying, the bid is not doing its job (§6.9).
- **Does the short format keep the arc?** (New in v0.5.) Run the 12-round settings of §8 against the same targets as the standard game.

### Method

| Layer            | Method                                               | Why                                                                                                                                                    |
|------------------|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| Player decisions | Bots, sampled                                        | The space is too large to enumerate                                                                                                                    |
| Maps             | Terrain and link shuffles, a few hundred per setting | The game has no dice; the shuffle is what makes matches differ                                                                                         |
| Player count     | 2, 3 and 4, reported separately                      | Balance does not transfer between counts                                                                                                               |
| Design knobs     | Full grid                                            | Building costs, starting coins, stall size, dividend rate, votes per share, bond terms. New in v0.5: buildings per player, import price and import cap |

**Bots.** Six scripted: raw specialist, workshop builder, district founder, cash hoarder, free-rider, and an adaptive bot that follows the project queue. One searching bot tries many random continuations at each decision and keeps the best; a score far above every scripted bot means an exploit. Scripted bots need a little randomness in their choices, otherwise every match on one map is the same match. In round 0 the scripted bots bid zero with a ranking that suits their script, and the searching bot is free to bid.

**Variants to compare, one at a time:** stall-level pricing against the proposal's formula; shares against end-game contribution points; city fund against a free city contribution every third round; reserved district plots against plots a player may build on. New in v0.5: imports on against imports off; round 0 against a random deal; the short format against the standard game.

### Targets (proposed, not yet agreed)

- No seat wins more than 55% or less than 45% of mirrored two-player matches.
- The best bot's median vote total is within about 15% of the second best.
- The free-rider loses to the district founder in most matches, but not all.
- Shares supply between a quarter and a half of the winner's votes.
- At least four of the five plots are founded by round 15 in most matches.
- No stall sits empty or full for more than a quarter of all rounds.
- A player who falls behind by round 6 still has an affordable action every round.

New in v0.5:

- Imports are under about 5% of all units bought, and with imports on no match reaches a state where no player can build for want of brick.
- With round 0 on, the first pick's win rate at four players is within about 5 points of the last pick's.
- Short format, arc check one: at least three of the five plots are founded by round 10 in most matches.
- Short format, arc check two: at least one district reaches class III in most matches.

For each module in §7, the same three measures v0.3 set for cross-axis actions: how often it is used, when, and whether its users win more. A small, map-dependent edge is the target.

## 12. Build order

The server comes last, after the economy is proven.

| Stage                   | What is built                                                                                                          | Done when                                                                                                                                       |
|-------------------------|------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| 1\. Headless simulation | The resolver, the bots, the knob sweep (§11)                                                                           | Identical inputs give identical results, coins and goods reconcile every phase, and a configuration meets the targets                           |
| 2\. Grey-box on device  | 20 circles, the three HUD strips, plan builder, settlement report; one human against bots                              | Twenty matches played by hand; the sell-or-invest choice feels close at round 9                                                                 |
| 3\. Moderated play      | Five to eight outside players against bots                                                                             | Each can explain one price change and name an alternative they considered. New in v0.5: each can also say why they bid what they bid in round 0 |
| 4\. Online              | Authoritative server, locked plans, deadlines, reconnects, bot takeover. New in v0.5: matches by invite link only (§8) | Every client reaches the same state each round; a repeated request never settles a round twice                                                  |
| 5\. Modules             | §7, one at a time, each through simulation first                                                                       | Each meets its use, timing and win-rate measures                                                                                                |

The grey-box has no theme, art or animation. If grey circles and six grey bars are tense at round 9, the theme will make a good game better. If they are not, no theme will rescue it.

## 13. Open questions and what changed

### Answered in v0.5

Six of the eight questions [v0.4](https://claude.ai/artifact/22Bd9p6wc5BSn26yGS5dNj) left open are answered here by design reasoning. Every number in an answer is still a proposal for the simulation.

| v0.4 question                                            | Answer                                                                  | Main reason                                                                                                                                            | Where |
|----------------------------------------------------------|-------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-------|
| Does four players need a 24-node board?                  | No. One 20-node board at every count                                    | The caps already hold total industry at 10 to 12 buildings; 24 nodes is the legibility ceiling at the busiest table; a second board doubles the tuning | §4    |
| Should the market import goods nobody produces?          | Districts never import. Players may, at 10 or 16 coins, 2 units a round | A missing district good is a signal and takes nothing away. A missing brick stops every build at the table, which is a locked game                     | §6.3  |
| Does the stall need more than six slots at four players? | No. Six at every count                                                  | Stalls are loaded by buildings, and the caps keep buildings constant across counts; the price ladder is built on six                                   | §6.3  |
| Should starting works be dealt or drafted?               | Neither. One sealed bid for pick order in round 0                       | A deal ignores unequal starts; a draft costs up to four days of deadlines; the bid is one step and reuses §6.7                                         | §6.9  |
| Is hidden storage worth testing?                         | Parked, not planned                                                     | It breaks the first rule of §1, and the hidden plan already supplies the uncertainty                                                                   | §8    |
| Friends only, or open matchmaking?                       | Friends by invite link first, bots fill empty seats                     | An open lobby at launch is mostly bots and needs ratings and moderation that say nothing about the game                                                | §8    |

Two of these lean on judgment more than the rest. Round 0 adds a decision before a new player can read the map, and friends-first is a product call as much as a design one. Both are easy to reverse: a zero bid by all players is a deal, and open matchmaking can be added on the same server.

### Still open

- Should the 12-round short format be the default for asynchronous play? v0.5 defines the format (§8) and its two arc checks (§11). The simulation says whether it keeps the arc; the default is then a choice.
- Should some district plots be open to player building, so land is contested between city and industry? This remains a simulation variant (§11). The design leans against it, because building on a plot is the one move that would take a shared opportunity away from every rival.
- Are three buildings each enough at four players? Narrowed from v0.4: the 24-node board is ruled out, and the test is now a cap of three against a cap of four on the same board (§4).

### New questions raised by v0.5

- Are 10 and 16 coins and a cap of 2 the right import terms, and should imports pay a toll like other goods?
- Should the last picker in round 0 pay nothing, or should every bid be paid?
- Is 18 starting coins the right head start for the short format?

### Dropped from v0.3

- Rising water, elevation bands, dikes, reclaiming and the quota strip.
- The three flood-based cross-axis candidates (pawn the dike, open the sluice, salvage). The bond takes their place.
- Solo as the primary mode. Solo play against bots remains.
- The 13-site winning engine. Building caps by player count replace it.
- The river-channel terrain, replaced by farmland.

### Dropped from the Living City proposal

- The price formula, contribution points, the free city contribution every third round, the six-unit delivery cap and public contracts. §6 gives the replacement for each.

### Dropped or parked in v0.5

- The 24-node board for four players.
- A larger stall for four players.
- A sequential draft and a plain deal of starting works, both replaced by round 0.
- Hidden storage, parked until play shows a need.
- Open matchmaking at launch, deferred until friend matches show the numbers.
