// Every number from "Theme and Board v0.4" lives here so it can be changed in one place.
// Section references (§) point at the design doc.
(function (root) {
  'use strict';
  const CONFIG = {
    rounds: 18,                       // §5 election day
    actionsPerRound: 3,               // §6
    startCoins: 12,                   // §6.2
    startGoods: { brick: 2 },         // §6.2
    storageCap: 8,                    // §6.2
    buildingCap: { 2: 5, 3: 4, 4: 3 },// §4 buildings per player by player count

    goods: ['timber', 'brick', 'iron', 'food', 'tools', 'goods'],
    raw: ['timber', 'brick', 'iron', 'food'],
    terrain: { forest: 'timber', clay: 'brick', mountain: 'iron', farm: 'food' },
    sitesPerTerrain: 3,               // §4

    // §6.2 production
    rawOutput: [2, 3, 4],             // units per round at tier I / II / III
    recipeRuns: [1, 2, 3],            // workshop runs per round by tier
    recipes: {
      tools: { in: { iron: 1, timber: 1 }, out: 'tools', qty: 2 },
      goods: { in: { food: 1, timber: 1 }, out: 'goods', qty: 2 },
    },
    cost: {
      raw: { coins: 10, brick: 1 },
      workshop: { coins: 14, brick: 1 },
      upgrade: { 1: { coins: 8, brick: 1 }, 2: { coins: 12, brick: 1 } }, // keyed by current tier
      link: 2,
    },
    upkeep: 1,                        // per running building per round

    // §6.3 market. Price is indexed by units in the stall at the start of the round.
    stallSlots: 6,
    stallStart: 3,
    price: {
      raw: [8, 7, 6, 5, 4, 3, 2],
      processed: [13, 12, 11, 10, 9, 8, 7],
    },

    // §6.4 neighbourhoods
    visibleProjects: 2,
    districts: {
      residential: {
        found: { timber: 2, brick: 4 },
        demand: [{ food: 2 }, { food: 2, goods: 1 }, { food: 1, goods: 3 }],
      },
      commercial: {
        found: { brick: 3, goods: 2 },
        demand: [{ timber: 1, goods: 1 }, { timber: 1, goods: 2 }, { goods: 3, tools: 1 }],
      },
      industrial: {
        found: { brick: 2, iron: 4 },
        demand: [{ iron: 2 }, { iron: 2, tools: 1 }, { iron: 1, tools: 3 }],
      },
    },
    coreDemand: { timber: 1, brick: 1, iron: 1, food: 1 },
    startDistricts: ['residential', 'commercial'],
    projectTypes: ['residential', 'industrial', 'commercial', 'industrial', 'residential'], // shuffled per match
    sharesPerUnit: { raw: 1, processed: 2 },
    dividendPerShare: 1,
    pipsPerClass: 3,

    // §6.5 and §6.6
    toll: 1,
    bond: { amount: 12, interest: 1, max: 2, votePenalty: 4 },

    // §6.8 election
    votes: { share: [1, 2, 3], building: [1, 2, 3], coinsPerVote: 10 },

    // Board geometry in points (§4: 390 x 480 board, 56 pt nodes) and the link pool.
    map: {
      w: 390, h: 480, cx: 195, cy: 240, nodeR: 28,
      plotRx: 86, plotRy: 100, siteRx: 162, siteRy: 206,
      secondPlotLinkChance: 0.5,      // a site also links to its second-nearest plot
      ringLinkChance: 0.6,            // neighbouring production sites link to each other
    },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = CONFIG;
  else root.CONFIG = CONFIG;
})(typeof window !== 'undefined' ? window : globalThis);
