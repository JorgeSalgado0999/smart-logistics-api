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
    expect(planRoute(README_GRAPH, request({ waypoints: ['C', 'B'] }))).toEqual(
      {
        ok: false,
        error: {
          code: 'UNREACHABLE',
          message: 'No route from C to B (leg 2 of 3)',
        },
      },
    );
  });

  it('returns UNREACHABLE when constraints block every route', () => {
    const plan = planRoute(
      README_GRAPH,
      request({ vehicle: { type: 'truck', weight: 9000, hazardous: false } }),
    );

    expect(plan).toEqual({
      ok: false,
      error: {
        code: 'UNREACHABLE',
        message: 'No route from A to E (leg 1 of 1)',
      },
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
