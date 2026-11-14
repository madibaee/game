/** Plays one match between bots and gathers the measurements §11 asks for. */
import { audit } from './audit.ts';
import type { Bot } from './bots/planner.ts';
import type { Config } from './config.ts';
import { BRICK, NG } from './config.ts';
import type { Event, Score, State } from './engine.ts';
import { buildingCap, buildingCount, createGame, postedPrices, resolveRound, resolveStartBids, score, winners } from './engine.ts';
import { makeRng } from './rng.ts';

export interface Metrics {
  /** coins[p][r-1] = coins held at the end of round r. */
  coins: number[][];
  /** votes[p] at the end of round 6, to find who fell behind. */
  votesAtRound6: number[];
  unitsSold: number[];
  unitsInvested: number[];
  salesIncome: number[];
  dividends: number[];
  tollsPaid: number[];
  tollsEarned: number[];
  bondsTaken: { p: number; round: number }[];
  bondsRepaid: number;
  bondsOpenAtEnd: number[];
  foundedRounds: number[];
  classAtEnd: number[];
  /** Round each player first stood at the building cap (0 = never). */
  capRound: number[];
  buildings: number[];
  /** Buildings on the board at the end, by kind. */
  kinds: Record<string, number>;
  /** stallEmpty[g] / stallFull[g]: rounds that opened with the stall empty / full. */
  stallEmpty: number[];
  stallFull: number[];
  brickPriceByRound: number[];
  brickDiscarded: number[]; // by round
  brickUnsold: number[]; // by round: units offered and not taken
  linksBuilt: Record<string, number>;
  contested: number;
  invalid: number;
  unitsBought: number;
  unitsImported: number;
  /** Rounds in which no player held a brick, the stall had none, and so nobody could build. */
  brickLockRounds: number;
  /** For the player trailing after round 6: later rounds with nothing they could afford to do. */
  trailerStuckRounds: number;
  unservedDistrictRounds: number;
  districtRounds: number;
  startPicks: { p: number; pick: number; bid: number; paid: number; good: number }[];
  overdrafts: number;
  /** Good made by each player's starting works. */
  startGood: number[];
}

export interface MatchResult {
  seed: number;
  bots: string[];
  scores: Score[];
  winners: number[];
  metrics: Metrics;
  final: State;
}

export function runMatch(cfg: Config, seed: number, bots: Bot[], opts: { audit?: boolean; onRound?: (s: State, events: Event[]) => void } = {}): MatchResult {
  const n = cfg.players;
  if (bots.length !== n) throw new Error(`Need ${n} bots, got ${bots.length}`);
  const rng = makeRng(seed ^ 0x9e3779b9);
  const seatRng = bots.map(() => rng.fork());
  let s = createGame(cfg, seed);
  const zeros = () => new Array(n).fill(0);
  const m: Metrics = {
    coins: Array.from({ length: n }, () => []), votesAtRound6: zeros(), unitsSold: zeros(), unitsInvested: zeros(), salesIncome: zeros(),
    dividends: zeros(), tollsPaid: zeros(), tollsEarned: zeros(), bondsTaken: [], bondsRepaid: 0, bondsOpenAtEnd: zeros(),
    foundedRounds: [], classAtEnd: [], capRound: zeros(), buildings: zeros(), kinds: { raw: 0, toolWorks: 0, goodsWorks: 0 }, stallEmpty: new Array(NG).fill(0), stallFull: new Array(NG).fill(0),
    brickPriceByRound: [], brickDiscarded: [], brickUnsold: [], linksBuilt: {}, contested: 0, invalid: 0, unitsBought: 0, unitsImported: 0,
    brickLockRounds: 0, trailerStuckRounds: 0, unservedDistrictRounds: 0, districtRounds: 0, startPicks: [], overdrafts: 0, startGood: zeros(),
  };

  if (s.round === 0) {
    const bids = bots.map((b, p) => b.startBid(s, p, cfg, seatRng[p]));
    const r = resolveStartBids(s, bids, cfg);
    for (const e of r.events) if (e.t === 'startPick') m.startPicks.push({ p: e.p, pick: e.pick, bid: e.bid, paid: e.paid, good: e.good });
    opts.onRound?.(r.state, r.events);
    s = r.state;
  }

  for (let p = 0; p < n; p++) m.startGood[p] = s.buildings.find((b) => b?.owner === p)?.good ?? -1;
  let trailer = -1;
  const cap = buildingCap(cfg);
  while (s.round <= cfg.rounds) {
    const round = s.round;
    for (let g = 0; g < NG; g++) {
      if (s.stalls[g] === 0) m.stallEmpty[g]++;
      if (s.stalls[g] >= cfg.market.slots) m.stallFull[g]++;
    }
    m.brickPriceByRound.push(postedPrices(s, cfg)[BRICK]);
    if (trailer >= 0) {
      const pl = s.players[trailer];
      // Nothing to sell or invest, and too poor to run a works or lay a link.
      if (pl.coins < Math.min(cfg.cost.link.coins, cfg.upkeepPerBuilding) && pl.goods.every((x) => x === 0)) m.trailerStuckRounds++;
    }
    const plans = bots.map((b, p) => b.plan(s, p, cfg, seatRng[p]));
    const r = resolveRound(s, plans, cfg);
    if (opts.audit) {
      const problems = audit(s, r.events, r.state, cfg);
      if (problems.length) throw new Error(`Round ${round}, seed ${seed}: ${problems.join('; ')}`);
    }
    let brickDiscarded = 0, brickUnsold = 0, brickHeld = 0;
    for (const e of r.events) {
      switch (e.t) {
        case 'invalid': m.invalid++; break;
        case 'sold': m.unitsSold[e.p] += e.units; m.salesIncome[e.p] += e.units * e.price; if (e.g === BRICK) brickUnsold += e.asked - e.units; break;
        case 'bought': m.unitsBought += e.units + e.imported; m.unitsImported += e.imported; break;
        case 'invested': m.unitsInvested[e.p] += e.units; break;
        case 'toll': m.tollsPaid[e.p]++; m.tollsEarned[e.to]++; break;
        case 'bond': if (e.op === 'take') m.bondsTaken.push({ p: e.p, round }); else m.bondsRepaid++; break;
        case 'founded': m.foundedRounds.push(round); break;
        case 'linked': m.linksBuilt[e.why ?? 'other'] = (m.linksBuilt[e.why ?? 'other'] ?? 0) + 1; break;
        case 'contested': m.contested++; break;
        case 'overdraft': m.overdrafts++; break;
        case 'served': if (e.plot !== s.board.core) { m.districtRounds++; if (!e.served) m.unservedDistrictRounds++; } break;
        case 'coin': if (e.why === 'dividend') m.dividends[e.to] += e.n; break;
        case 'good': if (e.why === 'storage-cap' && e.g === BRICK) brickDiscarded += e.n; break;
        case 'production': brickHeld += s.players[e.p].goods[BRICK] + e.made[BRICK]; break;
      }
    }
    if (brickHeld === 0 && s.stalls[BRICK] === 0) m.brickLockRounds++;
    m.brickDiscarded.push(brickDiscarded);
    m.brickUnsold.push(brickUnsold);
    opts.onRound?.(r.state, r.events);
    s = r.state;
    for (let p = 0; p < n; p++) {
      m.coins[p].push(s.players[p].coins);
      if (!m.capRound[p] && buildingCount(s, p) >= cap) m.capRound[p] = round;
    }
    if (round === 6) {
      const sc = score(s, cfg);
      m.votesAtRound6 = sc.map((x) => x.total);
      trailer = sc.reduce((worst, x, p) => (x.total < sc[worst].total ? p : worst), 0);
    }
  }
  const scores = score(s, cfg);
  for (let p = 0; p < n; p++) {
    m.buildings[p] = buildingCount(s, p);
    m.bondsOpenAtEnd[p] = s.players[p].bonds;
  }
  for (const b of s.buildings) if (b) m.kinds[b.kind]++;
  m.classAtEnd = s.districts.map((d) => d.cls);
  return { seed, bots: bots.map((b) => b.name), scores, winners: winners(scores), metrics: m, final: s };
}
