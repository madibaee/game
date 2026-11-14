# 0001. One board for every player count

- **Status:** adopted in rules v0.5 (draft). Numbers await the simulator.
- **Date:** 2026-11-14
- **Rules section:** §4

## Context

v0.4 asked whether three buildings each are enough at four players, or whether four players need a 24-node board.

## Decision

One 20-node board serves two, three and four players. The 24-node board is ruled out.

## Why

- The caps already hold the city's total industry nearly constant: 10 buildings with two players, 12 with three and 12 with four. A bigger board at four would break that and need its own price table and district demand.
- Twenty-four sites is the top of the legibility range in §2, and four players is the count with the most owner colours and badges on screen.
- A second board is a second layout, a second link pool and a second tuning pass, for one player count.

## Alternatives considered

- **A 24-node board at four players.** Rejected for the reasons above.

## What would change this

The narrower question stays open: whether three buildings feel like an engine. The simulator compares a cap of three against a cap of four at four players on the same board, where 16 wanted buildings compete for 12 sites.
