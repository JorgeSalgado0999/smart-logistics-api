import type { Graph, VehicleProfile } from '../domain/graph.types.js';
import { shortestPath } from './algorithm/dijkstra.js';
import { multiStopPath } from './algorithm/multi-stop.js';
import {
  type MinuteOfDay,
  parseDepartureTime,
} from './constraints/departure-time.js';
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

export const ROUTE_ERROR_CODES = [
  'INVALID_NODE',
  'UNREACHABLE',
  'CONSTRAINTS_BLOCK_ROUTE',
] as const;
export type RouteErrorCode = (typeof ROUTE_ERROR_CODES)[number];

/** Vehicle rules that can block a route. Peak hours change cost only. */
export const BLOCKING_CONSTRAINTS = ['WEIGHT', 'HAZARDOUS'] as const;
export type BlockingConstraint = (typeof BLOCKING_CONSTRAINTS)[number];

export interface FailedLeg {
  /** 0-based: leg 0 is origin -> first stop. */
  readonly index: number;
  readonly from: string;
  readonly to: string;
}

export type RouteError =
  | {
      readonly code: 'INVALID_NODE';
      readonly message: string;
      /** Requested ids not in the graph, in request order, no repeats. */
      readonly unknownNodes: string[];
    }
  | {
      readonly code: 'UNREACHABLE';
      readonly message: string;
      readonly failedLeg: FailedLeg;
    }
  | {
      readonly code: 'CONSTRAINTS_BLOCK_ROUTE';
      readonly message: string;
      readonly failedLeg: FailedLeg;
      readonly blockedBy: BlockingConstraint[];
    };

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

  const known = new Set(graph.nodes.map((node) => node.id));
  const unknownNodes = [...new Set(stops.filter((id) => !known.has(id)))];
  if (unknownNodes.length > 0) {
    return {
      ok: false,
      error: {
        code: 'INVALID_NODE',
        message: `Unknown node(s): ${unknownNodes.join(', ')}`,
        unknownNodes,
      },
    };
  }

  const departure = parseDepartureTime(request.departureTime);
  const outcome = multiStopPath(
    graph.edges,
    stops,
    createEdgeWeight(request.vehicle, departure),
  );

  if (!outcome.found) {
    return {
      ok: false,
      error: diagnoseFailedLeg(
        graph,
        request,
        departure,
        outcome.failedLeg,
        stops.length - 1,
      ),
    };
  }

  const legs = outcome.legs.map((leg) => ({
    from: leg.from,
    to: leg.to,
    path: leg.path,
    cost: roundCost(leg.cost),
  }));
  return {
    ok: true,
    result: {
      graphId: graph.id,
      // Sum of the rounded legs, so clients can check legs add up to the total.
      totalCost: roundCost(legs.reduce((sum, leg) => sum + leg.cost, 0)),
      path: outcome.path,
      legs,
    },
  };
}

/**
 * Explains why a leg has no route. If it has one when the vehicle's rules
 * are ignored, those rules are the cause; blockedBy lists each rule whose
 * removal alone opens a route, or both when only removing both does.
 * Runs at most 3 extra searches, and only for failed jobs.
 */
function diagnoseFailedLeg(
  graph: Graph,
  request: RouteRequest,
  departure: MinuteOfDay,
  failedLeg: FailedLeg,
  legCount: number,
): RouteError {
  const { index, from, to } = failedLeg;
  const leg = `leg ${index + 1} of ${legCount}`;

  if (!shortestPath(graph.edges, from, to)) {
    return {
      code: 'UNREACHABLE',
      message: `No route from ${from} to ${to} (${leg})`,
      failedLeg,
    };
  }

  const reachableWith = (vehicle: VehicleProfile) =>
    shortestPath(
      graph.edges,
      from,
      to,
      createEdgeWeight(vehicle, departure),
    ) !== null;
  const { vehicle } = request;
  const blockedBy: BlockingConstraint[] = [];
  if (reachableWith({ ...vehicle, weight: 0 })) blockedBy.push('WEIGHT');
  if (reachableWith({ ...vehicle, hazardous: false })) {
    blockedBy.push('HAZARDOUS');
  }
  if (blockedBy.length === 0) blockedBy.push('WEIGHT', 'HAZARDOUS');

  const reasons = blockedBy
    .map((rule) =>
      rule === 'WEIGHT' ? 'weight limit' : 'hazardous materials restriction',
    )
    .join(' and ');
  return {
    code: 'CONSTRAINTS_BLOCK_ROUTE',
    message: `Vehicle can't reach ${to} from ${from}: blocked by ${reasons} (${leg})`,
    failedLeg,
    blockedBy,
  };
}

/** Rounds to 6 decimals to drop float noise such as 0.30000000000000004. */
export function roundCost(cost: number): number {
  return Math.round(cost * 1e6) / 1e6;
}
