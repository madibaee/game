# 0002. Capped player imports

- **Status:** adopted in rules v0.5 (draft). Numbers await the simulator.
- **Date:** 2026-11-14
- **Rules section:** §6.3

## Context

v0.4 asked whether the market should import goods nobody produces, or whether a standing shortage is acceptable. Every build and upgrade needs a brick. With three buildings each, a table of four can leave one raw good unmade; if that good is brick and the stall is empty, nobody can build again.

## Decision

Districts never import. Players may: a buy order can be marked *import if short*, and the part the stall cannot fill arrives by rail at 10 coins for a raw good and 16 for a processed good. A player may import at most 2 units a round across all goods. Imported units go straight to the buyer, never enter the stall and do not move the price. The city fund does not import.

## Why

- A missing district good is a signal. The districts go unserved and pay no dividends, which costs shareholders income and takes nothing away, and a raw price of 8 with a hungry district is the clearest invitation to build that works.
- A missing brick stops every build at the table. That is a locked game, not a shortage, so players get a valve.
- The import price sits above the top of each price ladder (8 and 13), so an import never undercuts a local producer. The cap of 2 keeps it a valve and not a supply.

## Alternatives considered

- **No imports.** A table can lock for want of brick.
- **The market imports for everyone, districts included.** Removes the shortage signal that tells players what to build.

## What would change this

Simulator targets: imports stay under about 5% of all units bought, and with imports on no match reaches a state where nobody can build for want of brick. If bots import every round, the price or cap is too soft. Still open: whether imports should pay tolls.
