/**
 * The shape of the rules. The numbers themselves live in config/economy.json at the repo
 * root, shared with the prototype: `base` is v0.4 and each preset is a list of overrides.
 * Nothing in the engine or the bots hard-codes a number that appears there.
 */
import economy from '../../config/economy.json' with { type: 'json' };

export const GOODS = ['timber', 'brick', 'iron', 'food', 'tools', 'consumer'] as const;
export type Good = (typeof GOODS)[number];
export const NG = GOODS.length;
export const TIMBER = 0, BRICK = 1, IRON = 2, FOOD = 3, TOOLS = 4, CONSUMER = 5;
/** Goods 0..3 are raw, 4..5 are processed. */
export const isRaw = (g: number) => g < 4;

export type Terrain = 'forest' | 'clay' | 'mountain' | 'farmland';
export const TERRAINS: Terrain[] = ['forest', 'clay', 'mountain', 'farmland'];
export const TERRAIN_GOOD: Record<Terrain, number> = { forest: TIMBER, clay: BRICK, mountain: IRON, farmland: FOOD };

export type BuildingKind = 'raw' | 'toolWorks' | 'goodsWorks';
export type DistrictType = 'residential' | 'commercial' | 'industrial';
export type GoodBag = Partial<Record<Good, number>>;

export interface Recipe { inputs: GoodBag; output: Good; outputQty: number }
export interface Cost { coins: number; goods: GoodBag }
export interface DistrictSpec { founding: GoodBag; demandByClass: GoodBag[] }

export interface Config {
  players: number;
  rounds: number;
  actionsPerRound: number;

  board: {
    plots: number;            // district plots ringed around the core
    sitesPerTerrain: number;  // production sites = 4 x this
    /** Chance that each optional candidate link from the pool is drawn for a match. */
    linkPool: { plotRing: number; siteSecondPlot: number; siteRing: number };
    minLinksPerSite: number;
    maxLinksPerSite: number;
  };
  /** Buildings a player may own, by player count (§4). */
  buildingCap: Record<number, number>;

  start: {
    coins: number;
    goods: GoodBag;
    /** 'deal': starting works handed out at random (v0.4). 'bid': round 0 sealed bid for pick order (v0.5 §6.9). */
    works: 'deal' | 'bid';
    /** In round 0, does the last player to pick keep their bid? (v0.5: yes.) */
    lastPickPaysNothing: boolean;
  };

  rawOutputByTier: number[];
  recipes: { toolWorks: Recipe; goodsWorks: Recipe };
  recipeRunsByTier: number[];
  cost: { raw: Cost; workshop: Cost; upgradeToTier: Record<number, Cost>; link: Cost };
  upkeepPerBuilding: number;
  storageCap: number;

  market: {
    slots: number;
    startStock: number;
    /** Price by units in the stall, index 0 .. slots. */
    rawPrices: number[];
    processedPrices: number[];
  };

  districts: Record<DistrictType, DistrictSpec>;
  coreDemand: GoodBag;
  startDistricts: DistrictType[];
  /** Types of the growth projects; shuffled per match. Length should equal plots - startDistricts. */
  projectPool: DistrictType[];
  visibleProjects: number;
  maxFoundingsPerRound: number;

  sharesPerUnit: { raw: number; processed: number };
  dividendPerShare: number;
  pipsPerClass: number;
  maxClass: number;

  tollPerLink: number;

  bond: { amount: number; interestPerRound: number; repayCost: number; maxOpen: number; votePenalty: number };
  cityFund: { enabled: boolean; buysPerRound: number };
  /** v0.5 §6.3: the part of a marked buy order the stall cannot fill arrives by rail at a fixed price. */
  imports: { enabled: boolean; rawPrice: number; processedPrice: number; capPerRound: number };

  votes: { perShareByClass: number[]; perBuildingByTier: number[]; coinsPerVote: number; lostPerCoinOfDebt: number };

  /** §11 variants, each off by default. */
  variants: {
    /** Proposal rule: the city adds one missing good to the first project for free every N rounds (0 = off). */
    freeCityContributionEvery: number;
    /** Proposal rule: no shares or dividends; each unit invested is worth this many votes on election day (0 = off, shares on). */
    contributionVotesPerUnit: number;
    /** A player may build a workshop on a district plot that holds no district and no visible project; that plot's project is lost. */
    plotsOpenToPlayers: boolean;
  };
}

/** Rules v0.4, read from the shared config/economy.json (also used by the prototype). */
export const DEFAULT_CONFIG: Config = economy.base as unknown as Config;

/** Turn a named bag ({ brick: 2 }) into a vector indexed like GOODS. Cached per bag object. */
const bagCache = new WeakMap<object, number[]>();
export function vec(bag: GoodBag): number[] {
  let v = bagCache.get(bag);
  if (!v) {
    v = GOODS.map((g) => bag[g] ?? 0);
    bagCache.set(bag, v);
  }
  return v;
}

export function priceAt(cfg: Config, good: number, stock: number): number {
  const table = isRaw(good) ? cfg.market.rawPrices : cfg.market.processedPrices;
  return table[Math.max(0, Math.min(table.length - 1, stock))];
}

/**
 * Copy a config with overrides given as dotted paths, e.g.
 * withOverrides(DEFAULT_CONFIG, { 'cost.raw.coins': 12, 'market.slots': 8 }).
 * Values may be numbers, strings, arrays or objects.
 */
export function withOverrides(base: Config, overrides: Record<string, unknown>): Config {
  const out = structuredClone(base) as any;
  for (const [path, value] of Object.entries(overrides)) {
    const keys = path.split('.');
    let node = out;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in node)) throw new Error(`Unknown config path: ${path}`);
      node = node[keys[i]];
    }
    const last = keys[keys.length - 1];
    if (node === null || typeof node !== 'object' || !(last in node)) throw new Error(`Unknown config path: ${path}`);
    node[last] = structuredClone(value);
  }
  // Keep the price tables as long as the stall.
  for (const key of ['rawPrices', 'processedPrices'] as const) {
    const t: number[] = out.market[key];
    while (t.length < out.market.slots + 1) t.push(Math.max(1, t[t.length - 1] - 1));
  }
  return out as Config;
}

/** Named rule sets from config/economy.json. Each is a list of dotted-path overrides on DEFAULT_CONFIG. */
export const PRESETS: Record<string, Record<string, unknown>> = economy.presets;
/** The preset that matches the current design doc. */
export const CURRENT_RULES: string = economy.currentRules;

export function preset(name: string, overrides: Record<string, unknown> = {}): Config {
  if (!(name in PRESETS)) throw new Error(`Unknown preset ${name}; known: ${Object.keys(PRESETS).join(', ')}`);
  return withOverrides(DEFAULT_CONFIG, { ...PRESETS[name], ...overrides });
}
