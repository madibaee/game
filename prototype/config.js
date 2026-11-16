// The prototype's view of the shared rule numbers in config/economy.json.
// Rule numbers are NOT set here: change them in config/economy.json, then run
// `node config/sync.js` to refresh prototype/economy.js (the copy the browser loads).
// This file only renames the shared keys to the names engine.js uses, and holds the
// board geometry, which belongs to this prototype's screen and not to the rules.
// Section references (§) point at docs/design/theme-and-board.md.
(function (root) {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const ECONOMY = node ? require('../config/economy.json') : root.ECONOMY;

  // The prototype plays the v0.6 preset: the v0.4 base with the changes that came out of self-play
  // (docs/decisions/0008). It does not have v0.5's imports or round-0 bid.
  const PRESET = 'v0.6';
  const E = JSON.parse(JSON.stringify(ECONOMY.base));
  Object.keys(ECONOMY.presets[PRESET] || {}).forEach((path) => {
    const keys = path.split('.');
    let at = E;
    keys.slice(0, -1).forEach((k) => { at = at[k]; });
    at[keys[keys.length - 1]] = ECONOMY.presets[PRESET][path];
  });

  // For tuning runs in Node: ECONOMY_SET='{"storageCap":12}' overrides numbers by dotted path.
  const trial = node && process.env.ECONOMY_SET ? JSON.parse(process.env.ECONOMY_SET) : {};
  Object.keys(trial).forEach((path) => {
    const keys = path.split('.');
    let at = E;
    keys.slice(0, -1).forEach((k) => { at = at[k]; });
    at[keys[keys.length - 1]] = trial[path];
  });

  // The shared file calls consumer goods 'consumer'; this prototype calls them 'goods'.
  const good = (g) => (g === 'consumer' ? 'goods' : g);
  const bag = (b) => { const o = {}; Object.keys(b).forEach((g) => { o[good(g)] = b[g]; }); return o; };
  const cost = (c) => Object.assign({ coins: c.coins }, bag(c.goods));
  const district = (d) => ({ found: bag(d.founding), demand: d.demandByClass.map(bag) });
  const recipe = (r) => ({ in: bag(r.inputs), out: good(r.output), qty: r.outputQty });

  const CONFIG = {
    rules: PRESET,
    rounds: E.rounds,                 // §5 election day
    actionsPerRound: E.actionsPerRound, // §6
    startCoins: E.start.coins,        // §6.2
    startGoods: bag(E.start.goods),   // §6.2
    storageCap: E.storageCap,         // §6.2
    buildingCap: E.buildingCap,       // §4 buildings per player by player count

    goods: ['timber', 'brick', 'iron', 'food', 'tools', 'goods'],
    raw: ['timber', 'brick', 'iron', 'food'],
    terrain: { forest: 'timber', clay: 'brick', mountain: 'iron', farm: 'food' },
    sitesPerTerrain: E.board.sitesPerTerrain, // §4

    // §6.2 production
    rawOutput: E.rawOutputByTier,     // units per round at tier I / II / III
    recipeRuns: E.recipeRunsByTier,   // workshop runs per round by tier
    recipes: { tools: recipe(E.recipes.toolWorks), goods: recipe(E.recipes.goodsWorks) },
    cost: {
      raw: cost(E.cost.raw),
      workshop: cost(E.cost.workshop),
      // keyed by current tier here, by target tier in the shared file
      upgrade: { 1: cost(E.cost.upgradeToTier[2]), 2: cost(E.cost.upgradeToTier[3]) },
      link: E.cost.link.coins,
    },
    upkeep: E.upkeepByTier,           // per running building per round, by tier

    // §6.3 market. Price is indexed by units in the stall at the start of the round.
    stallSlots: E.market.slots,
    stallStart: E.market.startStock,
    slidingPrice: E.market.slidingPrice, // each unit traded moves the price one step
    declineAfter: E.districtDecline.unservedRounds, // unserved rounds in a row before a district drops a class (0 = never)
    price: { raw: E.market.rawPrices, processed: E.market.processedPrices },

    imports: { on: E.imports.enabled, raw: E.imports.rawPrice, processed: E.imports.processedPrice, cap: E.imports.capPerRound }, // §6.3 imports by rail
    // §6.4 neighbourhoods
    visibleProjects: E.visibleProjects,
    districts: {
      residential: district(E.districts.residential),
      commercial: district(E.districts.commercial),
      industrial: district(E.districts.industrial),
    },
    coreDemand: bag(E.coreDemand),
    startDistricts: E.startDistricts,
    projectTypes: E.projectPool,      // shuffled per match
    sharesPerUnit: E.sharesPerUnit,
    dividendPerShare: E.dividendPerShare,
    pipsPerClass: E.pipsPerClass,

    // §6.5 and §6.6
    toll: E.tollPerLink,
    bond: { amount: E.bond.amount, interest: E.bond.interestPerRound, max: E.bond.maxOpen, votePenalty: E.bond.votePenalty },

    // §6.8 election
    votes: { share: E.votes.perShareByClass, building: E.votes.perBuildingByTier, coinsPerVote: E.votes.coinsPerVote, debt: E.votes.lostPerCoinOfDebt },

    // Board geometry in points (§4: 390 x 480 board, 56 pt nodes). Prototype only.
    map: {
      w: 390, h: 480, cx: 195, cy: 240, nodeR: 28,
      plotRx: 86, plotRy: 100, siteRx: 162, siteRy: 206,
      secondPlotLinkChance: E.board.linkPool.siteSecondPlot, // a site also links to its second-nearest plot
      ringLinkChance: E.board.linkPool.siteRing,             // neighbouring production sites link to each other
    },
  };
  if (node) module.exports = CONFIG;
  else root.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
