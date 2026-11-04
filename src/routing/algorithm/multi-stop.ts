import type { Edge } from '../../domain/graph.types.js';
import { type EdgeWeight, shortestPath } from './dijkstra.js';

export interface Leg {
  readonly from: string;
  readonly to: string;
  readonly path: string[];
  readonly cost: number;
}

export type MultiStopResult =
  | {
      readonly found: true;
      /** Full route; nodes shared by consecutive legs appear once. */
      readonly path: string[];
      readonly totalCost: number;
      readonly legs: Leg[];
    }
  | {
      readonly found: false;
      /** First leg with no route. Later legs are not computed. */
      readonly failedLeg: {
        readonly index: number;
        readonly from: string;
        readonly to: string;
      };
    };

/**
 * Cheapest route visiting `stops` in the given order: origin, waypoints...,
 * destination. Each leg is solved with Dijkstra, so the route is optimal for
 * that fixed order. Nodes may repeat across legs (e.g. A -> B -> A).
 */
export function multiStopPath(
  edges: readonly Edge[],
  stops: readonly string[],
  weight?: EdgeWeight,
): MultiStopResult {
  if (stops.length < 2) {
    throw new RangeError(
      `A route needs an origin and a destination (got ${stops.length} stop(s))`,
    );
  }

  const legs: Leg[] = [];
  for (let index = 0; index < stops.length - 1; index++) {
    const from = stops[index];
    const to = stops[index + 1];
    const result = shortestPath(edges, from, to, weight);
    if (!result) {
      return { found: false, failedLeg: { index, from, to } };
    }
    legs.push({ from, to, path: result.path, cost: result.totalCost });
  }

  const path = [...legs[0].path];
  for (const leg of legs.slice(1)) path.push(...leg.path.slice(1));
  const totalCost = legs.reduce((sum, leg) => sum + leg.cost, 0);

  return { found: true, path, totalCost, legs };
}
