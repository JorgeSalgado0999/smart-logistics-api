import type { Edge, VehicleProfile } from '../../domain/graph.types.js';
import type { EdgeWeight } from '../algorithm/dijkstra.js';
import { isPeakHour, type MinuteOfDay } from './departure-time.js';

/** True when the vehicle may travel the edge. */
export function canTraverse(edge: Edge, vehicle: VehicleProfile): boolean {
  if (edge.maxWeight !== undefined && vehicle.weight > edge.maxWeight) {
    return false;
  }
  if (vehicle.hazardous && edge.noHazardous) {
    return false;
  }
  return true;
}

/**
 * Builds the Dijkstra weight for one route request:
 * - edges the vehicle can't use are skipped (undefined);
 * - during peak hours the cost is multiplied by the edge's trafficMultiplier.
 *
 * Peak is decided by the departure time only. The clock doesn't advance
 * along the route, because edge costs have no time unit.
 */
export function createEdgeWeight(
  vehicle: VehicleProfile,
  departure: MinuteOfDay,
): EdgeWeight {
  const peak = isPeakHour(departure);
  return (edge) => {
    if (!canTraverse(edge, vehicle)) return undefined;
    return peak ? edge.cost * edge.trafficMultiplier : edge.cost;
  };
}
