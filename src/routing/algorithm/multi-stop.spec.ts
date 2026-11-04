import type { Edge } from '../../domain/graph.types.js';
import { parseDepartureTime } from '../constraints/departure-time.js';
import { createEdgeWeight } from '../constraints/edge-weight.js';
import { shortestPath } from './dijkstra.js';
import { multiStopPath } from './multi-stop.js';

function edge(
  from: string,
  to: string,
  cost: number,
  extra: Partial<Edge> = {},
): Edge {
  return { from, to, cost, noHazardous: false, trafficMultiplier: 1, ...extra };
}

/** Validation graph from instructions.md. */
const README_GRAPH: Edge[] = [
  edge('A', 'B', 10, { maxWeight: 10000 }),
  edge('A', 'C', 15, {
    maxWeight: 5000,
    noHazardous: true,
    trafficMultiplier: 1.5,
  }),
  edge('B', 'D', 12, { maxWeight: 10000, trafficMultiplier: 2.0 }),
  edge('C', 'D', 5, { maxWeight: 5000, noHazardous: true }),
  edge('D', 'E', 10, { maxWeight: 8000, trafficMultiplier: 1.2 }),
];

describe('multiStopPath', () => {
  it('matches shortestPath when there are no waypoints', () => {
    const result = multiStopPath(README_GRAPH, ['A', 'E']);

    expect(result).toEqual({
      found: true,
      path: ['A', 'C', 'D', 'E'],
      totalCost: 30,
      legs: [{ from: 'A', to: 'E', path: ['A', 'C', 'D', 'E'], cost: 30 }],
    });
  });

  it('goes through a waypoint even when a cheaper route skips it', () => {
    const result = multiStopPath(README_GRAPH, ['A', 'B', 'E']);

    expect(result).toEqual({
      found: true,
      path: ['A', 'B', 'D', 'E'],
      totalCost: 32,
      legs: [
        { from: 'A', to: 'B', path: ['A', 'B'], cost: 10 },
        { from: 'B', to: 'E', path: ['B', 'D', 'E'], cost: 22 },
      ],
    });
  });

  it('visits waypoints in the given order', () => {
    const edges = [
      edge('A', 'B', 1),
      edge('B', 'A', 1),
      edge('A', 'C', 1),
      edge('C', 'A', 1),
      edge('A', 'D', 1),
    ];

    const bc = multiStopPath(edges, ['A', 'B', 'C', 'D']);
    const cb = multiStopPath(edges, ['A', 'C', 'B', 'D']);

    expect(bc).toMatchObject({
      path: ['A', 'B', 'A', 'C', 'A', 'D'],
      totalCost: 5,
    });
    expect(cb).toMatchObject({
      path: ['A', 'C', 'A', 'B', 'A', 'D'],
      totalCost: 5,
    });
  });

  it('reports the first leg with no route', () => {
    // C -> B has no route: edges are directed.
    expect(multiStopPath(README_GRAPH, ['A', 'C', 'B', 'E'])).toEqual({
      found: false,
      failedLeg: { index: 1, from: 'C', to: 'B' },
    });
  });

  it('applies the edge weight to every leg', () => {
    const truck = createEdgeWeight(
      { type: 'truck', weight: 6000, hazardous: false },
      parseDepartureTime('12:00'),
    );

    // The truck can't use A -> C, so the first leg fails.
    expect(multiStopPath(README_GRAPH, ['A', 'C', 'E'], truck)).toEqual({
      found: false,
      failedLeg: { index: 0, from: 'A', to: 'C' },
    });
  });

  it('applies peak costs on every leg', () => {
    const peak = createEdgeWeight(
      { type: 'van', weight: 1000, hazardous: false },
      parseDepartureTime('08:00'),
    );

    // A->B 10, then B->D 12*2 + D->E 10*1.2 = 36
    expect(multiStopPath(README_GRAPH, ['A', 'B', 'E'], peak)).toMatchObject({
      path: ['A', 'B', 'D', 'E'],
      totalCost: 46,
    });
  });

  it('handles a waypoint equal to the origin or repeated', () => {
    expect(
      multiStopPath(README_GRAPH, ['A', 'A', 'B', 'B', 'E']),
    ).toMatchObject({
      found: true,
      path: ['A', 'B', 'D', 'E'],
      totalCost: 32,
    });
  });

  it('handles origin equal to destination', () => {
    expect(multiStopPath(README_GRAPH, ['D', 'D'])).toMatchObject({
      found: true,
      path: ['D'],
      totalCost: 0,
    });
  });

  it.each([[[]], [['A']]])('throws for fewer than 2 stops: %p', (stops) => {
    expect(() => multiStopPath(README_GRAPH, stops)).toThrow(RangeError);
  });

  it('costs the same as the sum of separate shortest paths', () => {
    const edges = [
      edge('A', 'B', 3),
      edge('B', 'C', 4),
      edge('C', 'A', 2),
      edge('A', 'C', 9),
      edge('C', 'D', 1),
      edge('D', 'B', 6),
      edge('B', 'D', 8),
    ];
    const stops = ['A', 'D', 'A', 'C', 'B'];
    const result = multiStopPath(edges, stops);

    let expected = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      expected += shortestPath(edges, stops[i], stops[i + 1])!.totalCost;
    }
    expect(result.found && result.totalCost).toBe(expected);
    expect(result.found && result.legs.map((leg) => leg.cost)).toEqual([
      8, 12, 7, 5,
    ]);
  });
});
