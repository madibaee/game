# Proposed rule edits from the v0.4 gap review

**Status: proposed. None of these is in the rules.**

The gap review of 2026-11-14 read rules v0.4 for places where two people could resolve the same round differently, and left 28 suggested edits on the v0.4 document. They have not been reviewed or accepted, so `docs/design/theme-and-board.md` does not contain them. They were written against v0.4, and v0.5 has since reworded a few of the passages they touch (the Start bullet in §6.2 and the city fund sentence in §6.6), so check each against the current wording when applying it.

To accept one, apply it to the rules in its own commit (for example `rules: links must touch own network`) and change its status below. To turn one down, change its status and add a line saying why.

The grey-box prototype and the simulator each had to pick a reading where v0.4 is silent. Their choices are listed in the root `README.md` and `sim/README.md`, and some differ from the edits proposed here; accepting an edit may mean changing one of them.

| # | Section | Status | Where | Proposed edit |
| --- | --- | --- | --- | --- |
| G01 | §6.1 | Proposed | "Place one tier-I building on a free…" | Add: ", up to your building cap (§4); the starting works counts towards it" |
| G02 | §6.1 | Proposed | "Build one link on a free candidate…" | Add: "that touches the core, one of your buildings or one of your links" |
| G03 | §6.1 | Proposed | New paragraph | Add: "The three actions may be any mix, and an action may be repeated, except Trade: one basket per round. Upgrade applies only to a building that stood at the start of the round, one tier per building per round." |
| G04 | §6.2 | Proposed | "1 coin per running building per round;…" | Add: "in the plan at no action. An idle building, or one that makes nothing, pays no upkeep" |
| G05 | §6.2 | Proposed | "Start. Each player has 12 coins, 2…" | Add: ", which that player owns" |
| G06 | §6.2 | Proposed | New paragraph | Add: "Workshops. The plan sets how many batches each workshop runs, up to its tier and the inputs held. Goods the plan sells or invests cannot also feed a recipe." |
| G07 | §6.2 | Proposed | "Storage. Each player holds at most 8…" | Add: "The plan ranks goods for discard, cheapest first by default." |
| G08 | §6.2 | Proposed | New paragraph | Add: "Paying. A plan must be payable from coins held at lock plus any bond taken that round. Sale income, dividends and tolls received do not count. Buy orders, bids and the tolls a plan could incur are reserved in full and the unused part returned." |
| G09 | §6.3 | Proposed | "Sell orders are accepted up to the…" | Add: "left after step 1" |
| G10 | §6.3 | Proposed | "The city consumes its demand from the…" | Replace "this round, newest district first." with "this round. Districts are served oldest first, the core before any district and the residential before the commercial of the two starting ones. A district takes its goods only when all of them are in stock; otherwise it takes none." |
| G11 | §6.3 | Proposed | "All trades settle at the round's posted…" | Add: "Leftovers are dealt one at a time from the marker holder clockwise. Seat order and the first holder come from the match seed." |
| G12 | §6.4 | Proposed | New paragraph | Add: "The five projects, each a plot and a district type, are put in order by the match seed, and the next is revealed when one is founded. Players may invest in either project shown. If both are completed in one round, the first in the queue is founded and the other is founded the round after." |
| G13 | §6.4 | Proposed | "Shares. Each raw unit a player invests…" | Add: "Shares are issued when the project is founded; goods in a project still unfounded on election day earn nothing." |
| G14 | §6.4 | Proposed | "Class. A fully served round earns a…" | Add: "The new demand applies from the next round. Class III is the top and earns no more pips." |
| G15 | §6.5 | Proposed | "A link belongs to the player who…" | Add: "Each rival who crosses pays separately." |
| G16 | §6.5 | Proposed | New paragraph | Add: "Routes. Stored goods have no location; each player has one stockpile. A building whose site has no path of built links to the core at the start of the round makes nothing and is shown starved. A sale ships to the core, and an investment to the plot, from whichever of the player's buildings gives the route with the fewest tolls, chosen automatically. Goods bought at the market reach the stockpile without crossing a link." |
| G17 | §6.5 | Proposed | New paragraph | Add: "City links. The seven district plots are joined to the core from the start by city links, which everyone uses free." |
| G18 | §6.6 | Proposed | "Bond. Taking a bond gives 12 coins…" | Add: "Bonds are taken and repaid at the start of resolution, so the 12 coins can be spent in the same plan. Interest is charged in the City step on every bond open then, including one taken that round." |
| G19 | §6.6 | Proposed | "Bond. Taking a bond gives 12 coins…" | Add: "A player who cannot pay interest holds the shortfall as debt, which is cleared from the next coins received and costs 1 vote per coin still owed on election day." |
| G20 | §6.6 | Proposed | "City fund. Interest and winning site bids…" | Replace "site bids" with "claim bids" |
| G21 | §6.6 | Proposed | "City fund. Interest and winning site bids…" | Add: "It buys the first missing good, in the order the project lists them, that the stall has in stock; if none is in stock it buys nothing." |
| G22 | §6.7 | Proposed | "When two players claim the same site…" | Replace "two players claim" with "two or more players claim" |
| G23 | §6.7 | Proposed | "When two players claim the same site…" | Add: "An uncontested claim pays no bid." |
| G24 | §6.7 | Proposed | "When two players claim the same site…" | Add: ", or to the tied player nearest clockwise from the holder" |
| G25 | §6.7 | Proposed | "When two players claim the same site…" | Add: "Any other action in the plan that the loss makes impossible is cancelled and its coins and goods returned." |
| G26 | §6.8 | Proposed | "Goods left in storage count for nothing.…" | Add: "Buildings count whether running or idle, and the campaign fund rounds down." |
| G27 | §8 | Proposed | "Bots from day one. The scripted bots…" | Add: "in a row, until the player returns" |
| G28 | §8 Resolution order | Proposed | "Lock and validate. Each plan is checked…" | Add: "Bonds are taken and repaid here." |
