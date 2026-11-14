// Scripted bots (§11). One heuristic planner with a persona that weights its choices,
// plus a little seeded randomness so two matches on one map are not the same match.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const E = node ? require('./engine.js') : root.Engine;
  const CFG = E.CFG;
  const GOODS = E.GOODS;

  const PERSONAS = {
    raw:       { label: 'Raw specialist',   build: 0.9, workshop: 0.1, invest: 0.35, upgrade: 0.8, bond: 0.5, minRaw: 4, minProc: 9,  buyFor: 0 },
    workshop:  { label: 'Workshop builder', build: 0.9, workshop: 0.8, invest: 0.4,  upgrade: 0.6, bond: 0.6, minRaw: 5, minProc: 8,  buyFor: 0 },
    founder:   { label: 'District founder', build: 0.6, workshop: 0.3, invest: 1.0,  upgrade: 0.4, bond: 0.4, minRaw: 5, minProc: 10, buyFor: 6 },
    adaptive:  { label: 'Follows the queue', build: 0.7, workshop: 0.4, invest: 0.75, upgrade: 0.6, bond: 0.5, minRaw: 4, minProc: 9,  buyFor: 4 },
    freerider: { label: 'Free-rider',       build: 0.8, workshop: 0.4, invest: 0.0,  upgrade: 0.7, bond: 0.3, minRaw: 3, minProc: 8,  buyFor: 0 },
  };

  function plan(S, pi) {
    const P = PERSONAS[S.players[pi].persona] || PERSONAS.adaptive;
    const rng = E.mulberry32((S.seed * 31 + S.round * 977 + pi * 7919) >>> 0);
    const pl = E.emptyPlan();
    const max = CFG.actionsPerRound;
    const left = CFG.rounds - S.round; // rounds after this one
    const tryAdd = (a) => {
      pl.actions.push(a);
      const v = E.preview(S, pi, pl);
      if (!v.ok) { pl.actions.pop(); return false; }
      return true;
    };
    const mine = E.ownBuildings(S, pi);
    const cap = E.buildingCap(S);
    const canGrow = (mine.length < cap || mine.some((x) => x.building.tier < 3)) && left >= 3;
    const price = (g) => E.price(g, S.stalls[g]);
    const pathTo = (from, dest) => E.findPath(S, pi, from, dest, { allowFree: true });
    const myNodes = mine.map((x) => x.id);
    let pv = E.preview(S, pi, pl);

    // 1. Clear bonds before the election: 12 coins are worth 1 vote, an open bond costs 4.
    if (left <= 3 && S.players[pi].bonds > 0) tryAdd({ type: 'bond', op: 'repay' });

    // 2. Invest in the open projects.
    if (rng() < P.invest) {
      for (const pr of E.visibleProjects(S)) {
        if (pl.actions.length >= max - 1) break;
        pv = E.preview(S, pi, pl);
        const bundle = {};
        let any = 0;
        GOODS.forEach((g) => {
          const keep = g === 'brick' && canGrow && left > 6 ? 1 : 0;
          const q = Math.min(E.missing(pr, g), pv.goods[g] - keep);
          if (q > 0) { bundle[g] = q; any += q; }
        });
        if (!any) continue;
        if (tryAdd({ type: 'invest', plot: pr.plot, goods: bundle })) continue;
        // No route yet: lay the one missing link if that is all it takes.
        const r = pathTo(myNodes, pr.plot);
        if (r && r.missing === 1 && pl.actions.length <= max - 2) {
          const mark = pl.actions.length;
          if (tryAdd({ type: 'link', edge: r.missingEdges[0], bid: 0 }) && !tryAdd({ type: 'invest', plot: pr.plot, goods: bundle })) pl.actions.length = mark;
        }
      }
    }

    // 3. Build a new works.
    pv = E.preview(S, pi, pl);
    if (mine.length < cap && left >= 5 && pl.actions.length <= max - 2 && rng() < P.build && pv.goods.brick >= 1) {
      const produced = new Set(mine.map((x) => E.outputOf(x.building)));
      const options = [];
      S.nodes.filter((x) => x.kind === 'site' && !x.building).forEach((x) => {
        const r = pathTo([x.id], 0);
        if (!r) return;
        const access = -3 * r.missing - 2 * r.tolls;
        const g = CFG.terrain[x.terrain];
        options.push({ site: x.id, kind: 'raw', r, v: price(g) * 2 + (produced.has(g) ? -2 : 2) + access + rng() * 4 });
        if (rng() < P.workshop) {
          Object.keys(CFG.recipes).forEach((k) => {
            const rc = CFG.recipes[k];
            const have = Object.keys(rc.in).filter((i) => produced.has(i)).length;
            options.push({ site: x.id, kind: k, r, v: price(rc.out) + have * 5 - 6 + access + rng() * 4 });
          });
        }
      });
      options.sort((a, b) => b.v - a.v);
      const o = options[0];
      if (o && o.r.missing <= max - 1 - pl.actions.length - 1) {
        const mark = pl.actions.length;
        const cost = (o.kind === 'raw' ? CFG.cost.raw.coins : CFG.cost.workshop.coins) + o.r.missing * CFG.cost.link;
        if (pv.coins < cost && S.players[pi].bonds < CFG.bond.max && left >= 8 && rng() < P.bond && pl.actions.length + o.r.missing + 2 <= max - 0) {
          tryAdd({ type: 'bond', op: 'take' });
        }
        let ok = true;
        o.r.missingEdges.forEach((ei) => { ok = ok && tryAdd({ type: 'link', edge: ei, bid: 0 }); });
        const bid = rng() < 0.3 ? 1 + Math.floor(rng() * 2) : 0;
        ok = ok && (tryAdd({ type: 'build', site: o.site, kind: o.kind, bid }) || tryAdd({ type: 'build', site: o.site, kind: o.kind, bid: 0 }));
        if (!ok) pl.actions.length = mark;
      }
    }

    // 4. Upgrade.
    pv = E.preview(S, pi, pl);
    if (pl.actions.length <= max - 2 && left >= 3 && rng() < P.upgrade && pv.goods.brick >= 1) {
      const c = mine.filter((x) => x.building.tier < 3 && x.building.built < S.round)
        .sort((a, b) => a.building.tier - b.building.tier || price(E.outputOf(b.building)) - price(E.outputOf(a.building)))[0];
      if (c) tryAdd({ type: 'upgrade', site: c.id });
    }

    // 5. A spare action can lay the core link of an open project plot, for the tolls.
    if (pl.actions.length <= max - 2 && left >= 6 && rng() < 0.25) {
      const pr = E.visibleProjects(S)[0];
      const ei = pr ? E.edgeBetween(S, 0, pr.plot) : -1;
      if (ei >= 0 && S.edges[ei].owner === null && E.preview(S, pi, pl).coins >= 8) tryAdd({ type: 'link', edge: ei, bid: 0 });
    }

    // 6. One trade basket: sell the surplus, buy what the engine is short of.
    pv = E.preview(S, pi, pl);
    const keep = E.zero();
    if (canGrow) keep.brick = 1;
    mine.forEach((x) => {
      const b = x.building;
      if (b.type === 'raw') return;
      const rc = CFG.recipes[b.type];
      for (const g in rc.in) keep[g] += rc.in[g] * CFG.recipeRuns[b.tier - 1];
    });
    if (P.invest >= 0.7 && left >= 2) {
      E.visibleProjects(S).forEach((pr) => GOODS.forEach((g) => { if (E.missing(pr, g) > 0) keep[g] = Math.max(keep[g], Math.min(2, E.missing(pr, g))); }));
    }
    const total = GOODS.reduce((s, g) => s + pv.goods[g], 0);
    const sell = {};
    const buy = {};
    let selling = 0;
    GOODS.forEach((g) => {
      const spare = pv.goods[g] - (left === 0 ? 0 : keep[g]);
      const floor = E.isRaw(g) ? P.minRaw : P.minProc;
      if (spare > 0 && (price(g) >= floor || left === 0 || total > CFG.storageCap - 2)) { sell[g] = spare; selling += spare; }
    });
    let budget = pv.coins - 2;
    GOODS.forEach((g) => {
      if (sell[g] || left === 0) return;
      let want = Math.max(0, keep[g] - pv.goods[g]);
      if (g !== 'brick' && !(keep[g] && price(g) <= Math.max(6, P.buyFor))) want = 0;
      want = Math.min(want, 2, S.stalls[g]);
      while (want > 0 && price(g) * want > budget) want--;
      if (want > 0) { buy[g] = want; budget -= price(g) * want; }
    });
    if (selling || Object.keys(buy).length) {
      if (!tryAdd({ type: 'trade', buy, sell })) {
        if (!tryAdd({ type: 'trade', buy: {}, sell })) tryAdd({ type: 'trade', buy, sell: {} });
      }
    }
    return pl;
  }

  const Bots = { plan, PERSONAS };
  if (node) module.exports = Bots;
  else root.Bots = Bots;
})(typeof window !== 'undefined' ? window : globalThis);
