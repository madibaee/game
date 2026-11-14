# 0003. Six stall slots at every player count

- **Status:** adopted in rules v0.5 (draft). Numbers await the simulator.
- **Date:** 2026-11-14
- **Rules section:** §6.3

## Context

v0.4 asked whether the stall needs more than six slots at four players.

## Decision

Each stall has six slots at two, three and four players. Stall size stays in the simulator's knob grid as one number for all counts.

## Why

- A stall is loaded by buildings, not by seats, and the caps hold the table at 10 to 12 buildings at every count.
- The city's demand does not grow with seats either. What four players add is more orders competing for the same room, which is the fill uncertainty the market is meant to have.
- The price ladder is built on six slots, so a larger stall would mean a second price table.

## Alternatives considered

- **A larger stall at four players.** Rejected: it needs a second price ladder and solves a load that does not grow with seats.

## What would change this

The simulator target that no stall sits empty or full for more than a quarter of all rounds. If that fails at four players only, revisit.
