// Rules engine for the grey-box prototype. Pure functions: no DOM, no hidden state.
// resolve(state, plans) returns a new state and an event log, as §11 of the design doc asks.
(function (root) {
  'use strict';
  const CFG = typeof module !== 'undefined' && module.exports ? require('./config.js') : root.CONFIG;
  const GOODS = CFG.goods;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const zero = () => Object.fromEntries(GOODS.map((g) => [g, 0]));
  const isRaw = (g) => CFG.raw.includes(g);
  const price = (g, units) => {
    const t = isRaw(g) ? CFG.price.raw : CFG.price.processed;
    return t[Math.max(0, Math.min(units, t.length - 1))];
  };
  const shuffle = (arr, rng) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };
  const emptyPlan = () => ({ actions: [], idle: [] });
  // Imports (§6.3): a buy order marked "import if short" is topped up by rail, a few units a round.
  const importPrice = (g) => (isRaw(g) ? CFG.imports.raw : CFG.imports.processed);
  const wantsImport = (a, g) => CFG.imports.on && !!a.import && (a.import === true || !!a.import[g]);
  const upkeepOf = (b) => CFG.upkeep[b.tier - 1];
  // What k units fetch when sold into a stall holding `units`, and what k units cost to buy from it.
  // With sliding prices every unit moves the price one step; without, all trade at the posted price.
  const sellValue = (g, units, k) => {
    if (!CFG.slidingPrice) return k * price(g, units);
    let v = 0; for (let j = 0; j < k; j++) v += price(g, units + j); return v;
  };
  const buyCost = (g, units, k) => {
    if (!CFG.slidingPrice) return k * price(g, units);
    let v = 0; for (let j = 0; j < k; j++) v += price(g, units - j); return v;
  };

  // ---------- Setup ----------
  function newGame(opts) {
    const n = Math.max(2, Math.min(4, opts.nPlayers || 3));
    const seed = (opts.seed >>> 0) || 1;
    const human = opts.human === undefined ? 0 : opts.human; // seat index, or -1 for all bots
    const rng = mulberry32(seed);
    const M = CFG.map;
    const nodes = [{ id: 0, kind: 'core', x: M.cx, y: M.cy }];
    for (let k = 0; k < 7; k++) {
      const a = ((-90 + (k * 360) / 7) * Math.PI) / 180;
      nodes.push({ id: 1 + k, kind: 'plot', x: Math.round(M.cx + M.plotRx * Math.cos(a)), y: Math.round(M.cy + M.plotRy * Math.sin(a)) });
    }
    for (let k = 0; k < 12; k++) {
      const a = ((-75 + k * 30) * Math.PI) / 180;
      nodes.push({ id: 8 + k, kind: 'site', x: Math.round(M.cx + M.siteRx * Math.cos(a)), y: Math.round(M.cy + M.siteRy * Math.sin(a)) });
    }
    const plots = nodes.filter((x) => x.kind === 'plot');
    const sites = nodes.filter((x) => x.kind === 'site');
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

    // Candidate links: every plot to the core, every site to its nearest plot, plus a shuffled pool.
    const edges = [];
    const deg = (id) => edges.filter((e) => e.a === id || e.b === id).length;
    const has = (a, b) => edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
    const add = (a, b) => { if (!has(a, b)) edges.push({ a, b, owner: null }); };
    plots.forEach((p) => add(0, p.id));
    const near = {};
    const second = {};
    sites.forEach((s) => {
      const by = plots.slice().sort((p, q) => dist(s, p) - dist(s, q));
      near[s.id] = by[0].id; second[s.id] = by[1].id;
      add(s.id, by[0].id);
    });
    sites.forEach((s) => { if (rng() < M.secondPlotLinkChance && deg(second[s.id]) < 4) add(s.id, second[s.id]); });
    sites.forEach((s, i) => { const t = sites[(i + 1) % 12]; if (rng() < M.ringLinkChance && deg(s.id) < 4 && deg(t.id) < 4) add(s.id, t.id); });
    sites.forEach((s, i) => { if (deg(s.id) < 2) add(s.id, sites[(i + 1) % 12].id); });

    // Starting sites: spread round the ring, each with its own nearest plot (§4: no shared only-way-in).
    let starts = [];
    const off = Math.floor(rng() * 12);
    for (let t = 0; t < 12; t++) {
      starts = Array.from({ length: n }, (_, i) => 8 + ((off + t + Math.round((i * 12) / n)) % 12));
      if (new Set(starts.map((s) => near[s])).size === n) break;
    }

    // Terrain shuffle, then make sure starting works stand on different terrains (§6.2).
    const terrNames = Object.keys(CFG.terrain);
    let terr = shuffle(terrNames.flatMap((t) => Array(CFG.sitesPerTerrain).fill(t)), rng);
    sites.forEach((s, i) => { s.terrain = terr[i]; });
    const used = new Set();
    starts.forEach((sid) => {
      const s = nodes[sid];
      if (used.has(s.terrain)) {
        const swap = sites.find((o) => !starts.includes(o.id) && !used.has(o.terrain));
        if (swap) { const t = s.terrain; s.terrain = swap.terrain; swap.terrain = t; }
      }
      used.add(s.terrain);
    });

    const personas = shuffle(['raw', 'workshop', 'founder', 'adaptive', 'freerider', 'founder'], rng);
    const botNames = shuffle(['Ashworth', 'Brandt', 'Castell', 'Dunmore', 'Eller', 'Fenwick'], rng);
    const players = [];
    for (let i = 0; i < n; i++) {
      const goods = zero();
      for (const g in CFG.startGoods) goods[g] = CFG.startGoods[g];
      const bot = i !== human;
      players.push({ name: bot ? botNames[i] : 'You', bot, persona: bot ? personas[i] : null, coins: CFG.startCoins, goods, bonds: 0, debt: 0 });
      const s = nodes[starts[i]];
      s.building = { owner: i, type: 'raw', good: CFG.terrain[s.terrain], tier: 1, built: 0, st: 'run' };
      edges.forEach((e) => {
        const k = [e.a, e.b].sort((x, y) => x - y).join('-');
        if (k === [s.id, near[s.id]].sort((x, y) => x - y).join('-') || k === [0, near[s.id]].join('-')) e.owner = i;
      });
    }

    // Two built districts whose shares belong to the city; the other five plots form the project queue.
    const startPlots = new Set(starts.map((s) => near[s]));
    const freePlots = shuffle(plots.filter((p) => !startPlots.has(p.id)).map((p) => p.id), rng);
    const builtPlots = freePlots.slice(0, CFG.startDistricts.length);
    builtPlots.forEach((pid, i) => {
      nodes[pid].district = { type: CFG.startDistricts[i], cls: 1, pips: 0, shares: Array(n).fill(0), founded: 0, served: true, miss: 0 };
    });
    const queuePlots = shuffle(plots.filter((p) => !builtPlots.includes(p.id)).map((p) => p.id), rng);
    const types = shuffle(CFG.projectTypes, rng);
    const queue = queuePlots.map((pid, i) => ({
      plot: pid, type: types[i % types.length], need: { ...CFG.districts[types[i % types.length]].found },
      got: {}, shares: Array(n).fill(0), city: 0,
    }));

    const stalls = zero();
    GOODS.forEach((g) => { stalls[g] = CFG.stallStart; });
    return { seed, round: 1, over: false, priority: 0, nodes, edges, stalls, fund: 0, queue, players };
  }

  // ---------- Queries ----------
  const visibleProjects = (S) => S.queue.slice(0, CFG.visibleProjects);
  const missing = (pr, g) => (pr.need[g] || 0) - (pr.got[g] || 0);
  const districtDemand = (d) => CFG.districts[d.type].demand[d.cls - 1];
  const buildingCap = (S) => CFG.buildingCap[S.players.length];
  const ownBuildings = (S, pi) => S.nodes.filter((x) => x.building && x.building.owner === pi);
  const edgeBetween = (S, a, b) => S.edges.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
  const outputOf = (b) => (b.type === 'raw' ? b.good : CFG.recipes[b.type].out);

  // Districts that buy this round, oldest first. The core counts as the oldest.
  function activeDistricts(S) {
    const list = [{ id: 0, core: true, demand: CFG.coreDemand }];
    S.nodes.filter((x) => x.district && x.district.founded < S.round)
      .sort((a, b) => a.district.founded - b.district.founded || a.id - b.id)
      .forEach((x) => list.push({ id: x.id, demand: districtDemand(x.district) }));
    return list;
  }
  function cityDemand(S) {
    const d = zero();
    activeDistricts(S).forEach((x) => { for (const g in x.demand) d[g] += x.demand[g]; });
    return d;
  }

  // Cheapest path from any origin to dest. Own links are free, a rival link costs one toll,
  // an unbuilt candidate link costs 100 when allowFree is set and is impassable otherwise.
  function findPath(S, pi, origins, dest, opts) {
    opts = opts || {};
    const paid = opts.paid || new Set();
    const extra = opts.extra || new Set();
    const INF = 1e9;
    const d = S.nodes.map(() => INF);
    const via = S.nodes.map(() => -1);
    origins.forEach((o) => { d[o] = 0; });
    const w = (e, i) => {
      if (e.owner === pi || extra.has(i) || paid.has(i)) return 0;
      if (e.owner === null) return opts.allowFree ? 100 : INF;
      return 1;
    };
    for (let it = 0; it < S.nodes.length; it++) {
      let changed = false;
      S.edges.forEach((e, i) => {
        const c = w(e, i);
        if (c >= INF) return;
        if (d[e.a] + c < d[e.b]) { d[e.b] = d[e.a] + c; via[e.b] = i; changed = true; }
        if (d[e.b] + c < d[e.a]) { d[e.a] = d[e.b] + c; via[e.a] = i; changed = true; }
      });
      if (!changed) break;
    }
    if (d[dest] >= INF) return null;
    const tollEdges = [];
    const missingEdges = [];
    let at = dest;
    let guard = 0;
    while (via[at] !== -1 && d[at] > 0 && guard++ < 50) {
      const i = via[at];
      const e = S.edges[i];
      const c = w(e, i);
      if (c === 1) tollEdges.push(i);
      if (c === 100) missingEdges.push(i);
      at = e.a === at ? e.b : e.a;
    }
    // Walk back through zero-cost steps too, so the full path is consistent.
    return { tolls: tollEdges.length, tollEdges, missing: missingEdges.length, missingEdges };
  }

  // Where a player's units of a good ship from: works that make it, otherwise any of their works.
  function origins(S, pi, g) {
    const mine = ownBuildings(S, pi).filter((x) => x.building.built < S.round);
    const makers = mine.filter((x) => outputOf(x.building) === g);
    return (makers.length ? makers : mine).map((x) => x.id);
  }

  // ---------- Plan preview and validation ----------
  // Walks a plan the way the resolver will and reports what each action costs and whether it is legal.
  function preview(S, pi, plan) {
    plan = plan || emptyPlan();
    const p = S.players[pi];
    let coins = p.coins;
    let bonds = p.bonds;
    const acts = (plan.actions || []).map((a, i) => ({ a, err: i >= CFG.actionsPerRound ? 'No actions left' : null, tolls: 0 }));

    for (const x of acts) {
      if (x.err || x.a.type !== 'bond') continue;
      if (x.a.op === 'take') {
        if (bonds >= CFG.bond.max) x.err = 'Bond limit reached';
        else { bonds++; coins += CFG.bond.amount; }
      } else if (bonds < 1) x.err = 'No bond to repay';
      else if (coins < CFG.bond.amount) x.err = 'Not enough coin';
      else { bonds--; coins -= CFG.bond.amount; }
    }

    // Upkeep and production: recipes use goods held at the start of the round.
    const held = { ...p.goods };
    const made = zero();
    const production = [];
    for (const nd of ownBuildings(S, pi)) {
      const b = nd.building;
      const pr = { site: nd.id, status: 'run', made: {}, used: {} };
      if (b.built >= S.round) pr.status = 'new';
      else if ((plan.idle || []).includes(nd.id)) pr.status = 'idle';
      else if (coins < upkeepOf(b)) pr.status = 'unpaid';
      else if (b.type === 'raw') {
        const q = CFG.rawOutput[b.tier - 1];
        made[b.good] += q; pr.made[b.good] = q; coins -= upkeepOf(b); pr.upkeep = upkeepOf(b);
      } else {
        const rc = CFG.recipes[b.type];
        let runs = CFG.recipeRuns[b.tier - 1];
        for (const g in rc.in) runs = Math.min(runs, Math.floor(held[g] / rc.in[g]));
        if (runs <= 0) pr.status = 'starved';
        else {
          for (const g in rc.in) { held[g] -= runs * rc.in[g]; pr.used[g] = runs * rc.in[g]; }
          made[rc.out] += runs * rc.qty; pr.made[rc.out] = runs * rc.qty; coins -= upkeepOf(b); pr.upkeep = upkeepOf(b);
        }
      }
      production.push(pr);
    }
    const goods = zero();
    GOODS.forEach((g) => { goods[g] = held[g] + made[g]; });

    let nB = ownBuildings(S, pi).length;
    const cap = buildingCap(S);
    const usedSites = new Set();
    const upgraded = new Set();
    const myLinks = new Set();
    const paid = new Set();
    let traded = false;
    let buying = 0;
    let tolls = 0;
    acts.forEach((x) => { if (!x.err && x.a.type === 'link' && S.edges[x.a.edge] && S.edges[x.a.edge].owner === null) myLinks.add(x.a.edge); });

    for (const x of acts) {
      if (x.err || x.a.type === 'bond') continue;
      const a = x.a;
      if (a.type === 'build') {
        const nd = S.nodes[a.site];
        const bid = Math.max(0, a.bid | 0);
        const cost = a.kind === 'raw' ? CFG.cost.raw : CFG.cost.workshop;
        if (!nd || nd.kind !== 'site') x.err = 'Not a production site';
        else if (a.kind !== 'raw' && !CFG.recipes[a.kind]) x.err = 'Unknown building';
        else if (nd.building) x.err = 'Site is taken';
        else if (usedSites.has(a.site)) x.err = 'Already in your plan';
        else if (nB >= cap) x.err = 'Building cap reached (' + cap + ')';
        else if (coins < cost.coins + bid) x.err = 'Not enough coin';
        else if (goods.brick < cost.brick) x.err = 'Needs ' + cost.brick + ' brick';
        else { coins -= cost.coins + bid; goods.brick -= cost.brick; nB++; usedSites.add(a.site); }
      } else if (a.type === 'upgrade') {
        const nd = S.nodes[a.site];
        const b = nd && nd.building;
        if (!b || b.owner !== pi) x.err = 'Not your building';
        else if (b.built >= S.round) x.err = 'Still under construction';
        else if (b.tier >= 3) x.err = 'Already tier III';
        else if (upgraded.has(a.site)) x.err = 'Already in your plan';
        else {
          const cost = CFG.cost.upgrade[b.tier];
          if (coins < cost.coins) x.err = 'Not enough coin';
          else if (goods.brick < cost.brick) x.err = 'Needs ' + cost.brick + ' brick';
          else { coins -= cost.coins; goods.brick -= cost.brick; upgraded.add(a.site); }
        }
      } else if (a.type === 'link') {
        const e = S.edges[a.edge];
        const bid = Math.max(0, a.bid | 0);
        if (!e) x.err = 'No candidate link there';
        else if (e.owner !== null) x.err = 'Link already built';
        else if (acts.some((y) => y !== x && !y.err && y.a.type === 'link' && y.a.edge === a.edge && acts.indexOf(y) < acts.indexOf(x))) x.err = 'Already in your plan';
        else if (coins < CFG.cost.link + bid) x.err = 'Not enough coin';
        else coins -= CFG.cost.link + bid;
      } else if (a.type === 'trade') {
        if (traded) { x.err = 'One trade basket per round'; continue; }
        let cost = 0;
        let t = 0;
        let imp = 0;
        const trial = new Set(paid);
        for (const g of GOODS) {
          const b = (a.buy && a.buy[g]) | 0;
          const s = (a.sell && a.sell[g]) | 0;
          if (b < 0 || s < 0) x.err = 'Bad quantity';
          else if (b > 0 && s > 0) x.err = 'Cannot buy and sell ' + g + ' in one round';
          else if (s > goods[g]) x.err = 'Not enough ' + g + ' to sell';
          else if (s > 0) {
            const r = findPath(S, pi, origins(S, pi, g), 0, { paid: trial, extra: myLinks });
            if (!r) x.err = 'No link route to the market for ' + g;
            else { t += r.tolls; r.tollEdges.forEach((i) => trial.add(i)); }
          }
          const fromStall = Math.min(b, S.stalls[g]);
          cost += buyCost(g, S.stalls[g], fromStall);
          if (b > fromStall && wantsImport(a, g)) { const k = Math.min(b - fromStall, CFG.imports.cap - imp); imp += k; cost += k * importPrice(g); }
          if (x.err) break;
        }
        // Tolls on a sale are taken out of the proceeds, so a seat with no coin can still sell (§6.5).
        if (!x.err && coins < cost) x.err = 'Not enough coin for these orders';
        if (!x.err) {
          coins -= cost; tolls += t; x.tolls = t; traded = true;
          trial.forEach((i) => paid.add(i));
          GOODS.forEach((g) => { goods[g] -= (a.sell && a.sell[g]) | 0; buying += (a.buy && a.buy[g]) | 0; });
        }
      } else if (a.type === 'invest') {
        const pr = visibleProjects(S).find((q) => q.plot === a.plot);
        let total = 0;
        let t = 0;
        const trial = new Set(paid);
        if (!pr) x.err = 'That project is not open';
        else {
          for (const g of GOODS) {
            const q = (a.goods && a.goods[g]) | 0;
            if (q < 0) x.err = 'Bad quantity';
            else if (q > goods[g]) x.err = 'Not enough ' + g;
            else if (q > Math.max(0, missing(pr, g))) x.err = 'The project does not need that much ' + g;
            else if (q > 0) {
              const r = findPath(S, pi, origins(S, pi, g), pr.plot, { paid: trial, extra: myLinks });
              if (!r) x.err = 'No link route to that plot';
              else { t += r.tolls; r.tollEdges.forEach((i) => trial.add(i)); }
            }
            total += q;
            if (x.err) break;
          }
          if (!x.err && total === 0) x.err = 'Nothing to invest';
          if (!x.err && coins < t * CFG.toll) x.err = 'Not enough coin for tolls';
          if (!x.err) {
            coins -= t * CFG.toll; tolls += t; x.tolls = t;
            trial.forEach((i) => paid.add(i));
            GOODS.forEach((g) => { goods[g] -= (a.goods && a.goods[g]) | 0; });
          }
        }
      } else x.err = 'Unknown action';
    }
    const totalGoods = GOODS.reduce((s, g) => s + goods[g], 0);
    return {
      ok: acts.every((x) => !x.err), actions: acts, production, coins, goods, bonds, tolls,
      storage: totalGoods + buying, overflow: Math.max(0, totalGoods + buying - CFG.storageCap),
    };
  }

  // Proportional split with leftovers handed out in priority order (§6.3).
  function allocate(reqs, avail, prio) {
    const res = {};
    const total = reqs.reduce((s, r) => s + r.q, 0);
    avail = Math.max(0, avail);
    if (total <= avail) { reqs.forEach((r) => { res[r.pi] = r.q; }); return res; }
    let left = avail;
    reqs.forEach((r) => { res[r.pi] = Math.floor((r.q * avail) / total); left -= res[r.pi]; });
    const order = reqs.slice().sort((a, b) => prio(a.pi) - prio(b.pi));
    let guard = 0;
    while (left > 0 && guard++ < 100) {
      for (const r of order) { if (left > 0 && res[r.pi] < r.q) { res[r.pi]++; left--; } }
    }
    return res;
  }

  // ---------- Round resolution (§8) ----------
  function resolve(S0, plans) {
    const S = JSON.parse(JSON.stringify(S0));
    const n = S.players.length;
    const log = [];
    const L = (ph, pi, t) => log.push({ ph, pi, t });
    const nm = (pi) => S.players[pi].name;
    const pv = S.players.map((_, i) => preview(S, i, plans[i] || emptyPlan()));
    const valid = pv.map((v) => v.actions.filter((x) => !x.err).map((x) => x.a));
    pv.forEach((v, pi) => v.actions.filter((x) => x.err).forEach((x) => L('Lock', pi, nm(pi) + "'s " + x.a.type + ' was dropped: ' + x.err)));
    const prio = (pi) => (pi - S.priority + n) % n;
    const posted = {};
    GOODS.forEach((g) => { posted[g] = price(g, S.stalls[g]); });
    const demand = cityDemand(S);
    const active = activeDistricts(S);
    const openProjects = visibleProjects(S);

    // Bonds are settled first so the coins can be used this round.
    valid.forEach((as, pi) => as.filter((a) => a.type === 'bond').forEach((a) => {
      const p = S.players[pi];
      if (a.op === 'take') { p.bonds++; p.coins += CFG.bond.amount; L('Bonds', pi, nm(pi) + ' takes a bond (+' + CFG.bond.amount + ')'); }
      else { p.bonds--; p.coins -= CFG.bond.amount; L('Bonds', pi, nm(pi) + ' repays a bond'); }
    }));

    // Claims: contested sites and edges go to the higher bid, then the priority marker (§6.7).
    const claims = {};
    valid.forEach((as, pi) => as.forEach((a) => {
      if (a.type === 'build') (claims['s' + a.site] = claims['s' + a.site] || []).push({ pi, a });
      if (a.type === 'link') (claims['e' + a.edge] = claims['e' + a.edge] || []).push({ pi, a });
    }));
    const won = [];
    Object.keys(claims).forEach((k) => {
      const arr = claims[k].sort((x, y) => ((y.a.bid | 0) - (x.a.bid | 0)) || (prio(x.pi) - prio(y.pi)));
      arr[0].contested = arr.length > 1;
      won.push(arr[0]);
      const what = k[0] === 's' ? 'site' : 'link';
      arr.slice(1).forEach((l) => L('Claims', l.pi, nm(l.pi) + ' loses a contested ' + what + ' to ' + nm(arr[0].pi) + ' (bid ' + (arr[0].a.bid | 0) + ' against ' + (l.a.bid | 0) + '); coins refunded'));
    });

    // Upkeep and production.
    pv.forEach((v, pi) => {
      const p = S.players[pi];
      v.production.forEach((pr) => {
        const b = S.nodes[pr.site].building;
        b.st = pr.status;
        if (pr.status !== 'run') {
          if (pr.status !== 'new') L('Production', pi, nm(pi) + "'s " + label(b) + ' is ' + (pr.status === 'unpaid' ? 'idle (no coin for upkeep)' : pr.status));
          return;
        }
        p.coins -= pr.upkeep;
        for (const g in pr.used) p.goods[g] -= pr.used[g];
        for (const g in pr.made) p.goods[g] += pr.made[g];
        const used = Object.keys(pr.used).map((g) => pr.used[g] + ' ' + g).join(' + ');
        L('Production', pi, nm(pi) + "'s " + label(b) + ' makes ' + Object.keys(pr.made).map((g) => pr.made[g] + ' ' + g).join(', ') + (used ? ' from ' + used : ''));
      });
    });

    // Construction.
    won.forEach(({ pi, a, contested }) => {
      const p = S.players[pi];
      const bid = contested ? Math.max(0, a.bid | 0) : 0; // an uncontested claim pays no bid (§6.7)
      if (a.type === 'build') {
        const cost = a.kind === 'raw' ? CFG.cost.raw : CFG.cost.workshop;
        const nd = S.nodes[a.site];
        p.coins -= cost.coins + bid; p.goods.brick -= cost.brick; S.fund += bid;
        nd.building = { owner: pi, type: a.kind, good: a.kind === 'raw' ? CFG.terrain[nd.terrain] : null, tier: 1, built: S.round, st: 'new' };
        L('Construction', pi, nm(pi) + ' builds a ' + label(nd.building) + (bid ? ' (bid ' + bid + ' to the city fund)' : ''));
      } else {
        p.coins -= CFG.cost.link + bid; S.fund += bid;
        S.edges[a.edge].owner = pi;
        L('Construction', pi, nm(pi) + ' lays a link' + (bid ? ' (bid ' + bid + ' to the city fund)' : ''));
      }
    });
    valid.forEach((as, pi) => as.filter((a) => a.type === 'upgrade').forEach((a) => {
      const p = S.players[pi];
      const b = S.nodes[a.site].building;
      const cost = CFG.cost.upgrade[b.tier];
      p.coins -= cost.coins; p.goods.brick -= cost.brick; b.tier++;
      L('Construction', pi, nm(pi) + ' upgrades a ' + label(b) + ' to tier ' + 'I'.repeat(b.tier));
    }));

    // Shipping pays each rival link once per round (§6.5).
    const paid = Array.from({ length: n }, () => new Set());
    const ship = (pi, g, dest, ph, fromProceeds) => {
      const r = findPath(S, pi, origins(S, pi, g), dest, { paid: paid[pi] });
      if (!r) return 'no link route';
      if (fromProceeds) return { due: r.tollEdges }; // settled after the sale, out of what it brings
      if (S.players[pi].coins < r.tolls * CFG.toll) return 'no coin for the toll';
      payTolls(pi, r.tollEdges, ph);
      return null;
    };
    const payTolls = (pi, edges, ph) => edges.forEach((i) => {
      if (paid[pi].has(i)) return;
      const o = S.edges[i].owner;
      const amount = Math.min(CFG.toll, Math.max(0, S.players[pi].coins));
      paid[pi].add(i); S.players[pi].coins -= amount; S.players[o].coins += amount;
      L(ph, pi, nm(pi) + ' pays ' + nm(o) + ' a toll of ' + amount);
    });

    // Investments.
    openProjects.forEach((pr0) => {
      const pr = S.queue.find((q) => q.plot === pr0.plot);
      GOODS.forEach((g) => {
        const reqs = [];
        valid.forEach((as, pi) => {
          const q = as.filter((a) => a.type === 'invest' && a.plot === pr.plot).reduce((s, a) => s + ((a.goods && a.goods[g]) | 0), 0);
          if (q <= 0) return;
          const err = ship(pi, g, pr.plot, 'Investments');
          if (err) L('Investments', pi, nm(pi) + "'s " + g + ' never reaches the project: ' + err);
          else reqs.push({ pi, q: Math.min(q, S.players[pi].goods[g]) });
        });
        if (!reqs.length) return;
        const got = allocate(reqs, missing(pr, g), prio);
        reqs.forEach((r) => {
          const k = got[r.pi] || 0;
          if (k > 0) {
            const sh = k * (isRaw(g) ? CFG.sharesPerUnit.raw : CFG.sharesPerUnit.processed);
            S.players[r.pi].goods[g] -= k; pr.got[g] = (pr.got[g] || 0) + k; pr.shares[r.pi] += sh;
            L('Investments', r.pi, nm(r.pi) + ' invests ' + k + ' ' + g + ' in the ' + pr.type + ' project for ' + sh + ' share' + (sh > 1 ? 's' : '') + (k < r.q ? ' (' + (r.q - k) + ' returned, over-subscribed)' : ''));
          } else L('Investments', r.pi, nm(r.pi) + "'s " + g + ' is returned: the project was over-subscribed');
        });
      });
    });

    // Market: each stall clears on its own at the posted price (§6.3).
    const served = {};
    const imported = S.players.map(() => 0);
    active.forEach((d) => { served[d.id] = true; });
    GOODS.forEach((g) => {
      const pz = posted[g];
      const buys = [];
      const sells = [];
      valid.forEach((as, pi) => as.filter((a) => a.type === 'trade').forEach((a) => {
        const b = (a.buy && a.buy[g]) | 0;
        const s = (a.sell && a.sell[g]) | 0;
        if (b > 0) buys.push({ pi, q: b, imp: wantsImport(a, g) });
        if (s > 0) {
          const res = ship(pi, g, 0, 'Market', true);
          if (typeof res === 'string') L('Market', pi, nm(pi) + ' cannot sell ' + g + ': ' + res);
          else sells.push({ pi, q: Math.min(s, S.players[pi].goods[g]), due: res.due });
        }
      }));
      const bought = allocate(buys, S.stalls[g], prio);
      const wantK = buys.reduce((t, r) => t + (bought[r.pi] || 0), 0);
      const buyTotal = buyCost(g, S.stalls[g], wantK);
      let taken = 0;
      buys.forEach((r) => {
        let k = bought[r.pi] || 0;
        const each = wantK ? buyTotal / wantK : 0; // buyers in one round share one average price
        while (k > 0 && Math.ceil(k * each) > S.players[r.pi].coins) k--;
        const cost = Math.ceil(k * each);
        S.players[r.pi].coins -= cost; S.players[r.pi].goods[g] += k; taken += k;
        L('Market', r.pi, nm(r.pi) + ' buys ' + k + ' of ' + r.q + ' ' + g + ' for ' + cost);
        if (r.imp && k < r.q) {
          let m = Math.min(r.q - k, CFG.imports.cap - imported[r.pi]);
          while (m > 0 && m * importPrice(g) > S.players[r.pi].coins) m--;
          if (m > 0) {
            S.players[r.pi].coins -= m * importPrice(g); S.players[r.pi].goods[g] += m; imported[r.pi] += m;
            L('Market', r.pi, nm(r.pi) + ' imports ' + m + ' ' + g + ' by rail for ' + m * importPrice(g));
          }
        }
      });
      S.stalls[g] -= taken;
      const room = CFG.stallSlots - S.stalls[g] + demand[g];
      const sold = allocate(sells, room, prio);
      const soldK = sells.reduce((t, r) => t + (sold[r.pi] || 0), 0);
      const sellTotal = sellValue(g, S.stalls[g], soldK);
      sells.forEach((r) => {
        const k = sold[r.pi] || 0;
        const income = soldK ? Math.floor((k * sellTotal) / soldK) : 0;
        S.players[r.pi].coins += income; S.players[r.pi].goods[g] -= k;
        L('Market', r.pi, nm(r.pi) + ' sells ' + k + ' of ' + r.q + ' ' + g + ' for ' + income + (k < r.q ? ' (stall full)' : ''));
        if (k > 0) payTolls(r.pi, r.due, 'Market'); // nothing shipped, nothing owed
      });
      S.stalls[g] += soldK;
      active.forEach((d) => {
        const need = d.demand[g] || 0;
        const take = Math.min(need, S.stalls[g]);
        S.stalls[g] -= take;
        if (take < need) served[d.id] = false;
      });
    });

    // City: served districts pay dividends and earn pips; interest feeds the fund; the fund buys; one project is founded.
    active.forEach((d) => {
      if (d.core) { if (!served[0]) L('City', -1, 'The city core went short this round'); return; }
      const nd = S.nodes[d.id];
      const dd = nd.district;
      dd.served = served[d.id];
      if (!dd.served) {
        dd.miss = (dd.miss || 0) + 1;
        L('City', -1, 'The ' + dd.type + ' district (class ' + 'I'.repeat(dd.cls) + ') went unserved: no dividend, no pip');
        if (CFG.declineAfter && dd.miss >= CFG.declineAfter && dd.cls > 1) {
          dd.cls--; dd.pips = 0; dd.miss = 0;
          L('City', -1, 'The ' + dd.type + ' district falls to class ' + 'I'.repeat(dd.cls) + ' after ' + CFG.declineAfter + ' unserved rounds');
        }
        return;
      }
      dd.miss = 0;
      dd.shares.forEach((sh, pi) => {
        if (sh > 0) { S.players[pi].coins += sh * CFG.dividendPerShare; L('City', pi, nm(pi) + ' collects a dividend of ' + sh * CFG.dividendPerShare + ' from the ' + dd.type + ' district'); }
      });
      if (dd.cls < 3) {
        dd.pips++;
        if (dd.pips >= CFG.pipsPerClass) { dd.cls++; dd.pips = 0; L('City', -1, 'The ' + dd.type + ' district rises to class ' + 'I'.repeat(dd.cls)); }
      }
    });
    S.players.forEach((p, pi) => {
      if (p.bonds > 0 || p.debt > 0) {
        const owed = p.bonds * CFG.bond.interest + (p.debt || 0);
        const due = Math.max(0, Math.min(owed, p.coins)); // a broke house pays what it has; the rest is debt
        p.coins -= due; S.fund += due; p.debt = owed - due;
        L('City', pi, nm(pi) + ' pays ' + due + ' in bond interest into the city fund' + (p.debt ? ' and owes ' + p.debt + ' more as debt' : ''));
      }
    });
    const first = visibleProjects(S)[0];
    if (first) {
      const opts = GOODS.filter((g) => missing(first, g) > 0 && S.stalls[g] > 0 && S.fund >= posted[g]).sort((a, b) => posted[a] - posted[b]);
      if (opts.length) {
        const g = opts[0];
        S.fund -= posted[g]; S.stalls[g]--; first.got[g] = (first.got[g] || 0) + 1; first.city++;
        L('City', -1, 'The city fund buys 1 ' + g + ' for the ' + first.type + ' project (' + posted[g] + ' coins)');
      }
    }
    const done = visibleProjects(S).find((pr) => GOODS.every((g) => missing(pr, g) <= 0));
    if (done) {
      S.nodes[done.plot].district = { type: done.type, cls: 1, pips: 0, shares: done.shares, founded: S.round, served: false, miss: 0 };
      S.queue.splice(S.queue.indexOf(done), 1);
      const holders = done.shares.map((sh, pi) => (sh ? nm(pi) + ' ' + sh : null)).filter(Boolean).join(', ');
      L('City', -1, 'A ' + done.type + ' district is founded. Shares: ' + (holders || 'none') + '. Its demand starts next round');
    }

    // Close: storage cap, priority marker, next round.
    S.players.forEach((p, pi) => {
      let total = GOODS.reduce((s, g) => s + p.goods[g], 0);
      const lost = {};
      while (total > CFG.storageCap) {
        const g = GOODS.filter((x) => p.goods[x] > 0).sort((a, b) => price(a, S.stalls[a]) - price(b, S.stalls[b]) || p.goods[b] - p.goods[a])[0];
        p.goods[g]--; total--; lost[g] = (lost[g] || 0) + 1;
      }
      const txt = Object.keys(lost).map((g) => lost[g] + ' ' + g).join(', ');
      if (txt) L('Close', pi, nm(pi) + ' discards ' + txt + ' over the storage cap of ' + CFG.storageCap);
    });
    S.priority = (S.priority + 1) % n;
    S.round++;
    if (S.round > CFG.rounds) S.over = true;
    return { state: S, log };
  }

  function label(b) {
    if (b.type === 'raw') return b.good + ' works';
    return b.type === 'tools' ? 'tool works' : 'goods works';
  }

  // ---------- Election score (§6.8) ----------
  function score(S) {
    const rows = S.players.map((p, pi) => {
      let shares = 0;
      let shareCount = 0;
      S.nodes.forEach((nd) => {
        if (nd.district) { shares += nd.district.shares[pi] * CFG.votes.share[nd.district.cls - 1]; shareCount += nd.district.shares[pi]; }
      });
      const buildings = ownBuildings(S, pi).reduce((s, nd) => s + CFG.votes.building[nd.building.tier - 1], 0);
      const campaign = Math.floor(Math.max(0, p.coins) / CFG.votes.coinsPerVote);
      const bonds = -p.bonds * CFG.bond.votePenalty - (p.debt || 0) * CFG.votes.debt;
      return { pi, shares, buildings, campaign, bonds, total: shares + buildings + campaign + bonds, shareCount, coins: p.coins };
    });
    const order = rows.slice().sort((a, b) => b.total - a.total || b.shareCount - a.shareCount || b.coins - a.coins);
    order.forEach((r, i) => { r.rank = i + 1; });
    return rows;
  }

  const Engine = {
    CFG, GOODS, mulberry32, zero, isRaw, price, emptyPlan, newGame, visibleProjects, missing, districtDemand,
    buildingCap, ownBuildings, importPrice, upkeepOf, sellValue, buyCost, edgeBetween, outputOf, activeDistricts, cityDemand, findPath, origins,
    preview, allocate, resolve, label, score,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
  else root.Engine = Engine;
})(typeof window !== 'undefined' ? window : globalThis);
