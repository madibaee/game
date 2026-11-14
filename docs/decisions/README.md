# Design decisions

One short note per design choice: the context, the choice, why, and what was set aside. Notes are numbered in the order they were made and are not rewritten later; a decision that is overturned gets a new note that says so.

| # | Decision | Status | Rules |
| --- | --- | --- | --- |
| [0001](0001-one-board-for-every-player-count.md) | One 20-node board for every player count | Adopted in v0.5 | §4 |
| [0002](0002-capped-player-imports.md) | Capped player imports; districts never import | Adopted in v0.5 | §6.3 |
| [0003](0003-six-stall-slots-at-every-count.md) | Six stall slots at every player count | Adopted in v0.5 | §6.3 |
| [0004](0004-round-0-sealed-bid.md) | Round 0: sealed bid for starting works | Adopted in v0.5 | §6.9 |
| [0005](0005-hidden-storage-parked.md) | Hidden storage is parked | Adopted in v0.5 | §8 |
| [0006](0006-friends-by-invite-first.md) | Friends by invite link first | Adopted in v0.5 | §8, §12 |

v0.5 is a draft, and every number in these notes is a proposal until the simulator confirms it.

## Proposed, not yet decided

[proposed/gap-review-v0.4.md](proposed/gap-review-v0.4.md) lists 28 rule edits from the v0.4 gap review. None is in the rules. When one is accepted, apply it to `docs/design/theme-and-board.md` in its own commit and mark it accepted in that list; if the choice was a real fork, give it a numbered note here.
