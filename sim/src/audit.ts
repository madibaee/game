/**
 * Reconciliation (§12 stage 1): replay the coin and goods transfers in an event log on top of
 * the state before the round and check, at every phase boundary, that nothing is created or
 * lost outside a logged transfer, and that the replay lands exactly on the state after.
 */
import { NG, vec } from './config.ts';
import type { Config } from './config.ts';
import type { Event, State } from './engine.ts';

export function audit(before: State, events: Event[], after: State, cfg: Config): string[] {
  const problems: string[] = [];
  const n = before.players.length;
  const coins = before.players.map((p) => p.coins);
  let fund = before.fund, bank = before.bank;
  const goods = before.players.map((p) => p.goods.slice());
  const stalls = before.stalls.slice();
  const held = new Map<number, number[]>(); // goods sitting in unfounded projects
  for (const q of before.projects) {
    const founding = vec(cfg.districts[q.type].founding);
    held.set(q.plot, founding.map((f, g) => f - q.need[g]));
  }
  const total = () => coins.reduce((a, b) => a + b, 0) + fund + bank;
  const coinTotal = total();
  let phase = 'start';

  const check = () => {
    if (total() !== coinTotal) problems.push(`coins do not reconcile after ${phase}`);
    for (let p = 0; p < n; p++) for (let g = 0; g < NG; g++) if (goods[p][g] < 0) problems.push(`player ${p} holds negative goods after ${phase}`);
    for (let g = 0; g < NG; g++) if (stalls[g] < 0) problems.push(`stall ${g} negative after ${phase}`);
    if (fund < 0) problems.push(`city fund negative after ${phase}`);
  };

  for (const e of events) {
    if (e.t === 'phase') { check(); phase = e.phase; continue; }
    if (e.t === 'coin') {
      for (const [acct, d] of [[e.from, -e.n], [e.to, e.n]] as const) {
        if (typeof acct === 'number') coins[acct] += d;
        else if (acct === 'fund') fund += d;
        else if (acct === 'bank') bank += d;
        else problems.push(`unknown coin account ${acct}`);
      }
    } else if (e.t === 'good') {
      for (const [acct, d] of [[e.from, -e.n], [e.to, e.n]] as const) {
        if (typeof acct === 'number') goods[acct][e.g] += d;
        else if (acct === 'stall') stalls[e.g] += d;
        else if (typeof acct === 'string' && acct.startsWith('project:')) {
          const plot = Number(acct.slice(8));
          if (!held.has(plot)) held.set(plot, new Array(NG).fill(0));
          held.get(plot)![e.g] += d;
        }
      }
    }
  }
  check();

  for (let p = 0; p < n; p++) {
    if (coins[p] !== after.players[p].coins) problems.push(`player ${p} coins: log says ${coins[p]}, state says ${after.players[p].coins}`);
    for (let g = 0; g < NG; g++) if (goods[p][g] !== after.players[p].goods[g]) problems.push(`player ${p} good ${g}: log says ${goods[p][g]}, state says ${after.players[p].goods[g]}`);
    if (after.players[p].goods.reduce((a, b) => a + b, 0) > cfg.storageCap) problems.push(`player ${p} over the storage cap`);
  }
  if (fund !== after.fund) problems.push(`fund: log says ${fund}, state says ${after.fund}`);
  if (bank !== after.bank) problems.push(`bank: log says ${bank}, state says ${after.bank}`);
  for (let g = 0; g < NG; g++) {
    if (stalls[g] !== after.stalls[g]) problems.push(`stall ${g}: log says ${stalls[g]}, state says ${after.stalls[g]}`);
    if (after.stalls[g] > cfg.market.slots) problems.push(`stall ${g} over its slots`);
  }
  for (const q of after.projects) {
    const founding = vec(cfg.districts[q.type].founding);
    const h = held.get(q.plot) ?? new Array(NG).fill(0);
    for (let g = 0; g < NG; g++) if (h[g] !== founding[g] - q.need[g]) problems.push(`project ${q.plot} good ${g} does not reconcile`);
  }
  return problems;
}
