// Headless smoke test: all-bot matches, with checks that nothing goes negative or out of range.
// Run: node prototype/test/sim.js [matches per player count]
'use strict';
// The browser loads prototype/economy.js, a generated copy of config/economy.json. Fail if it is stale.
require('child_process').execFileSync(process.execPath, [require('path').join(__dirname, '..', '..', 'config', 'sync.js'), '--check'], { stdio: 'inherit' });
const E = require('../engine.js');
const B = require('../bots.js');
const CFG = E.CFG;
const N = +process.argv[2] || 100;
let fail = 0;
const check = (ok, msg) => { if (!ok) { fail++; if (fail < 20) console.log('FAIL', msg); } };

for (const n of [2, 3, 4]) {
  const stat = { founded: 0, votes: 0, shareVotes: 0, bonds: 0, coins: 0, wins: {}, games: {}, classUp: 0, tolls: 0, unserved: 0, districtRounds: 0, bldg: 0 };
  for (let m = 0; m < N; m++) {
    let S = E.newGame({ nPlayers: n, seed: 1000 + m * 7 + n, human: -1 });
    check(S.edges.every((e) => e.a !== e.b), 'self edge');
    S.nodes.filter((x) => x.kind !== 'core').forEach((x) => check(E.findPath(S, 0, [x.id], 0, { allowFree: true }), 'node cut off from core'));
    while (!S.over) {
      const plans = S.players.map((_, i) => B.plan(S, i));
      const again = S.players.map((_, i) => B.plan(S, i));
      check(JSON.stringify(plans) === JSON.stringify(again), 'bot plan not deterministic');
      const r = E.resolve(S, plans);
      const r2 = E.resolve(S, plans);
      check(JSON.stringify(r.state) === JSON.stringify(r2.state), 'resolver not deterministic');
      S = r.state;
      stat.tolls += r.log.filter((l) => /toll of/.test(l.t)).length;
      stat.unserved += r.log.filter((l) => /went unserved/.test(l.t)).length;
      stat.districtRounds += S.nodes.filter((x) => x.district && x.district.founded < S.round - 1).length;
      S.players.forEach((p, i) => {
        check(Number.isFinite(p.coins) && p.coins >= 0, 'coins ' + p.coins + ' seat ' + i + ' round ' + S.round);
        let tot = 0;
        E.GOODS.forEach((g) => { check(Number.isInteger(p.goods[g]) && p.goods[g] >= 0, 'goods ' + g + ' ' + p.goods[g]); tot += p.goods[g]; });
        check(tot <= CFG.storageCap, 'storage over cap');
        check(p.bonds >= 0 && p.bonds <= CFG.bond.max, 'bonds range');
        check(E.ownBuildings(S, i).length <= E.buildingCap(S), 'building cap');
      });
      E.GOODS.forEach((g) => check(S.stalls[g] >= 0 && S.stalls[g] <= CFG.stallSlots, 'stall range ' + g + ' ' + S.stalls[g]));
      check(S.fund >= 0, 'fund negative');
    }
    const sc = E.score(S);
    stat.founded += 5 - S.queue.length;
    stat.classUp += S.nodes.filter((x) => x.district && x.district.cls > 1).length;
    sc.forEach((r) => {
      const per = S.players[r.pi].persona;
      stat.votes += r.total; stat.shareVotes += r.shares; stat.bonds += S.players[r.pi].bonds; stat.coins += r.coins;
      stat.bldg += E.ownBuildings(S, r.pi).length;
      stat.games[per] = (stat.games[per] || 0) + 1;
      if (r.rank === 1) stat.wins[per] = (stat.wins[per] || 0) + 1;
    });
  }
  const seats = N * n;
  console.log(`\n${n} players, ${N} matches`);
  console.log('  districts founded per match:', (stat.founded / N).toFixed(2), 'of 5; districts above class I:', (stat.classUp / N).toFixed(2));
  console.log('  mean votes:', (stat.votes / seats).toFixed(1), ' from shares:', (stat.shareVotes / seats).toFixed(1), ' end coins:', (stat.coins / seats).toFixed(1), ' buildings:', (stat.bldg / seats).toFixed(2), ' open bonds:', (stat.bonds / seats).toFixed(2));
  console.log('  tolls paid per match:', (stat.tolls / N).toFixed(1), ' unserved district-rounds:', (100 * stat.unserved / Math.max(1, stat.districtRounds)).toFixed(0) + '%');
  console.log('  win rate by persona:', Object.keys(stat.games).map((k) => `${k} ${(100 * (stat.wins[k] || 0) / stat.games[k]).toFixed(0)}%`).join(', '));
}
console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll checks passed');
process.exit(fail ? 1 : 0);
