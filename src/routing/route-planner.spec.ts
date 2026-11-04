import type { Edge, Graph } from '../domain/graph.types.js';
import { planRoute, roundCost, type RouteRequest } from './route-planner.js';

function edge(
  from: string,
  to: string,
  cost: number,
  extra: Partial<Edge> = {},
): Edge {
  return { from, to, cost, noHazardous: false, trafficMultiplier: 1, ...extra };
}

/** Validation graph from instructions.md. */
const README_GRAPH: Graph = {
  id: 'graph-1',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  nodes: ['A', 'B', 'C', 'D', 'E'].map((id) => ({ id })),
  edges: [
    edge('A', 'B', 10, { maxWeight: 10000 }),
    edge('A', 'C', 15, {
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.5,
    }),
    edge('B', 'D', 12, { maxWeight: 10000, trafficMultiplier: 2.0 }),
    edge('C', 'D', 5, { maxWeight: 5000, noHazardous: true }),
    edge('D', 'E', 10, { maxWeight: 8000, trafficMultiplier: 1.2 }),
  ],
};

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    originNodeId: 'A',
    destinationNodeId: 'E',
    waypoints: [],
    vehicle: { type: 'van', weight: 3000, hazardous: false },
    departureTime: '12:00',
    ...overrides,
  };
}

describe('planRoute', () => {
  it('README Test Case 1: standard path', () => {
    expect(planRoute(README_GRAPH, request())).toEqual({
      ok: true,
      result: {
        graphId: 'graph-1',
        totalCost: 30,
        path: ['A', 'C', 'D', 'E'],
        legs: [{ from: 'A', to: 'E', path: ['A', 'C', 'D', 'E'], cost: 30 }],
      },
    });
  });

  it('README Test Case 2: weight constraint', () => {
    const plan = planRoute(
      README_GRAPH,
      request({ vehicle: { type: 'truck', weight: 6000, hazardous: false } }),
    );

    expect(plan).toMatchObject({
      ok: true,
      result: { path: ['A', 'B', 'D', 'E'], totalCost: 32 },
    });
  });

  it('README Test Case 3: hazardous constraint', () => {
    const plan = planRoute(
      README_GRAPH,
      request({ vehicle: { type: 'truck', weight: 3000, hazardous: true } }),
    );

    expect(plan).toMatchObject({
      ok: true,
      result: { path: ['A', 'B', 'D', 'E'], totalCost: 32 },
    });
  });

  it('applies peak-hour multipliers', () => {
    expect(
      planRoute(README_GRAPH, request({ departureTime: '08:00' })),
    ).toMatchObject({
      ok: true,
      result: { path: ['A', 'C', 'D', 'E'], totalCost: 39.5 },
    });
  });

  it('visits waypoints in order', () => {
    expect(planRoute(README_GRAPH, request({ waypoints: ['B'] }))).toEqual({
      ok: true,
      result: {
        graphId: 'graph-1',
        totalCost: 32,
        path: ['A', 'B', 'D', 'E'],
        legs: [
          { from: 'A', to: 'B', path: ['A', 'B'], cost: 10 },
          { from: 'B', to: 'E', path: ['B', 'D', 'E'], cost: 22 },
        ],
      },
    });
  });

  it('returns UNREACHABLE naming the failed leg', () => {
    // C -> B has no route at all: edges are directed.
    expect(planRoute(README_GRAPH, request({ waypoints: ['C', 'B'] }))).toEqual(
      {
        ok: false,
        error: {
          code: 'UNREACHABLE',
          message: 'No route from C to B (leg 2 of 3)',
          failedLeg: { index: 1, from: 'C', to: 'B' },
        },
      },
    );
  });

  describe('INVALID_NODE', () => {
    it.each([
      ['origin', { originNodeId: 'X' }, ['X']],
      ['destination', { destinationNodeId: 'Z' }, ['Z']],
      ['waypoint', { waypoints: ['B', 'Q'] }, ['Q']],
      [
        'several, in request order without repeats',
        { originNodeId: 'X', waypoints: ['Y', 'X'], destinationNodeId: 'Y' },
        ['X', 'Y'],
      ],
      ['a case mismatch', { destinationNodeId: 'e' }, ['e']],
    ])('reports an unknown %s', (_name, overrides, unknownNodes) => {
      expect(planRoute(README_GRAPH, request(overrides))).toEqual({
        ok: false,
        error: {
          code: 'INVALID_NODE',
          message: `Unknown node(s): ${unknownNodes.join(', ')}`,
          unknownNodes,
        },
      });
    });

    it('is checked before routing, even when the route would also fail', () => {
      const plan = planRoute(
        README_GRAPH,
        request({ originNodeId: 'E', destinationNodeId: 'X' }),
      );

      expect(plan.ok || plan.error.code).toBe('INVALID_NODE');
    });
  });

  describe('CONSTRAINTS_BLOCK_ROUTE', () => {
    it('blames the weight limit for a vehicle too heavy for D -> E', () => {
      const plan = planRoute(
        README_GRAPH,
        request({ vehicle: { type: 'truck', weight: 9000, hazardous: false } }),
      );

      expect(plan).toEqual({
        ok: false,
        error: {
          code: 'CONSTRAINTS_BLOCK_ROUTE',
          message:
            "Vehicle can't reach E from A: blocked by weight limit (leg 1 of 1)",
          failedLeg: { index: 0, from: 'A', to: 'E' },
          blockedBy: ['WEIGHT'],
        },
      });
    });

    it('blames the hazardous restriction when only noHazardous edges lead on', () => {
      // A hazardous truck can't reach waypoint C: A -> C is noHazardous.
      const plan = planRoute(
        README_GRAPH,
        request({
          waypoints: ['C'],
          vehicle: { type: 'truck', weight: 3000, hazardous: true },
        }),
      );

      expect(plan).toEqual({
        ok: false,
        error: {
          code: 'CONSTRAINTS_BLOCK_ROUTE',
          message:
            "Vehicle can't reach C from A: blocked by hazardous materials restriction (leg 1 of 2)",
          failedLeg: { index: 0, from: 'A', to: 'C' },
          blockedBy: ['HAZARDOUS'],
        },
      });
    });

    it('lists both rules when the only edge breaks both', () => {
      // A -> C: maxWeight 5000 and noHazardous.
      const plan = planRoute(
        README_GRAPH,
        request({
          destinationNodeId: 'C',
          vehicle: { type: 'truck', weight: 6000, hazardous: true },
        }),
      );

      expect(plan.ok || plan.error).toMatchObject({
        code: 'CONSTRAINTS_BLOCK_ROUTE',
        blockedBy: ['WEIGHT', 'HAZARDOUS'],
        message:
          "Vehicle can't reach C from A: blocked by weight limit and hazardous materials restriction (leg 1 of 1)",
      });
    });

    it('lists both rules when each alone would open a different route', () => {
      const graph: Graph = {
        ...README_GRAPH,
        nodes: [{ id: 'S' }, { id: 'M' }, { id: 'N' }, { id: 'T' }],
        edges: [
          edge('S', 'M', 1, { maxWeight: 1000 }),
          edge('M', 'T', 1),
          edge('S', 'N', 1, { noHazardous: true }),
          edge('N', 'T', 1),
        ],
      };
      const plan = planRoute(graph, {
        ...request(),
        originNodeId: 'S',
        destinationNodeId: 'T',
        vehicle: { type: 'truck', weight: 5000, hazardous: true },
      });

      expect(plan.ok || plan.error).toMatchObject({
        code: 'CONSTRAINTS_BLOCK_ROUTE',
        blockedBy: ['WEIGHT', 'HAZARDOUS'],
      });
    });

    it('reports the later leg that fails', () => {
      // Leg A -> B is fine; B -> E needs D -> E (maxWeight 8000).
      const plan = planRoute(
        README_GRAPH,
        request({
          waypoints: ['B'],
          vehicle: { type: 'truck', weight: 9000, hazardous: false },
        }),
      );

      expect(plan.ok || plan.error).toMatchObject({
        code: 'CONSTRAINTS_BLOCK_ROUTE',
        failedLeg: { index: 1, from: 'B', to: 'E' },
        blockedBy: ['WEIGHT'],
      });
    });

    it('is never caused by peak hours', () => {
      const plan = planRoute(
        README_GRAPH,
        request({
          originNodeId: 'E',
          destinationNodeId: 'A',
          departureTime: '08:00',
        }),
      );

      expect(plan.ok || plan.error.code).toBe('UNREACHABLE');
    });
  });

  it('rounds float noise out of costs', () => {
    const graph: Graph = {
      ...README_GRAPH,
      edges: [edge('A', 'B', 0.1), edge('B', 'C', 0.2)],
    };
    const plan = planRoute(graph, request({ destinationNodeId: 'C' }));

    expect(plan.ok && plan.result.totalCost).toBe(0.3);
  });

  it('reports a totalCost equal to the sum of the rounded leg costs', () => {
    const graph: Graph = {
      ...README_GRAPH,
      edges: [edge('A', 'B', 0.0000004), edge('B', 'C', 0.0000004)],
    };
    const plan = planRoute(
      graph,
      request({ waypoints: ['B'], destinationNodeId: 'C' }),
    );

    if (!plan.ok) throw new Error('expected a route');
    expect(plan.result.legs.map((leg) => leg.cost)).toEqual([0, 0]);
    expect(plan.result.totalCost).toBe(0);
  });
});

describe('roundCost', () => {
  it.each([
    [0.1 + 0.2, 0.3],
    [39.5, 39.5],
    [1 / 3, 0.333333],
    [0, 0],
  ])('rounds %p to %p', (input, expected) => {
    expect(roundCost(input)).toBe(expected);
  });
});
