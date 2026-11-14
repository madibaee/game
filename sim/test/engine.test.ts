import assert from 'node:assert/strict';
import { test } from 'node:test';
import { audit } from '../src/audit.ts';
import { CITY, shippingRoute, shortestPath } from '../src/board.ts';
import { BRICK, CONSUMER, DEFAULT_CONFIG, FOOD, IRON, NG, TIMBER, preset, withOverrides } from '../src/config.ts';
import type { Config } from '../src/config.ts';
import type { Plan, State } from '../src/engine.ts';
import { allocate, cloneState, createGame, postedPrices, resolveRound, resolveStartBids, score, winners } from '../src/engine.ts';

const cfg4 = DEFAULT_CONFIG;
const noPlans = (n: number): Plan[] => Array.from({ length: n }, () => ({ actions: [] }));
const bag = (o: Record<number, number>) => { const v = new Array(NG).fill(0); for (const [g, n] of Object.entries(o)) v[+g] = n; return v; };
/** Resolve a round and insist that it reconciles. */
function step(s: State, plans: Plan[], cfg: Config = cfg4) {
  const r = resolveRound(s, plans, cfg);
  assert.deepEqual(audit(s, r.events, r.state, cfg), []);
  return r;
}
const mySite = (s: State, p: number) => s.buildings.findIndex((b) => b?.owner === p);
/** A free production site, with a link path to the core laid for player p so that it can run and ship. */
const freeSite = (s: State, p = 0) => {
  const site = s.board.sites.find((x) => !s.buildings[x])!;
  const path = shortestPath(s.board, site, s.board.core, (e) => (s.links[e] < 0 ? 1 : 0))!;
  for (const e of path.edges) if (s.links[e] < 0) s.links[e] = p;
  return site;
};

test('board: every match meets the §3/§4 guarantees', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = createGame(withOverrides(cfg4, { players: 2 + (seed % 3) }), seed);
    const b = s.board;
    assert.equal(b.nodes.length, 20);
    assert.equal(b.plots.length, 7);
    assert.equal(b.sites.length, 12);
    for (const terrain of ['forest', 'clay', 'mountain', 'farmland']) assert.equal(b.sites.filter((x) => b.nodes[x].terrain === terrain).length, 3);
    for (let v = 1; v < 20; v++) assert.ok(b.adj[v].length >= 2 && b.adj[v].length <= 4, `node ${v} has ${b.adj[v].length} candidate links`);
    assert.equal(new Set(b.startSites.map((x) => b.nodes[x].terrain)).size, 4, 'starting works are on different terrains');
    // Each player starts with a works and an owned link path to the core.
    s.players.forEach((_, p) => {
      const site = mySite(s, p);
      assert.ok(site > 0);
      const route = shippingRoute(b, s.links, p, site, b.core, 1);
      assert.ok(route && route.cost === 0 && route.edges.length === 2, 'equal distance, toll-free');
    });
  }
});

test('determinism: identical inputs give identical results, and the input state is not touched', () => {
  const s = createGame(cfg4, 42);
  const frozen = JSON.stringify(s);
  assert.equal(JSON.stringify(createGame(cfg4, 42)), frozen);
  const plans: Plan[] = [
    { actions: [{ type: 'bond', op: 'take' }, { type: 'build', site: s.board.sites.find((x) => !s.buildings[x])!, kind: 'toolWorks' }] },
    { actions: [{ type: 'trade', orders: bag({ [BRICK]: 1 }) }] },
    { actions: [] },
    { actions: [{ type: 'link', edge: s.links.indexOf(-1) }] },
  ];
  const a = resolveRound(s, plans, cfg4), b = resolveRound(s, plans, cfg4);
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.equal(JSON.stringify(s), frozen);
  assert.notEqual(JSON.stringify(createGame(cfg4, 43).board), JSON.stringify(s.board));
});

test('production: raw works make 2 a round, upkeep is 1 coin, a new building waits a round', () => {
  let s = createGame(cfg4, 5);
  const site = freeSite(s);
  const g0 = s.buildings[mySite(s, 0)]!.good;
  const r1 = step(s, [{ actions: [{ type: 'build', site, kind: 'raw' }] }, ...noPlans(3)]);
  s = r1.state;
  assert.equal(s.players[0].coins, 12 - 1 - 10);
  assert.equal(s.players[0].goods[BRICK], 2 - 1 + (g0 === BRICK ? 2 : 0));
  assert.equal(s.buildings[site]!.tier, 1);
  const made1 = r1.events.find((e) => e.t === 'production' && e.p === 0)!.made.reduce((a: number, b: number) => a + b, 0);
  assert.equal(made1, 2, 'the new works did not produce in the round it was built');
  s.players[0].coins = 5;
  const r2 = step(s, noPlans(4));
  assert.equal(r2.events.find((e) => e.t === 'production' && e.p === 0)!.made.reduce((a: number, b: number) => a + b, 0), 4);
  assert.equal(r2.state.players[0].coins, 3);
});

test('recipes run on goods held at the start of the round, up to the tier', () => {
  const s = createGame(cfg4, 5);
  const site = freeSite(s);
  s.buildings[site] = { owner: 0, kind: 'toolWorks', good: 4, tier: 2, builtRound: 0 };
  s.players[0].goods = bag({ [IRON]: 3, [TIMBER]: 1 });
  const before = s.players[0].goods.slice();
  const r = step(s, noPlans(4));
  const e = r.events.find((x) => x.t === 'production' && x.p === 0)!;
  assert.equal(e.used[IRON], 1);
  assert.equal(e.used[TIMBER], 1);
  assert.equal(e.made[4], 2, 'one run only: one timber was held at the start');
  assert.ok(before[IRON] === 3);
});

test('market: price follows stock, sells fill free slots plus city demand, the city then eats', () => {
  const s = createGame(cfg4, 9);
  assert.deepEqual(postedPrices(s, cfg4), [5, 5, 5, 5, 10, 10]);
  s.stalls[FOOD] = 6;
  assert.equal(postedPrices(s, cfg4)[FOOD], 2);
  s.players[0].goods = bag({ [FOOD]: 8 });
  s.buildings[mySite(s, 0)]!.good = FOOD;
  // Full stall: room is only the city's appetite (core 1 + residential 2).
  const r = step(s, [{ actions: [{ type: 'trade', orders: bag({ [FOOD]: -8 }) }], idle: [mySite(s, 0)] }, ...noPlans(3)]);
  const sold = r.events.find((e) => e.t === 'sold' && e.p === 0)!;
  assert.equal(sold.units, 3);
  assert.equal(sold.price, 2);
  assert.equal(r.state.stalls[FOOD], 6);
  assert.equal(r.state.players[0].coins, 12 + 6);
});

test('market: short stock is shared in proportion, odd units by priority marker; nobody trades twice on one good', () => {
  assert.deepEqual(allocate([3, 3, 0, 0], 3, [1, 0, 2, 3]), [1, 2, 0, 0]);
  assert.deepEqual(allocate([4, 2], 3, [0, 1]), [2, 1]);
  assert.deepEqual(allocate([1, 1], 5, [0, 1]), [1, 1]);
  const s = createGame(cfg4, 9);
  s.priority = 1;
  s.stalls[IRON] = 3;
  s.players.forEach((p) => (p.coins = 30));
  const buy: Plan = { actions: [{ type: 'trade', orders: bag({ [IRON]: 3 }) }], idle: [] };
  const r = step(s, [buy, buy, ...noPlans(2)]);
  const got = [0, 1].map((p) => r.events.find((e) => e.t === 'bought' && e.p === p)!.units);
  assert.deepEqual(got, [1, 2]);
  const twice = step(s, [{ actions: [{ type: 'trade', orders: bag({ [IRON]: 1 }) }, { type: 'trade', orders: bag({ [IRON]: -1 }) }] }, ...noPlans(3)]);
  assert.equal(twice.events.filter((e) => e.t === 'invalid').length, 1);
});

test('plans are checked as a whole: no coin or good is spent twice', () => {
  const s = createGame(cfg4, 11);
  const sites = s.board.sites.filter((x) => !s.buildings[x]);
  // 12 coins: one works (10) fits, a second does not, and brick sold cannot also be built with.
  const r = step(s, [{ idle: [mySite(s, 0)], actions: [{ type: 'build', site: sites[0], kind: 'raw' }, { type: 'build', site: sites[1], kind: 'raw' }, { type: 'trade', orders: bag({ [BRICK]: -2 }) }] }, ...noPlans(3)]);
  const invalid = r.events.filter((e) => e.t === 'invalid');
  assert.equal(invalid.length, 2);
  assert.equal(r.state.players[0].coins, 2);
  assert.equal(r.state.players[0].goods[BRICK], 1);
});

test('contested claims: higher bid wins and pays the city fund; ties go to the priority marker; the loser pays nothing', () => {
  const s = createGame(cfg4, 13);
  s.priority = 2;
  const site = freeSite(s);
  s.players.forEach((p) => (p.coins = 30));
  const claim = (bid: number): Plan => ({ actions: [{ type: 'build', site, kind: 'goodsWorks', bid }] });
  let r = step(s, [claim(1), claim(3), claim(0), { actions: [] }]);
  assert.equal(r.state.buildings[site]!.owner, 1);
  assert.equal(r.state.fund, 3);
  assert.equal(r.state.players[0].coins, 30 - 1);
  assert.equal(r.state.players[0].goods[BRICK] >= 2, true);
  r = step(s, [claim(2), claim(2), claim(2), { actions: [] }]);
  assert.equal(r.state.buildings[site]!.owner, 2);
  // An uncontested bid is not charged.
  r = step(s, [claim(5), ...noPlans(3)]);
  assert.equal(r.state.fund, 0);
});

test('building cap by player count', () => {
  const cfg = withOverrides(cfg4, { players: 4 });
  const s = createGame(cfg, 3);
  s.players[0].coins = 100;
  s.players[0].goods = bag({ [BRICK]: 6 });
  const sites = s.board.sites.filter((x) => !s.buildings[x]);
  const r = step(s, [{ actions: sites.slice(0, 3).map((site) => ({ type: 'build' as const, site, kind: 'toolWorks' as const })) }, ...noPlans(3)], cfg);
  assert.equal(r.state.buildings.filter((b) => b?.owner === 0).length, 3);
  assert.equal(r.events.filter((e) => e.t === 'invalid' && e.reason === 'building cap').length, 1);
});

test('investing: shares on founding, dividends when served, three pips raise a class', () => {
  let s = createGame(cfg4, 21);
  const proj = s.projects[0];
  const coreEdge = s.board.edges.findIndex(([a, b]) => a === s.board.core && b === proj.plot);
  s.links[coreEdge] = 0;
  s.buildings[mySite(s, 0)] = null; // goods ship from the core
  s.buildings[mySite(s, 1)] = null;
  s.players[0].goods = proj.need.slice();
  s.players[0].goods[proj.need.findIndex((x) => x > 0)]--;
  s.players[1].goods = proj.need.map((x) => Math.min(x, 1));
  const give = (p: number): Plan => ({ actions: [{ type: 'invest', plot: proj.plot, goods: s.players[p].goods.slice() }] });
  const r = step(s, [give(0), give(1), ...noPlans(2)]);
  const founded = r.events.find((e) => e.t === 'founded')!;
  assert.ok(founded, 'the last good arrived, so the project is founded this round');
  const total = founded.shares.reduce((a: number, b: number) => a + b, 0);
  const expected = proj.need.reduce((a, n, g) => a + n * (g < 4 ? 1 : 2), 0);
  assert.equal(total, expected);
  assert.ok(founded.shares[1] >= 1, 'the over-subscribed good was split, the rival got a share');
  assert.equal(r.events.find((e) => e.t === 'toll' && e.p === 1)!.to, 0, 'the rival paid a toll on the link to the plot');
  s = r.state;
  const d = s.districts.at(-1)!;
  assert.equal(d.cls, 1);
  // Keep every stall stocked so the district is served three rounds running.
  for (let k = 0; k < 3; k++) {
    s.stalls = s.stalls.map(() => 6);
    const coins = s.players[0].coins;
    s = step(s, noPlans(4)).state;
    assert.equal(s.players[0].coins, coins + d.shares[0] * 1 - 0);
  }
  assert.equal(s.districts.at(-1)!.cls, 2);
  assert.equal(score(s, cfg4)[0].shares, d.shares[0] * 2);
});

test('districts are served oldest first, and a district takes all its goods or none', () => {
  const s = createGame(cfg4, 21);
  s.districts.push({ plot: s.projects[0].plot, type: 'residential', cls: 1, pips: 0, shares: [1, 0, 0, 0], foundedRound: 1, servedRounds: 0 });
  s.projects.shift();
  s.stalls[FOOD] = 3; // core 1 + old residential 2; nothing left for the new one
  s.players.forEach((_, p) => (s.buildings[mySite(s, p)] = null));
  const r = step(s, noPlans(4));
  const served = r.events.filter((e) => e.t === 'served');
  assert.equal(served.find((e) => e.plot === s.districts[0].plot)!.served, true);
  assert.equal(served.find((e) => e.plot === s.districts.at(-1)!.plot)!.served, false);
  assert.equal(r.state.players[0].coins, 12, 'no dividend from an unserved district');
  assert.equal(r.state.stalls[FOOD], 0);
});

test('bonds: 12 coins now, 1 a round to the city fund, the fund buys for the first project, 4 votes if left open', () => {
  let s = createGame(cfg4, 8);
  s.players.forEach((_, p) => (s.buildings[mySite(s, p)] = null));
  let r = step(s, [{ actions: [{ type: 'bond', op: 'take' }, { type: 'bond', op: 'take' }, { type: 'bond', op: 'take' }] }, ...noPlans(3)]);
  s = r.state;
  assert.equal(s.players[0].bonds, 2);
  assert.equal(s.players[0].coins, 12 + 24 - 2);
  assert.equal(s.fund, 2);
  assert.equal(score(s, cfg4)[0].bonds, -8);
  // Once the fund can afford the posted price it buys one missing good for the first project.
  s.fund = 4;
  s.stalls = s.stalls.map(() => 3);
  r = step(s, noPlans(4));
  assert.equal(r.events.some((e) => e.t === 'cityBought'), true);
  assert.equal(r.state.fund, 4 + 2 - 5);
  assert.equal(r.state.projects[0].need.reduce((a, b) => a + b, 0), s.projects[0].need.reduce((a, b) => a + b, 0) - 1);
  s = r.state;
  r = step(s, [{ actions: [{ type: 'bond', op: 'repay' }] }, ...noPlans(3)]);
  assert.equal(r.state.players[0].bonds, 1);
});

test('links: plots are joined to the core by free city links; a rival link costs 1 coin once a round; a new link must touch your network', () => {
  const s = createGame(cfg4, 17);
  const site = mySite(s, 0);
  const g = s.buildings[site]!.good;
  const mine = s.links.map((o, e) => (o === 0 ? e : -1)).filter((e) => e >= 0);
  assert.equal(mine.length, 1, 'the starting path is one own link to a plot, then the city link');
  assert.equal(s.links.filter((o) => o === CITY).length, 7);
  s.links[mine[0]] = 1;
  s.stalls[g] = 0;
  const r = step(s, [{ actions: [{ type: 'trade', orders: bag({ [g]: -2 }) }] }, ...noPlans(3)]);
  assert.equal(r.events.filter((e) => e.t === 'toll' && e.p === 0 && e.to === 1).length, 1);
  assert.equal(r.state.players[0].coins, 12 - 1 + 2 * 8 - 1);
  // A link nowhere near the player's works, links or the core is refused.
  const far = s.board.edges.findIndex(([a, b], e) => s.links[e] < 0 && ![a, b].some((v) => v === s.board.core || s.buildings[v]?.owner === 0 || s.board.adj[v].some((x) => s.links[x.edge] === 0)));
  const near = s.board.adj[site].find((x) => s.links[x.edge] < 0)!.edge;
  const r2 = step(s, [{ actions: [{ type: 'link', edge: far }, { type: 'link', edge: near }] }, ...noPlans(3)]);
  assert.equal(r2.events.filter((e) => e.t === 'invalid').length, 1);
  assert.equal(r2.state.links[near], 0);
});

test('a works with no built path to the core makes nothing', () => {
  const s = createGame(cfg4, 17);
  const site = mySite(s, 0);
  for (const { edge } of s.board.adj[site]) s.links[edge] = -1;
  const r = step(s, noPlans(4));
  assert.equal(r.events.find((e) => e.t === 'production' && e.p === 0)!.running, 0);
  assert.equal(r.state.players[0].coins, 12, 'and pays no upkeep');
});

test('unpaid bond interest is held as debt and costs a vote per coin on election day', () => {
  const s = createGame(cfg4, 17);
  s.players[0].bonds = 2;
  s.players[0].coins = 0;
  const r = step(s, noPlans(4));
  assert.equal(r.state.players[0].coins, -2);
  const sc = score(r.state, cfg4)[0];
  assert.deepEqual([sc.debt, sc.cash, sc.bonds], [-2, 0, -8]);
});

test('workshop batches and the discard order can be set in the plan', () => {
  const s = createGame(cfg4, 5);
  s.buildings[mySite(s, 0)]!.good = FOOD;
  const site = freeSite(s);
  s.buildings[site] = { owner: 0, kind: 'toolWorks', good: 4, tier: 3, builtRound: 0 };
  s.players[0].goods = bag({ [IRON]: 3, [TIMBER]: 3, [BRICK]: 2 });
  const r = step(s, [{ actions: [], batches: { [site]: 1 }, discardOrder: [4, FOOD] }, ...noPlans(3)]);
  assert.equal(r.events.find((e) => e.t === 'production' && e.p === 0)!.made[4], 2);
  // Held 6 + 2 tools + 2 food = 10: the two tools go first, as the plan asked.
  assert.equal(r.state.players[0].goods[4], 0);
  assert.equal(r.state.players[0].goods[FOOD], 2);
});

test('storage cap: the excess is discarded at the end of the round', () => {
  const s = createGame(cfg4, 4);
  s.players[0].goods = bag({ [TIMBER]: 5, [CONSUMER]: 5 });
  const r = step(s, noPlans(4));
  assert.equal(r.state.players[0].goods.reduce((a, b) => a + b, 0), 8);
  assert.equal(r.state.players[0].goods[CONSUMER], 5, 'the cheapest goods go first');
});

test('election: votes by source and the tie-breaks', () => {
  const s = createGame(cfg4, 4);
  s.players[0].coins = 57;
  s.players[1].bonds = 1;
  s.buildings[mySite(s, 2)]!.tier = 3;
  const sc = score(s, cfg4);
  assert.deepEqual([sc[0].cash, sc[0].buildings, sc[0].total], [5, 1, 6]);
  assert.equal(sc[1].total, 1 + 1 - 4);
  assert.equal(sc[2].buildings, 3);
  const tie = [{ total: 5, shareCount: 2, coins: 3 }, { total: 5, shareCount: 2, coins: 9 }, { total: 5, shareCount: 1, coins: 99 }] as any;
  assert.deepEqual(winners(tie), [1]);
});

test('v0.5 imports: a marked buy the stall cannot fill arrives by rail, capped per round', () => {
  const cfg = preset('v0.5', { 'start.works': 'deal' });
  const s = createGame(cfg, 6);
  s.stalls[BRICK] = 1;
  s.players[0].coins = 60;
  s.players.forEach((_, p) => (s.buildings[mySite(s, p)] = null));
  const r = step(s, [{ actions: [{ type: 'trade', orders: bag({ [BRICK]: 4 }), importIfShort: [BRICK] }] }, ...noPlans(3)], cfg);
  const e = r.events.find((x) => x.t === 'bought')!;
  assert.deepEqual([e.units, e.imported], [1, 2]);
  assert.equal(r.state.players[0].coins, 60 - 7 - 20);
  assert.equal(r.state.stalls[BRICK], 0);
});

test('v0.5 round 0: highest bid picks first, the last picker pays nothing, bids go to the city fund', () => {
  const cfg = preset('v0.5');
  const s = createGame(cfg, 6);
  assert.equal(s.round, 0);
  assert.throws(() => resolveRound(s, noPlans(4), cfg));
  const want = s.board.startSites[2];
  const bids = [{ ranking: [want], bid: 1 }, { ranking: [want], bid: 4 }, { ranking: [want], bid: 0 }, { ranking: [want], bid: 2 }];
  const r = resolveStartBids(s, bids, cfg);
  assert.equal(r.state.round, 1);
  assert.equal(r.state.buildings[want]!.owner, 1);
  assert.equal(r.state.fund, 4 + 2 + 1);
  assert.deepEqual(r.state.players.map((p) => p.coins), [11, 8, 12, 10]);
  assert.equal(new Set(r.state.buildings.filter(Boolean).map((b) => b!.good)).size, 4);
  const again = cloneState(r.state);
  assert.deepEqual(audit(again, resolveRound(again, noPlans(4), cfg).events, resolveRound(again, noPlans(4), cfg).state, cfg), []);
});

test('variants: contribution points replace shares; free city contribution every third round', () => {
  const cfg = withOverrides(cfg4, { 'variants.contributionVotesPerUnit': 0.5, 'variants.freeCityContributionEvery': 3, 'cityFund.enabled': false });
  let s = createGame(cfg, 2);
  s.players[0].unitsInvested = 6;
  assert.equal(score(s, cfg)[0].shares, 3);
  const need = () => s.projects[0].need.reduce((a, b) => a + b, 0);
  const before = need();
  for (let k = 0; k < 3; k++) s = step(s, noPlans(4), cfg).state;
  assert.equal(need(), before - 1);
});
