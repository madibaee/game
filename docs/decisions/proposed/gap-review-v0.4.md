# Proposed rule edits from the v0.4 gap review

**Status: applied to the rules in one pull request, one commit per edit. They become rules when that pull request is merged.**

The gap review of 2026-11-14 read rules v0.4 for places where two people could resolve the same round differently, and proposed these 28 edits. Each was applied to `docs/design/theme-and-board.md` in its own commit, named `rules: ... ` and tagged with its number below, so one edit can be dropped or reworded without touching the others.

The grey-box prototype and the simulator each had to pick a reading where v0.4 was silent. Their choices are listed in the root `README.md` and `sim/README.md`, and some differ from these edits; see the pull request for the list of what each would need to change.

| # | Section | Status | Where | Proposed edit |
| --- | --- | --- | --- | --- |
| G01 | §6.1 | Applied in the gap-review pull request | "Place one tier-I building on a free…" | Add: ", up to your building cap (§4); the starting works counts towards it" |
| G02 | §6.1 | Applied in the gap-review pull request | "Build one link on a free candidate…" | Add: "that touches the core, one of your buildings or one of your links" |
| G03 | §6.1 | Applied in the gap-review pull request | New paragraph | Add: "The three actions may be any mix, and an action may be repeated, except Trade: one basket per round. Upgrade applies only to a building that stood at the start of the round, one tier per building per round." |
| G04 | §6.2 | Applied in the gap-review pull request | "1 coin per running building per round;…" | Add: "in the plan at no action. An idle building, or one that makes nothing, pays no upkeep" |
| G05 | §6.2 | Applied in the gap-review pull request | "Start. Each player has 12 coins, 2…" | Add: ", which that player owns" |
| G06 | §6.2 | Applied in the gap-review pull request | New paragraph | Add: "Workshops. The plan sets how many batches each workshop runs, up to its tier and the inputs held. Goods the plan sells or invests cannot also feed a recipe." |
| G07 | §6.2 | Applied in the gap-review pull request | "Storage. Each player holds at most 8…" | Add: "The plan ranks goods for discard, cheapest first by default." |
| G08 | §6.2 | Applied in the gap-review pull request | New paragraph | Add: "Paying. A plan must be payable from coins held at lock plus any bond taken that round. Sale income, dividends and tolls received do not count. Buy orders, bids and the tolls a plan could incur are reserved in full and the unused part returned." |
| G09 | §6.3 | Applied in the gap-review pull request | "Sell orders are accepted up to the…" | Add: "left after step 1" |
| G10 | §6.3 | Applied in the gap-review pull request | "The city consumes its demand from the…" | Replace "this round, newest district first." with "this round. Districts are served oldest first, the core before any district and the residential before the commercial of the two starting ones. A district takes its goods only when all of them are in stock; otherwise it takes none." |
| G11 | §6.3 | Applied in the gap-review pull request | "All trades settle at the round's posted…" | Add: "Leftovers are dealt one at a time from the marker holder clockwise. Seat order and the first holder come from the match seed." |
| G12 | §6.4 | Applied in the gap-review pull request | New paragraph | Add: "The five projects, each a plot and a district type, are put in order by the match seed, and the next is revealed when one is founded. Players may invest in either project shown. If both are completed in one round, the first in the queue is founded and the other is founded the round after." |
| G13 | §6.4 | Applied in the gap-review pull request | "Shares. Each raw unit a player invests…" | Add: "Shares are issued when the project is founded; goods in a project still unfounded on election day earn nothing." |
| G14 | §6.4 | Applied in the gap-review pull request | "Class. A fully served round earns a…" | Add: "The new demand applies from the next round. Class III is the top and earns no more pips." |
| G15 | §6.5 | Applied in the gap-review pull request | "A link belongs to the player who…" | Add: "Each rival who crosses pays separately." |
| G16 | §6.5 | Applied in the gap-review pull request | New paragraph | Add: "Routes. Stored goods have no location; each player has one stockpile. A building whose site has no path of built links to the core at the start of the round makes nothing and is shown starved. A sale ships to the core, and an investment to the plot, from whichever of the player's buildings gives the route with the fewest tolls, chosen automatically. Goods bought at the market reach the stockpile without crossing a link." |
| G17 | §6.5 | Applied in the gap-review pull request | New paragraph | Add: "City links. The seven district plots are joined to the core from the start by city links, which everyone uses free." |
| G18 | §6.6 | Applied in the gap-review pull request | "Bond. Taking a bond gives 12 coins…" | Add: "Bonds are taken and repaid at the start of resolution, so the 12 coins can be spent in the same plan. Interest is charged in the City step on every bond open then, including one taken that round." |
| G19 | §6.6 | Applied in the gap-review pull request | "Bond. Taking a bond gives 12 coins…" | Add: "A player who cannot pay interest holds the shortfall as debt, which is cleared from the next coins received and costs 1 vote per coin still owed on election day." |
| G20 | §6.6 | Applied in the gap-review pull request | "City fund. Interest and winning site bids…" | Replace "site bids" with "claim bids" |
| G21 | §6.6 | Applied in the gap-review pull request | "City fund. Interest and winning site bids…" | Add: "It buys the first missing good, in the order the project lists them, that the stall has in stock; if none is in stock it buys nothing." |
| G22 | §6.7 | Applied in the gap-review pull request | "When two players claim the same site…" | Replace "two players claim" with "two or more players claim" |
| G23 | §6.7 | Applied in the gap-review pull request | "When two players claim the same site…" | Add: "An uncontested claim pays no bid." |
| G24 | §6.7 | Applied in the gap-review pull request | "When two players claim the same site…" | Add: ", or to the tied player nearest clockwise from the holder" |
| G25 | §6.7 | Applied in the gap-review pull request | "When two players claim the same site…" | Add: "Any other action in the plan that the loss makes impossible is cancelled and its coins and goods returned." |
| G26 | §6.8 | Applied in the gap-review pull request | "Goods left in storage count for nothing.…" | Add: "Buildings count whether running or idle, and the campaign fund rounds down." |
| G27 | §8 | Applied in the gap-review pull request | "Bots from day one. The scripted bots…" | Add: "in a row, until the player returns" |
| G28 | §8 Resolution order | Applied in the gap-review pull request | "Lock and validate. Each plan is checked…" | Add: "Bonds are taken and repaid here." |
