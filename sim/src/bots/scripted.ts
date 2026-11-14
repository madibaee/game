/**
 * The six scripted bots of §11. They share one decision routine and differ only in the
 * Persona knobs below, so adding a bot is adding a row. Each uses a little randomness
 * (Persona.noise) so that matches on one map differ.
 */
import { CITY, shippingRoute, shortestPath } from '../board.ts';
import type { BuildingKind, Config } from '../config.ts';
import { BRICK, GOODS, NG, TERRAIN_GOOD, isRaw, vec } from '../config.ts';
import type { Plan, StartBid, State } from '../engine.ts';
import { buildCost, buildingCap, canLink, cityDemand, districtDemand, maxOutput, recipeOf, shipCost, shipOrigins, upgradeCost } from '../engine.ts';
import type { Rng } from '../rng.ts';
import type { Bot } from './planner.ts';
import { Planner } from './planner.ts';

export interface Persona {
  name: string;
  /** Multipliers on the estimated value of a new raw works / workshop. 0 = never builds it. */
  rawBias: number;
  workshopBias: number;
  /** Extra value for making goods the visible projects need. */
  queueBias: number;
  maxBuildings: number;
  /** Count the votes a building is worth when weighing a build or upgrade. */
  countsBuildingVotes: boolean;
  /** An expansion must be worth this many times its cost. */
  hurdle: number;
  invest: 'never' | 'value' | 'always';
  /** Multiplier on the estimated worth of a share when deciding sell-or-invest. */
  investBias: number;
  /** Buys goods from the stall in order to invest them next round. */
  buysToInvest: boolean;
  /** How many missing links it will lay to reach a project plot. */
  linksToPlots: number;
  bonds: 'never' | 'need';
  /** 0..1: how far it trusts that districts will climb a class and projects will be founded when sizing up demand. */
  foresight: number;
  noise: number;
}

const base: Persona = {
  name: 'base', rawBias: 1, workshopBias: 1, queueBias: 0, maxBuildings: Infinity, countsBuildingVotes: true, hurdle: 1,
  invest: 'value', investBias: 1, buysToInvest: false, linksToPlots: 1, bonds: 'need', foresight: 0.5, noise: 0.25,
};

export const PERSONAS: Record<string, Persona> = {
  /** Raw works only, upgraded hard; sells or invests on value. */
  raw: { ...base, name: 'raw', workshopBias: 0 },
  /** Leans to workshops and buys inputs it does not make. */
  workshop: { ...base, name: 'workshop', workshopBias: 1.8, rawBias: 0.8, foresight: 1 },
  /** Puts every needed good into projects and buys more to invest. */
  founder: { ...base, name: 'founder', invest: 'always', buysToInvest: true, linksToPlots: 2, queueBias: 0.5 },
  /** Small engine, no bonds, no investing; banks coins for the campaign fund. */
  hoarder: { ...base, name: 'hoarder', maxBuildings: 2, countsBuildingVotes: false, hurdle: 1.5, invest: 'never', bonds: 'never' },
  /** Full engine, never invests; sells into districts others found. */
  freerider: { ...base, name: 'freerider', invest: 'never' },
  /** Follows the project queue: builds what it needs, invests when a share beats the sale. */
  adaptive: { ...base, name: 'adaptive', queueBias: 1, buysToInvest: true, linksToPlots: 2, foresight: 1 },
};

export const SCRIPTED = Object.keys(PERSONAS);

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** A read of the table that every decision below shares. */
function readTable(s: State, me: number, cfg: Config, foresight: number) {
  const demand = cityDemand(s, cfg);
  const roundsLeft = cfg.rounds - s.round + 1;
  // Look ahead: districts climb a class and change what they buy, and the visible projects
  // become districts. A building placed now sells into that city, not only today's.
  if (roundsLeft > 4) {
    for (const d of s.districts) {
      if (d.cls >= cfg.maxClass) continue;
      const now = districtDemand(cfg, d), next = districtDemand(cfg, { ...d, cls: d.cls + 1 });
      for (let g = 0; g < NG; g++) demand[g] += (next[g] - now[g]) * foresight;
    }
    for (const q of s.projects) {
      const first = vec(cfg.districts[q.type].demandByClass[0]);
      for (let g = 0; g < NG; g++) demand[g] += first[g] * foresight;
    }
  }
  const supply = new Array(NG).fill(0);
  const myOut = new Array(NG).fill(0);
  const myUse = new Array(NG).fill(0);
  for (const b of s.buildings) {
    if (!b) continue;
    const out = maxOutput(cfg, b.kind, b.tier);
    supply[b.good] += out;
    if (b.owner === me) myOut[b.good] += out;
    const r = recipeOf(cfg, b.kind);
    if (r) {
      const inputs = vec(r.inputs);
      for (let g = 0; g < NG; g++) {
        const use = inputs[g] * cfg.recipeRunsByTier[b.tier - 1];
        demand[g] += use; // workshops are customers too
        if (b.owner === me) myUse[g] += use;
      }
    }
  }
  const queueNeed = new Array(NG).fill(0);
  for (const q of s.projects) for (let g = 0; g < NG; g++) queueNeed[g] += q.need[g];
  // Building eats brick while the table is still growing.
  if (roundsLeft > 6) demand[BRICK] += 0.5 * s.players.length;
  for (let g = 0; g < NG; g++) demand[g] += queueNeed[g] / 4;
  return { demand, supply, myOut, myUse, queueNeed, roundsLeft };
}

type Table = ReturnType<typeof readTable>;

/** Coins a unit of good g should fetch if `extra` more units a round came to market. */
function sustainedPrice(pl: Planner, t: Table, g: number, extra: number): number {
  const table = isRaw(g) ? pl.cfg.market.rawPrices : pl.cfg.market.processedPrices;
  const hi = table[1], lo = table[table.length - 2];
  const gap = t.demand[g] - t.supply[g];
  const anchor = gap >= extra ? hi : gap <= 0 ? lo : lo + ((hi - lo) * gap) / extra;
  const sellable = extra <= 0 ? 1 : clamp((gap + extra * 0.5) / extra, 0.1, 1);
  return ((pl.prices[g] + anchor) / 2) * sellable;
}

/** Estimated worth in coins of one share in a project, if it is founded in time. */
function shareWorth(s: State, cfg: Config, projectIndex: number, roundsLeft: number): number {
  if (cfg.variants.contributionVotesPerUnit > 0) return cfg.variants.contributionVotesPerUnit * cfg.votes.coinsPerVote;
  const q = s.projects[projectIndex];
  const missing = q.need.reduce((a, b) => a + b, 0);
  const wait = Math.ceil(missing / 3) + projectIndex; // rounds until founded, roughly
  const life = roundsLeft - 1 - wait;
  if (life < 0) return 0;
  const served = life * 0.6;
  const cls = Math.min(cfg.maxClass, 1 + Math.floor(served / cfg.pipsPerClass));
  return served * cfg.dividendPerShare + cfg.votes.perShareByClass[cls - 1] * cfg.votes.coinsPerVote;
}

interface Option { value: number; cost: number; brick: number; run: (pl: Planner) => boolean; kind: BuildingKind | 'upgrade' }

function expansionOptions(pl: Planner, t: Table, per: Persona, rng: Rng): Option[] {
  const { s, cfg, me } = pl;
  const out: Option[] = [];
  const horizon = t.roundsLeft - 1; // a new building first produces next round
  if (horizon <= 0) return out;
  const voteCoins = per.countsBuildingVotes ? cfg.votes.coinsPerVote : 0;
  const brickPrice = pl.prices[BRICK];
  const jitter = () => 1 + per.noise * (rng.next() - 0.5) * 2;
  const actionCost = 3; // what a spent action is worth in coins, roughly

  const inputCost = (kind: BuildingKind): number => {
    const r = recipeOf(cfg, kind)!;
    const inputs = vec(r.inputs);
    let c = 0;
    for (let g = 0; g < NG; g++) {
      if (!inputs[g]) continue;
      const spare = t.myOut[g] - t.myUse[g];
      // Own surplus costs what it would have sold for; otherwise the stall price, dearer if the stall runs dry.
      c += inputs[g] * (spare >= inputs[g] ? sustainedPrice(pl, t, g, 0) : pl.prices[g] + (s.stalls[g] === 0 ? 3 : 0));
    }
    return c;
  };
  const workshopProfitPerRun = (kind: BuildingKind) => {
    const r = recipeOf(cfg, kind)!;
    const g = GOODS.indexOf(r.output);
    return r.outputQty * sustainedPrice(pl, t, g, r.outputQty) - inputCost(kind);
  };

  // New buildings.
  if (pl.buildings < Math.min(buildingCap(cfg), per.maxBuildings)) {
    for (const site of s.board.sites) {
      if (s.buildings[site]) continue;
      // Getting goods out: links still to lay, and tolls on the way.
      const path = shortestPath(s.board, site, s.board.core, (e) => (s.links[e] < 0 ? 1 : 0));
      const missing = path ? path.cost : 9;
      const tollPath = shortestPath(s.board, site, s.board.core, (e) => (s.links[e] === me || s.links[e] === CITY ? 0 : s.links[e] < 0 ? 0.01 : cfg.tollPerLink));
      const tolls = tollPath ? Math.floor(tollPath.cost) : 0;
      const access = missing * (cfg.cost.link.coins + actionCost) + tolls * horizon;
      const lateStart = missing; // rounds lost laying links before it can run
      const terrain = s.board.nodes[site].terrain!;
      const kinds: BuildingKind[] = ['raw', 'toolWorks', 'goodsWorks'];
      for (const kind of kinds) {
        const bias = kind === 'raw' ? per.rawBias : per.workshopBias;
        if (bias <= 0) continue;
        const c = buildCost(cfg, kind);
        let perRound: number;
        if (kind === 'raw') {
          const g = TERRAIN_GOOD[terrain];
          const units = cfg.rawOutputByTier[0];
          perRound = units * sustainedPrice(pl, t, g, units) * (1 + per.queueBias * Math.min(1, t.queueNeed[g] / 4));
        } else {
          perRound = workshopProfitPerRun(kind) * cfg.recipeRunsByTier[0];
        }
        perRound -= cfg.upkeepPerBuilding;
        const value = (perRound * Math.max(0, horizon - lateStart) * bias + cfg.votes.perBuildingByTier[0] * voteCoins - access) * jitter();
        const cost = c.coins + vec(c.goods)[BRICK] * brickPrice;
        out.push({ value: value / per.hurdle - cost, cost: c.coins, brick: vec(c.goods)[BRICK], kind, run: (p) => p.build(site, kind) });
      }
    }
  }
  // Upgrades.
  for (const site of s.board.nodes.keys()) {
    const b = s.buildings[site];
    if (!b || b.owner !== me) continue;
    const c = upgradeCost(cfg, b.tier + 1);
    if (!c) continue;
    let perRound: number;
    if (b.kind === 'raw') {
      const more = cfg.rawOutputByTier[b.tier] - cfg.rawOutputByTier[b.tier - 1];
      perRound = more * sustainedPrice(pl, t, b.good, more);
    } else {
      perRound = workshopProfitPerRun(b.kind) * (cfg.recipeRunsByTier[b.tier] - cfg.recipeRunsByTier[b.tier - 1]);
    }
    const votes = cfg.votes.perBuildingByTier[b.tier] - cfg.votes.perBuildingByTier[b.tier - 1];
    const value = (perRound * horizon + votes * voteCoins) * jitter();
    const cost = c.coins + vec(c.goods)[BRICK] * brickPrice;
    out.push({ value: value / per.hurdle - cost, cost: c.coins, brick: vec(c.goods)[BRICK], kind: 'upgrade', run: (p) => p.upgrade(site) });
  }
  return out.filter((o) => o.value > 0).sort((a, b) => b.value - a.value);
}

export function scriptedPlan(per: Persona, s: State, me: number, cfg: Config, rng: Rng): Plan {
  const pl = new Planner(s, me, cfg);
  const t = readTable(s, me, cfg, per.foresight);
  const R = t.roundsLeft;
  const board = s.board;
  const n = s.players.length;

  // 1. Late on, clear bonds: an open bond costs more votes than its coins are worth.
  if (R <= 4) while (pl.bonds > 0 && pl.bond('repay')) { /* repay as many as coins allow */ }

  // 2. A works that cannot reach the core earns nothing: lay the missing link.
  for (const site of board.sites) {
    const b = s.buildings[site];
    if (!b || b.owner !== me || pl.left <= 1) continue;
    if (shippingRoute(board, s.links, me, site, board.core, cfg.tollPerLink)) continue;
    const path = shortestPath(board, site, board.core, (e) => (s.links[e] < 0 ? 1 : 0));
    const edge = path?.edges.find((e) => canLink(s, me, e));
    if (edge !== undefined) pl.link(edge, 'connect');
  }

  // 3. What to keep back from sale: next round's recipe inputs, and a brick for the next build.
  const keep = new Array(NG).fill(0);
  for (let g = 0; g < NG; g++) keep[g] = t.myUse[g];
  const options = expansionOptions(pl, t, per, rng);
  const growing = options.length > 0 && R > 2;
  if (growing) keep[BRICK] += 1;

  const doInvest = (limit: number) => {
    if (per.invest === 'never' || limit <= 0) return;
    const bundles: { plot: number; goods: number[]; worth: number; edge?: number }[] = [];
    s.projects.forEach((q, i) => {
      const worth = shareWorth(s, cfg, i, R) * per.investBias;
      if (worth <= 0 && per.invest !== 'always') return;
      const goods = new Array(NG).fill(0);
      let total = 0, edge: number | undefined;
      for (let g = 0; g < NG; g++) {
        if (q.need[g] <= 0) continue;
        const reserve = per.invest === 'always' ? (g === BRICK && growing && pl.buildings < 2 ? 1 : 0) : keep[g];
        const have = Math.min(q.need[g], pl.goods[g] - reserve);
        if (have <= 0) continue;
        const shares = isRaw(g) ? cfg.sharesPerUnit.raw : cfg.sharesPerUnit.processed;
        // Early coins still buy engine; a share must beat the sale by more while growing.
        const hurdle = per.invest === 'always' ? 0 : pl.prices[g] * (growing && R > cfg.rounds / 2 ? 1.6 : 1) * (1 + per.noise * (rng.next() - 0.5));
        if (worth * shares < hurdle) continue;
        // Can the goods get there? If not, is the gap worth a link?
        if (shipCost(s, me, q.plot, cfg) === null) {
          let best: { cost: number; edges: number[] } | null = null;
          for (const o of shipOrigins(s, me)) {
            const p = shortestPath(board, o, q.plot, (e) => (s.links[e] < 0 ? 1 : 0));
            if (p && (!best || p.cost < best.cost)) best = p;
          }
          if (!best || best.cost > Math.min(per.linksToPlots, 1)) {
            // More than one link short: start laying it if this bot cares enough, invest later.
            if (best && best.cost <= per.linksToPlots && edge === undefined) edge = best.edges.find((e) => canLink(s, me, e));
            continue;
          }
          const e = best.edges.find((x) => canLink(s, me, x));
          if (e === undefined) continue;
          if (edge !== undefined && e !== edge) continue; // one link per project per round
          edge = e;
        }
        goods[g] = have;
        total += have * shares * Math.max(worth, 1);
      }
      if (total > 0 || edge !== undefined) bundles.push({ plot: q.plot, goods, worth: total, edge });
    });
    bundles.sort((a, b) => b.worth - a.worth);
    for (const b of bundles) {
      if (limit <= 0) break;
      const has = b.goods.some((x) => x > 0);
      if (b.edge !== undefined) {
        if (pl.left < (has ? 2 : 1) || !pl.link(b.edge, 'plot')) continue;
      }
      if (has && pl.invest(b.plot, b.goods)) limit--;
    }
  };

  const doExpand = (maxActions: number) => {
    let used = 0;
    for (const o of options) {
      if (used >= maxActions || pl.left < 1) break;
      if (pl.goods[BRICK] < o.brick) continue;
      if (pl.coins < o.cost) {
        // Short of coins: a bond bridges it if this bot borrows and there is time to earn it back.
        const gap = o.cost - pl.coins;
        const b = cfg.bond;
        const carry = b.interestPerRound * Math.min(R, 8) + actionValue(R) * 2;
        if (per.bonds !== 'need' || pl.bonds >= b.maxOpen || gap > b.amount || R < 7 || o.value < carry) continue;
        if (pl.left < 2 || used + 2 > maxActions) continue;
        if (!pl.bond('take')) continue;
        used++;
      }
      if (o.run(pl)) used++;
    }
  };

  const sellable = (g: number) => Math.max(0, pl.goods[g] - keep[g]);
  const worthSelling = () => {
    let v = 0;
    for (let g = 0; g < NG; g++) v += sellable(g) * pl.prices[g];
    return v;
  };

  // 4. Spend the actions. One is held for the market when there is something worth selling.
  const holdForTrade = () => (worthSelling() >= 4 ? 1 : 0);
  if (per.invest === 'always') {
    doInvest(2);
    doExpand(pl.left - holdForTrade());
  } else {
    doExpand(Math.min(pl.left - holdForTrade(), per.invest === 'never' ? 2 : 2));
    doInvest(pl.left - holdForTrade());
  }

  // 5. Market basket: sell the surplus, buy what the engine or the next project needs.
  const room = (g: number) => cfg.market.slots - s.stalls[g] + cityDemandCached(s, cfg)[g];
  if (per.invest === 'always') {
    // Hold what a project still wants if storage allows; it goes in next round.
    for (const q of s.projects) for (let g = 0; g < NG; g++) if (q.need[g] > 0) keep[g] = Math.max(keep[g], Math.min(q.need[g], pl.goods[g]));
  }
  const buying = new Array(NG).fill(0);
  // Workshop inputs for next round, including a workshop placed this round.
  const use = t.myUse.slice();
  for (const a of pl.actions) {
    if (a.type !== 'build' || a.kind === 'raw') continue;
    const inputs = vec(recipeOf(cfg, a.kind)!.inputs);
    for (let g = 0; g < NG; g++) use[g] += inputs[g] * cfg.recipeRunsByTier[0];
  }
  for (let g = 0; g < NG; g++) {
    const short = use[g] - pl.goods[g];
    if (short > 0) buying[g] = short;
  }
  if (growing && pl.goods[BRICK] < 1 && t.myOut[BRICK] === 0) buying[BRICK] = Math.max(buying[BRICK], 1);
  if (per.buysToInvest && R > 3) {
    s.projects.forEach((q, i) => {
      const worth = shareWorth(s, cfg, i, R - 1) * per.investBias;
      for (let g = 0; g < NG; g++) {
        if (q.need[g] <= 0 || t.myOut[g] > 0) continue;
        const shares = isRaw(g) ? cfg.sharesPerUnit.raw : cfg.sharesPerUnit.processed;
        const margin = per.invest === 'always' ? 1.0 : 1.5;
        if (worth * shares > pl.prices[g] * margin) buying[g] = Math.max(buying[g], Math.min(q.need[g], 2));
      }
    });
  }
  for (let g = 0; g < NG; g++) {
    const qty = Math.min(sellable(g), Math.max(0, room(g)));
    if (qty > 0 && !buying[g]) pl.order(g, -qty);
  }
  let incoming = 0;
  const coinFloor = growing ? 0 : 2;
  for (let g = 0; g < NG; g++) {
    if (!buying[g]) continue;
    const storageRoom = cfg.storageCap - pl.goods.reduce((x, y) => x + y, 0) - incoming;
    const wantImport = cfg.imports.enabled && g === BRICK && s.stalls[g] === 0 && growing;
    let qty = Math.min(buying[g], wantImport ? buying[g] : s.stalls[g], Math.max(0, storageRoom));
    while (qty > 0 && pl.coins - qty * pl.prices[g] < coinFloor) qty--;
    if (qty > 0 && (pl.order(g, qty, wantImport) || pl.order(g, qty))) incoming += qty;
  }

  // 6. A spare action can cut a standing toll with a link of one's own.
  if (pl.left > 0 && R > 4) {
    for (const site of board.sites) {
      const b = s.buildings[site];
      if (!b || b.owner !== me) continue;
      const now = shippingRoute(board, s.links, me, site, board.core, cfg.tollPerLink);
      if (!now || now.cost <= 0) continue;
      const own = shortestPath(board, site, board.core, (e) => (s.links[e] === me || s.links[e] === CITY ? 0 : s.links[e] < 0 ? 1 : Infinity));
      if (!own || own.cost < 1) continue;
      if (now.cost * (R - 1) > own.cost * (cfg.cost.link.coins + actionValue(R))) {
        const edge = own.edges.find((e) => canLink(s, me, e));
        if (edge !== undefined && pl.link(edge, 'avoid-toll')) break;
      }
    }
  }
  void n;
  return pl.plan();
}

const actionValue = (roundsLeft: number) => (roundsLeft > 4 ? 3 : 1);

let demandCache: { s: State; d: number[] } | null = null;
function cityDemandCached(s: State, cfg: Config) {
  if (demandCache?.s !== s) demandCache = { s, d: cityDemand(s, cfg) };
  return demandCache.d;
}

/** Round-0 ranking: bid nothing, prefer the works whose good the opening city and the workshops buy most. */
export function scriptedStartBid(per: Persona, s: State, _me: number, cfg: Config, rng: Rng): StartBid {
  const demand = cityDemand(s, cfg);
  // Workshop inputs are wanted by rivals as well as the city.
  for (const r of Object.values(cfg.recipes)) vec(r.inputs).forEach((x, g) => (demand[g] += x));
  const score = (site: number) => {
    const g = TERRAIN_GOOD[s.board.nodes[site].terrain!];
    let q = 0;
    for (const p of s.projects) q += p.need[g];
    return demand[g] + per.queueBias * q * 0.25 + per.noise * rng.next();
  };
  return { ranking: s.board.startSites.slice().sort((a, b) => score(b) - score(a)), bid: 0 };
}

export function scriptedBot(name: string, overrides: Partial<Persona> = {}): Bot {
  const base = PERSONAS[name];
  if (!base) throw new Error(`Unknown bot ${name}; known: ${SCRIPTED.join(', ')}, search`);
  const per = { ...base, ...overrides };
  return {
    name: per.name,
    plan: (s, me, cfg, rng) => scriptedPlan(per, s, me, cfg, rng),
    startBid: (s, me, cfg, rng) => scriptedStartBid(per, s, me, cfg, rng),
  };
}
