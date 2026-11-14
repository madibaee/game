# First findings

A reading of the three reports in this folder: 300 bot matches per setting, on the rules in
`docs/design/theme-and-board.md` with the 28 gap-review edits applied. Numbers are v0.4 unless
noted. The bots are plausible players, not optimal ones. Where a finding depends on how the
bots play rather than on the rules, it says so.

## Against the §11 targets (v0.4)

| Target | Result |
| --- | --- |
| Mirrored two-player seats within 45% to 55% | Met: 49% / 51% |
| Best bot within 15% of second | Missed at 3 players (founder leads by 21%), borderline at 2 and 4 (15%) |
| Free-rider loses to founder in most matches, not all | Met at 3 and 4 players (70%, 84%). Missed at 2, where the free-rider comes out ahead 56% of the time |
| Shares are a quarter to a half of the winner's votes | Met: 37% to 43% |
| Four of five plots founded by round 15 | Met: 57% / 82% / 93% of matches. Two players is slow |
| No stall empty or full more than a quarter of rounds | Missed badly: the consumer goods stall is empty about 55% of rounds, raw stalls are full 40% to 50% |
| Trailing player always has an affordable action | Missed in 4% to 9% of matches: a seat in debt with nothing in store |

## The seven questions

1. **Is money scarce? No.** The median seat holds 43 coins after round 6 and 237 at the end
   (four players). A seat reaches its building cap by round 3 and then has only upgrades to
   buy, about 60 coins in all. Cash is the largest single source of votes for most bots. Costs,
   upkeep or the 10-coins-a-vote rate need to move a long way; in the example sweep, upkeep 3
   with a lower processed price table brings final coins to about 77.
2. **Do shares dominate? Not by volume, but investing is the best line.** Only 8% of goods are
   invested, because a project takes six or seven units and there are five projects. Shares
   still supply over a third of the winner's votes, and the bot that invests everything wins
   58% of four-player matches against a fair 25%.
3. **Does anyone free-ride? Not at three or four players.** The free-rider wins 7% at four
   players. At two players it holds its own against the founder, as the doc feared: a shared
   benefit is worth little with one rival.
4. **Is the bond a decision? Yes.** About a fifth of seats borrow in round 1 and half never
   do. A bot that refuses to borrow wins a little less often than its borrowing twins (20%
   against a fair 25%). Almost every bond is repaid before the election.
5. **Do the building caps work? They bind too early.** At four players 84% of seats are at the
   cap of three, reached at a median of round 3, before the city has shown what it will buy.
   The board ends with nine raw works and just over two workshops, while districts at class II
   and III ask for processed goods nobody can add capacity for. Almost half of all district
   rounds go unserved. A cap of four at four players eases the lock (36% of seats at the cap)
   but does not fix the shortage on its own.
6. **Is brick stranded late? Yes.** In the last third the brick stall is full 82% of rounds at
   four players, the price sits near the floor, and about 36 bricks a match are thrown away at
   the storage cap.
7. **Do tolls matter? Under the merged rules, not at all: no toll is ever paid.** Two
   gap-review edits combine to remove them. Goods may ship from any of a player's buildings by
   the route with the fewest tolls (G16), and every plot has a free city link to the core
   (G17). Each player starts with an own link from a works to a plot, so a toll-free route
   always exists. Before those edits, with goods shipping from the works that made them and
   plot links laid by players, tolls were 3% of sales income and bots laid about four links a
   match to dodge them. If links are meant to matter, one of the two edits has to give.

## Other things the runs show

- **Starting works are far from equal.** At four players a seat starting on brick wins 8% of
  matches; timber and food starts win about a third. That supports the v0.5 round-0 bid. With
  scripted bots bidding zero, the last picker wins 12%. The searching bot chose to bid about 2
  coins on average.
- **The searching bot finds a cash line.** It beats the best scripted bot by 44% of votes at
  three players and wins 92% of two-player matches, taking most of its votes from coins
  earned on processed goods at the top of the price table. That is the exploit check of §11
  firing: the processed-goods shortage pays whoever owns a workshop. At four players it is
  level with the best script.
- **Two players is a different game.** Only 3.3 of 5 projects are founded, and the free-rider
  is viable. It needs its own settings, as the doc expects.
- **v0.5 imports are a valve.** 3% of units bought are imported, under the 5% target, and
  rounds where nobody can build for want of brick drop from 2% of matches to none.
- **v0.5 as a whole is closer to the targets than v0.4**: the top two bots are within 3% to
  10% of each other and the founder beats the free-rider about 80% of the time at every count.
- **Short format.** It passes both arc checks at three and four players (three plots by round
  10 in 74% and 95% of matches, a class III district in 97% and 99%) but not at two (36% for
  the first check). Shares rise to 57% to 62% of the winner's votes at three and four players,
  above the target band, and the founder wins 66% at four.
- **Contribution points in place of shares** drop shares to 3% of the winner's votes and hand
  the game to the workshop builder, which backs the doc's reason for replacing them.
- **Free city contribution in place of the city fund** changes nothing measurable.

## A new gap in the rules

§6.3 gives sellers room for the free slots plus the city's demand. Since G10 a district that
lacks one good takes none of its goods, so sellers can put more into a stall than the city
removes and the stall ends above six. The simulator discards what does not fit and lets the
sellers keep the coins. The rules need a line for this.

## What I would test next

Raise the sinks before touching anything else: upkeep, building and upgrade costs, and coins
per vote. Then look at the processed price table and the class II and III demands together
with the cap, since the consumer goods shortage drives the empty stall, the unserved
districts and the cash line at once. Decide separately whether tolls should exist.
