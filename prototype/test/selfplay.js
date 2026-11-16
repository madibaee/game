// Self-play: one scripted "player" seat (seat 0) against the prototype's bots, many matches per strategy.
// Run: node prototype/test/selfplay.js [matches per strategy and player count] [--json]
// The player strategies below are deliberately simple and readable, so a human can copy them at the table.
'use strict';
const E = require('../engine.js');
const B = require('../bots.js');
const CFG = E.CFG;
const GOODS = E.GOODS;
const MAX = CFG.actionsPerRound;

// ---------- A parameterised scripted player ----------
// o.expand   build new works up to the cap          o.chain    aim for one workshop fed by own works
// o.upgrade  upgrade works to tier III              o.invest   'none' | 'own' (invest own goods) | 'buy' (also buy goods to invest)
// o.bonds    bonds taken in round 1                 o.sell     sell what is spare
// o.hold     keep goods for a price at or above this (0 = always sell)
function scripted(o) {
  return function plan(S, pi) {
    const p = S.players[pi];
    const pl = E.emptyPlan();
    const left = CFG.rounds - S.round;
    const tryAdd = (a) => { pl.actions.push(a); if (!E.preview(S, pi, pl).ok) { pl.actions.pop(); return false; } return true; };
    const mine = E.ownBuildings(S, pi);
    const cap = E.buildingCap(S);
    const price = (g) => E.price(g, S.stalls[g]);
    const pathTo = (from, dest) => E.findPath(S, pi, from, dest, { allowFree: true });
    const myNodes = mine.map((x) => x.id);
    const produced = new Set(mine.map((x) => E.outputOf(x.building)));
    const hasWorkshop = mine.some((x) => x.building.type !== 'raw');
    const wantGrow = (o.expand && mine.length < cap && left >= 4) || (o.upgrade && mine.some((x) => x.building.tier < 3) && left >= 3);

    // Bonds: take in round 1, repay near the end.
    if (S.round === 1) for (let i = 0; i < (o.bonds || 0); i++) tryAdd({ type: 'bond', op: 'take' });
    if (left <= 2) for (let i = 0; i < p.bonds; i++) if (pl.actions.length < MAX - 1) tryAdd({ type: 'bond', op: 'repay' });

    // Invest in the open projects.
    if (o.invest && o.invest !== 'none') {
      for (const pr of E.visibleProjects(S)) {
        if (pl.actions.length >= MAX - 1) break;
        const pv = E.preview(S, pi, pl);
        const bundle = {};
        let any = 0;
        GOODS.forEach((g) => {
          const keep = g === 'brick' && wantGrow && left > 6 ? 1 : 0;
          const q = Math.min(E.missing(pr, g), pv.goods[g] - keep);
          if (q > 0) { bundle[g] = q; any += q; }
        });
        if (!any) continue;
        if (tryAdd({ type: 'invest', plot: pr.plot, goods: bundle })) continue;
        const r = pathTo(myNodes, pr.plot);
        if (r && r.missing === 1 && pl.actions.length <= MAX - 2) {
          const mark = pl.actions.length;
          if (tryAdd({ type: 'link', edge: r.missingEdges[0], bid: 0 }) && !tryAdd({ type: 'invest', plot: pr.plot, goods: bundle })) pl.actions.length = mark;
        }
      }
    }

    // Build.
    let pv = E.preview(S, pi, pl);
    if (o.expand && mine.length < cap && left >= 4 && pv.goods.brick >= 1 && pl.actions.length <= MAX - 2) {
      const recipe = o.recipe || (o.chain ? (produced.has('food') ? 'goods' : 'tools') : null);
      const inputs = recipe ? Object.keys(CFG.recipes[recipe].in) : [];
      const buildWorkshop = recipe && !hasWorkshop && (o.workshopFirst || mine.length === cap - 1 || inputs.every((g) => produced.has(g)));
      const options = [];
      S.nodes.filter((x) => x.kind === 'site' && !x.building).forEach((x) => {
        const r = pathTo([x.id], 0);
        if (!r) return;
        const access = -3 * r.missing - 2 * r.tolls;
        const g = CFG.terrain[x.terrain];
        if (buildWorkshop) options.push({ site: x.id, kind: recipe, r, v: access });
        else options.push({ site: x.id, kind: 'raw', r, v: price(g) * 2 + (produced.has(g) ? -2 : 2) + (inputs.includes(g) && !produced.has(g) ? 8 : 0) + access });
      });
      options.sort((a, b) => b.v - a.v || a.site - b.site);
      const c = options[0];
      if (c && c.r.missing <= MAX - 1 - pl.actions.length - 1) {
        const mark = pl.actions.length;
        let ok = true;
        c.r.missingEdges.forEach((ei) => { ok = ok && tryAdd({ type: 'link', edge: ei, bid: 0 }); });
        ok = ok && tryAdd({ type: 'build', site: c.site, kind: c.kind, bid: o.bid || 0 });
        if (!ok) pl.actions.length = mark;
      }
    }

    // Upgrade (lowest tier first), as many as actions allow while leaving one for the trade.
    if (o.upgrade && left >= 3) {
      mine.filter((x) => x.building.tier < 3 && x.building.built < S.round)
        .sort((a, b) => (o.workshopFirst ? (a.building.type === 'raw') - (b.building.type === 'raw') : 0) || a.building.tier - b.building.tier || a.id - b.id)
        .forEach((x) => { if (pl.actions.length <= MAX - 2) tryAdd({ type: 'upgrade', site: x.id }); });
    }

    // One trade basket.
    pv = E.preview(S, pi, pl);
    const keep = E.zero();
    if (wantGrow) keep.brick = 1;
    mine.forEach((x) => {
      const b = x.building;
      if (b.type === 'raw') return;
      const rc = CFG.recipes[b.type];
      for (const g in rc.in) keep[g] += rc.in[g] * CFG.recipeRuns[b.tier - 1];
    });
    const wantInvest = E.zero();
    const keepInv = E.zero();
    if (o.invest && o.invest !== 'none' && left >= 1) {
      E.visibleProjects(S).forEach((pr) => GOODS.forEach((g) => { wantInvest[g] += Math.max(0, E.missing(pr, g) - ((pl.actions.find((a) => a.type === 'invest' && a.plot === pr.plot) || { goods: {} }).goods[g] || 0)); }));
      GOODS.forEach((g) => { keepInv[g] = Math.min(wantInvest[g], o.invest === 'buy' ? 4 : 2); });
    }
    const sell = {};
    const buy = {};
    let held = 0;
    GOODS.forEach((g) => {
      const spare = pv.goods[g] - (left === 0 ? 0 : Math.max(keep[g], keepInv[g]));
      if (o.sell !== false && spare > 0 && (left === 0 || !o.hold || price(g) >= (E.isRaw(g) ? o.hold : o.hold + 4))) sell[g] = spare;
      held += pv.goods[g] - (sell[g] || 0);
    });
    let budget = pv.coins - 2;
    let room = CFG.storageCap - held;
    GOODS.forEach((g) => {
      if (sell[g] || left === 0) return;
      const target = o.invest === 'buy' ? Math.max(keep[g], keepInv[g]) : keep[g]; // 'own' never buys just to invest
      let want = Math.min(Math.max(0, target - pv.goods[g]), 4, S.stalls[g], room);
      while (want > 0 && price(g) * want > budget) want--;
      if (want > 0) { buy[g] = want; budget -= price(g) * want; room -= want; }
    });
    if (Object.keys(sell).length || Object.keys(buy).length) {
      if (!tryAdd({ type: 'trade', buy, sell })) { if (!tryAdd({ type: 'trade', buy: {}, sell })) tryAdd({ type: 'trade', buy, sell: {} }); }
    }
    return pl;
  };
}

// ---------- A one-round lookahead player ----------
// Lists a few dozen whole plans, resolves each against rivals who do nothing, and keeps the best by a
// rough value: votes now, plus what the works and shares should still earn before the election.
function lookahead(S, pi) {
  const base = [
    scripted({ sell: true }), scripted({ expand: true, sell: true }), scripted({ expand: true, upgrade: true, sell: true }),
    scripted({ upgrade: true, sell: true }), scripted({ expand: true, chain: true, upgrade: true, sell: true }),
    scripted({ expand: true, upgrade: true, invest: 'own', sell: true }), scripted({ invest: 'own', sell: true }),
    scripted({ expand: true, upgrade: true, invest: 'buy', sell: true }), scripted({ invest: 'buy', sell: true }),
    scripted({ expand: true, upgrade: true, sell: true, hold: 5 }), scripted({ upgrade: true, invest: 'own', sell: true }),
    scripted({ expand: true, recipe: 'goods', workshopFirst: true, upgrade: true, sell: true }), scripted({ expand: true, recipe: 'tools', workshopFirst: true, upgrade: true, sell: true }),
    scripted({ expand: true, recipe: 'goods', workshopFirst: true, upgrade: true, invest: 'own', sell: true }), scripted({ expand: true, recipe: 'tools', workshopFirst: true, upgrade: true, invest: 'own', sell: true }),
  ];
  const cands = base.map((f) => f(S, pi));
  // The same plans with a bond taken or repaid first.
  const p = S.players[pi];
  cands.slice().forEach((c) => {
    if (c.actions.length < MAX && p.bonds < CFG.bond.max && CFG.rounds - S.round >= 6) cands.push({ actions: [{ type: 'bond', op: 'take' }].concat(c.actions), idle: [] });
    if (c.actions.length < MAX && p.bonds > 0) cands.push({ actions: [{ type: 'bond', op: 'repay' }].concat(c.actions), idle: [] });
  });
  let best = cands[0];
  let bestV = -1e9;
  const seen = new Set();
  cands.forEach((c) => {
    const key = JSON.stringify(c);
    if (seen.has(key) || !E.preview(S, pi, c).ok) return;
    seen.add(key);
    const plans = S.players.map((_, i) => (i === pi ? c : E.emptyPlan()));
    const v = value(E.resolve(S, plans).state, pi);
    if (v > bestV) { bestV = v; best = c; }
  });
  return best;
}
function value(S, pi) {
  const p = S.players[pi];
  const left = CFG.rounds - S.round + 1; // rounds still to play
  let v = p.coins / CFG.votes.coinsPerVote - p.bonds * (CFG.bond.votePenalty + (left * CFG.bond.interest) / CFG.votes.coinsPerVote);
  S.nodes.forEach((nd) => {
    if (nd.district && nd.district.shares[pi]) v += nd.district.shares[pi] * (Math.min(3, nd.district.cls + left / 6) + (left * 0.6) / CFG.votes.coinsPerVote);
  });
  S.queue.forEach((pr, i) => { if (pr.shares[pi]) v += pr.shares[pi] * (i < 2 && left > 2 ? 0.9 : 0.2); });
  E.ownBuildings(S, pi).forEach((nd) => {
    const b = nd.building;
    v += CFG.votes.building[b.tier - 1];
    const q = b.type === 'raw' ? CFG.rawOutput[b.tier - 1] : CFG.recipeRuns[b.tier - 1] * 2;
    const unit = b.type === 'raw' ? 4.5 : 6; // a workshop unit sells for about 11 but each run eats two raw goods
    v += (left * (q * unit - CFG.upkeep) * 0.8) / CFG.votes.coinsPerVote;
  });
  GOODS.forEach((g) => { v += (p.goods[g] * (left > 0 ? E.price(g, S.stalls[g]) * 0.7 : 0)) / CFG.votes.coinsPerVote; });
  return v;
}

const STRATEGIES = {
  'do nothing': () => E.emptyPlan(),
  'sell only': scripted({ sell: true }),
  'expand raw, sell': scripted({ expand: true, sell: true }),
  'expand + upgrade, sell': scripted({ expand: true, upgrade: true, sell: true }),
  'expand + upgrade, 2 bonds': scripted({ expand: true, upgrade: true, sell: true, bonds: 2 }),
  'workshop chain': scripted({ expand: true, chain: true, upgrade: true, sell: true }),
  'goods works first': scripted({ expand: true, recipe: 'goods', workshopFirst: true, upgrade: true, sell: true }),
  'tool works first': scripted({ expand: true, recipe: 'tools', workshopFirst: true, upgrade: true, sell: true }),
  'goods works + invest': scripted({ expand: true, recipe: 'goods', workshopFirst: true, upgrade: true, invest: 'own', sell: true }),
  'goods works + invest, 1 bond': scripted({ expand: true, recipe: 'goods', workshopFirst: true, upgrade: true, invest: 'own', sell: true, bonds: 1 }),
  'expand + invest own goods': scripted({ expand: true, upgrade: true, invest: 'own', sell: true }),
  'expand + buy to invest': scripted({ expand: true, upgrade: true, invest: 'buy', sell: true }),
  'invest only, no growth': scripted({ invest: 'buy', sell: true }),
  'one-round lookahead': lookahead,
};

// ---------- Match runner ----------
function playMatch(n, seed, plan, opts) {
  opts = opts || {};
  let S = E.newGame({ nPlayers: n, seed, human: opts.allBots ? -1 : 0 });
  const startGood = S.nodes.map((x) => x.building).filter(Boolean).reduce((o, b) => { o[b.owner] = b.good; return o; }, {});
  const m = { dropped: 0, droppedWhy: {}, tolls: 0, unserved: 0, districtRounds: 0, lost: 0, discards: 0, lead: [], coreShort: 0, emptyStall: E.zero(), fullStall: E.zero(), negative: 0 };
  while (!S.over) {
    const plans = S.players.map((pl, i) => (pl.bot ? B.plan(S, i) : plan(S, i)));
    const r = E.resolve(S, plans);
    r.log.forEach((l) => {
      if (l.pi === 0 && /was dropped/.test(l.t)) { m.dropped++; const why = l.t.split(': ')[1]; m.droppedWhy[why] = (m.droppedWhy[why] || 0) + 1; }
      if (/toll of/.test(l.t)) m.tolls++;
      if (/went unserved/.test(l.t)) m.unserved++;
      if (/core went short/.test(l.t)) m.coreShort++;
      if (/loses a contested/.test(l.t)) m.lost++;
      if (/discards/.test(l.t) && l.pi === 0) m.discards++;
    });
    S = r.state;
    m.districtRounds += S.nodes.filter((x) => x.district && x.district.founded < S.round - 1).length;
    GOODS.forEach((g) => { if (S.stalls[g] === 0) m.emptyStall[g]++; if (S.stalls[g] >= CFG.stallSlots) m.fullStall[g]++; });
    S.players.forEach((p) => { if (!(p.coins >= 0) || GOODS.some((g) => p.goods[g] < 0)) m.negative++; });
    const sc = E.score(S);
    m.lead.push(sc.find((x) => x.rank === 1).pi);
  }
  const sc = E.score(S);
  const win = sc.find((x) => x.rank === 1);
  const sorted = sc.slice().sort((a, b) => a.rank - b.rank);
  let locked = CFG.rounds; // first round after which the eventual winner led to the end
  for (let r = CFG.rounds - 1; r >= 0 && m.lead[r] === win.pi; r--) locked = r + 1;
  return Object.assign(m, {
    S, sc, winner: win.pi, margin: sorted[0].total - sorted[1].total, locked, startGood,
    founded: 5 - S.queue.length, classUp: S.nodes.filter((x) => x.district && x.district.cls > 1).length,
  });
}

function main() {
  const N = +process.argv[2] || 200;
  const out = { matchesPerCell: N, rules: CFG.rules, strategies: {}, table: {} };
  const mean = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
  const pct = (x) => Math.round(100 * x);
  const f1 = (x) => +x.toFixed(1);
  let anomalies = 0;

  // 1. The player seat with each strategy.
  for (const name of Object.keys(STRATEGIES)) {
    out.strategies[name] = {};
    for (const n of [2, 3, 4]) {
      const ms = [];
      for (let k = 0; k < N; k++) ms.push(playMatch(n, 5000 + k * 13 + n, STRATEGIES[name]));
      const me = ms.map((x) => x.sc[0]);
      const bestBot = ms.map((x) => Math.max(...x.sc.slice(1).map((r) => r.total)));
      anomalies += ms.reduce((s, x) => s + x.negative, 0);
      const why = {};
      ms.forEach((x) => Object.keys(x.droppedWhy).forEach((k) => { why[k] = (why[k] || 0) + x.droppedWhy[k]; }));
      out.strategies[name][n] = {
        win: pct(mean(ms.map((x) => +(x.winner === 0)))), rank: f1(mean(me.map((r) => r.rank))),
        votes: f1(mean(me.map((r) => r.total))), bestBot: f1(mean(bestBot)),
        shares: f1(mean(me.map((r) => r.shares))), buildings: f1(mean(me.map((r) => r.buildings))),
        campaign: f1(mean(me.map((r) => r.campaign))), bonds: f1(mean(me.map((r) => r.bonds))), coins: Math.round(mean(me.map((r) => r.coins))),
        dropped: f1(mean(ms.map((x) => x.dropped))), droppedWhy: why, discards: f1(mean(ms.map((x) => x.discards))),
      };
    }
  }

  // 2. The table as a whole: every match above, plus all-bot matches for the persona and start comparison.
  for (const n of [2, 3, 4]) {
    const ms = [];
    for (let k = 0; k < N * 3; k++) ms.push(playMatch(n, 90000 + k * 17 + n, null, { allBots: true }));
    const per = {}; const start = {}; const seat = Array(n).fill(0);
    let sh = 0; let bl = 0; let ca = 0; let coins = 0;
    ms.forEach((x) => {
      seat[x.winner]++;
      x.sc.forEach((r) => {
        const pe = x.S.players[r.pi].persona; const g = x.startGood[r.pi];
        per[pe] = per[pe] || [0, 0]; start[g] = start[g] || [0, 0];
        per[pe][1]++; start[g][1]++;
        if (r.rank === 1) { per[pe][0]++; start[g][0]++; }
        sh += r.shares; bl += r.buildings; ca += r.campaign; coins += r.coins;
      });
    });
    const seats = ms.length * n;
    const rate = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, pct(o[k][0] / o[k][1])]));
    out.table[n] = {
      matches: ms.length, fair: pct(1 / n), persona: rate(per), startGood: rate(start), seat: seat.map((s) => pct(s / ms.length)),
      votes: { shares: f1(sh / seats), buildings: f1(bl / seats), campaign: f1(ca / seats) }, endCoins: Math.round(coins / seats),
      margin: f1(mean(ms.map((x) => x.margin))), close: pct(mean(ms.map((x) => +(x.margin <= 2)))),
      lockedRound: f1(mean(ms.map((x) => x.locked))), lockedBy12: pct(mean(ms.map((x) => +(x.locked <= 12)))),
      founded: f1(mean(ms.map((x) => x.founded))), classUp: f1(mean(ms.map((x) => x.classUp))),
      unserved: pct(ms.reduce((s, x) => s + x.unserved, 0) / Math.max(1, ms.reduce((s, x) => s + x.districtRounds, 0))),
      coreShort: f1(mean(ms.map((x) => x.coreShort))), tolls: f1(mean(ms.map((x) => x.tolls))), lostClaims: f1(mean(ms.map((x) => x.lost))),
      emptyStall: Object.fromEntries(GOODS.map((g) => [g, pct(mean(ms.map((x) => x.emptyStall[g])) / CFG.rounds)])),
      fullStall: Object.fromEntries(GOODS.map((g) => [g, pct(mean(ms.map((x) => x.fullStall[g])) / CFG.rounds)])),
    };
    anomalies += ms.reduce((s, x) => s + x.negative, 0);
  }
  out.anomalies = anomalies;

  if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); return; }
  console.log(`Self-play, rules ${CFG.rules}, ${N} matches per strategy and player count. Player is seat 0; rivals are the prototype bots.\n`);
  for (const n of [2, 3, 4]) {
    console.log(`${n} players (an even chance is ${pct(1 / n)}%)`);
    console.log('  strategy'.padEnd(32) + 'win%  rank  votes  best bot  shares  works  campaign  coins  dropped');
    Object.keys(out.strategies).forEach((k) => {
      const r = out.strategies[k][n];
      console.log(('  ' + k).padEnd(32) + [r.win, r.rank, r.votes, r.bestBot, r.shares, r.buildings, r.campaign, r.coins, r.dropped].map((x, i) => String(x).padStart([4, 6, 7, 10, 8, 7, 10, 7, 9][i])).join(''));
    });
    console.log('  all-bot table:', JSON.stringify(out.table[n]), '\n');
  }
  console.log('negative coins or goods seen:', anomalies);
}

module.exports = { scripted, lookahead, STRATEGIES, playMatch };
if (require.main === module) main();
