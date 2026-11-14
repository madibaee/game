#!/usr/bin/env node
/**
 * Command line for the economy simulator.
 *
 *   node src/cli.ts run    --players 4 --games 300 --bots mixed
 *   node src/cli.ts match  --seed 7 --bots founder,workshop,adaptive,raw
 *   node src/cli.ts report --games 300 --out reports/v0.4.md
 *   node src/cli.ts sweep  --grid grids/example.json --games 100 --out reports/sweep.csv
 *
 * Common flags: --preset v0.4 | v0.5 | v0.5-short, --config overrides.json, --set path=value (repeatable).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { runBatch } from './batch.ts';
import { makeBot } from './bots/index.ts';
import { GOODS, PRESETS, preset } from './config.ts';
import { runMatch } from './match.ts';
import { buildReport } from './report.ts';

function parseArgs(argv: string[]) {
  const flags: Record<string, string> = {};
  const sets: Record<string, unknown> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    if (key === 'set') {
      const eq = value.indexOf('=');
      if (eq < 0) throw new Error('--set needs path=value');
      const raw = value.slice(eq + 1);
      let parsed: unknown = raw;
      try { parsed = JSON.parse(raw); } catch { /* keep as string */ }
      sets[value.slice(0, eq)] = parsed;
    } else flags[key] = value;
  }
  return { flags, sets };
}

const [command, ...rest] = process.argv.slice(2);
const { flags, sets } = parseArgs(rest);
const presetName = flags.preset ?? 'v0.4';
const overrides: Record<string, unknown> = { ...(flags.config ? JSON.parse(readFileSync(flags.config, 'utf8')) : {}), ...sets };
const players = Number(flags.players ?? overrides.players ?? 4);
const games = Number(flags.games ?? 200);
const seed = Number(flags.seed ?? 1);
const lineup = !flags.bots || flags.bots === 'mixed' ? ('mixed' as const) : flags.bots.split(',');

switch (command) {
  case 'run': {
    const cfg = preset(presetName, { ...overrides, players });
    const { summary } = runBatch({ cfg, games, seed, lineup, audit: flags.audit !== 'false' });
    if (flags.json) console.log(JSON.stringify(summary, null, 2));
    else {
      console.log(`${games} matches, ${players} players, preset ${presetName}`);
      console.table(Object.fromEntries(Object.entries(summary.bots).sort((a, b) => b[1].winRate - a[1].winRate)));
      const { bots, ...others } = summary;
      console.log(JSON.stringify(others, null, 1).replace(/\n\s+(?=[\d"\]\-}])/g, ' '));
    }
    break;
  }
  case 'match': {
    const cfg = preset(presetName, { ...overrides, players: lineup === 'mixed' ? players : lineup.length });
    const names = lineup === 'mixed' ? ['founder', 'workshop', 'adaptive', 'raw'].slice(0, players) : lineup;
    const g = (xs: number[]) => xs.map((x, i) => (x ? `${x} ${GOODS[i]}` : '')).filter(Boolean).join(', ') || 'nothing';
    const res = runMatch(cfg, seed, names.map(makeBot), {
      audit: true,
      onRound: (s, events) => {
        console.log(`\n== Round ${s.round - 1}`);
        for (const e of events) {
          if (e.t === 'coin' || e.t === 'good' || e.t === 'phase' || e.t === 'production' || e.t === 'roundEnd') continue;
          const { t, p, ...restOf } = e;
          console.log(`  ${p !== undefined ? `${names[p]}(${p}) ` : ''}${t} ${JSON.stringify(restOf)}`);
        }
        s.players.forEach((pl, p) => console.log(`  ${names[p]}(${p}): ${pl.coins} coins, ${pl.bonds} bonds, holds ${g(pl.goods)}`));
        console.log(`  stalls: ${s.stalls.map((x, i) => `${GOODS[i]} ${x}`).join(', ')}; fund ${s.fund}`);
        console.log(`  districts: ${s.districts.map((d) => `${d.type} ${'I'.repeat(d.cls)} [${d.shares.join('/')}]`).join(', ')}`);
        console.log(`  projects: ${s.projects.map((q) => `${q.type} needs ${g(q.need)}`).join('; ') || 'none'}`);
      },
    });
    console.log('\n== Election');
    res.scores.forEach((sc, p) => console.log(`  ${names[p]}(${p}): ${sc.total} votes = shares ${sc.shares} + buildings ${sc.buildings} + cash ${sc.cash} + bonds ${sc.bonds}${res.winners.includes(p) ? '  <- mayor' : ''}`));
    break;
  }
  case 'report': {
    const md = buildReport({ preset: presetName, overrides, games, seed, searchGames: Number(flags['search-games'] ?? 40), log: (m) => console.error(`... ${m}`) });
    if (flags.out) { writeFileSync(flags.out, md + '\n'); console.error(`wrote ${flags.out}`); } else console.log(md);
    break;
  }
  case 'sweep': {
    // Grid file: { "cost.raw.coins": [10, 14], "start.coins": [12, 18], ... }. Full grid, every combination.
    const grid: Record<string, unknown[]> = JSON.parse(readFileSync(flags.grid, 'utf8'));
    const keys = Object.keys(grid);
    const counts = (flags.players ?? '2,3,4').split(',').map(Number);
    const combos: Record<string, unknown>[] = keys.reduce<Record<string, unknown>[]>((acc, k) => acc.flatMap((c) => grid[k].map((v) => ({ ...c, [k]: v }))), [{}]);
    const cols = ['players', 'topBot', 'topWinRate', 'medianGapToSecond', 'founderBeatsFreerider', 'winnerShareFraction', 'investedFraction', 'fourByRound15', 'worstStall', 'coinsRound6', 'coinsFinal', 'bondsPerSeat', 'bondRound1', 'unservedDistrictRounds'];
    const lines = [[...keys, ...cols].join(',')];
    console.error(`${combos.length} combinations x ${counts.length} player counts x ${games} matches`);
    for (const combo of combos) {
      for (const n of counts) {
        const s = runBatch({ cfg: preset(presetName, { ...overrides, ...combo, players: n }), games, seed, lineup }).summary;
        const r = Object.entries(s.bots).sort((a, b) => b[1].medianVotes - a[1].medianVotes);
        const top = Object.entries(s.bots).sort((a, b) => b[1].winRate - a[1].winRate)[0];
        const row = [n, top[0], top[1].winRate, r[1] && r[1][1].medianVotes ? +(r[0][1].medianVotes / r[1][1].medianVotes - 1).toFixed(3) : '', s.founderBeatsFreerider?.rate ?? '', s.winnerShareFraction.median, s.investedFraction, s.founded.fourByRound15,
          Math.max(...Object.values(s.stallEmpty), ...Object.values(s.stallFull)), s.medianCoinsByRound[5] ?? '', s.medianCoinsByRound.at(-1), s.bonds.perPlayerGame, s.bonds.takenRound1, s.unservedDistrictRounds];
        lines.push([...keys.map((k) => JSON.stringify(combo[k]).replaceAll(',', ';')), ...row].join(','));
      }
    }
    const csv = lines.join('\n') + '\n';
    if (flags.out) { writeFileSync(flags.out, csv); console.error(`wrote ${flags.out}`); } else process.stdout.write(csv);
    break;
  }
  default:
    console.log(`Usage: node src/cli.ts <run|match|report|sweep> [flags]\nPresets: ${Object.keys(PRESETS).join(', ')}\nSee README.md.`);
}
