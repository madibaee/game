# 0006. Friends by invite link first

- **Status:** adopted in rules v0.5 (draft). Numbers await the simulator.
- **Date:** 2026-11-14
- **Rules section:** §8, §12

## Context

v0.4 asked how matches are made: friends only at first, or open matchmaking with bots filling seats.

## Decision

Online play opens with invited friends only. A player starts a match and shares a link, and bots fill any seat still empty when the match begins. Open matchmaking with strangers waits until friend matches show there are enough players to fill a lobby.

## Why

- An open lobby at launch would be mostly bots, and solo play already offers a match against bots.
- Strangers need ratings, reporting, names that are safe to show and rules for players who walk away. That is server work with no bearing on whether the game is good.
- An 18-round asynchronous match needs every seat to keep coming back. Friends do; strangers leave.
- Friend matches still exercise everything in stage 4 of the build order: locked plans, deadlines, reconnects and bot takeover.

## Alternatives considered

- **Open matchmaking at launch.** Deferred, not rejected.

## What would change this

This is a product call as much as a design one, and it is easy to reverse: open matchmaking can be added on the same server once friend matches show the numbers.
