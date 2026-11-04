import type { Graph } from '../../domain/graph.types.js';

/**
 * Storage for uploaded graphs. Abstract class so it works as a DI token and
 * an in-memory store can be swapped for a database later.
 */
export abstract class GraphRepository {
  abstract save(graph: Graph): Promise<void>;
  abstract findById(id: string): Promise<Graph | undefined>;
}

/** DI token for how many graphs the in-memory store keeps. */
export const GRAPH_CAPACITY = Symbol('GRAPH_CAPACITY');
