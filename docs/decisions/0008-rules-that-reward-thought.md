# 0008. Rules that reward thought

- **Status:** adopted in rules v0.6 (draft). Numbers set by self-play of the prototype; the economy simulator has not confirmed them.
- **Date:** 2026-11-16
- **Rules sections:** §4, §6.2 to §6.5, §6.8

## Context

Self-play of the v0.4 prototype ([report](../sim-reports/2026-11-16-prototype-self-play.md)) showed a game that did not need thinking:

- One fixed build order (an early consumer goods works, then invest) won 54% of four-player matches against the bots, where an even chance is 25%.
- A whole round's sales cleared at the opening price, so the best sale was always everything at once.
- Coins had no use after the building cap was reached. Seats ended with 240 to 370 coins and the campaign fund was the largest source of votes.
- The winner led for good from about round 10.
- A district that rose to a class nobody could supply stopped paying dividends for the rest of the match.
- A seat with no coins whose route to the market crossed a rival link could not sell, and so could never recover.

The request was to change the game so that it truly requires thought.

## Decision

Ten rule and number changes, listed in the [changelog](../design/CHANGELOG.md) under v0.6. The three that carry most of the weight:

1. **Prices slide with every unit traded.** What a good is worth now depends on how much of it you and your rivals sell this round, so selling becomes a question of how much, of what and when.
2. **Growth is limited by coin, not by the cap.** Works cost more to build and to run, the caps are one higher, and a campaign vote costs 25 coins. A coin spent on a works has to earn its way back, and a works that floods its own market does not.
3. **Districts can fall as well as rise.** Shares keep their votes only while the district is supplied.

The prototype's bots were rebuilt for the same reason. Each bot now drafts a plan in five styles, plays every draft forward to the election, and locks the one that ends furthest ahead.

## Why

- A rule set has depth when the best move changes with the state of the board. Sliding prices, upkeep by tier and district decline all make the value of an action depend on what others are doing.
- Each change answers one measured problem, so each can be reverted on its own if a later test disagrees.
- The measure of success is in the [v0.6 report](../sim-reports/2026-11-16-v0.6-self-play.md): no fixed build order beats the bots any more, and a player does better the further ahead it looks.

## Alternatives considered

- **Only make the bots stronger.** The v0.4 rules would still have one best line; stronger bots would simply all play it.
- **A bonus for the largest shareholder of each district.** Tested: it widened the winning margin instead of narrowing it.
- **Larger projects (nine goods each).** Tested: shares grew to half of all votes, finishes were no closer, and brick starts pulled ahead again.
- **Paying upkeep at the end of the round, with the shortfall as debt.** It would remove the last way to stall, but it turns debt into free one-round credit.

## What would change this

- The economy simulator, once it plays v0.6, disagreeing with the prototype's numbers.
- Human playtests finding the sliding price too hard to predict on a phone. The trade sheet shows what an order will bring, which is the mitigation.
- The open items in the changelog: the consumer goods stall is still empty more than half the time, timber is the strongest start at four players, and two-player matches are still decided early. Round 0 (§6.9), which the prototype does not have yet, is the designed answer to unequal starts.
