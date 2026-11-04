import type { Edge } from '../../domain/graph.types.js';
import { MinHeap } from './min-heap.js';

/**
 * Cost of travelling an edge, or undefined when the edge can't be used.
 * Must return a value >= 0.
 */
export type EdgeWeight = (edge: Edge) => number | undefined;

export interface PathResult {
  /** Node ids from origin to destination, both included. */
  readonly path: string[];
  readonly totalCost: number;
}

const baseCost: EdgeWeight = (edge) => edge.cost;

/**
 * Dijkstra's algorithm over directed edges. Returns the cheapest path from
 * origin to destination, or null when destination can't be reached.
 *
 * Runs in O((V + E) log E). A node gets a new heap entry each time a cheaper
 * route to it is found; stale entries are skipped when popped.
 */
export function shortestPath(
  edges: readonly Edge[],
  origin: string,
  destination: string,
  weight: EdgeWeight = baseCost,
): PathResult | null {
  if (origin === destination) {
    return { path: [origin], totalCost: 0 };
  }

  const adjacency = buildAdjacency(edges, weight);
  const best = new Map<string, number>([[origin, 0]]);
  const previous = new Map<string, string>();
  const settled = new Set<string>();
  const queue = new MinHeap<string>();
  queue.push(origin, 0);

  for (let entry = queue.pop(); entry; entry = queue.pop()) {
    const { value: node, priority: cost } = entry;
    if (settled.has(node)) continue;
    settled.add(node);

    if (node === destination) {
      return {
        path: rebuildPath(previous, origin, destination),
        totalCost: cost,
      };
    }

    for (const { to, cost: edgeCost } of adjacency.get(node) ?? []) {
      if (settled.has(to)) continue;
      const candidate = cost + edgeCost;
      const known = best.get(to);
      if (known === undefined || candidate < known) {
        best.set(to, candidate);
        previous.set(to, node);
        queue.push(to, candidate);
      }
    }
  }

  return null;
}

interface Arc {
  readonly to: string;
  readonly cost: number;
}

function buildAdjacency(
  edges: readonly Edge[],
  weight: EdgeWeight,
): Map<string, Arc[]> {
  const adjacency = new Map<string, Arc[]>();
  for (const edge of edges) {
    if (edge.from === edge.to) continue;
    const cost = weight(edge);
    if (cost === undefined) continue;
    if (!Number.isFinite(cost) || cost < 0) {
      throw new RangeError(
        `Edge ${edge.from}->${edge.to} has invalid weight ${cost}; Dijkstra needs finite weights >= 0`,
      );
    }

    const arcs = adjacency.get(edge.from);
    if (arcs) arcs.push({ to: edge.to, cost });
    else adjacency.set(edge.from, [{ to: edge.to, cost }]);
  }
  return adjacency;
}

function rebuildPath(
  previous: ReadonlyMap<string, string>,
  origin: string,
  destination: string,
): string[] {
  const path = [destination];
  for (let node = destination; node !== origin;) {
    node = previous.get(node)!;
    path.push(node);
  }
  return path.reverse();
}
