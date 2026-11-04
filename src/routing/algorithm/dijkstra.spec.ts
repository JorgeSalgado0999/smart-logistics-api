import type { Edge } from '../../domain/graph.types.js';
import { shortestPath, type EdgeWeight } from './dijkstra.js';

function edge(
  from: string,
  to: string,
  cost: number,
  extra: Partial<Edge> = {},
): Edge {
  return { from, to, cost, noHazardous: false, trafficMultiplier: 1, ...extra };
}

/** Both directions, for undirected example graphs. */
function both(from: string, to: string, cost: number): Edge[] {
  return [edge(from, to, cost), edge(to, from, cost)];
}

/** Validation graph from instructions.md. */
const README_GRAPH: Edge[] = [
  edge('A', 'B', 10, { maxWeight: 10000, trafficMultiplier: 1.0 }),
  edge('A', 'C', 15, {
    maxWeight: 5000,
    noHazardous: true,
    trafficMultiplier: 1.5,
  }),
  edge('B', 'D', 12, { maxWeight: 10000, trafficMultiplier: 2.0 }),
  edge('C', 'D', 5, {
    maxWeight: 5000,
    noHazardous: true,
    trafficMultiplier: 1.0,
  }),
  edge('D', 'E', 10, { maxWeight: 8000, trafficMultiplier: 1.2 }),
];

/** Sum of the cheapest edge for each step of a path. */
function pathCost(edges: readonly Edge[], path: string[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const costs = edges
      .filter((e) => e.from === path[i - 1] && e.to === path[i])
      .map((e) => e.cost);
    expect(costs.length).toBeGreaterThan(0);
    total += Math.min(...costs);
  }
  return total;
}

describe('shortestPath', () => {
  it('solves the graph from docs/resources/dijkstras-image.jpeg', () => {
    const edges = [
      ...both('1', '2', 8),
      ...both('1', '3', 5),
      ...both('2', '4', 2),
      ...both('3', '4', 12),
      ...both('4', '5', 4),
      ...both('4', '6', 9),
      ...both('5', '6', 4),
    ];

    expect(shortestPath(edges, '1', '6')).toEqual({
      path: ['1', '2', '4', '5', '6'],
      totalCost: 18,
    });
  });

  it('solves the README graph with base costs', () => {
    expect(shortestPath(README_GRAPH, 'A', 'E')).toEqual({
      path: ['A', 'C', 'D', 'E'],
      totalCost: 30,
    });
  });

  it('respects edge direction', () => {
    expect(shortestPath(README_GRAPH, 'E', 'A')).toBeNull();
  });

  it('returns a zero-cost single-node path when origin is destination', () => {
    expect(shortestPath(README_GRAPH, 'B', 'B')).toEqual({
      path: ['B'],
      totalCost: 0,
    });
  });

  it('returns null for an unreachable isolated node', () => {
    const edges = [edge('A', 'B', 1), edge('Z', 'Z', 1)];

    expect(shortestPath(edges, 'A', 'Z')).toBeNull();
  });

  it('returns null when there are no edges', () => {
    expect(shortestPath([], 'A', 'B')).toBeNull();
  });

  it('handles cycles', () => {
    const edges = [
      edge('A', 'B', 1),
      edge('B', 'C', 1),
      edge('C', 'A', 1),
      edge('C', 'D', 1),
    ];

    expect(shortestPath(edges, 'A', 'D')).toEqual({
      path: ['A', 'B', 'C', 'D'],
      totalCost: 3,
    });
  });

  it('handles zero-cost edges', () => {
    const edges = [edge('A', 'B', 0), edge('B', 'C', 0), edge('A', 'C', 1)];

    expect(shortestPath(edges, 'A', 'C')).toEqual({
      path: ['A', 'B', 'C'],
      totalCost: 0,
    });
  });

  it('ignores self-loops', () => {
    const edges = [edge('A', 'A', 0), edge('A', 'B', 4)];

    expect(shortestPath(edges, 'A', 'B')).toEqual({
      path: ['A', 'B'],
      totalCost: 4,
    });
  });

  it('uses the cheaper of duplicate edges', () => {
    const edges = [edge('A', 'B', 9), edge('A', 'B', 2), edge('A', 'B', 5)];

    expect(shortestPath(edges, 'A', 'B')).toEqual({
      path: ['A', 'B'],
      totalCost: 2,
    });
  });

  it('prefers a cheaper multi-hop route over a direct edge', () => {
    const edges = [
      edge('A', 'D', 10),
      edge('A', 'B', 1),
      edge('B', 'C', 1),
      edge('C', 'D', 1),
    ];

    expect(shortestPath(edges, 'A', 'D')?.path).toEqual(['A', 'B', 'C', 'D']);
  });

  it('returns the same path for equal-cost routes on every run', () => {
    const edges = [
      edge('A', 'B', 1),
      edge('A', 'C', 1),
      edge('B', 'D', 1),
      edge('C', 'D', 1),
    ];
    const first = shortestPath(edges, 'A', 'D');

    expect(first?.totalCost).toBe(2);
    for (let i = 0; i < 20; i++)
      expect(shortestPath(edges, 'A', 'D')).toEqual(first);
  });

  describe('weight callback', () => {
    it('skips edges the callback rejects', () => {
      const noAtoC: EdgeWeight = (e) =>
        e.from === 'A' && e.to === 'C' ? undefined : e.cost;

      expect(shortestPath(README_GRAPH, 'A', 'E', noAtoC)).toEqual({
        path: ['A', 'B', 'D', 'E'],
        totalCost: 32,
      });
    });

    it('returns null when every route is rejected', () => {
      const noIntoD: EdgeWeight = (e) => (e.to === 'D' ? undefined : e.cost);

      expect(shortestPath(README_GRAPH, 'A', 'E', noIntoD)).toBeNull();
    });

    it('uses the costs the callback returns', () => {
      const withMultiplier: EdgeWeight = (e) => e.cost * e.trafficMultiplier;

      // A->C->D->E = 22.5 + 5 + 12 = 39.5, A->B->D->E = 10 + 24 + 12 = 46
      expect(shortestPath(README_GRAPH, 'A', 'E', withMultiplier)).toEqual({
        path: ['A', 'C', 'D', 'E'],
        totalCost: 39.5,
      });
    });

    it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
      'throws for an invalid weight %p',
      (bad) => {
        expect(() => shortestPath(README_GRAPH, 'A', 'E', () => bad)).toThrow(
          RangeError,
        );
      },
    );
  });

  describe('against Bellman-Ford on random graphs', () => {
    /** Small seeded PRNG (mulberry32) so failures can be reproduced. */
    function rng(seed: number): () => number {
      let a = seed;
      return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    function bellmanFord(
      edges: readonly Edge[],
      nodes: string[],
      origin: string,
    ) {
      const dist = new Map(nodes.map((n) => [n, Number.POSITIVE_INFINITY]));
      dist.set(origin, 0);
      for (let i = 0; i < nodes.length - 1; i++) {
        for (const e of edges) {
          const via = dist.get(e.from)! + e.cost;
          if (via < dist.get(e.to)!) dist.set(e.to, via);
        }
      }
      return dist;
    }

    it('matches costs and returns valid paths on 200 seeded graphs', () => {
      for (let seed = 1; seed <= 200; seed++) {
        const random = rng(seed);
        const nodeCount = 2 + Math.floor(random() * 15);
        const nodes = Array.from({ length: nodeCount }, (_, i) => `N${i}`);
        const edgeCount = Math.floor(random() * nodeCount * 3);
        const edges = Array.from({ length: edgeCount }, () =>
          edge(
            nodes[Math.floor(random() * nodeCount)],
            nodes[Math.floor(random() * nodeCount)],
            Math.floor(random() * 20),
          ),
        );
        const origin = nodes[0];
        const expected = bellmanFord(edges, nodes, origin);

        for (const destination of nodes) {
          const result = shortestPath(edges, origin, destination);
          const want = expected.get(destination)!;

          if (want === Number.POSITIVE_INFINITY) {
            expect(result).toBeNull();
            continue;
          }
          expect(result).not.toBeNull();
          expect(result!.totalCost).toBe(want);
          expect(result!.path[0]).toBe(origin);
          expect(result!.path.at(-1)).toBe(destination);
          expect(pathCost(edges, result!.path)).toBe(want);
        }
      }
    });
  });
});
