/**
 * The resolver of §11: state, all players' plans and configuration in; new state and an
 * event log out. It is a pure function with no randomness of its own. The seed is used
 * once, in createGame, for the map shuffle, the project order and the first priority marker.
 *
 * Resolution order follows §8. Where the design doc is silent the choice made here is
 * listed in sim/README.md under "Rulings".
 */
import type { Board } from './board.ts';
import { generateBoard, shippingRoute, shortestPath } from './board.ts';
import type { BuildingKind, Config, Cost, DistrictType } from './config.ts';
import { BRICK, GOODS, NG, TERRAIN_GOOD, isRaw, priceAt, vec } from './config.ts';
import { makeRng } from './rng.ts';

export interface Building { owner: number; kind: BuildingKind; good: number; tier: number; builtRound: number }
export interface District { plot: number; type: DistrictType; cls: number; pips: number; shares: number[]; foundedRound: number; servedRounds: number }
export interface Project { plot: number; type: DistrictType; need: number[]; pendingShares: number[] }
export interface Player { coins: number; goods: number[]; bonds: number; unitsInvested: number }

export interface State {
  /** The round about to be resolved. 0 = the round-0 bid is pending; rounds + 1 = the game is over. */
  round: number;
  board: Board;
  /** Owner of each candidate link, -1 if unbuilt. Indexed like board.edges. */
  links: number[];
  /** Building on each node, or null. Indexed like board.nodes. */
  buildings: (Building | null)[];
  players: Player[];
  stalls: number[];
  districts: District[];
  /** The visible project queue, first in line first. */
  projects: Project[];
  deck: { plot: number; type: DistrictType }[];
  fund: number;
  /** Net coins paid to (+) or by (-) the bank. Only there so coins reconcile. */
  bank: number;
  /** Seat holding the priority marker. */
  priority: number;
}

export type Action =
  | { type: 'build'; site: number; kind: BuildingKind; bid?: number; why?: string }
  | { type: 'upgrade'; site: number; why?: string }
  | { type: 'link'; edge: number; bid?: number; why?: string }
  /** orders[g] > 0 buys, < 0 sells. importIfShort lists goods whose unfilled buy may arrive by rail. */
  | { type: 'trade'; orders: number[]; importIfShort?: number[]; why?: string }
  | { type: 'invest'; plot: number; goods: number[]; why?: string }
  | { type: 'bond'; op: 'take' | 'repay'; why?: string }
  | { type: 'pass' };

export interface Plan {
  actions: Action[];
  /** Sites of own buildings to idle this round (no upkeep, no output). Free, not an action. */
  idle?: number[];
}

/** Round-0 plan (v0.5 §6.9): rank the starting works, bid coins for pick order. */
export interface StartBid { ranking: number[]; bid: number }

export type Account = number | 'bank' | 'fund' | 'stall' | 'world' | `project:${number}`;
export type Event = { t: string; [key: string]: any };

export const PHASES = ['lock', 'claims', 'production', 'construction', 'investments', 'market', 'city', 'close'] as const;

// ---------------------------------------------------------------- setup

export function createGame(cfg: Config, seed: number): State {
  const rng = makeRng(seed);
  const board = generateBoard(cfg, rng.fork());
  const n = cfg.players;
  const setup = rng.fork();

  const startPlots = setup.shuffle(board.plots);
  const districts: District[] = cfg.startDistricts.map((type, i) => ({
    plot: startPlots[i], type, cls: 1, pips: 0, shares: new Array(n).fill(0), foundedRound: 0, servedRounds: 0,
  }));
  const freePlots = startPlots.slice(cfg.startDistricts.length);
  const types = setup.shuffle(cfg.projectPool);
  const deck = freePlots.map((plot, i) => ({ plot, type: types[i % types.length] }));

  const s: State = {
    round: cfg.start.works === 'bid' ? 0 : 1,
    board,
    links: new Array(board.edges.length).fill(-1),
    buildings: new Array(board.nodes.length).fill(null),
    players: Array.from({ length: n }, () => ({ coins: cfg.start.coins, goods: vec(cfg.start.goods).slice(), bonds: 0, unitsInvested: 0 })),
    stalls: new Array(NG).fill(Math.min(cfg.market.startStock, cfg.market.slots)),
    districts,
    projects: [],
    deck,
    fund: 0,
    bank: 0,
    priority: setup.int(n),
  };
  refillProjects(s, cfg);
  if (cfg.start.works === 'deal') {
    const works = setup.shuffle(board.startSites);
    for (let p = 0; p < n; p++) grantStartingWorks(s, p, works[p % works.length]);
  }
  return s;
}

function grantStartingWorks(s: State, p: number, site: number) {
  const terrain = s.board.nodes[site].terrain!;
  s.buildings[site] = { owner: p, kind: 'raw', good: TERRAIN_GOOD[terrain], tier: 1, builtRound: 0 };
  const path = shortestPath(s.board, site, s.board.core, (e) => (s.links[e] < 0 ? 1 : 1.01));
  for (const e of path?.edges ?? []) if (s.links[e] < 0) s.links[e] = p;
}

/** Round 0 of v0.5 §6.9. Highest bid picks first; ties by priority marker; all but the last picker pay. */
export function resolveStartBids(state: State, bids: StartBid[], cfg: Config): { state: State; events: Event[] } {
  if (state.round !== 0) throw new Error('Round 0 is already resolved');
  const s = cloneState(state);
  const ev: Event[] = [{ t: 'phase', phase: 'round0', round: 0 }];
  const n = s.players.length;
  const prio = priorityOrder(s);
  const clean = bids.map((b, p) => Math.max(0, Math.min(Math.floor(b?.bid ?? 0), s.players[p].coins)));
  const order = prio.slice().sort((a, b) => clean[b] - clean[a] || prio.indexOf(a) - prio.indexOf(b));
  const left = new Set(s.board.startSites);
  order.forEach((p, i) => {
    const ranking = [...(bids[p]?.ranking ?? []), ...s.board.startSites];
    const site = ranking.find((x) => left.has(x))!;
    left.delete(site);
    grantStartingWorks(s, p, site);
    const pays = i === n - 1 && cfg.start.lastPickPaysNothing ? 0 : clean[p];
    if (pays > 0) {
      s.players[p].coins -= pays;
      s.fund += pays;
      ev.push({ t: 'coin', from: p, to: 'fund', n: pays, why: 'round0-bid' });
    }
    ev.push({ t: 'startPick', p, site, bid: clean[p], paid: pays, pick: i + 1, good: s.buildings[site]!.good });
  });
  s.round = 1;
  return { state: s, events: ev };
}

function refillProjects(s: State, cfg: Config) {
  while (s.projects.length < cfg.visibleProjects && s.deck.length) {
    const next = s.deck.shift()!;
    s.projects.push({ plot: next.plot, type: next.type, need: vec(cfg.districts[next.type].founding).slice(), pendingShares: new Array(s.players.length).fill(0) });
  }
}

export function cloneState(s: State): State {
  return {
    round: s.round,
    board: s.board, // never mutated after createGame
    links: s.links.slice(),
    buildings: s.buildings.map((b) => (b ? { ...b } : null)),
    players: s.players.map((p) => ({ coins: p.coins, goods: p.goods.slice(), bonds: p.bonds, unitsInvested: p.unitsInvested })),
    stalls: s.stalls.slice(),
    districts: s.districts.map((d) => ({ ...d, shares: d.shares.slice() })),
    projects: s.projects.map((q) => ({ plot: q.plot, type: q.type, need: q.need.slice(), pendingShares: q.pendingShares.slice() })),
    deck: s.deck.slice(),
    fund: s.fund,
    bank: s.bank,
    priority: s.priority,
  };
}

// ---------------------------------------------------------------- read-only helpers (shared with bots)

export const isOver = (s: State, cfg: Config) => s.round > cfg.rounds;
export const postedPrices = (s: State, cfg: Config) => s.stalls.map((stock, g) => priceAt(cfg, g, stock));
export const buildingCap = (cfg: Config) => cfg.buildingCap[cfg.players] ?? cfg.buildingCap[4];
export const buildingCount = (s: State, p: number) => s.buildings.reduce((k, b) => k + (b && b.owner === p ? 1 : 0), 0);

export function priorityOrder(s: State): number[] {
  const n = s.players.length;
  return Array.from({ length: n }, (_, i) => (s.priority + i) % n);
}

export function districtDemand(cfg: Config, d: District): number[] {
  const tiers = cfg.districts[d.type].demandByClass;
  return vec(tiers[Math.min(d.cls, tiers.length) - 1]);
}

/** What the city will try to consume this round, per good (core plus every founded district). */
export function cityDemand(s: State, cfg: Config): number[] {
  const out = vec(cfg.coreDemand).slice();
  for (const d of s.districts) {
    const dem = districtDemand(cfg, d);
    for (let g = 0; g < NG; g++) out[g] += dem[g];
  }
  return out;
}

export function buildCost(cfg: Config, kind: BuildingKind): Cost {
  return kind === 'raw' ? cfg.cost.raw : cfg.cost.workshop;
}
export function upgradeCost(cfg: Config, toTier: number): Cost | null {
  return cfg.cost.upgradeToTier[toTier] ?? null;
}
export function recipeOf(cfg: Config, kind: BuildingKind) {
  return kind === 'toolWorks' ? cfg.recipes.toolWorks : kind === 'goodsWorks' ? cfg.recipes.goodsWorks : null;
}
/** Most a building can put out in a round at a tier. */
export function maxOutput(cfg: Config, kind: BuildingKind, tier: number): number {
  const r = recipeOf(cfg, kind);
  return r ? cfg.recipeRunsByTier[tier - 1] * r.outputQty : cfg.rawOutputByTier[tier - 1];
}

export interface ProductionPreview {
  /** Goods held after production, before construction, investing and trading. */
  goods: number[];
  upkeep: number;
  made: number[];
  used: number[];
  /** Sites that run this round, with their output. */
  running: { site: number; good: number; out: number }[];
}

/**
 * What player p's buildings will do this round. Recipes draw on goods held at the start of the
 * round, in site order. A workshop with no inputs does not run and pays no upkeep. A building
 * whose upkeep cannot be paid from `coins` is idled.
 */
export function previewProduction(s: State, p: number, cfg: Config, idle: readonly number[] = [], coins = Math.max(0, s.players[p].coins)): ProductionPreview {
  const start = s.players[p].goods.slice();
  const made = new Array(NG).fill(0);
  const used = new Array(NG).fill(0);
  const running: ProductionPreview['running'] = [];
  let upkeep = 0;
  for (let site = 0; site < s.buildings.length; site++) {
    const b = s.buildings[site];
    if (!b || b.owner !== p || idle.includes(site)) continue;
    if (coins - upkeep < cfg.upkeepPerBuilding) continue;
    const recipe = recipeOf(cfg, b.kind);
    let out = 0;
    if (!recipe) {
      out = cfg.rawOutputByTier[b.tier - 1];
    } else {
      const inputs = vec(recipe.inputs);
      let runs = cfg.recipeRunsByTier[b.tier - 1];
      for (let g = 0; g < NG; g++) if (inputs[g] > 0) runs = Math.min(runs, Math.floor(start[g] / inputs[g]));
      if (runs <= 0) continue;
      for (let g = 0; g < NG; g++) {
        start[g] -= inputs[g] * runs;
        used[g] += inputs[g] * runs;
      }
      out = runs * recipe.outputQty;
    }
    made[b.good] += out;
    upkeep += cfg.upkeepPerBuilding;
    running.push({ site, good: b.good, out });
  }
  const goods = s.players[p].goods.map((h, g) => h - used[g] + made[g]);
  return { goods, upkeep, made, used, running };
}

/** Sites a player's units of a good are taken to ship from: their works making it, else the core (bought goods). */
export function shipOrigins(s: State, p: number, good: number): number[] {
  const out: number[] = [];
  for (let site = 0; site < s.buildings.length; site++) {
    const b = s.buildings[site];
    if (b && b.owner === p && b.good === good) out.push(site);
  }
  return out.length ? out : [s.board.core];
}

/** Cheapest toll for p to ship a good to a node this round, or null if no built path reaches it. */
export function shipCost(s: State, p: number, good: number, dest: number, cfg: Config, paid?: Set<number>): number | null {
  let best: number | null = null;
  for (const o of shipOrigins(s, p, good)) {
    const r = shippingRoute(s.board, s.links, p, o, dest, cfg.tollPerLink, paid);
    if (r && (best === null || r.cost < best)) best = r.cost;
  }
  return best;
}

/** Share a limited quantity in proportion to requests; odd units go in priority order. */
export function allocate(requests: number[], capacity: number, order: number[]): number[] {
  const total = requests.reduce((a, b) => a + b, 0);
  if (total <= capacity) return requests.slice();
  const out = requests.map((r) => Math.floor((r * Math.max(0, capacity)) / total));
  let left = Math.max(0, capacity) - out.reduce((a, b) => a + b, 0);
  while (left > 0) {
    let gave = false;
    for (const p of order) {
      if (left > 0 && out[p] < requests[p]) { out[p]++; left--; gave = true; }
    }
    if (!gave) break;
  }
  return out;
}

// ---------------------------------------------------------------- scoring

export interface Score { shares: number; buildings: number; cash: number; bonds: number; total: number; shareCount: number; coins: number }

export function score(s: State, cfg: Config): Score[] {
  return s.players.map((pl, p) => {
    let shares = 0, shareCount = 0, buildings = 0;
    if (cfg.variants.contributionVotesPerUnit > 0) {
      shares = Math.floor(pl.unitsInvested * cfg.variants.contributionVotesPerUnit);
    } else {
      for (const d of s.districts) {
        shares += d.shares[p] * cfg.votes.perShareByClass[Math.min(d.cls, cfg.votes.perShareByClass.length) - 1];
        shareCount += d.shares[p];
      }
    }
    for (const b of s.buildings) if (b && b.owner === p) buildings += cfg.votes.perBuildingByTier[b.tier - 1];
    const cash = Math.max(0, Math.floor(pl.coins / cfg.votes.coinsPerVote));
    const bonds = -pl.bonds * cfg.bond.votePenalty;
    return { shares, buildings, cash, bonds, total: shares + buildings + cash + bonds, shareCount, coins: pl.coins };
  });
}

/** Winners after the tie-breaks of §6.8 (more shares, then more coins, then shared). */
export function winners(scores: Score[]): number[] {
  const key = (x: Score) => [x.total, x.shareCount, x.coins];
  let best: number[] = [];
  scores.forEach((sc, p) => {
    if (!best.length) { best = [p]; return; }
    const a = key(sc), b = key(scores[best[0]]);
    const cmp = a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    if (cmp > 0) best = [p];
    else if (cmp === 0) best.push(p);
  });
  return best;
}

// ---------------------------------------------------------------- the resolver

interface Claim { p: number; bid: number; action: Action }

export function resolveRound(state: State, plans: Plan[], cfg: Config, opts: { log?: boolean } = {}): { state: State; events: Event[] } {
  if (state.round < 1) throw new Error('Resolve round 0 with resolveStartBids first');
  if (state.round > cfg.rounds) throw new Error('The game is over');
  const s = cloneState(state);
  const n = s.players.length;
  const log = opts.log !== false;
  const ev: Event[] = [];
  const emit = (e: Event) => { if (log) ev.push(e); };
  const phase = (name: string) => emit({ t: 'phase', phase: name, round: s.round });

  const coin = (from: Account, to: Account, amount: number, why: string) => {
    if (amount === 0) return;
    const add = (a: Account, d: number) => {
      if (typeof a === 'number') s.players[a].coins += d;
      else if (a === 'fund') s.fund += d;
      else s.bank += d;
    };
    add(from, -amount);
    add(to, amount);
    emit({ t: 'coin', from, to, n: amount, why });
  };
  const good = (from: Account, to: Account, g: number, amount: number, why: string) => {
    if (amount === 0) return;
    const add = (a: Account, d: number) => {
      if (typeof a === 'number') s.players[a].goods[g] += d;
      else if (a === 'stall') s.stalls[g] += d;
    };
    add(from, -amount);
    add(to, amount);
    emit({ t: 'good', from, to, g, n: amount, why });
  };

  const prices = postedPrices(s, cfg);
  const demand = cityDemand(s, cfg);
  const prio = priorityOrder(s);
  const cap = buildingCap(cfg);

  // ---- 1. Lock and validate. Each plan is checked as a whole: no coin or good is spent twice.
  phase('lock');
  const previews: ProductionPreview[] = [];
  const builds: Claim[] = [];
  const linkClaims: Claim[] = [];
  const upgrades: { p: number; site: number }[] = [];
  const invests: { p: number; plot: number; goods: number[] }[] = [];
  const trades: ({ orders: number[]; imports: Set<number> } | null)[] = new Array(n).fill(null);

  for (let p = 0; p < n; p++) {
    const plan = plans[p] ?? { actions: [] };
    const pl = s.players[p];
    const reject = (action: Action, reason: string) => emit({ t: 'invalid', p, action, reason });
    const actions = plan.actions.filter((a) => a.type !== 'pass');
    actions.slice(cfg.actionsPerRound).forEach((a) => reject(a, 'too many actions'));
    const taken = actions.slice(0, cfg.actionsPerRound);

    // Bonds settle at lock, so a bond taken this round can pay for this round's building.
    for (const a of taken) {
      if (a.type !== 'bond') continue;
      if (a.op === 'take') {
        if (pl.bonds >= cfg.bond.maxOpen) { reject(a, 'bond limit'); continue; }
        pl.bonds++;
        coin('bank', p, cfg.bond.amount, 'bond-take');
        emit({ t: 'bond', p, op: 'take' });
      } else {
        if (pl.bonds <= 0) { reject(a, 'no bond to repay'); continue; }
        if (pl.coins < cfg.bond.repayCost) { reject(a, 'cannot afford repayment'); continue; }
        pl.bonds--;
        coin(p, 'bank', cfg.bond.repayCost, 'bond-repay');
        emit({ t: 'bond', p, op: 'repay' });
      }
    }

    const idle = (plan.idle ?? []).filter((site) => s.buildings[site]?.owner === p);
    const pv = previewProduction(s, p, cfg, idle);
    previews.push(pv);
    let coinsLeft = Math.max(0, pl.coins) - pv.upkeep;
    const goodsLeft = pv.goods.slice();
    let planned = buildingCount(s, p);
    const upgrading = new Set<number>();
    const linking = new Set<number>();
    const building = new Set<number>();

    const afford = (cost: Cost, extra: number) => {
      if (coinsLeft < cost.coins + extra) return false;
      const need = vec(cost.goods);
      for (let g = 0; g < NG; g++) if (goodsLeft[g] < need[g]) return false;
      return true;
    };
    const reserve = (cost: Cost, extra: number) => {
      coinsLeft -= cost.coins + extra;
      const need = vec(cost.goods);
      for (let g = 0; g < NG; g++) goodsLeft[g] -= need[g];
    };
    const validBid = (b: number | undefined) => b === undefined || (Number.isInteger(b) && b >= 0);

    for (const a of taken) {
      switch (a.type) {
        case 'bond':
          break;
        case 'build': {
          const node = s.board.nodes[a.site];
          const bid = a.bid ?? 0;
          if (!node || !validBid(a.bid)) { reject(a, 'bad build'); break; }
          if (s.buildings[a.site] || building.has(a.site)) { reject(a, 'site taken'); break; }
          if (node.kind === 'core') { reject(a, 'cannot build on the core'); break; }
          if (node.kind === 'plot') {
            const open = cfg.variants.plotsOpenToPlayers && a.kind !== 'raw' && !s.districts.some((d) => d.plot === a.site) && !s.projects.some((q) => q.plot === a.site);
            if (!open) { reject(a, 'district plots are reserved'); break; }
          }
          if (!['raw', 'toolWorks', 'goodsWorks'].includes(a.kind)) { reject(a, 'unknown building'); break; }
          if (planned >= cap) { reject(a, 'building cap'); break; }
          const cost = buildCost(cfg, a.kind);
          if (!afford(cost, bid)) { reject(a, 'cannot afford'); break; }
          reserve(cost, bid);
          planned++;
          building.add(a.site);
          builds.push({ p, bid, action: a });
          break;
        }
        case 'upgrade': {
          const b = s.buildings[a.site];
          if (!b || b.owner !== p) { reject(a, 'not your building'); break; }
          if (upgrading.has(a.site)) { reject(a, 'one upgrade per building per round'); break; }
          const cost = upgradeCost(cfg, b.tier + 1);
          if (!cost) { reject(a, 'already at top tier'); break; }
          if (!afford(cost, 0)) { reject(a, 'cannot afford'); break; }
          reserve(cost, 0);
          upgrading.add(a.site);
          upgrades.push({ p, site: a.site });
          break;
        }
        case 'link': {
          const bid = a.bid ?? 0;
          if (!(a.edge in s.links) || !validBid(a.bid)) { reject(a, 'bad link'); break; }
          if (s.links[a.edge] >= 0 || linking.has(a.edge)) { reject(a, 'link already built'); break; }
          if (!afford(cfg.cost.link, bid)) { reject(a, 'cannot afford'); break; }
          reserve(cfg.cost.link, bid);
          linking.add(a.edge);
          linkClaims.push({ p, bid, action: a });
          break;
        }
        case 'invest': {
          const proj = s.projects.find((q) => q.plot === a.plot);
          const gs = a.goods ?? [];
          if (!proj) { reject(a, 'no such project'); break; }
          let ok = gs.length === NG, sum = 0;
          for (let g = 0; ok && g < NG; g++) {
            if (!Number.isInteger(gs[g]) || gs[g] < 0 || gs[g] > goodsLeft[g]) ok = false;
            sum += gs[g];
          }
          if (!ok || sum === 0) { reject(a, 'bad bundle or goods not held'); break; }
          for (let g = 0; g < NG; g++) goodsLeft[g] -= gs[g];
          invests.push({ p, plot: a.plot, goods: gs.slice() });
          break;
        }
        case 'trade': {
          if (trades[p]) { reject(a, 'one trade basket per round'); break; }
          const o = a.orders ?? [];
          const marked = new Set(cfg.imports.enabled ? (a.importIfShort ?? []) : []);
          let ok = o.length === NG, spend = 0;
          const premiums: number[] = [];
          for (let g = 0; ok && g < NG; g++) {
            if (!Number.isInteger(o[g])) ok = false;
            else if (o[g] < 0 && -o[g] > goodsLeft[g]) ok = false;
            else if (o[g] > 0) {
              spend += o[g] * prices[g];
              if (marked.has(g)) for (let k = 0; k < o[g]; k++) premiums.push(importPrice(cfg, g) - prices[g]);
            }
          }
          premiums.sort((x, y) => y - x);
          for (let k = 0; k < Math.min(cfg.imports.capPerRound, premiums.length); k++) spend += Math.max(0, premiums[k]);
          if (!ok) { reject(a, 'bad basket or goods not held'); break; }
          if (spend > coinsLeft) { reject(a, 'cannot afford basket'); break; }
          coinsLeft -= spend;
          for (let g = 0; g < NG; g++) if (o[g] < 0) goodsLeft[g] += o[g];
          trades[p] = { orders: o.slice(), imports: marked };
          break;
        }
      }
    }
  }

  // ---- 2. Claims. Contested sites and edges go to the higher bid, then the priority marker.
  phase('claims');
  const settle = (claims: Claim[], keyOf: (c: Claim) => number): Claim[] => {
    const byKey = new Map<number, Claim[]>();
    for (const c of claims) {
      const k = keyOf(c);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(c);
    }
    const won: Claim[] = [];
    for (const [k, group] of byKey) {
      group.sort((a, b) => b.bid - a.bid || prio.indexOf(a.p) - prio.indexOf(b.p));
      const w = group[0];
      if (group.length > 1) {
        coin(w.p, 'fund', w.bid, 'winning-bid');
        emit({ t: 'contested', what: w.action.type, key: k, winner: w.p, bid: w.bid, losers: group.slice(1).map((c) => c.p) });
      }
      won.push(w);
    }
    return won.sort((a, b) => claims.indexOf(a) - claims.indexOf(b));
  };
  const wonBuilds = settle(builds, (c) => (c.action as any).site);
  const wonLinks = settle(linkClaims, (c) => (c.action as any).edge);

  // ---- 3. Upkeep and production.
  phase('production');
  for (let p = 0; p < n; p++) {
    const pv = previews[p];
    coin(p, 'bank', pv.upkeep, 'upkeep');
    for (let g = 0; g < NG; g++) good(p, 'world', g, pv.used[g], 'recipe-input');
    for (let g = 0; g < NG; g++) good('world', p, g, pv.made[g], 'production');
    emit({ t: 'production', p, made: pv.made, used: pv.used, running: pv.running.length });
  }

  // ---- 4. Construction. New buildings produce from next round; new links carry goods this round.
  phase('construction');
  const pay = (p: number, cost: Cost, why: string) => {
    coin(p, 'bank', cost.coins, why);
    const need = vec(cost.goods);
    for (let g = 0; g < NG; g++) good(p, 'world', g, need[g], why);
  };
  for (const c of wonBuilds) {
    const a = c.action as Extract<Action, { type: 'build' }>;
    const node = s.board.nodes[a.site];
    if (a.kind === 'raw' && !node.terrain) continue;
    pay(c.p, buildCost(cfg, a.kind), 'build');
    const g = a.kind === 'raw' ? TERRAIN_GOOD[node.terrain!] : GOODS.indexOf(recipeOf(cfg, a.kind)!.output);
    s.buildings[a.site] = { owner: c.p, kind: a.kind, good: g, tier: 1, builtRound: s.round };
    if (node.kind === 'plot') s.deck = s.deck.filter((d) => d.plot !== a.site);
    emit({ t: 'built', p: c.p, site: a.site, kind: a.kind, good: g, why: a.why });
  }
  for (const u of upgrades) {
    const b = s.buildings[u.site]!;
    pay(u.p, upgradeCost(cfg, b.tier + 1)!, 'upgrade');
    b.tier++;
    emit({ t: 'upgraded', p: u.p, site: u.site, tier: b.tier });
  }
  for (const c of wonLinks) {
    const a = c.action as Extract<Action, { type: 'link' }>;
    pay(c.p, cfg.cost.link, 'link');
    s.links[a.edge] = c.p;
    emit({ t: 'linked', p: c.p, edge: a.edge, why: a.why });
  }

  // ---- 5. Investments. Over-subscribed goods are accepted in proportion, the rest stay home.
  phase('investments');
  const shipments: { p: number; g: number; units: number; dest: number }[] = [];
  for (const proj of s.projects) {
    for (let g = 0; g < NG; g++) {
      const req = new Array(n).fill(0);
      for (const iv of invests) {
        if (iv.plot !== proj.plot || !iv.goods[g]) continue;
        if (shipCost(s, iv.p, g, proj.plot, cfg) === null) { emit({ t: 'noRoute', p: iv.p, g, dest: proj.plot, units: iv.goods[g] }); continue; }
        req[iv.p] += iv.goods[g];
      }
      if (!req.some((x) => x > 0)) continue;
      const got = allocate(req, proj.need[g], prio);
      for (let p = 0; p < n; p++) {
        if (!got[p]) continue;
        good(p, `project:${proj.plot}`, g, got[p], 'invest');
        proj.need[g] -= got[p];
        const sh = got[p] * (isRaw(g) ? cfg.sharesPerUnit.raw : cfg.sharesPerUnit.processed);
        proj.pendingShares[p] += sh;
        s.players[p].unitsInvested += got[p];
        shipments.push({ p, g, units: got[p], dest: proj.plot });
        emit({ t: 'invested', p, plot: proj.plot, g, units: got[p], shares: sh, offered: req[p] });
      }
    }
  }

  // ---- 6. Market. Each stall clears on its own at the posted price.
  phase('market');
  const importsLeft = new Array(n).fill(cfg.imports.enabled ? cfg.imports.capPerRound : 0);
  for (let g = 0; g < NG; g++) {
    const price = prices[g];
    const buy = trades.map((t) => (t && t.orders[g] > 0 ? t.orders[g] : 0));
    const stock0 = s.stalls[g];
    const bought = allocate(buy, stock0, prio);
    for (let p = 0; p < n; p++) {
      if (bought[p]) {
        good('stall', p, g, bought[p], 'buy');
        coin(p, 'bank', bought[p] * price, 'buy');
      }
      const short = buy[p] - bought[p];
      let imported = 0;
      if (short > 0 && trades[p]!.imports.has(g)) {
        imported = Math.min(short, importsLeft[p]);
        if (imported > 0) {
          importsLeft[p] -= imported;
          good('world', p, g, imported, 'import');
          coin(p, 'bank', imported * importPrice(cfg, g), 'import');
        }
      }
      if (buy[p]) emit({ t: 'bought', p, g, units: bought[p], asked: buy[p], imported, price });
    }
    const sell = trades.map((t, p) => {
      if (!t || t.orders[g] >= 0) return 0;
      if (shipCost(s, p, g, s.board.core, cfg) === null) { emit({ t: 'noRoute', p, g, dest: s.board.core, units: -t.orders[g] }); return 0; }
      return -t.orders[g];
    });
    const room = cfg.market.slots - s.stalls[g] + demand[g];
    const sold = allocate(sell, room, prio);
    for (let p = 0; p < n; p++) {
      if (sold[p]) {
        good(p, 'stall', g, sold[p], 'sell');
        coin('bank', p, sold[p] * price, 'sell');
        shipments.push({ p, g, units: sold[p], dest: s.board.core });
      }
      if (sell[p]) emit({ t: 'sold', p, g, units: sold[p], asked: sell[p], price });
    }
  }
  // Tolls: once per rival link per round, whatever the quantity.
  for (let p = 0; p < n; p++) {
    const paid = new Set<number>();
    for (const sh of shipments) {
      if (sh.p !== p) continue;
      const routes = shipOrigins(s, p, sh.g)
        .map((o) => ({ o, r: shippingRoute(s.board, s.links, p, o, sh.dest, cfg.tollPerLink, paid) }))
        .filter((x) => x.r)
        .sort((a, b) => a.r!.cost - b.r!.cost);
      let left = sh.units;
      for (const { o, r } of routes) {
        if (left <= 0) break;
        for (const e of r!.edges) {
          const owner = s.links[e];
          if (owner !== p && !paid.has(e)) {
            paid.add(e);
            coin(p, owner, cfg.tollPerLink, 'toll');
            emit({ t: 'toll', p, to: owner, edge: e });
          }
        }
        const b = s.buildings[o];
        left -= b ? maxOutput(cfg, b.kind, b.tier) : Infinity;
      }
    }
  }

  // ---- 7. City.
  phase('city');
  const serve = (dem: number[]): boolean => {
    let full = true;
    for (let g = 0; g < NG; g++) {
      if (!dem[g]) continue;
      const take = Math.min(dem[g], s.stalls[g]);
      good('stall', 'world', g, take, 'city-demand');
      if (take < dem[g]) full = false;
    }
    return full;
  };
  const coreServed = serve(vec(cfg.coreDemand));
  emit({ t: 'served', plot: s.board.core, served: coreServed });
  for (const d of s.districts) {
    const served = serve(districtDemand(cfg, d));
    emit({ t: 'served', plot: d.plot, served, cls: d.cls });
    if (!served) continue;
    d.servedRounds++;
    for (let p = 0; p < n; p++) coin('bank', p, d.shares[p] * cfg.dividendPerShare, 'dividend');
    if (d.cls < cfg.maxClass && ++d.pips >= cfg.pipsPerClass) {
      d.cls++;
      d.pips = 0;
      emit({ t: 'classUp', plot: d.plot, cls: d.cls });
    }
  }
  for (let p = 0; p < n; p++) {
    const due = s.players[p].bonds * cfg.bond.interestPerRound;
    if (!due) continue;
    coin(p, 'fund', due, 'bond-interest');
    if (s.players[p].coins < 0) emit({ t: 'overdraft', p, coins: s.players[p].coins });
  }
  const first = s.projects[0];
  if (first && cfg.cityFund.enabled) {
    for (let k = 0; k < cfg.cityFund.buysPerRound; k++) {
      let pick = -1;
      for (let g = 0; g < NG; g++) if (first.need[g] > 0 && s.stalls[g] > 0 && (pick < 0 || first.need[g] > first.need[pick])) pick = g;
      if (pick < 0 || s.fund < prices[pick]) break;
      coin('fund', 'bank', prices[pick], 'city-buys');
      good('stall', `project:${first.plot}`, pick, 1, 'city-buys');
      first.need[pick]--;
      emit({ t: 'cityBought', plot: first.plot, g: pick, price: prices[pick] });
    }
  }
  const every = cfg.variants.freeCityContributionEvery;
  if (first && every > 0 && s.round % every === 0) {
    let pick = -1;
    for (let g = 0; g < NG; g++) if (first.need[g] > 0 && (pick < 0 || first.need[g] > first.need[pick])) pick = g;
    if (pick >= 0) {
      good('world', `project:${first.plot}`, pick, 1, 'city-free');
      first.need[pick]--;
      emit({ t: 'cityGave', plot: first.plot, g: pick });
    }
  }
  for (let k = 0; k < cfg.maxFoundingsPerRound; k++) {
    const i = s.projects.findIndex((q) => q.need.every((x) => x === 0));
    if (i < 0) break;
    const [proj] = s.projects.splice(i, 1);
    const founding = vec(cfg.districts[proj.type].founding);
    for (let g = 0; g < NG; g++) good(`project:${proj.plot}`, 'world', g, founding[g], 'founded');
    const sharesOn = cfg.variants.contributionVotesPerUnit <= 0;
    s.districts.push({ plot: proj.plot, type: proj.type, cls: 1, pips: 0, shares: sharesOn ? proj.pendingShares.slice() : new Array(n).fill(0), foundedRound: s.round, servedRounds: 0 });
    emit({ t: 'founded', plot: proj.plot, type: proj.type, shares: proj.pendingShares.slice() });
    refillProjects(s, cfg);
  }

  // ---- 8. Close.
  phase('close');
  const next = postedPrices(s, cfg);
  for (let p = 0; p < n; p++) {
    const gs = s.players[p].goods;
    let over = gs.reduce((a, b) => a + b, 0) - cfg.storageCap;
    while (over > 0) {
      // Drop the least valuable unit at next round's prices; ties drop the larger pile.
      let pick = -1;
      for (let g = 0; g < NG; g++) if (gs[g] > 0 && (pick < 0 || next[g] < next[pick] || (next[g] === next[pick] && gs[g] > gs[pick]))) pick = g;
      good(p, 'world', pick, 1, 'storage-cap');
      over--;
    }
  }
  s.priority = (s.priority + 1) % n;
  s.round++;
  emit({ t: 'roundEnd', round: s.round - 1, stalls: s.stalls.slice(), prices: next, coins: s.players.map((x) => x.coins), fund: s.fund });
  return { state: s, events: ev };
}

export function importPrice(cfg: Config, g: number): number {
  return isRaw(g) ? cfg.imports.rawPrice : cfg.imports.processedPrice;
}

void BRICK;
