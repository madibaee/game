# Self-play of the grey-box prototype

Run on 16 November 2026 against `prototype/` as it stands on `main` (rules v0.4, `config/economy.json`
preset `v0.4`, without the 28 gap-review edits). Nothing in the rules or numbers was changed.

## What was played

| How | Matches |
| --- | --- |
| One player seat with a fixed strategy against the prototype's bots: 14 strategies, 2, 3 and 4 players, 300 matches each | 12,600 |
| All-bot tables, for the comparison of bot styles, starting goods and seats | 2,700 |
| One match played by hand, choosing every action from the board state (3 players, seed 42) | 1 |
| One match played through the real page in a phone-size browser, all 18 rounds | 1 |

Reproduce the first two rows with `node prototype/test/selfplay.js 300`. With 300 matches a win rate
is good to about 3 points either way.

## Headline

1. **A person who plans beats the bots easily.** The hand-played match ended 93 votes to 63 and 49.
   The fixed strategies, which never react to rivals, still win up to 54% at four players.
2. **One line dominates at three and four players: an early consumer goods works, then invest.**
   The goods stall is empty in about 80% of rounds, so goods sell at 11 to 13 almost every round.
3. **Money is not scarce and it decides the election.** Bots finish with 240 to 370 coins. Campaign
   votes (coins divided by 10) are the largest source of votes for every style of play.
4. **The match is usually decided by round 10.** Close finishes are rare.
5. **No engine bug turned up.** No negative coins or goods in 15,300 matches, and no page errors in
   the browser match. The list of confusing spots is at the end.

## Win rate of the player seat, by strategy

An even chance is 50% / 33% / 25%. "Votes" is the player's mean total at four players, "best bot"
the mean of the strongest rival in the same matches.

| Strategy | 2 players | 3 players | 4 players | Votes (4p) | Best bot (4p) |
| --- | --- | --- | --- | --- | --- |
| Do nothing | 1% | 0% | 0% | 1.5 | 65.6 |
| Sell output only, never build | 19% | 2% | 0% | 17.6 | 66.4 |
| Build raw works to the cap, sell | 46% | 7% | 1% | 24.6 | 65.2 |
| The same, and upgrade everything | 33% | 5% | 1% | 25.6 | 64.6 |
| The same, with two bonds in round 1 | 38% | 5% | 2% | 24.1 | 63.4 |
| Raw works first, one workshop last | 37% | 18% | 21% | 45.6 | 70.3 |
| Tool works as the second building | 13% | 1% | 4% | 35.9 | 70.4 |
| Goods works as the second building | 24% | 14% | 34% | 50.0 | 66.4 |
| Goods works second, and invest own goods | 34% | 35% | **54%** | 64.1 | 63.2 |
| The same, with one bond in round 1 | 44% | **39%** | 53% | 64.8 | 65.1 |
| Raw works, upgrade, invest own goods | **55%** | 33% | 20% | 41.3 | 59.7 |
| Raw works, upgrade, buy goods to invest | 48% | 35% | 24% | 45.3 | 58.7 |
| Invest only, never build | 13% | 3% | 10% | 37.6 | 60.3 |
| One-round lookahead over the plans above | 45% | 35% | 38% | 56.4 | 63.8 |

What this says:

- **Selling raw goods alone cannot win at three or four players** (7% at best). The raw stalls are
  full in 40% to 66% of rounds there, so extra output does not sell. Upgrading raw works even lowers
  final coins at three players (223 against 297) because the upgrades cost more than the unsold
  goods return.
- **Shares are needed, but only on top of an income.** Investing without building loses. Adding
  investment to any building plan adds 15 to 20 votes.
- **Tools are a trap.** The tool works needs iron and timber, sells into a stall that is rarely
  empty at two players, and only higher-class districts ask for tools.
- **Two players is a different game.** With a cap of five works and one rival, raw works plus
  investing is best and the goods works is too slow.
- **A bond in round 1 is worth a little** (plus 4 to 10 points at two and three players, nothing at
  four). Two bonds are not better than none.

## The all-bot tables

| | 2 players | 3 players | 4 players |
| --- | --- | --- | --- |
| Rounds played | 18 | 18 | 18 |
| Round from which the winner led to the end (mean) | 6.6 | 9.8 | 10.7 |
| Matches decided by round 12 | 82% | 67% | 60% |
| Winning margin (mean votes) | 27.7 | 18.5 | 15.9 |
| Matches won by 2 votes or fewer | 5% | 10% | 13% |
| Mean votes per seat: shares / works / campaign | 14.8 / 6.4 / 37.0 | 16.9 / 7.3 / 33.3 | 14.1 / 7.3 / 23.8 |
| Coins at the end (mean) | 374 | 337 | 242 |
| Projects founded, of 5 | 3.0 | 4.3 | 4.5 |
| District-rounds unserved | 73% | 65% | 66% |
| Goods stall empty, share of rounds | 77% | 82% | 86% |
| Timber stall full, share of rounds | 29% | 49% | 66% |
| Tolls paid per match (1 coin each) | 11 | 31 | 50 |
| Contested claims lost per match | 0.6 | 1.6 | 2.0 |

Win rate by bot style (even chance 50 / 33 / 25):

| Style | 2 players | 3 players | 4 players |
| --- | --- | --- | --- |
| Workshop builder | 70% | 51% | 29% |
| Follows the queue | 47% | 37% | 40% |
| District founder | 38% | 26% | 29% |
| Raw specialist | 59% | 35% | 12% |
| Free-rider | 48% | 26% | 11% |

Win rate by starting works:

| Starting good | 2 players | 3 players | 4 players |
| --- | --- | --- | --- |
| Food | 64% | 43% | 35% |
| Iron | 39% | 29% | 28% |
| Timber | 45% | 31% | 19% |
| Brick | 52% | 31% | 18% |

Seats are even: 50 / 50, 33 / 34 / 34 and 26 / 23 / 26 / 25.

## Balance issues

1. **Coins pile up and have nowhere to go.** A seat reaches the building cap in a few rounds. In the
   hand-played match all three seats ended above 430 coins. At 10 coins a vote, that idle cash is
   about half of the final score.
2. **Consumer goods are underpriced to make and overpaid to sell.** One food and one timber (about 10
   coins) become two goods worth 22 to 26. A tier III goods works earned 66 to 78 coins a round in the
   hand-played match. Demand for goods grows with every district that rises in class, so the stall
   never fills.
3. **A whole round's sales clear at the price posted at the start.** Seven brick sold at 8 into an
   empty stall in one round. There is no reason to spread sales out.
4. **Rising in class can stop a district's dividends.** Commercial districts at class III and
   industrial districts from class II ask for tools. Hardly anyone makes tools, so such a district goes
   unserved from then on. In the hand-played
   match the player's seven-share district paid 7 coins a round at class I and II and nothing after it
   reached class III.
5. **Food is the best start and brick or timber the worst at four players** (35% against 18% to 19%).
   Food feeds the goods works and the food stall is the emptiest raw stall.
6. **The storage cap of 8 is small next to tier III output.** A tier III raw works makes 4 a round and a
   goods works 6. When a stall is full the surplus is discarded: more than 20 goods in the hand-played match.
7. **Tolls do not matter.** They are paid 11 to 50 times a match at 1 coin each, against incomes of 30 to
   80 coins a round.
8. **The match is decided early.** The winner leads for good from about round 10, and a third of the
   match is played out with the result known.

## Bugs and confusing rules

No crash, no negative balance and no rejected action for the scripted seat. These are the places where
a player is likely to be surprised:

1. **Round 1 cannot afford a second works without a bond.** 12 coins, less 1 upkeep, leaves 11. A works
   costs 10 and every free site also needs a link at 2. Sales do not fund the same round's builds, so
   the only round 1 build is on borrowed money. The page does not say so.
2. **A workshop needs its inputs in store at the start of the round.** Goods made or bought this round
   feed it next round, so a new workshop gives nothing for two rounds. The rules list on the page does
   not mention it.
3. **The prototype charges a bid on an uncontested claim.** The accepted rules (gap review) say an
   uncontested claim pays no bid. The prototype also still forgives unpaid bond interest. It predates
   those edits.
4. **One wrong quantity drops the whole trade basket.** The page prevents it with its plus and minus
   buttons, so this only shows when plans are submitted directly to the engine.
5. **Bots often race for the same link.** Ties go to the priority marker. The loser's goods still move,
   over the winner's link, for a toll of 1, so the contest has almost no stake.
6. **The last project often stalls.** An industrial project waiting for 4 iron stayed open from round 12
   to the end, because nobody at the table made iron for sale and the city fund buys one unit a round
   only when the stall has stock.
7. **The score chip shows minus votes after a round 1 bond** (4 votes per open bond). Correct by the
   rules, alarming without a note.

## The hand-played match in short

Three players, seed 42, brick start. Round 1: bond, link, food works. Round 3: goods works. Rounds 4
and 6: goods works to tier II and III. Brick and the first goods went into projects: 16 shares in four
districts by round 12. Result: 93 votes (38 shares, 12 works, 43 campaign) against 63 and 49. Mistakes
that cost votes: timber ran out twice because the stall was empty, and more than 20 goods were discarded over
the storage cap.

## Suggested next steps

The economy simulator's findings (`sim/reports/FINDINGS.md`) reached the first two independently.

1. Give coins a sink or make campaign votes dearer, so shares and works decide the election.
2. Lower the goods price table or raise the recipe's cost, and test a price that falls within the round.
3. Decide what a class III district does when tools are missing: partial service, or imports (v0.5).
4. Bring the prototype in line with the accepted gap-review rules before more human playtests.
5. Add the two missing lines to the page's rules list (round 1 needs a bond, inputs from store).
