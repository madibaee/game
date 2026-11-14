# Rules changelog

One entry per tagged release of [theme-and-board.md](theme-and-board.md), newest first. Each entry says what changed and why. To read an old version in full, check out its tag, for example `git show rules-v0.4:docs/design/theme-and-board.md`. To see exactly what a release changed, `git diff rules-v0.4 rules-v0.5 -- docs/design/theme-and-board.md`.

Every number in the rules is a proposal until the economy simulator confirms it.

## Unreleased

The 28 edits from the v0.4 gap review, each closing a place where the rules could be read two ways. No new mechanics. The full list with wording is in [decisions/proposed/gap-review-v0.4.md](../decisions/proposed/gap-review-v0.4.md).

| Area | What is now stated | Edits |
| --- | --- | --- |
| Actions (§6.1) | Builds count against the cap, starting works included; a link must touch the core, your building or your link; actions may repeat except Trade; upgrades need a building that stood at the start of the round | G01 to G03 |
| Production (§6.2) | Idling is free and idle buildings pay no upkeep; the starting link path is owned; the plan sets workshop batches and discard order; a plan must be payable from coins held at lock | G04 to G08 |
| Market (§6.3) | Sell room is counted after buys; districts are served oldest first and all or nothing (was: newest goes short first); leftovers are dealt clockwise from the marker | G09 to G11 |
| Districts (§6.4) | Project order and reveal; shares issued at founding; class demand changes next round and class III is the top | G12 to G14 |
| Links (§6.5) | Each rival pays tolls separately; one stockpile per player and automatic cheapest route; an unlinked building is starved; plots are joined to the core by free city links | G15 to G17 |
| Bonds and city fund (§6.6) | Bonds settle at the start of resolution; unpaid interest becomes debt at 1 vote per coin; which good the fund buys | G18 to G21, G28 |
| Claims (§6.7) | Three-way contests, no bid when uncontested, tie-break, and cancelling actions that depended on a lost claim | G22 to G25 |
| Election and bots (§6.8, §8) | Idle buildings count, the campaign fund rounds down; takeover after two missed deadlines in a row, until the player returns | G26, G27 |

## v0.5 (2026-11-14), tag `rules-v0.5`

Draft. Answers six of the eight questions v0.4 left open and narrows the other two.

| Change | Why | Section | Decision |
| --- | --- | --- | --- |
| One 20-node board at every player count; the 24-node board for four players is dropped | The building caps already hold total industry at 10 to 12 buildings, 24 nodes is the legibility ceiling at the busiest table, and a second board doubles the tuning | §4 | [0001](../decisions/0001-one-board-for-every-player-count.md) |
| Players may import: an order marked "import if short" is topped up by rail at 10 coins (raw) or 16 (processed), at most 2 units a round. Districts and the city fund never import | A missing district good is a signal and takes nothing away. A missing brick stops every build at the table, which is a locked game | §6.3 | [0002](../decisions/0002-capped-player-imports.md) |
| The stall keeps six slots at every player count | Stalls are loaded by buildings, and the caps keep buildings constant across counts; the price ladder is built on six | §6.3 | [0003](../decisions/0003-six-stall-slots-at-every-count.md) |
| Round 0: starting works are chosen by one sealed bid for pick order. Bids go to the city fund; the last to pick pays nothing | A deal ignores unequal starts, a draft costs up to four days of deadlines, and the bid is one step that reuses §6.7 | §6.9 (new) | [0004](../decisions/0004-round-0-sealed-bid.md) |
| Hidden storage is parked, not planned | It breaks the first rule of §1, and the hidden plan already supplies the uncertainty | §8 | [0005](../decisions/0005-hidden-storage-parked.md) |
| Online play opens with friends by invite link; bots fill empty seats. Open matchmaking is deferred | An open lobby at launch is mostly bots and needs ratings and moderation that say nothing about the game | §8, §12 | [0006](../decisions/0006-friends-by-invite-first.md) |
| The 12-round short format is defined: 2 pips per class, 18 starting coins, modules start earlier | So the simulator can test it. Whether it becomes the asynchronous default stays open | §8, §11 | none yet |
| The city fund also receives round-0 bids | Follows from round 0 | §6.6 | 0004 |
| Resolution order: imports are topped up in the market step; round 0 runs once before round 1 | Follows from imports and round 0 | §8 | 0002, 0004 |
| Simulation plan gains knobs (buildings per player, import price, import cap), variants (imports on/off, round 0 against a deal, short against standard) and four targets | Each new rule needs its own test | §11 | |

Still open after v0.5:

- Should the short format be the default for asynchronous play?
- Should some district plots be open to player building?
- Is a cap of three buildings enough at four players, or should it be four on the same board?
- Are 10 and 16 coins and a cap of 2 the right import terms, and should imports pay tolls?
- Should the last picker in round 0 pay nothing, or should every bid be paid?
- Is 18 starting coins the right head start for the short format?

## v0.4 (2026-11-11), tag `rules-v0.4`

The baseline in this repository. Compared with v0.3 (not in the repository), it removed the flood, elevation bands and dikes, and made the game multiplayer with simultaneous planning, asynchronous online play and bots. The core is a stall-level market, district shares and class, toll links and municipal bonds, with four later modules staged in §7. Its §13 lists what it dropped from v0.3 and from the Living City proposal.
