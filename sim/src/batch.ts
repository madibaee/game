/** Runs many matches and boils them down to the numbers §11 asks about. */
import type { Bot } from './bots/planner.ts';
import { makeBot } from './bots/index.ts';
import type { Config } from './config.ts';
import { BRICK, GOODS, NG } from './config.ts';
import type { MatchResult } from './match.ts';
import { runMatch } from './match.ts';
import { makeRng } from './rng.ts';

export interface BatchOptions {
  cfg: Config;
  games: number;
  seed?: number;
  /** 'mixed' draws each seat from `pool`; a list fixes the bots (seats still rotate unless fixedSeats). */
  lineup: 'mixed' | string[];
  pool?: string[];
  fixedSeats?: boolean;
  audit?: boolean;
  /** Custom bots by name, for A/B runs (e.g. a scripted bot with one knob changed). */
  custom?: Record<string, () => Bot>;
}

export interface BotStats { games: number; wins: number; winRate: number; medianVotes: number; meanVotes: number; shares: number; buildings: number; cash: number; bonds: number; sold: number; invested: number; bondsTaken: number }

export interface Summary {
  players: number;
  games: number;
  bots: Record<string, BotStats>;
  seatWinRate: number[];
  medianCoinsByRound: number[];
  winnerVotes: number;
  winnerShareFraction: { median: number; inTargetBand: number };
  investedFraction: number;
  founded: { meanCount: number; fourByRound15: number; threeByRound10: number; meanRounds: number[] };
  classIIIGames: number;
  stallEmpty: Record<string, number>;
  stallFull: Record<string, number>;
  unservedDistrictRounds: number;
  founderBeatsFreerider: { games: number; rate: number } | null;
  bonds: { perPlayerGame: number; takenRound1: number; gamesWithAny: number; neverTook: number; openAtEnd: number; meanRound: number };
  cap: { atCapByEnd: number; medianRound: number; meanBuildings: number; kindsPerGame: Record<string, number> };
  dividendsPerPlayerGame: number;
  brick: { priceEarly: number; priceMid: number; priceLate: number; stallFullLate: number; discardedLatePerGame: number; unsoldLatePerGame: number };
  tolls: { perPlayerGame: number; shareOfSalesIncome: number; linksPerGame: Record<string, number>; contestedPerGame: number };
  imports: { shareOfUnitsBought: number; brickLockGames: number; brickLockRoundsPerGame: number };
  trailerStuckGames: number;
  round0: { winRateByPick: number[]; meanBidByPick: number[] } | null;
  /** Win rate by the good the starting works makes. */
  winRateByStartGood: Record<string, number>;
  invalidActions: number;
  overdraftsPerGame: number;
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;

export function runBatch(o: BatchOptions): { summary: Summary; results: MatchResult[] } {
  const n = o.cfg.players;
  const pool = o.pool ?? ['raw', 'workshop', 'founder', 'hoarder', 'freerider', 'adaptive'];
  const rng = makeRng((o.seed ?? 1) * 7919 + n);
  const make = (name: string) => (o.custom?.[name] ? o.custom[name]() : makeBot(name));
  const results: MatchResult[] = [];
  for (let i = 0; i < o.games; i++) {
    let names: string[];
    if (o.lineup === 'mixed') {
      // No repeats while the pool lasts, so every bot meets every other.
      const bag = rng.shuffle(pool);
      names = Array.from({ length: n }, (_, k) => bag[k % bag.length]);
    } else {
      names = o.fixedSeats ? o.lineup.slice() : rng.shuffle(o.lineup);
    }
    const res = runMatch(o.cfg, (o.seed ?? 1) * 100003 + i, names.map(make), { audit: o.audit });
    res.bots = names;
    results.push(res);
  }
  return { summary: summarize(o.cfg, results), results };
}

export function summarize(cfg: Config, results: MatchResult[]): Summary {
  const n = cfg.players;
  const G = results.length;
  const R = cfg.rounds;
  const per: Record<string, { votes: number[]; wins: number; shares: number; buildings: number; cash: number; bonds: number; sold: number; invested: number; bondsTaken: number }> = {};
  const seatWins = new Array(n).fill(0);
  const coinsByRound: number[][] = Array.from({ length: R }, () => []);
  const shareFrac: number[] = [];
  const winnerVotes: number[] = [];
  let sold = 0, invested = 0;
  const foundedCount: number[] = [];
  const foundedRounds: number[][] = [];
  let four15 = 0, three10 = 0, classIII = 0;
  const empty = new Array(NG).fill(0), full = new Array(NG).fill(0);
  let unserved = 0, districtRounds = 0;
  let fb = 0, fbGames = 0;
  let bondsTaken = 0, bondR1 = 0, gamesWithBond = 0, never = 0, openAtEnd = 0;
  const bondRounds: number[] = [];
  let atCap = 0, buildings = 0;
  const kinds: Record<string, number> = {};
  let dividends = 0;
  const capRounds: number[] = [];
  const third = Math.ceil(R / 3);
  const brickPrice: number[][] = [[], [], []];
  let brickFullLate = 0, brickDiscardLate = 0, brickUnsoldLate = 0;
  let tolls = 0, salesIncome = 0, contested = 0;
  const links: Record<string, number> = {};
  let bought = 0, imported = 0, lockGames = 0, lockRounds = 0, stuckGames = 0, invalid = 0, overdrafts = 0;
  const pickWins: number[] = new Array(n).fill(0), pickBids: number[][] = Array.from({ length: n }, () => []);
  let pickGames = 0;
  const goodWins = new Array(NG).fill(0), goodSeats = new Array(NG).fill(0);

  for (const r of results) {
    const m = r.metrics;
    r.scores.forEach((sc, p) => {
      const b = (per[r.bots[p]] ??= { votes: [], wins: 0, shares: 0, buildings: 0, cash: 0, bonds: 0, sold: 0, invested: 0, bondsTaken: 0 });
      b.votes.push(sc.total);
      b.shares += sc.shares; b.buildings += sc.buildings; b.cash += sc.cash; b.bonds += sc.bonds;
      b.sold += m.unitsSold[p]; b.invested += m.unitsInvested[p];
      if (m.startGood[p] >= 0) { goodSeats[m.startGood[p]]++; if (r.winners.includes(p)) goodWins[m.startGood[p]] += 1 / r.winners.length; }
      if (r.winners.includes(p)) { b.wins += 1 / r.winners.length; seatWins[p] += 1 / r.winners.length; }
      for (let k = 0; k < R; k++) coinsByRound[k].push(m.coins[p][k]);
      sold += m.unitsSold[p]; invested += m.unitsInvested[p];
      tolls += m.tollsPaid[p]; salesIncome += m.salesIncome[p];
      if (m.capRound[p]) { atCap++; capRounds.push(m.capRound[p]); }
      buildings += m.buildings[p];
      openAtEnd += m.bondsOpenAtEnd[p];
      if (!m.bondsTaken.some((b2) => b2.p === p)) never++;
    });
    for (const b of m.bondsTaken) { per[r.bots[b.p]].bondsTaken++; bondRounds.push(b.round); if (b.round === 1) bondR1++; }
    bondsTaken += m.bondsTaken.length;
    if (m.bondsTaken.length) gamesWithBond++;
    const w = r.scores[r.winners[0]];
    winnerVotes.push(w.total);
    if (w.total > 0) shareFrac.push(w.shares / w.total);
    foundedCount.push(m.foundedRounds.length);
    foundedRounds.push(m.foundedRounds);
    if (m.foundedRounds.filter((x) => x <= 15).length >= 4) four15++;
    if (m.foundedRounds.filter((x) => x <= 10).length >= 3) three10++;
    if (m.classAtEnd.some((c) => c >= 3)) classIII++;
    for (let g = 0; g < NG; g++) { empty[g] += m.stallEmpty[g]; full[g] += m.stallFull[g]; }
    unserved += m.unservedDistrictRounds; districtRounds += m.districtRounds;
    const iF = r.bots.indexOf('founder'), iR = r.bots.indexOf('freerider');
    if (iF >= 0 && iR >= 0) {
      fbGames++;
      const d = r.scores[iF].total - r.scores[iR].total;
      fb += d > 0 ? 1 : d === 0 ? 0.5 : 0;
    }
    m.brickPriceByRound.forEach((p, k) => brickPrice[Math.min(2, Math.floor(k / third))].push(p));
    for (let k = R - third; k < R; k++) { brickDiscardLate += m.brickDiscarded[k] ?? 0; brickUnsoldLate += m.brickUnsold[k] ?? 0; if (m.brickPriceByRound[k] === cfg.market.rawPrices[cfg.market.slots]) brickFullLate++; }
    contested += m.contested;
    for (const [k, v] of Object.entries(m.kinds)) kinds[k] = (kinds[k] ?? 0) + v;
    dividends += m.dividends.reduce((a, b) => a + b, 0);
    for (const [k, v] of Object.entries(m.linksBuilt)) links[k] = (links[k] ?? 0) + v;
    bought += m.unitsBought; imported += m.unitsImported;
    if (m.brickLockRounds) lockGames++;
    lockRounds += m.brickLockRounds;
    if (m.trailerStuckRounds) stuckGames++;
    invalid += m.invalid; overdrafts += m.overdrafts;
    if (m.startPicks.length) {
      pickGames++;
      for (const sp of m.startPicks) {
        pickBids[sp.pick - 1].push(sp.bid);
        if (r.winners.includes(sp.p)) pickWins[sp.pick - 1] += 1 / r.winners.length;
      }
    }
  }

  const bots: Record<string, BotStats> = {};
  for (const [name, b] of Object.entries(per)) {
    const k = b.votes.length;
    bots[name] = { games: k, wins: round(b.wins, 1), winRate: round(b.wins / k, 3), medianVotes: median(b.votes), meanVotes: round(mean(b.votes), 1), shares: round(b.shares / k, 1), buildings: round(b.buildings / k, 1), cash: round(b.cash / k, 1), bonds: round(b.bonds / k, 1), sold: round(b.sold / k, 1), invested: round(b.invested / k, 1), bondsTaken: round(b.bondsTaken / k, 2) };
  }
  const maxFound = Math.max(0, ...foundedRounds.map((x) => x.length));
  const pg = G * n;
  const pct = (x: number, of: number) => (of ? round(x / of, 3) : 0);
  const goodsRecord = (xs: number[]) => Object.fromEntries(GOODS.map((g, i) => [g, pct(xs[i], G * R)]));
  return {
    players: n,
    games: G,
    bots,
    seatWinRate: seatWins.map((x) => pct(x, G)),
    medianCoinsByRound: coinsByRound.map(median),
    winnerVotes: median(winnerVotes),
    winnerShareFraction: { median: round(median(shareFrac), 3), inTargetBand: pct(shareFrac.filter((x) => x >= 0.25 && x <= 0.5).length, shareFrac.length) },
    investedFraction: pct(invested, invested + sold),
    founded: {
      meanCount: round(mean(foundedCount)), fourByRound15: pct(four15, G), threeByRound10: pct(three10, G),
      meanRounds: Array.from({ length: maxFound }, (_, k) => round(mean(foundedRounds.filter((x) => x.length > k).map((x) => x[k])), 1)),
    },
    classIIIGames: pct(classIII, G),
    stallEmpty: goodsRecord(empty),
    stallFull: goodsRecord(full),
    unservedDistrictRounds: pct(unserved, districtRounds),
    founderBeatsFreerider: fbGames ? { games: fbGames, rate: pct(fb, fbGames) } : null,
    bonds: { perPlayerGame: round(bondsTaken / pg), takenRound1: pct(bondR1, pg), gamesWithAny: pct(gamesWithBond, G), neverTook: pct(never, pg), openAtEnd: round(openAtEnd / pg), meanRound: round(mean(bondRounds), 1) },
    cap: { atCapByEnd: pct(atCap, pg), medianRound: median(capRounds), meanBuildings: round(buildings / pg), kindsPerGame: Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, round(v / G)])) },
    dividendsPerPlayerGame: round(dividends / pg, 1),
    brick: {
      priceEarly: round(mean(brickPrice[0]), 1), priceMid: round(mean(brickPrice[1]), 1), priceLate: round(mean(brickPrice[2]), 1),
      stallFullLate: pct(brickFullLate, G * third), discardedLatePerGame: round(brickDiscardLate / G, 1), unsoldLatePerGame: round(brickUnsoldLate / G, 1),
    },
    tolls: { perPlayerGame: round(tolls / pg, 1), shareOfSalesIncome: pct(tolls * cfg.tollPerLink, salesIncome), linksPerGame: Object.fromEntries(Object.entries(links).map(([k, v]) => [k, round(v / G)])), contestedPerGame: round(contested / G) },
    imports: { shareOfUnitsBought: pct(imported, bought), brickLockGames: pct(lockGames, G), brickLockRoundsPerGame: round(lockRounds / G) },
    trailerStuckGames: pct(stuckGames, G),
    round0: pickGames ? { winRateByPick: pickWins.map((x) => pct(x, pickGames)), meanBidByPick: pickBids.map((x) => round(mean(x), 1)) } : null,
    winRateByStartGood: Object.fromEntries(GOODS.slice(0, 4).map((g, i) => [g, pct(goodWins[i], goodSeats[i])])),
    invalidActions: invalid,
    overdraftsPerGame: round(overdrafts / G),
  };
}
