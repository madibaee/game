# Shared rule numbers

`economy.json` is the one source for every number in the rules: costs, prices, demand, votes, bond terms. The simulator (`sim/`) and the grey-box prototype (`prototype/`) both read it, so a tuned number cannot drift between them.

- `base` is rules v0.4.
- `presets` holds each rule set as overrides on `base`, written as dotted paths: `"v0.5": { "imports.enabled": true, "start.works": "bid" }`. A new rules version is a new preset, so reports for an old one can still be reproduced.
- `currentRules` names the preset that matches `docs/design/theme-and-board.md`.
- Key names follow the `Config` type in `sim/src/config.ts`.

## Changing a number

1. Edit `economy.json`.
2. Run `node config/sync.js`. The prototype is a static page that cannot read a JSON file from disk, so this writes a copy to `prototype/economy.js`. `node prototype/test/sim.js` fails if the copy is stale.
3. If the number appears in the rules, change `docs/design/theme-and-board.md` in the same commit.

The prototype plays the `v0.4` preset: its engine does not yet have v0.5's imports or round 0.
