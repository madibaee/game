# 0004. Round 0: sealed bid for starting works

- **Status:** adopted in rules v0.5 (draft). Numbers await the simulator.
- **Date:** 2026-11-14
- **Rules section:** §6.9

## Context

v0.4 asked whether starting works should be dealt or drafted. Terrain is shuffled, so starts are not equal: food has two hungry districts from round 1 and brick is in every build, while iron waits for an industrial district.

## Decision

Neither. Before round 1 the app marks four starting works, one on each terrain at equal distance from the core. Every player ranks the four and bids zero or more of their 12 coins in one sealed step. The highest bidder gets their first choice, the next their best remaining choice, and so on; equal bids go by the priority marker. Every player pays their bid to the city fund except the last to pick, who pays nothing. A seat that misses the deadline, a bot on its simplest setting and the tutorial bid zero with the app's suggested ranking.

## Why

- The table prices the imbalance itself, so no start has to be tuned to be equal.
- It is one deadline, and it reuses the sealed bid of §6.7, so players meet that mechanic before a contested site depends on it.
- The coins land in the city fund, so a hot round 0 brings the first project forward.

## Alternatives considered

- **A deal.** Hands out the difference between starts at random and offers no remedy.
- **A draft.** Picks in turn cost up to one 24-hour deadline each in asynchronous play, so four players could wait four days for round 1.

## What would change this

This leans on judgment more than most: it adds a decision before a new player can read the map. It is easy to reverse, because a zero bid by all players is a deal. Simulator checks: if winning bids stay near zero, the starts are equal enough to deal; if the first pick wins far more often even after paying, the bid is not doing its job. Target: at four players the first pick's win rate is within about 5 points of the last pick's. Still open: whether the last picker should pay.
