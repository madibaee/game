import type { Config, Terrain } from './config.ts';
import { TERRAINS } from './config.ts';
import type { Rng } from './rng.ts';

/** Owner id of the city's own links (plot to core), which everyone uses free. */
export const CITY = 99;

export type NodeKind = 'core' | 'plot' | 'site';
export interface BoardNode { id: number; kind: NodeKind; x: number; y: number; terrain: Terrain | null }
export interface Board {
  nodes: BoardNode[];
  /** Candidate links for this match. A link is built on one of these or not at all. */
  edges: [number, number][];
  adj: { to: number; edge: number }[][];
  core: number;
  plots: number[];
  sites: number[];
  /** The starting works on offer: one per terrain, at equal distance from the core (four at every player count). */
  startSites: number[];
}

/**
 * Board of §4: one core, a ring of district plots, an outer ring of production sites.
 * Positions are fixed. Terrain is shuffled and the candidate link set is drawn from a pool.
 * Guarantees: every node can reach the core, non-core nodes have min..max candidate links,
 * and no single candidate link is the only way in for more than one starting site.
 */
export function generateBoard(cfg: Config, rng: Rng): Board {
  const P = cfg.board.plots;
  const S = cfg.board.sitesPerTerrain * TERRAINS.length;
  const core = 0;
  const plots = Array.from({ length: P }, (_, i) => 1 + i);
  const sites = Array.from({ length: S }, (_, j) => 1 + P + j);

  const nodes: BoardNode[] = [{ id: 0, kind: 'core', x: 0, y: 0, terrain: null }];
  const plotAngle = (i: number) => (i * 2 * Math.PI) / P;
  const siteAngle = (j: number) => ((j + 0.5) * 2 * Math.PI) / S;
  for (let i = 0; i < P; i++) nodes.push({ id: plots[i], kind: 'plot', x: 0.45 * Math.cos(plotAngle(i)), y: 0.45 * Math.sin(plotAngle(i)), terrain: null });
  for (let j = 0; j < S; j++) nodes.push({ id: sites[j], kind: 'site', x: Math.cos(siteAngle(j)), y: Math.sin(siteAngle(j)), terrain: null });

  const angDist = (a: number, b: number) => {
    const d = Math.abs(a - b) % (2 * Math.PI);
    return Math.min(d, 2 * Math.PI - d);
  };
  /** Plots ordered by closeness to site j. */
  const nearestPlots = (j: number) => plots.map((_, i) => i).sort((a, b) => angDist(plotAngle(a), siteAngle(j)) - angDist(plotAngle(b), siteAngle(j)));

  const pool = cfg.board.linkPool;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const relax = attempt >= 1500; // never fail outright on odd configs
    const edges: [number, number][] = [];
    for (let i = 0; i < P; i++) edges.push([core, plots[i]]);
    for (let i = 0; i < P; i++) if (rng.next() < pool.plotRing) edges.push([plots[i], plots[(i + 1) % P]]);
    for (let j = 0; j < S; j++) {
      const near = nearestPlots(j);
      edges.push([plots[near[0]], sites[j]]);
      if (rng.next() < pool.siteSecondPlot) edges.push([plots[near[1]], sites[j]]);
      if (rng.next() < pool.siteRing) edges.push([sites[j], sites[(j + 1) % S]]);
    }
    const adj = buildAdj(nodes.length, edges);
    if (!relax) {
      let ok = true;
      for (let v = 1; v < nodes.length; v++) {
        if (adj[v].length < cfg.board.minLinksPerSite || adj[v].length > cfg.board.maxLinksPerSite) { ok = false; break; }
      }
      if (!ok) continue;
    }

    // Starting sites: spread evenly round the outer ring, each hanging off a different plot.
    const n = TERRAINS.length;
    const rot = rng.int(S);
    const startIdx = Array.from({ length: n }, (_, k) => (rot + Math.round((k * S) / n)) % S);
    const startPlots = new Set(startIdx.map((j) => nearestPlots(j)[0]));
    if (startPlots.size < n && !relax) continue;
    const startSites = startIdx.map((j) => sites[j]);

    if (!relax && !bridgeRuleHolds(nodes.length, edges, core, startSites)) continue;

    // Terrain shuffle; starting works sit on different terrains (as far as there are terrains).
    let terrain: Terrain[] = [];
    for (let t = 0; t < 200; t++) {
      terrain = rng.shuffle(TERRAINS.flatMap((x) => Array.from({ length: cfg.board.sitesPerTerrain }, () => x)));
      const starts = startIdx.map((j) => terrain[j]);
      if (new Set(starts).size === n) break;
    }
    for (let j = 0; j < S; j++) nodes[sites[j]].terrain = terrain[j];

    return { nodes, edges, adj, core, plots, sites, startSites };
  }
  throw new Error('Could not generate a board for this config');
}

function buildAdj(n: number, edges: [number, number][]) {
  const adj: { to: number; edge: number }[][] = Array.from({ length: n }, () => []);
  edges.forEach(([a, b], e) => {
    adj[a].push({ to: b, edge: e });
    adj[b].push({ to: a, edge: e });
  });
  return adj;
}

function bridgeRuleHolds(n: number, edges: [number, number][], core: number, starts: number[]): boolean {
  for (let skip = 0; skip < edges.length; skip++) {
    const adj = buildAdj(n, edges.filter((_, e) => e !== skip));
    const seen = new Uint8Array(n);
    const stack = [core];
    seen[core] = 1;
    while (stack.length) {
      const v = stack.pop()!;
      for (const { to } of adj[v]) if (!seen[to]) { seen[to] = 1; stack.push(to); }
    }
    if (starts.filter((s) => !seen[s]).length > 1) return false;
  }
  return true;
}

export interface Path { cost: number; edges: number[] }

/**
 * Cheapest path over candidate edges. `weight(edge)` returns the cost of crossing an edge,
 * or Infinity if it cannot be used. Ties resolve deterministically by node order.
 */
export function shortestPath(board: Board, from: number, to: number, weight: (edge: number) => number): Path | null {
  const n = board.nodes.length;
  if (from === to) return { cost: 0, edges: [] };
  const dist = new Array<number>(n).fill(Infinity);
  const hops = new Array<number>(n).fill(Infinity);
  const prevEdge = new Array<number>(n).fill(-1);
  const prevNode = new Array<number>(n).fill(-1);
  const done = new Uint8Array(n);
  dist[from] = 0;
  hops[from] = 0;
  for (;;) {
    let v = -1;
    for (let i = 0; i < n; i++) {
      if (done[i] || dist[i] === Infinity) continue;
      if (v < 0 || dist[i] < dist[v] || (dist[i] === dist[v] && hops[i] < hops[v])) v = i;
    }
    if (v < 0) return null;
    if (v === to) break;
    done[v] = 1;
    for (const { to: u, edge } of board.adj[v]) {
      const w = weight(edge);
      if (w === Infinity) continue;
      const d = dist[v] + w;
      if (d < dist[u] || (d === dist[u] && hops[v] + 1 < hops[u])) {
        dist[u] = d;
        hops[u] = hops[v] + 1;
        prevEdge[u] = edge;
        prevNode[u] = v;
      }
    }
  }
  const path: number[] = [];
  for (let v = to; v !== from; v = prevNode[v]) path.push(prevEdge[v]);
  path.reverse();
  return { cost: dist[to], edges: path };
}

/**
 * Route for one player's goods over built links (§6.5). Own links are free, a rival's link
 * costs the toll unless already paid this round. Returns null when no built path exists.
 */
export function shippingRoute(board: Board, links: number[], player: number, from: number, to: number, toll: number, paid?: Set<number>): Path | null {
  return shortestPath(board, from, to, (e) => {
    const owner = links[e];
    if (owner < 0) return Infinity;
    if (owner === player || owner === CITY || paid?.has(e)) return 0;
    return toll;
  });
}
