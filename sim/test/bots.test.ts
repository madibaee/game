import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runBatch } from '../src/batch.ts';
import { SCRIPTED, makeBot } from '../src/bots/index.ts';
import { preset } from '../src/config.ts';
import { runMatch } from '../src/match.ts';

for (const name of ['v0.4', 'v0.5', 'v0.5-short']) {
  for (const players of [2, 3, 4]) {
    test(`${name}, ${players} players: 40 bot matches reconcile every phase and no bot submits an invalid action`, () => {
      const { summary } = runBatch({ cfg: preset(name, { players }), games: 40, lineup: 'mixed', audit: true });
      assert.equal(summary.invalidActions, 0);
      assert.equal(summary.games, 40);
      assert.equal(Object.keys(summary.bots).length, SCRIPTED.length);
    });
  }
}

test('a match is reproducible from its seed and differs across seeds', () => {
  const cfg = preset('v0.5', { players: 3 });
  const play = (seed: number) => JSON.stringify(runMatch(cfg, seed, ['founder', 'workshop', 'adaptive'].map(makeBot)).scores);
  assert.equal(play(5), play(5));
  assert.notEqual(play(5), play(6));
});

test('the searching bot plays legal, reconciled matches', () => {
  const cfg = preset('v0.5', { players: 3 });
  const r = runMatch(cfg, 3, ['search', 'founder', 'adaptive'].map(makeBot), { audit: true });
  assert.equal(r.metrics.invalid, 0);
  assert.equal(r.scores.length, 3);
});
