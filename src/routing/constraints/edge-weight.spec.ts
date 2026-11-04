import type { Edge, VehicleProfile } from '../../domain/graph.types.js';
import { shortestPath } from '../algorithm/dijkstra.js';
import { parseDepartureTime } from './departure-time.js';
import { canTraverse, createEdgeWeight } from './edge-weight.js';

function edge(
  from: string,
  to: string,
  cost: number,
  extra: Partial<Edge> = {},
): Edge {
  return { from, to, cost, noHazardous: false, trafficMultiplier: 1, ...extra };
}

function vehicle(weight: number, hazardous = false): VehicleProfile {
  return { type: 'truck', weight, hazardous };
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
  edge('C', 'D', 5, { maxWeight: 5000, noHazardous: true }),
  edge('D', 'E', 10, { maxWeight: 8000, trafficMultiplier: 1.2 }),
];

function route(v: VehicleProfile, departure: string, edges = README_GRAPH) {
  return shortestPath(
    edges,
    'A',
    'E',
    createEdgeWeight(v, parseDepartureTime(departure)),
  );
}

describe('canTraverse', () => {
  it('allows a vehicle exactly at maxWeight', () => {
    expect(
      canTraverse(edge('A', 'B', 1, { maxWeight: 5000 }), vehicle(5000)),
    ).toBe(true);
  });

  it('blocks a vehicle over maxWeight', () => {
    expect(
      canTraverse(edge('A', 'B', 1, { maxWeight: 5000 }), vehicle(5001)),
    ).toBe(false);
  });

  it('has no weight limit when maxWeight is not set', () => {
    expect(canTraverse(edge('A', 'B', 1), vehicle(1_000_000))).toBe(true);
  });

  it('blocks a hazardous vehicle on a noHazardous edge', () => {
    expect(
      canTraverse(edge('A', 'B', 1, { noHazardous: true }), vehicle(1, true)),
    ).toBe(false);
  });

  it('allows a hazardous vehicle on other edges', () => {
    expect(canTraverse(edge('A', 'B', 1), vehicle(1, true))).toBe(true);
  });

  it('allows a non-hazardous vehicle on a noHazardous edge', () => {
    expect(
      canTraverse(edge('A', 'B', 1, { noHazardous: true }), vehicle(1)),
    ).toBe(true);
  });
});

describe('createEdgeWeight', () => {
  it('uses the base cost off-peak', () => {
    const weight = createEdgeWeight(vehicle(1), parseDepartureTime('12:00'));

    expect(weight(edge('A', 'B', 10, { trafficMultiplier: 2 }))).toBe(10);
  });

  it('applies trafficMultiplier during peak hours', () => {
    const weight = createEdgeWeight(vehicle(1), parseDepartureTime('08:00'));

    expect(weight(edge('A', 'B', 10, { trafficMultiplier: 2 }))).toBe(20);
  });

  it('skips edges the vehicle cannot use, even at peak', () => {
    const weight = createEdgeWeight(vehicle(6000), parseDepartureTime('08:00'));

    expect(weight(edge('A', 'B', 10, { maxWeight: 5000 }))).toBeUndefined();
  });
});

describe('README validation cases', () => {
  it('Test Case 1: light van takes A -> C -> D -> E (cost 30)', () => {
    expect(
      route({ type: 'van', weight: 3000, hazardous: false }, '12:00'),
    ).toEqual({
      path: ['A', 'C', 'D', 'E'],
      totalCost: 30,
    });
  });

  it('Test Case 2: 6000kg truck is forced through B (cost 32)', () => {
    expect(route(vehicle(6000), '12:00')).toEqual({
      path: ['A', 'B', 'D', 'E'],
      totalCost: 32,
    });
  });

  it('Test Case 3: hazardous truck avoids noHazardous edges (cost 32)', () => {
    expect(route(vehicle(3000, true), '12:00')).toEqual({
      path: ['A', 'B', 'D', 'E'],
      totalCost: 32,
    });
  });

  it('peak hours raise the cost: 08:00 gives 22.5 + 5 + 12 = 39.5', () => {
    expect(route(vehicle(3000), '08:00')).toEqual({
      path: ['A', 'C', 'D', 'E'],
      totalCost: 39.5,
    });
  });

  it('returns null when the vehicle is over every limit on the way to E', () => {
    expect(route(vehicle(9000), '12:00')).toBeNull();
  });
});

describe('peak hours can change the route', () => {
  // Off-peak via B is cheaper (10 vs 12); at peak B doubles to 20.
  const edges = [
    edge('A', 'B', 10, { trafficMultiplier: 2 }),
    edge('A', 'C', 12),
    edge('B', 'E', 0),
    edge('C', 'E', 0),
  ];

  it.each([
    ['06:59', ['A', 'B', 'E'], 10],
    ['07:00', ['A', 'C', 'E'], 12],
    ['08:59', ['A', 'C', 'E'], 12],
    ['09:00', ['A', 'B', 'E'], 10],
    ['17:00', ['A', 'C', 'E'], 12],
    ['19:00', ['A', 'B', 'E'], 10],
  ])('departing %p takes %p', (departure, path, totalCost) => {
    expect(route(vehicle(1), departure, edges)).toEqual({ path, totalCost });
  });
});
