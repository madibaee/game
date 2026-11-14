# First findings

A reading of the three reports in this folder (300 bot matches per setting, v0.4 rules unless
noted). The bots are plausible players, not optimal ones. Where a finding depends on how the
bots play rather than on the rules, it says so.

## Against the §11 targets (v0.4)

| Target | Result |
| --- | --- |
| Mirrored two-player seats within 45% to 55% | Met: 49% / 51% |
| Best bot within 15% of second | Missed at 3 and 4 players: the founder leads by 21% and 17% |
| Free-rider loses to founder in most matches, not all | Met: founder ahead in 61% / 75% / 80% at 2 / 3 / 4 players |
| Shares are a quarter to a half of the winner's votes | Met: 31% to 35% |
| Four of five plots founded by round 15 | Met: 60% / 84% / 96% of matches. Two players is slow |
| No stall empty or full more than a quarter of rounds | Missed badly: the consumer goods stall is empty about 70% of rounds, raw stalls are full 35% to 50% |
| Trailing player always has an affordable action | Met |

## The seven questions

1. **Is money scarce? No.** The median seat holds 43 coins after round 6 and 245 at the end
   (four players). A seat reaches its building cap by round 3 and then has only upgrades to
   buy, about 60 coins in all. Cash ends up as the largest single source of votes for most
   bots. Costs, upkeep or the 10-coins-a-vote rate need to move a long way; the example sweep
   shows upkeep 3 and a lower processed price table together bring final coins to about 90.
2. **Do shares dominate? Not by volume, but investing is the best line.** Only 8% of goods are
   invested, because a project takes six or seven units and there are five projects. Shares
   still supply about a third of the winner's votes, and the bot that invests everything wins
   54% of four-player matches against a fair 25%.
3. **Does anyone free-ride? No.** The free-rider wins 13% at four players and finishes behind
   the founder four times in five.
4. **Is the bond a decision? Yes, a small one.** About a fifth of seats borrow in round 1 and
   half never do. A bot that refuses to borrow wins as often as its borrowing twins (23% against
   a fair 25%). Almost every bond is repaid before the election.
5. **Do the building caps work? They bind too early.** At four players 85% of seats are at the
   cap of three, reached at a median of round 3, before the city has shown what it will buy.
   The board ends with nine raw works and under three workshops, while districts at class II
   and III ask for processed goods nobody can add capacity for. Over half of all district
   rounds go unserved. A cap of four at four players eases the lock (36% of seats at the cap)
   and closes the gap between the top bots, but does not fix the shortage on its own.
6. **Is brick stranded late? Yes.** In the last third the brick stall is full 86% of rounds at
   four players, the price sits at the floor, and about 38 bricks a match are thrown away at
   the storage cap.
7. **Do tolls matter? A little.** Tolls are 3% of sales income. They do change plans: bots lay
   about four links a match purely to stop paying a rival, and six when the toll is 3.
   Reaching project plots matters more than the toll itself, since somebody has to lay the
   link to each plot.

## Other things the runs show

- **Starting works are far from equal.** At four players a seat starting on brick wins 8% of
  matches; timber and food starts win about 30%. That supports the v0.5 round-0 bid. With
  scripted bots bidding zero, the last picker (left with brick) wins 9%.
- **The searching bot finds a cash line.** It beats the best scripted bot by 19% of votes at
  three players and wins 97% of two-player matches, taking most of its votes from coins earned
  on processed goods at the top of the price table. That is the exploit check of §11 firing:
  the processed-goods shortage pays whoever owns a workshop.
- **Two players is a different game.** Only 3.2 of 5 projects are founded and money piles up
  faster. It needs its own settings, as the doc expects.
- **v0.5 imports are a valve.** 2% to 3% of units bought are imported, under the 5% target,
  and rounds where nobody can build for want of brick all but vanish.
- **Short format.** It passes both arc checks at four players (three plots by round 10 in 94%
  of matches, a class III district in 99%) and at three players (70%, 98%), but not at two
  (33% for the first check). Shares rise to about half the winner's votes, the top of the
  target band, and the gap between bots narrows.
- **Contribution points in place of shares** drop shares to 2% of the winner's votes and hand
  the game to the workshop builder, which backs the doc's reason for replacing them.
- **Free city contribution in place of the city fund** changes nothing measurable.

## What I would test next

Raise the sinks before touching anything else: upkeep, building and upgrade costs, and coins
per vote. Then look at the processed price table and the class II and III demands together
with the cap, since the consumer goods shortage drives the empty stall, the unserved
districts and the cash line at once.
