/**
 * Plan builder used by every bot. It keeps the same running budget the resolver uses at lock,
 * so a plan built through it is always valid: no coin or good is committed twice.
 */
import type { BuildingKind, Config } from '../config.ts';
import { NG, vec } from '../config.ts';
import type { Action, Plan, ProductionPreview, StartBid, State } from '../engine.ts';
import { buildCost, buildingCap, buildingCount, importPrice, postedPrices, previewProduction, upgradeCost } from '../engine.ts';
import type { Rng } from '../rng.ts';

export interface Bot {
  name: string;
  plan(s: State, me: number, cfg: Config, rng: Rng): Plan;
  startBid(s: State, me: number, cfg: Config, rng: Rng): StartBid;
}

export class Planner {
  readonly actions: Action[] = [];
  readonly prices: number[];
  coins: number;
  goods: number[];
  pv: ProductionPreview;
  buildings: number;
  bonds: number;
  private trade: Extract<Action, { type: 'trade' }> | null = null;
  private importUnits = 0;
  private touched = new Set<string>();

  readonly s: State;
  readonly me: number;
  readonly cfg: Config;

  constructor(s: State, me: number, cfg: Config) {
    this.s = s;
    this.me = me;
    this.cfg = cfg;
    this.prices = postedPrices(s, cfg);
    this.pv = previewProduction(s, me, cfg);
    this.coins = Math.max(0, s.players[me].coins) - this.pv.upkeep;
    this.goods = this.pv.goods.slice();
    this.buildings = buildingCount(s, me);
    this.bonds = s.players[me].bonds;
  }

  get left() { return this.cfg.actionsPerRound - this.actions.length; }
  plan(): Plan { return { actions: this.actions }; }

  private canPay(coins: number, goods: number[]) {
    if (this.coins < coins) return false;
    for (let g = 0; g < NG; g++) if (this.goods[g] < goods[g]) return false;
    return true;
  }
  private spend(coins: number, goods: number[]) {
    this.coins -= coins;
    for (let g = 0; g < NG; g++) this.goods[g] -= goods[g];
  }

  bond(op: 'take' | 'repay', why?: string): boolean {
    if (this.left < 1) return false;
    const b = this.cfg.bond;
    if (op === 'take') {
      if (this.bonds >= b.maxOpen) return false;
      // More coins can wake buildings that were idled for want of upkeep: redo the preview.
      const spentCoins = Math.max(0, this.s.players[this.me].coins) - this.pv.upkeep - this.coins;
      const spentGoods = this.pv.goods.map((x, g) => x - this.goods[g]);
      this.bonds++;
      const taken = this.bonds - this.s.players[this.me].bonds;
      const cash = Math.max(0, this.s.players[this.me].coins + taken * b.amount);
      this.pv = previewProduction(this.s, this.me, this.cfg, [], cash);
      this.coins = cash - this.pv.upkeep - spentCoins;
      this.goods = this.pv.goods.map((x, g) => x - spentGoods[g]);
    } else {
      if (this.bonds <= 0 || this.coins < b.repayCost) return false;
      this.bonds--;
      this.coins -= b.repayCost;
    }
    this.actions.push({ type: 'bond', op, why });
    return true;
  }

  canBuild(kind: BuildingKind) {
    const c = buildCost(this.cfg, kind);
    return this.left >= 1 && this.buildings < buildingCap(this.cfg) && this.canPay(c.coins, vec(c.goods));
  }
  build(site: number, kind: BuildingKind, why?: string, bid = 0): boolean {
    if (!this.canBuild(kind) || this.touched.has(`b${site}`) || this.coins < buildCost(this.cfg, kind).coins + bid) return false;
    const c = buildCost(this.cfg, kind);
    this.spend(c.coins + bid, vec(c.goods));
    this.buildings++;
    this.touched.add(`b${site}`);
    this.actions.push({ type: 'build', site, kind, bid, why });
    return true;
  }

  upgrade(site: number, why?: string): boolean {
    const b = this.s.buildings[site];
    if (this.left < 1 || !b || b.owner !== this.me || this.touched.has(`u${site}`)) return false;
    const c = upgradeCost(this.cfg, b.tier + 1);
    if (!c || !this.canPay(c.coins, vec(c.goods))) return false;
    this.spend(c.coins, vec(c.goods));
    this.touched.add(`u${site}`);
    this.actions.push({ type: 'upgrade', site, why });
    return true;
  }

  link(edge: number, why?: string): boolean {
    const c = this.cfg.cost.link;
    if (this.left < 1 || this.s.links[edge] >= 0 || this.touched.has(`l${edge}`) || !this.canPay(c.coins, vec(c.goods))) return false;
    this.spend(c.coins, vec(c.goods));
    this.touched.add(`l${edge}`);
    this.actions.push({ type: 'link', edge, why });
    return true;
  }

  invest(plot: number, goods: number[], why?: string): boolean {
    if (this.left < 1 || !goods.some((x) => x > 0) || !this.canPay(0, goods)) return false;
    this.spend(0, goods);
    this.actions.push({ type: 'invest', plot, goods: goods.slice(), why });
    return true;
  }

  /** qty > 0 buys, qty < 0 sells. All orders in a round share one Trade action. */
  order(g: number, qty: number, importIfShort = false): boolean {
    if (qty === 0) return false;
    if (!this.trade && this.left < 1) return false;
    const current = this.trade?.orders[g] ?? 0;
    if (current !== 0 && Math.sign(current) !== Math.sign(qty)) return false;
    let cost = 0;
    let marks = 0;
    if (qty < 0) {
      if (this.goods[g] < -qty) return false;
    } else {
      cost = qty * this.prices[g];
      if (importIfShort && this.cfg.imports.enabled) {
        marks = Math.min(qty, this.cfg.imports.capPerRound - this.importUnits);
        if (marks <= 0) importIfShort = false;
        else cost += marks * Math.max(0, importPrice(this.cfg, g) - this.prices[g]);
      } else importIfShort = false;
      if (this.coins < cost) return false;
    }
    if (!this.trade) {
      this.trade = { type: 'trade', orders: new Array(NG).fill(0), importIfShort: [] };
      this.actions.push(this.trade);
    }
    this.trade.orders[g] += qty;
    if (qty < 0) this.goods[g] += qty;
    else {
      this.coins -= cost;
      this.importUnits += marks;
      if (importIfShort && !this.trade.importIfShort!.includes(g)) this.trade.importIfShort!.push(g);
    }
    return true;
  }
}
