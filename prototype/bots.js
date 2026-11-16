// Bots (§11). One planner for every bot: it reads the market, puts a value in votes on each thing it
// could do this round, and takes the best few. A persona only tilts those values, so every bot plays
// a sound game and they still differ. Seeded noise keeps two matches on one map from being the same.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./engine.js') : root.Engine;
  const CFG = E.CFG;
  const GOODS = E.GOODS;
  const MAX = CFG.actionsPerRound;
  const CPV = CFG.votes.coinsPerVote;

  // Weights on the value of a new works, a workshop, a share and an upgrade; appetite for bonds;
  // patience (how far below the expected price a bot still sells).
  const PERSONAS = {
    raw:       { label: 'Raw specialist',    build: 1.15, workshop: 0.6,  invest: 0.8,  upgrade: 1.1, bond: 0.8, patience: 0.8 },
    workshop:  { label: 'Workshop builder',  build: 1.0,  workshop: 1.3,  invest: 0.85, upgrade: 1.0, bond: 1.0, patience: 0.9 },
    founder:   { label: 'District founder',  build: 0.9,  workshop: 0.9,  invest: 1.35, upgrade: 0.8, bond: 0.7, patience: 0.9 },
    adaptive:  { label: 'Follows the queue', build: 1.0,  workshop: 1.0,  invest: 1.0,  upgrade: 1.0, bond: 0.9, patience: 1.0 },
    freerider: { label: 'Free-rider',        build: 1.1,  workshop: 1.0,  invest: 0.35, upgrade: 1.1, bond: 0.6, patience: 1.0 },
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  // ---------- Reading the market ----------
  // For each good: what the table makes a round, what the city and the workshops use, and the stall
  // level that balance points to over the next rounds.
  function forecast(S) {
    const make = E.zero();
    const use = Object.assign(E.zero(), E.cityDemand(S));
    S.nodes.forEach((nd) => {
      const b = nd.building;
      if (!b) return;
      if (b.type === 'raw') make[b.good] += CFG.rawOutput[b.tier - 1];
      else {
        const rc = CFG.recipes[b.type];
        const runs = CFG.recipeRuns[b.tier - 1];
        make[rc.out] += runs * rc.qty;
        for (const g in rc.in) use[g] += runs * rc.in[g];
      }
    });
    // Building sites eat brick, and the open projects take goods out of the market too.
    const left = CFG.rounds - S.round;
    if (left >= 3) {
      const cap = E.buildingCap(S);
      S.players.forEach((_, i) => {
        const own = E.ownBuildings(S, i);
        const todo = (cap - own.length) + own.reduce((t, x) => t + (3 - x.building.tier), 0);
        use.brick += Math.min(0.5, todo / 8);
      });
    }
    E.visibleProjects(S).forEach((pr) => GOODS.forEach((g) => { use[g] += Math.max(0, E.missing(pr, g)) / 3; }));
    const level = E.zero();
    GOODS.forEach((g) => { level[g] = clamp(Math.round(S.stalls[g] + 1.5 * (make[g] - use[g])), 0, CFG.stallSlots); });
    return { make, use, level };
  }
  // Coins a round from selling q units of g into a stall expected at `lvl`, and the cost of buying q.
  const sells = (g, lvl, q) => E.sellValue(g, clamp(lvl, 0, CFG.stallSlots), q);
  const buys = (g, lvl, q) => E.buyCost(g, clamp(lvl, 0, CFG.stallSlots), q);

  // Net coins a round from a works of this kind and tier, given the forecast. `extra` is output the
  // table would gain if this works were new, so a crowded good looks as poor as it will be.
  // Units of g a works making q of them can expect to sell each round: what the table uses beyond
  // what the others make, plus a share of the free slots. The rest would sit in store.
  function sellable(F, g, q, isNew, was) {
    const others = F.make[g] - (isNew ? 0 : was);
    return clamp(F.use[g] - others + (CFG.stallSlots - F.level[g]) / 3, 0, q);
  }
  function income(F, kind, good, tier, isNew, wasTier) {
    if (tier < 1) return 0;
    const was = wasTier || tier;
    if (kind === 'raw') {
      const q = CFG.rawOutput[tier - 1];
      const lvl = F.level[good] + (isNew ? Math.round(1.5 * q) : 0);
      const n = sellable(F, good, q, isNew, CFG.rawOutput[was - 1]);
      return (sells(good, lvl, q) * n) / q - CFG.upkeep[tier - 1];
    }
    const rc = CFG.recipes[kind];
    const runs = CFG.recipeRuns[tier - 1];
    const out = runs * rc.qty;
    const lvl = F.level[rc.out] + (isNew ? Math.round(1.5 * out) : 0);
    let cost = 0;
    for (const g in rc.in) cost += buys(g, F.level[g] - (isNew ? runs : 0), runs * rc.in[g]);
    const n = sellable(F, rc.out, out, isNew, CFG.recipeRuns[was - 1] * rc.qty);
    return ((sells(rc.out, lvl, out) - cost) * n) / out - CFG.upkeep[tier - 1];
  }

  // Votes one share in a project is worth: the chance it is founded, the class it should reach and
  // the dividends on the way.
  function shareValue(S, pr, missingAfter, left) {
    if (left < 0) return 0;
    const pFound = missingAfter <= 0 ? 1 : clamp((left * 1.2) / (missingAfter + 1), 0, 1);
    const roundsAfter = Math.max(0, left - Math.ceil(missingAfter / 2) - 1);
    const served = 0.5;
    const cls = clamp(1 + Math.floor((served * roundsAfter) / CFG.pipsPerClass), 1, 3);
    return pFound * (CFG.votes.share[cls - 1] + (served * roundsAfter * CFG.dividendPerShare) / CPV);
  }

  function plan(S, pi) {
    const P = PERSONAS[S.players[pi].persona] || PERSONAS.adaptive;
    const rng = E.mulberry32((S.seed * 31 + S.round * 977 + pi * 7919) >>> 0);
    const noise = () => 0.9 + rng() * 0.2;
    const p = S.players[pi];
    const pl = E.emptyPlan();
    const left = CFG.rounds - S.round; // rounds after this one
    const tryAdd = (a) => { pl.actions.push(a); if (!E.preview(S, pi, pl).ok) { pl.actions.pop(); return false; } return true; };
    const mine = E.ownBuildings(S, pi);
    const cap = E.buildingCap(S);
    const F = forecast(S);
    const price = (g) => E.price(g, S.stalls[g]);
    const pathTo = (from, dest) => E.findPath(S, pi, from, dest, { allowFree: true });
    const myNodes = mine.map((x) => x.id);
    const keepRate = 0.85; // a coin expected later is worth a little less than one in hand

    // Idle a raw works whose output could not be sold or used this round: it would only pay upkeep.
    const demandNow = E.cityDemand(S);
    mine.forEach((x) => {
      const b = x.building;
      if (b.built >= S.round || b.type !== 'raw') return;
      const g = b.good;
      const q = CFG.rawOutput[b.tier - 1];
      const room = CFG.stallSlots - S.stalls[g] + (demandNow[g] || 0);
      let uses = g === 'brick' ? 2 : 0;
      E.visibleProjects(S).forEach((pr) => { uses += Math.max(0, E.missing(pr, g)); });
      mine.forEach((y) => { if (y.building.type !== 'raw') uses += (CFG.recipes[y.building.type].in[g] || 0) * CFG.recipeRuns[y.building.tier - 1]; });
      const idleNow = mine.filter((y) => pl.idle.includes(y.id) && y.building.good === g).length;
      const others = mine.filter((y) => y !== x && y.building.type === 'raw' && y.building.good === g && !pl.idle.includes(y.id) && y.building.built < S.round).reduce((t, y) => t + CFG.rawOutput[y.building.tier - 1], 0);
      const spareRoom = room + uses - p.goods[g] - (idleNow ? 0 : 0) - others;
      if (spareRoom <= 0 || sells(g, S.stalls[g] + Math.max(0, p.goods[g] + others - uses), Math.min(q, spareRoom)) < CFG.upkeep[b.tier - 1]) pl.idle.push(x.id);
    });

    // The same for a workshop whose output has nowhere to go: keep the inputs and the upkeep.
    mine.forEach((x) => {
      const b = x.building;
      if (b.built >= S.round || b.type === 'raw') return;
      const out = CFG.recipes[b.type].out;
      const room = CFG.stallSlots - S.stalls[out] + (demandNow[out] || 0);
      let uses = 0;
      E.visibleProjects(S).forEach((pr) => { uses += Math.max(0, E.missing(pr, out)); });
      if (p.goods[out] >= room + uses) pl.idle.push(x.id);
    });

    // ---------- Options, each with a value in votes ----------
    const opts = [];
    const brickCoin = price('brick');

    // New works.
    if (mine.length < cap && left >= 2) {
      const mineMake = new Set(mine.map((x) => E.outputOf(x.building)));
      S.nodes.filter((x) => x.kind === 'site' && !x.building).forEach((x) => {
        const r = pathTo([x.id], 0);
        if (!r || r.missing > 2) return;
        const kinds = [['raw', CFG.terrain[x.terrain]]].concat(Object.keys(CFG.recipes).map((k) => [k, null]));
        kinds.forEach(([kind, good]) => {
          const cost = (kind === 'raw' ? CFG.cost.raw.coins : CFG.cost.workshop.coins) + r.missing * CFG.cost.link;
          let inc = income(F, kind, good, 1, true) - r.tolls * CFG.toll;
          // What the site could grow into matters as much as its first tier.
          const later = left >= 6 ? 0.5 * (income(F, kind, good, 2, true) - income(F, kind, good, 1, true)) : 0;
          // A workshop fed by its owner's works does not depend on the stall having stock.
          let w = kind === 'raw' ? P.build : P.workshop;
          if (kind !== 'raw') { const ins = Object.keys(CFG.recipes[kind].in); w *= 0.85 + 0.15 * ins.filter((g) => mineMake.has(g)).length; }
          else if (mineMake.has(good)) w *= 0.9;
          const v = (CFG.votes.building[0] + ((left * (inc + later) * keepRate) - cost - brickCoin) / CPV) * w * noise();
          const links = r.missingEdges.map((ei) => ({ type: 'link', edge: ei, bid: 0 }));
          const build = { type: 'build', site: x.id, kind, bid: rng() < 0.4 ? 1 + Math.floor(rng() * 3) : 0 };
          // Two links away: all three actions this round, or lay the first link now and build next round.
          opts.push({ v: r.missing === 2 ? v * 0.9 : v, grow: 'build', coins: cost, brick: 1, acts: links.concat([build]) });
          if (r.missing >= 1) opts.push({ v: v * 0.8, grow: 'build', prep: true, coins: CFG.cost.link, brick: 0, acts: [links[0]] });
        });
      });
    }

    // Upgrades.
    if (left >= 1) {
      mine.filter((x) => x.building.tier < 3 && x.building.built < S.round).forEach((x) => {
        const b = x.building;
        const cost = CFG.cost.upgrade[b.tier];
        const gain = income(F, b.type, b.good, b.tier + 1, false, b.tier) - income(F, b.type, b.good, b.tier, false);
        const dv = CFG.votes.building[b.tier] - CFG.votes.building[b.tier - 1];
        const v = (dv + ((left * gain * keepRate) - cost.coins - brickCoin * cost.brick) / CPV) * P.upgrade * noise();
        opts.push({ v, grow: 'upgrade', coins: cost.coins, brick: cost.brick, acts: [{ type: 'upgrade', site: x.id }] });
      });
    }

    // Investments: what is in store now, and what this round makes.
    const pv0 = E.preview(S, pi, pl);
    const wantForProjects = E.zero();
    const impShare = E.zero(); // votes a unit of each good would earn as shares
    E.visibleProjects(S).forEach((pr) => {
      const route = pathTo(myNodes, pr.plot);
      if (!route || route.missing > 1) return;
      const bundle = {};
      let v = 0;
      let n = 0;
      const totalMissing = GOODS.reduce((t, g) => t + Math.max(0, E.missing(pr, g)), 0);
      GOODS.forEach((g) => {
        const q = Math.min(E.missing(pr, g), pv0.goods[g]);
        const per = E.isRaw(g) ? CFG.sharesPerUnit.raw : CFG.sharesPerUnit.processed;
        const sv = shareValue(S, pr, totalMissing - Math.max(0, q), left) * per * P.invest;
        if (E.missing(pr, g) > 0 && sv * CPV > price(g) * 1.15) { wantForProjects[g] += Math.min(E.missing(pr, g) - Math.max(0, q), 3); impShare[g] = Math.max(impShare[g], sv); }
        if (q <= 0) return;
        const give = sv - sells(g, S.stalls[g], q) / q / CPV; // against selling it instead
        if (give > 0) { bundle[g] = q; v += q * give; n += q; }
      });
      if (!n) return;
      v = (v - (route.missing * CFG.cost.link + route.tolls * CFG.toll) / CPV) * noise();
      opts.push({ v, coins: route.missing * CFG.cost.link, brick: 0, invest: bundle, acts: route.missingEdges.map((ei) => ({ type: 'link', edge: ei, bid: 0 })).concat([{ type: 'invest', plot: pr.plot, goods: bundle }]) });
    });

    // ---------- Choose ----------
    // Repay a bond when the cash is there and nothing better needs it.
    opts.sort((a, b) => b.v - a.v);
    const best = opts[0];
    const firstGrow0 = opts.find((o) => o.grow && !o.prep);
    const spare = p.coins - mine.reduce((t, x) => t + E.upkeepOf(x.building), 0);
    if (p.bonds > 0 && spare >= CFG.bond.amount + 4 && (left <= 4 || spare >= CFG.bond.amount + (best && best.v > 0.6 ? best.coins : 0) + 10)) tryAdd({ type: 'bond', op: 'repay' });
    const growthLeft = left >= 2 && (mine.length < cap || mine.some((x) => x.building.tier < 3));
    // Leave an action for the trade basket unless there is nothing to trade.
    const hasTradable = GOODS.some((g) => pv0.goods[g] > 0) || mine.some((x) => x.building.type !== 'raw');
    const slots = MAX - (hasTradable ? 1 : 0);
    // While there are rounds for a works to pay back, growth gets the brick before a project does.
    if (left > 5) opts.sort((a, b) => (!!a.invest - !!b.invest) || b.v - a.v);
    // One new works a round, and never a poor site while a much better one is within reach.
    const bestBuild = Math.max(0, ...opts.filter((o) => o.grow === 'build').map((o) => o.v));
    let building = false;
    opts.forEach((o) => {
      if (o.v <= 0.05) return;
      if (o.grow === 'build' && (building || o.v < 0.7 * bestBuild)) return;
      // A three-action build leaves no trade this round: only when there is little to sell.
      const limit = o.grow === 'build' && !o.prep && o.acts.length === MAX && !pl.actions.some((a) => a.type !== 'bond') && o.v > 1.5 ? MAX : slots;
      if (pl.actions.length + o.acts.length > limit) return;
      const mark = pl.actions.length;
      // Borrow for growth clearly worth more than the interest and the risk of carrying the bond.
      const now0 = E.preview(S, pi, pl);
      const carry = (Math.min(left, 8) * CFG.bond.interest) / CPV + 0.4;
      const borrow = !!o.grow && !o.prep && now0.coins < o.coins && now0.bonds < CFG.bond.max && left >= 5 && !pl.actions.some((a) => a.type === 'bond' && a.op === 'repay') &&
        o.v * P.bond > carry && now0.coins + CFG.bond.amount >= o.coins && now0.goods.brick >= o.brick;
      if (borrow) { if (mark + o.acts.length + 1 > limit || !tryAdd({ type: 'bond', op: 'take' })) return; }
      if (o.invest) {
        const now = E.preview(S, pi, pl).goods;
        const inv = o.acts[o.acts.length - 1];
        const clipped = {};
        Object.keys(o.invest).forEach((g) => { const q = Math.min(o.invest[g], now[g] - (g === 'brick' && left > 5 && growthLeft ? 1 : 0)); if (q > 0) clipped[g] = q; });
        if (!Object.keys(clipped).length) { pl.actions.length = mark; return; }
        inv.goods = clipped;
      }
      if (!o.acts.every((a) => tryAdd(a))) pl.actions.length = mark;
      else if (o.grow === 'build') building = true;
    });

    // ---------- The trade basket ----------
    const pv = E.preview(S, pi, pl);
    const growing = left >= 2 && (mine.length < cap || mine.some((x) => x.building.tier < 3));
    const keep = E.zero();
    if (growing) keep.brick = opts.some((o) => o.v > 0.3 && o.brick && !o.acts.every((a) => pl.actions.includes(a))) ? 2 : 1;
    const inputWorth = E.zero(); // what one unit of an input is worth to a workshop of this bot
    const runsNext = {};
    S.nodes.forEach((nd) => {
      const b = nd.building;
      if (!b || b.owner !== pi || b.type === 'raw') return;
      const rc = CFG.recipes[b.type];
      const tier = b.tier + (pl.actions.some((a) => a.type === 'upgrade' && a.site === nd.id) ? 1 : 0);
      for (const g in rc.in) {
        keep[g] += rc.in[g] * CFG.recipeRuns[tier - 1];
        const rest = Object.keys(rc.in).filter((x) => x !== g).reduce((t, x) => t + rc.in[x] * price(x), 0);
        inputWorth[g] = Math.max(inputWorth[g], rc.qty * E.price(rc.out, clamp(F.level[rc.out] + 1, 0, CFG.stallSlots)) - rest);
      }
      runsNext[b.type] = true;
    });
    pl.actions.forEach((a) => { if (a.type === 'build' && a.kind !== 'raw') { const rc = CFG.recipes[a.kind]; for (const g in rc.in) keep[g] += rc.in[g]; } });
    const keepInvest = E.zero();
    if (left >= 1) GOODS.forEach((g) => { keepInvest[g] = wantForProjects[g]; });

    const madeNext = E.zero();
    mine.forEach((x) => { const b = x.building; if (b.type === 'raw') madeNext[b.good] += CFG.rawOutput[b.tier - 1]; else madeNext[CFG.recipes[b.type].out] += CFG.recipeRuns[b.tier - 1] * CFG.recipes[b.type].qty; });
    const sell = {};
    const buy = {};
    let held = 0;
    GOODS.forEach((g) => {
      const have = pv.goods[g];
      const reserve = left === 0 ? 0 : Math.max(keep[g], Math.min(keepInvest[g], have));
      let n = 0;
      // Sell unit by unit while the price beats what the unit would fetch next round, when it would
      // queue behind next round's own output and whatever else is held back.
      const spareNow = Math.max(0, have - reserve);
      for (let j = 0; j < spareNow; j++) {
        const now = E.price(g, clamp(S.stalls[g] + j, 0, CFG.stallSlots));
        const later = E.price(g, clamp(F.level[g] + (madeNext[g] || 0) + (spareNow - j - 1), 0, CFG.stallSlots));
        if (left === 0 || now >= later * keepRate * P.patience) n++; else break;
      }
      if (n > 0) sell[g] = n;
      held += have - n;
    });
    // Over the storage cap: let go of whatever loses least.
    let guard = 0;
    while (held > CFG.storageCap && guard++ < 40) {
      const g = GOODS.filter((x) => pv.goods[x] - (sell[x] || 0) > (left === 0 ? 0 : keep[x])).sort((a, b) => price(a) - price(b))[0]
        || GOODS.filter((x) => pv.goods[x] - (sell[x] || 0) > 0).sort((a, b) => price(a) - price(b))[0];
      if (!g) break;
      sell[g] = (sell[g] || 0) + 1; held--;
    }
    let budget = pv.coins - 3;
    let room = CFG.storageCap - held;
    const imp = {};
    let impLeft = CFG.imports.on ? CFG.imports.cap : 0;
    if (left >= 1) {
      GOODS.forEach((g) => {
        if (sell[g]) return;
        const need = Math.max(0, keep[g] - pv.goods[g]);
        // Buying to invest next round, when a share is worth more than the unit costs.
        const forShares = P.invest >= 0.8 && left >= 2 ? Math.max(0, Math.min(keepInvest[g], 3) - pv.goods[g]) : 0;
        let want = Math.min(Math.max(need, forShares), room);
        let fromStall = Math.min(want, S.stalls[g]);
        while (fromStall > 0 && E.buyCost(g, S.stalls[g], fromStall) > budget) fromStall--;
        budget -= E.buyCost(g, S.stalls[g], fromStall);
        // By rail when the stall is short: brick that growth is waiting for, or a unit a share repays.
        let rail = 0;
        const worthRail = (g === 'brick' && need > 0 && best && best.v > 0.8) || (need > 0 && inputWorth[g] > E.importPrice(g) + 2) || (forShares > 0 && impShare[g] * CPV > E.importPrice(g) * 1.1);
        if (worthRail) { rail = Math.min(want - fromStall, impLeft); while (rail > 0 && rail * E.importPrice(g) > budget) rail--; }
        if (rail > 0) { imp[g] = true; impLeft -= rail; budget -= rail * E.importPrice(g); }
        want = fromStall + rail;
        if (want > 0) { buy[g] = want; room -= want; }
      });
    }
    if (Object.keys(sell).length || Object.keys(buy).length) {
      const basket = { type: 'trade', buy, sell };
      if (Object.keys(imp).length) basket.import = imp;
      if (!tryAdd(basket)) { if (!tryAdd({ type: 'trade', buy: {}, sell })) tryAdd({ type: 'trade', buy, sell: {} }); }
    }
    return pl;
  }

  // ---------- Thinking ahead ----------
  // The bot drafts a plan in each of the five styles, plays every draft forward to the election with
  // all seats on the quick planner above, and locks the draft that ends furthest ahead. It does not see
  // the rivals' plans: it assumes each rival plays the middle-of-the-road style.
  function think(S, pi) {
    const own = S.players[pi].persona || 'adaptive';
    const model = JSON.parse(JSON.stringify(S));
    model.players.forEach((q, i) => { q.persona = i === pi ? own : 'adaptive'; });
    const drafts = [];
    const seen = new Set();
    [own].concat(Object.keys(PERSONAS).filter((k) => k !== own)).forEach((k) => {
      model.players[pi].persona = k;
      const d = plan(model, pi);
      const key = JSON.stringify(d);
      if (!seen.has(key)) { seen.add(key); drafts.push(d); }
    });
    model.players[pi].persona = own;
    if (drafts.length === 1) return drafts[0];
    let best = drafts[0];
    let bestV = -1e9;
    drafts.forEach((d) => {
      let T = E.resolve(model, model.players.map((_, i) => (i === pi ? d : plan(model, i)))).state;
      while (!T.over) T = E.resolve(T, T.players.map((_, i) => plan(T, i))).state;
      const sc = E.score(T);
      const v = sc[pi].total - Math.max(...sc.filter((r) => r.pi !== pi).map((r) => r.total)) + sc[pi].coins / 1000;
      if (v > bestV) { bestV = v; best = d; }
    });
    return best;
  }

  const Bots = { plan, think, PERSONAS, forecast };
  if (node) module.exports = Bots;
  else root.Bots = Bots;
})(typeof window !== 'undefined' ? window : globalThis);
