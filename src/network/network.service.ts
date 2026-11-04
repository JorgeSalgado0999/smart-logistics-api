import { randomUUID } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { Edge, Graph, Node } from '../domain/graph.types.js';
import type { UploadNetworkDto } from './dto/upload-network.dto.js';
import { GraphRepository } from './repository/graph.repository.js';

@Injectable()
export class NetworkService {
  constructor(private readonly graphs: GraphRepository) {}

  /** Stores a new graph and returns its id. */
  upload(dto: UploadNetworkDto): string {
    const edges: Edge[] = dto.edges.map((edge) => ({
      from: edge.from,
      to: edge.to,
      cost: edge.cost,
      maxWeight: edge.maxWeight,
      noHazardous: edge.noHazardous ?? false,
      trafficMultiplier: edge.trafficMultiplier ?? 1,
    }));

    const graph: Graph = {
      id: randomUUID(),
      nodes: deriveNodes(edges),
      edges,
      createdAt: new Date(),
    };
    this.graphs.save(graph);
    return graph.id;
  }

  /** Returns the graph, or throws 404 if it doesn't exist or was evicted. */
  getGraph(id: string): Graph {
    const graph = this.graphs.findById(id);
    if (!graph) {
      throw new NotFoundException(`Network ${id} not found`);
    }
    return graph;
  }
}

/** Unique from/to ids, in the order they first appear. */
function deriveNodes(edges: readonly Edge[]): Node[] {
  const ids = new Set<string>();
  for (const edge of edges) {
    ids.add(edge.from);
    ids.add(edge.to);
  }
  return [...ids].map((id) => ({ id }));
}
