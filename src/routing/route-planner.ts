import type { Graph, VehicleProfile } from '../domain/graph.types.js';
import { multiStopPath } from './algorithm/multi-stop.js';
import { parseDepartureTime } from './constraints/departure-time.js';
import { createEdgeWeight } from './constraints/edge-weight.js';

/** A validated route request. */
export interface RouteRequest {
  readonly originNodeId: string;
  readonly destinationNodeId: string;
  /** Visited in this order, between origin and destination. */
  readonly waypoints: readonly string[];
  readonly vehicle: VehicleProfile;
  /** 24-hour "HH:MM". */
  readonly departureTime: string;
}

export interface RouteLeg {
  readonly from: string;
  readonly to: string;
  readonly path: string[];
  readonly cost: number;
}

export interface RouteResult {
  readonly graphId: string;
  readonly totalCost: number;
  readonly path: string[];
  readonly legs: RouteLeg[];
}

export type RouteErrorCode = 'UNREACHABLE';

export interface RouteError {
  readonly code: RouteErrorCode;
  readonly message: string;
}

export type RoutePlan =
  | { readonly ok: true; readonly result: RouteResult }
  | { readonly ok: false; readonly error: RouteError };

/**
 * Finds the cheapest route for a request: applies the vehicle's limits and
 * the peak-hour multiplier, then visits origin, waypoints and destination
 * in order. Pure: no I/O, no clock.
 */
export function planRoute(graph: Graph, request: RouteRequest): RoutePlan {
  const stops = [
    request.originNodeId,
    ...request.waypoints,
    request.destinationNodeId,
  ];
  const weight = createEdgeWeight(
    request.vehicle,
    parseDepartureTime(request.departureTime),
  );
  const outcome = multiStopPath(graph.edges, stops, weight);

  if (!outcome.found) {
    const { index, from, to } = outcome.failedLeg;
    return {
      ok: false,
      error: {
        code: 'UNREACHABLE',
        message: `No route from ${from} to ${to} (leg ${index + 1} of ${stops.length - 1})`,
      },
    };
  }

  return {
    ok: true,
    result: {
      graphId: graph.id,
      totalCost: roundCost(outcome.totalCost),
      path: outcome.path,
      legs: outcome.legs.map((leg) => ({
        from: leg.from,
        to: leg.to,
        path: leg.path,
        cost: roundCost(leg.cost),
      })),
    },
  };
}

/** Rounds to 6 decimals to drop float noise such as 0.30000000000000004. */
export function roundCost(cost: number): number {
  return Math.round(cost * 1e6) / 1e6;
}
