/**
 * The searching bot of §11. At each decision it gathers candidate plans (what each scripted
 * bot would do here, sampled a few times), plays every candidate forward to election day
 * against scripted rivals, and keeps the plan with the best vote margin. A score far above
 * every scripted bot points at an exploit.
 */
import type { Config } from '../config.ts';
import type { Plan, StartBid, State } from '../engine.ts';
import { resolveRound, resolveStartBids, score } from '../engine.ts';
import { makeRng } from '../rng.ts';
import type { Rng } from '../rng.ts';
import type { Bot } from './planner.ts';
import { PERSONAS, scriptedPlan, scriptedStartBid } from './scripted.ts';

export interface SearchOptions {
  /** Samples of each scripted bot's plan to consider. */
  samples: number;
  /** Playouts per candidate. */
  rollouts: number;
  /** Rounds to play forward; Infinity = to the election. */
  horizon: number;
  /** What the bot assumes of rivals, and of itself after this round. */
  rivalPersona: string;
  selfPersona: string;
  /** Coins it may bid in round 0. */
  startBids: number[];
}

const DEFAULTS: SearchOptions = { samples: 2, rollouts: 2, horizon: Infinity, rivalPersona: 'adaptive', selfPersona: 'adaptive', startBids: [0, 2, 4] };

function playOut(s0: State, me: number, first: Plan | null, cfg: Config, o: SearchOptions, seed: number): number {
  const rng = makeRng(seed);
  const rival = PERSONAS[o.rivalPersona], self = PERSONAS[o.selfPersona];
  let s = s0;
  let steps = 0;
  while (s.round <= cfg.rounds && steps < o.horizon) {
    const plans = s.players.map((_, p) => (p === me && steps === 0 && first ? first : scriptedPlan(p === me ? self : rival, s, p, cfg, rng)));
    s = resolveRound(s, plans, cfg, { log: false }).state;
    steps++;
  }
  const sc = score(s, cfg);
  let bestRival = -Infinity;
  for (let p = 0; p < sc.length; p++) if (p !== me && sc[p].total > bestRival) bestRival = sc[p].total;
  // Votes decide; coins break ties between otherwise equal lines of play.
  return sc[me].total - bestRival + sc[me].coins * 0.01;
}

export function searchBot(options: Partial<SearchOptions> = {}): Bot {
  const o = { ...DEFAULTS, ...options };
  return {
    name: 'search',
    plan(s: State, me: number, cfg: Config, rng: Rng): Plan {
      const seen = new Set<string>();
      const candidates: Plan[] = [];
      for (const per of Object.values(PERSONAS)) {
        for (let k = 0; k < o.samples; k++) {
          const plan = scriptedPlan(per, s, me, cfg, rng);
          const key = JSON.stringify(plan.actions);
          if (!seen.has(key)) { seen.add(key); candidates.push(plan); }
        }
      }
      // The same playout seeds for every candidate, so they are compared on equal luck.
      const seeds = Array.from({ length: o.rollouts }, () => rng.int(2 ** 31));
      let best = candidates[0], bestValue = -Infinity;
      for (const plan of candidates) {
        let v = 0;
        for (const seed of seeds) v += playOut(s, me, plan, cfg, o, seed);
        if (v > bestValue) { bestValue = v; best = plan; }
      }
      return best;
    },
    startBid(s: State, me: number, cfg: Config, rng: Rng): StartBid {
      const baseRank = scriptedStartBid(PERSONAS[o.selfPersona], s, me, cfg, rng).ranking;
      const seeds = Array.from({ length: Math.max(2, o.rollouts) }, () => rng.int(2 ** 31));
      let best: StartBid = { ranking: baseRank, bid: 0 }, bestValue = -Infinity;
      for (const firstChoice of s.board.startSites) {
        for (const bid of o.startBids) {
          if (bid > s.players[me].coins) continue;
          const mine: StartBid = { ranking: [firstChoice, ...baseRank.filter((x) => x !== firstChoice)], bid };
          let v = 0;
          for (const seed of seeds) {
            const r = makeRng(seed);
            const bids = s.players.map((_, p) => (p === me ? mine : scriptedStartBid(PERSONAS[o.rivalPersona], s, p, cfg, r)));
            v += playOut(resolveStartBids(s, bids, cfg).state, me, null, cfg, o, seed);
          }
          if (v > bestValue) { bestValue = v; best = mine; }
        }
      }
      return best;
    },
  };
}
