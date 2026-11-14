/** The standard experiment suite: runs the batches behind each §11 question and writes a markdown report. */
import type { Summary } from './batch.ts';
import { runBatch } from './batch.ts';
import { scriptedBot, searchBot } from './bots/index.ts';
import type { Config } from './config.ts';
import { preset } from './config.ts';

const pc = (x: number) => `${Math.round(x * 100)}%`;
const table = (head: string[], rows: (string | number)[][]) =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');
const verdict = (ok: boolean) => (ok ? 'met' : '**missed**');

export interface ReportOptions { preset: string; overrides: Record<string, unknown>; games: number; seed: number; searchGames: number; log?: (msg: string) => void }

export function buildReport(o: ReportOptions): string {
  const log = o.log ?? (() => {});
  const cfgFor = (players: number, extra: Record<string, unknown> = {}, name = o.preset): Config => preset(name, { ...o.overrides, players, ...extra });
  const counts = [2, 3, 4];
  const mixed: Record<number, Summary> = {};
  for (const n of counts) {
    log(`baseline, ${n} players`);
    mixed[n] = runBatch({ cfg: cfgFor(n), games: o.games, seed: o.seed, lineup: 'mixed', audit: true }).summary;
  }
  const out: string[] = [];
  const P = (s: string) => out.push(s, '');

  P(`# Economy simulation report: ${o.preset}`);
  P(`Rules: preset \`${o.preset}\`${Object.keys(o.overrides).length ? ` with overrides \`${JSON.stringify(o.overrides)}\`` : ''}. ${o.games} matches per setting, each on its own shuffled map, seats drawn from the six scripted bots. Rules are docs/design/theme-and-board.md with the gap-review edits applied. Every match was reconciled phase by phase (coins and goods) and no bot submitted an invalid action unless noted. Results are relative to these bots: they are plausible players, not optimal ones, and the searching bot in section 3 is the check on what they miss.`);

  // ---------------------------------------------------------------- targets
  P('## 1. Targets of §11');
  log('mirrored two-player');
  const mirror = runBatch({ cfg: cfgFor(2), games: o.games * 2, seed: o.seed + 1, lineup: ['adaptive', 'adaptive'], fixedSeats: true }).summary;
  const m4 = mixed[4];
  const ranked = (s: Summary) => Object.entries(s.bots).sort((a, b) => b[1].medianVotes - a[1].medianVotes);
  const gap = (s: Summary) => { const r = ranked(s); return r[1][1].medianVotes ? r[0][1].medianVotes / r[1][1].medianVotes - 1 : 0; };
  const worstStall = (s: Summary) => Math.max(...Object.values(s.stallEmpty), ...Object.values(s.stallFull));
  const rows: (string | number)[][] = [
    ['Mirrored two-player seat win rate 45% to 55%', '', mirror.seatWinRate.map(pc).join(' / '), '', verdict(mirror.seatWinRate.every((x) => x >= 0.45 && x <= 0.55))],
    ['Best bot median votes within 15% of second', ...counts.map((n) => `${ranked(mixed[n])[0][0]} +${pc(gap(mixed[n]))}`), verdict(counts.every((n) => gap(mixed[n]) <= 0.15))],
    ['Free-rider loses to founder in most matches, not all', ...counts.map((n) => (mixed[n].founderBeatsFreerider ? pc(mixed[n].founderBeatsFreerider!.rate) : 'n/a')), verdict(counts.every((n) => { const r = mixed[n].founderBeatsFreerider?.rate ?? 0; return r > 0.5 && r < 0.95; }))],
    ["Shares are 25% to 50% of the winner's votes (median)", ...counts.map((n) => pc(mixed[n].winnerShareFraction.median)), verdict(counts.every((n) => mixed[n].winnerShareFraction.median >= 0.25 && mixed[n].winnerShareFraction.median <= 0.5))],
    ['Four of five plots founded by round 15 in most matches', ...counts.map((n) => pc(mixed[n].founded.fourByRound15)), verdict(counts.every((n) => mixed[n].founded.fourByRound15 > 0.5))],
    ['No stall empty or full more than 25% of rounds (worst stall)', ...counts.map((n) => pc(worstStall(mixed[n]))), verdict(counts.every((n) => worstStall(mixed[n]) <= 0.25))],
    ['Trailing player at round 6 always has an affordable action (matches where not)', ...counts.map((n) => pc(mixed[n].trailerStuckGames)), verdict(counts.every((n) => mixed[n].trailerStuckGames === 0))],
  ];
  P(table(['Target', '2 players', '3 players', '4 players', 'Result'], rows));

  // ---------------------------------------------------------------- bots
  P('## 2. How the scripted bots fare');
  for (const n of counts) {
    P(`**${n} players**`);
    P(table(['Bot', 'Win rate', 'Median votes', 'From shares', 'From buildings', 'From cash', 'Bond penalty', 'Units sold', 'Units invested', 'Bonds taken'],
      ranked(mixed[n]).map(([name, b]) => [name, pc(b.winRate), b.medianVotes, b.shares, b.buildings, b.cash, b.bonds, b.sold, b.invested, b.bondsTaken])));
  }
  P(`A fair seat wins ${counts.map((n) => `${pc(1 / n)} at ${n}`).join(', ')}.`);

  P('## 3. Searching bot (exploit check)');
  const searchRows: (string | number)[][] = [];
  for (const n of counts) {
    log(`searching bot, ${n} players`);
    const s = runBatch({ cfg: cfgFor(n), games: o.searchGames, seed: o.seed + 2, lineup: ['search', ...['workshop', 'founder', 'adaptive'].slice(0, n - 1)], custom: { search: () => searchBot() } }).summary;
    const best = Object.entries(s.bots).filter(([k]) => k !== 'search').sort((a, b) => b[1].medianVotes - a[1].medianVotes)[0];
    const se = s.bots.search;
    searchRows.push([n, pc(se.winRate), se.medianVotes, `${best[0]} ${best[1].medianVotes}`, `+${pc(se.medianVotes / Math.max(1, best[1].medianVotes) - 1)}`, se.shares, se.buildings, se.cash]);
  }
  P(table(['Players', 'Search win rate', 'Search median votes', 'Best scripted rival', 'Edge', 'From shares', 'From buildings', 'From cash'], searchRows));
  P(`${o.searchGames} matches per player count; the searching bot faces the strongest scripted bots. A large edge means the scripts leave value on the table; where its votes come from shows what kind.`);

  // ---------------------------------------------------------------- questions
  P('## 4. The questions of §11');
  P('### Is money scarce?');
  P(table(['Players', ...[1, 3, 6, 9, 12, 15, 18].filter((r) => r <= mixed[4].medianCoinsByRound.length).map((r) => `Round ${r}`)], counts.map((n) => [n, ...[1, 3, 6, 9, 12, 15, 18].filter((r) => r <= mixed[n].medianCoinsByRound.length).map((r) => mixed[n].medianCoinsByRound[r - 1])])));
  P('Median coins held at the end of each round, all seats.');

  P('### Do shares dominate? Does anyone free-ride?');
  P(table(['Players', 'Goods invested (of sold + invested)', "Shares in winner's votes", 'Founder beats free-rider', 'Dividends per player per match', 'District rounds unserved'],
    counts.map((n) => [n, pc(mixed[n].investedFraction), pc(mixed[n].winnerShareFraction.median), mixed[n].founderBeatsFreerider ? pc(mixed[n].founderBeatsFreerider!.rate) : 'n/a', mixed[n].dividendsPerPlayerGame, pc(mixed[n].unservedDistrictRounds)])));

  P('### Is the bond a decision?');
  log('bond A/B');
  const noBond = () => ({ ...scriptedBot('adaptive', { bonds: 'never' }), name: 'adaptive-nobond' });
  const bondRows = counts.map((n) => {
    const ab = runBatch({ cfg: cfgFor(n), games: o.games, seed: o.seed + 3, lineup: ['adaptive-nobond', ...Array(n - 1).fill('adaptive')], custom: { 'adaptive-nobond': noBond } }).summary;
    const b = mixed[n].bonds;
    return [n, b.perPlayerGame, pc(b.takenRound1), pc(b.neverTook), b.meanRound, b.openAtEnd, `${pc(ab.bots['adaptive-nobond'].winRate)} (fair ${pc(1 / n)})`];
  });
  P(table(['Players', 'Bonds per player per match', 'Seats taking one in round 1', 'Seats never taking one', 'Mean round taken', 'Open on election day per seat', 'Win rate of a bot that never borrows, among borrowers'], bondRows));

  P('### Do the building caps work?');
  log('cap comparison');
  const capRows: (string | number)[][] = counts.map((n) => [`${n} players, cap ${cfgFor(n).buildingCap[n]}`, pc(mixed[n].cap.atCapByEnd), mixed[n].cap.medianRound, JSON.stringify(mixed[n].cap.kindsPerGame), mixed[n].medianCoinsByRound.at(-1)!, pc(mixed[n].unservedDistrictRounds)]);
  const cap4 = runBatch({ cfg: cfgFor(4, { 'buildingCap.4': 4 }), games: o.games, seed: o.seed, lineup: 'mixed' }).summary;
  capRows.push(['4 players, cap 4', pc(cap4.cap.atCapByEnd), cap4.cap.medianRound, JSON.stringify(cap4.cap.kindsPerGame), cap4.medianCoinsByRound.at(-1)!, pc(cap4.unservedDistrictRounds)]);
  P(table(['Setting', 'Seats at the cap by the end', 'Median round the cap is reached', 'Buildings on the board at the end', 'Median final coins', 'District rounds unserved'], capRows));

  P('### Is brick stranded late?');
  P(table(['Players', 'Mean brick price, first third', 'Middle third', 'Last third', 'Brick stall full, last third', 'Brick thrown away at the storage cap, last third, per match', 'Brick offered and not bought, last third, per match'],
    counts.map((n) => { const b = mixed[n].brick; return [n, b.priceEarly, b.priceMid, b.priceLate, pc(b.stallFullLate), b.discardedLatePerGame, b.unsoldLatePerGame]; })));

  P('### Do tolls matter?');
  log('toll comparison');
  const tollRows: (string | number)[][] = [];
  for (const toll of [0, 1, 3]) {
    const s = toll === cfgFor(4).tollPerLink ? m4 : runBatch({ cfg: cfgFor(4, { tollPerLink: toll }), games: o.games, seed: o.seed, lineup: 'mixed' }).summary;
    tollRows.push([toll, s.tolls.perPlayerGame, pc(s.tolls.shareOfSalesIncome), s.tolls.linksPerGame.connect ?? 0, s.tolls.linksPerGame.plot ?? 0, s.tolls.linksPerGame['avoid-toll'] ?? 0, s.tolls.contestedPerGame]);
  }
  P(table(['Toll per link (4 players)', 'Rival links crossed per seat per match', 'Tolls as share of sales income', 'Links laid to connect a works', 'Links laid to reach a plot', 'Links laid to dodge a toll', 'Contested claims per match'], tollRows));

  P('Under the merged rules a shipment may leave from any of the player’s buildings by the route with the fewest tolls, and every plot has a free city link to the core. Each player starts with an own link from a works to a plot, so a toll-free route always exists.');

  P('### Stalls');
  P(table(['Players', 'Stall', ...Object.keys(m4.stallEmpty)], counts.flatMap((n) => [[n, 'empty', ...Object.values(mixed[n].stallEmpty).map(pc)], [n, 'full', ...Object.values(mixed[n].stallFull).map(pc)]])));
  P('Share of rounds that opened with the stall empty or full.');

  P('### City growth');
  P(table(['Players', 'Projects founded (of 5)', 'Mean founding rounds', 'Three founded by round 10', 'Four founded by round 15', 'Matches with a class III district'],
    counts.map((n) => [n, mixed[n].founded.meanCount, mixed[n].founded.meanRounds.join(', '), pc(mixed[n].founded.threeByRound10), pc(mixed[n].founded.fourByRound15), pc(mixed[n].classIIIGames)])));

  P('### Are the starting works equal?');
  log('round 0');
  const startRows: (string | number)[][] = counts.map((n) => [`${n} players, dealt`, ...Object.values(mixed[n].winRateByStartGood).map(pc), `fair ${pc(1 / n)}`, 'n/a']);
  const bid4 = runBatch({ cfg: cfgFor(4, { 'start.works': 'bid' }), games: o.games, seed: o.seed, lineup: 'mixed' }).summary;
  startRows.push(['4 players, round 0, scripted bots bid zero', ...Object.values(bid4.winRateByStartGood).map(pc), 'fair 25%', bid4.round0!.winRateByPick.map(pc).join(' / ')]);
  const bidSearch = runBatch({ cfg: cfgFor(4, { 'start.works': 'bid' }), games: o.searchGames, seed: o.seed + 4, lineup: ['search', 'workshop', 'founder', 'adaptive'], custom: { search: () => searchBot() } });
  const sb = bidSearch.results.flatMap((r) => r.metrics.startPicks.filter((x) => r.bots[x.p] === 'search'));
  P(table(['Setting', 'Win rate starting on timber', 'brick', 'iron', 'food', '', 'Win rate by pick order (first to last)'], startRows));
  P(`In ${o.searchGames} round-0 matches the searching bot bid ${(sb.reduce((a, x) => a + x.bid, 0) / Math.max(1, sb.length)).toFixed(1)} coins on average (choices: 0, 2 or 4) and won ${pc(bidSearch.summary.bots.search.winRate)}.`);

  // ---------------------------------------------------------------- variants
  P('## 5. Variants, one at a time (4 players)');
  log('variants');
  const variants: [string, Config][] = [
    [`${o.preset} as written`, cfgFor(4)],
    ['Free city contribution every third round, no city fund', cfgFor(4, { 'variants.freeCityContributionEvery': 3, 'cityFund.enabled': false })],
    ['Contribution points (0.5 vote per unit) in place of shares', cfgFor(4, { 'variants.contributionVotesPerUnit': 0.5 })],
    ['Imports on (10 / 16 coins, 2 a round)', cfgFor(4, { 'imports.enabled': true })],
    ['Imports off', cfgFor(4, { 'imports.enabled': false })],
    ['Round 0 bid for starting works', cfgFor(4, { 'start.works': 'bid' })],
    ['Starting works dealt', cfgFor(4, { 'start.works': 'deal' })],
    ['Short format (12 rounds, 2 pips, 18 coins)', cfgFor(4, { rounds: 12, pipsPerClass: 2, 'start.coins': 18 })],
  ];
  const vr = variants.map(([name, cfg]) => {
    const s = name.endsWith('as written') ? m4 : runBatch({ cfg, games: o.games, seed: o.seed, lineup: 'mixed' }).summary;
    const r = ranked(s);
    return [name, `${r[0][0]} ${pc(r[0][1].winRate)}`, s.winnerVotes, pc(s.winnerShareFraction.median), pc(s.investedFraction), s.founded.meanCount, pc(s.founded.threeByRound10), pc(s.classIIIGames), s.medianCoinsByRound.at(-1)!, pc(s.imports.shareOfUnitsBought), pc(s.imports.brickLockGames), s.round0 ? s.round0.winRateByPick.map(pc).join(' / ') : 'n/a'];
  });
  P(table(['Variant', 'Top bot (win rate)', "Winner's votes", 'Shares in them', 'Goods invested', 'Projects founded', 'Three by round 10', 'Class III reached', 'Median final coins', 'Imports, share of units bought', 'Matches with a brick lock', 'Win rate by round-0 pick order'], vr));
  P('A brick lock is a round in which no player holds a brick and the brick stall is empty, so nobody can build. Round-0 scripted bots bid zero, so pick order there is the priority marker; only the searching bot bids. The price-formula variant and plots open to player building are not in this table: the formula is not given in the design doc, and the bots do not yet know how to use an open plot (the engine supports it).');

  return out.join('\n');
}
