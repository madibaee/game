/**
 * Every rule number in one place. DEFAULT_CONFIG is the design doc v0.4, §4 and §6.
 * Nothing in the engine or the bots hard-codes a number that appears here, so a new
 * rules version is a new config object (or a JSON file of overrides, see `withOverrides`).
 */

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

  votes: { perShareByClass: number[]; perBuildingByTier: number[]; coinsPerVote: number };

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

const range = (from: number, to: number) => Array.from({ length: Math.abs(to - from) + 1 }, (_, i) => from + (to > from ? i : -i));

export const DEFAULT_CONFIG: Config = {
  players: 4,
  rounds: 18,
  actionsPerRound: 3,

  board: {
    plots: 7,
    sitesPerTerrain: 3,
    linkPool: { plotRing: 0.45, siteSecondPlot: 0.4, siteRing: 0.5 },
    minLinksPerSite: 2,
    maxLinksPerSite: 4,
  },
  buildingCap: { 2: 5, 3: 4, 4: 3 },

  start: { coins: 12, goods: { brick: 2 }, works: 'deal', lastPickPaysNothing: true },

  rawOutputByTier: [2, 3, 4],
  recipes: {
    toolWorks: { inputs: { iron: 1, timber: 1 }, output: 'tools', outputQty: 2 },
    goodsWorks: { inputs: { food: 1, timber: 1 }, output: 'consumer', outputQty: 2 },
  },
  recipeRunsByTier: [1, 2, 3],
  cost: {
    raw: { coins: 10, goods: { brick: 1 } },
    workshop: { coins: 14, goods: { brick: 1 } },
    upgradeToTier: { 2: { coins: 8, goods: { brick: 1 } }, 3: { coins: 12, goods: { brick: 1 } } },
    link: { coins: 2, goods: {} },
  },
  upkeepPerBuilding: 1,
  storageCap: 8,

  market: {
    slots: 6,
    startStock: 3,
    rawPrices: range(8, 2),
    processedPrices: range(13, 7),
  },

  districts: {
    residential: {
      founding: { timber: 2, brick: 4 },
      demandByClass: [{ food: 2 }, { food: 2, consumer: 1 }, { food: 1, consumer: 3 }],
    },
    commercial: {
      founding: { brick: 3, consumer: 2 },
      demandByClass: [{ timber: 1, consumer: 1 }, { timber: 1, consumer: 2 }, { consumer: 3, tools: 1 }],
    },
    industrial: {
      founding: { brick: 2, iron: 4 },
      demandByClass: [{ iron: 2 }, { iron: 2, tools: 1 }, { iron: 1, tools: 3 }],
    },
  },
  coreDemand: { timber: 1, brick: 1, iron: 1, food: 1 },
  startDistricts: ['residential', 'commercial'],
  projectPool: ['residential', 'commercial', 'industrial', 'industrial', 'residential'],
  visibleProjects: 2,
  maxFoundingsPerRound: 1,

  sharesPerUnit: { raw: 1, processed: 2 },
  dividendPerShare: 1,
  pipsPerClass: 3,
  maxClass: 3,

  tollPerLink: 1,

  bond: { amount: 12, interestPerRound: 1, repayCost: 12, maxOpen: 2, votePenalty: 4 },
  cityFund: { enabled: true, buysPerRound: 1 },
  imports: { enabled: false, rawPrice: 10, processedPrice: 16, capPerRound: 2 },

  votes: { perShareByClass: [1, 2, 3], perBuildingByTier: [1, 2, 3], coinsPerVote: 10 },

  variants: { freeCityContributionEvery: 0, contributionVotesPerUnit: 0, plotsOpenToPlayers: false },
};

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

/** Named rule sets. Each is a list of overrides on DEFAULT_CONFIG (v0.4). */
export const PRESETS: Record<string, Record<string, unknown>> = {
  'v0.4': {},
  /** v0.5 draft: player imports and the round-0 bid for starting works. */
  'v0.5': { 'imports.enabled': true, 'start.works': 'bid' },
  /** v0.5 §8 short format. */
  'v0.5-short': { 'imports.enabled': true, 'start.works': 'bid', rounds: 12, pipsPerClass: 2, 'start.coins': 18 },
};

export function preset(name: string, overrides: Record<string, unknown> = {}): Config {
  if (!(name in PRESETS)) throw new Error(`Unknown preset ${name}; known: ${Object.keys(PRESETS).join(', ')}`);
  return withOverrides(DEFAULT_CONFIG, { ...PRESETS[name], ...overrides });
}
