/** A location in the network. */
export interface Node {
  readonly id: string;
}

/**
 * A directed connection between two nodes. Optional fields from the upload
 * are filled with defaults, so routing code never checks for missing values.
 */
export interface Edge {
  readonly from: string;
  readonly to: string;
  /** Base cost, always >= 0. */
  readonly cost: number;
  /** Max vehicle weight allowed. `undefined` means no limit. */
  readonly maxWeight?: number;
  /** When true, hazardous vehicles cannot use this edge. Default false. */
  readonly noHazardous: boolean;
  /** Cost multiplier applied during peak hours. Default 1. */
  readonly trafficMultiplier: number;
}

/** A stored network: its nodes (derived from edges) and edges. */
export interface Graph {
  readonly id: string;
  readonly nodes: readonly Node[];
  readonly edges: readonly Edge[];
  readonly createdAt: Date;
}

/** Vehicle used for a route request. Edges it cannot use are skipped. */
export interface VehicleProfile {
  readonly type: string;
  readonly weight: number;
  readonly hazardous: boolean;
}
