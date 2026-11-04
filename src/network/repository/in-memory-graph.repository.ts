import { Inject, Injectable } from '@nestjs/common';
import type { Graph } from '../../domain/graph.types.js';
import { GRAPH_CAPACITY, GraphRepository } from './graph.repository.js';

/**
 * Keeps the most recently uploaded graphs in memory. When full, the oldest
 * upload is evicted (FIFO). Stored graphs are deep-frozen copies, so neither
 * the caller nor readers can change them.
 */
@Injectable()
export class InMemoryGraphRepository extends GraphRepository {
  private readonly graphs = new Map<string, Graph>();

  constructor(@Inject(GRAPH_CAPACITY) private readonly capacity: number) {
    super();
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error(
        `Graph capacity must be a positive integer, got ${capacity}`,
      );
    }
  }

  save(graph: Graph): void {
    this.graphs.delete(graph.id);
    this.graphs.set(graph.id, freezeCopy(graph));

    while (this.graphs.size > this.capacity) {
      const oldestId = this.graphs.keys().next().value as string;
      this.graphs.delete(oldestId);
    }
  }

  findById(id: string): Graph | undefined {
    return this.graphs.get(id);
  }
}

function freezeCopy(graph: Graph): Graph {
  return Object.freeze({
    id: graph.id,
    createdAt: new Date(graph.createdAt),
    nodes: Object.freeze(graph.nodes.map((node) => Object.freeze({ ...node }))),
    edges: Object.freeze(graph.edges.map((edge) => Object.freeze({ ...edge }))),
  });
}
