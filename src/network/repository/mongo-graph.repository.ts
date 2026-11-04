import type { Collection, Db } from 'mongodb';
import type { Edge, Graph } from '../../domain/graph.types.js';
import { GraphRepository } from './graph.repository.js';

export const GRAPHS_COLLECTION = 'graphs';

interface EdgeDocument {
  from: string;
  to: string;
  cost: number;
  /** Left out when the edge has no weight limit. */
  maxWeight?: number;
  noHazardous: boolean;
  trafficMultiplier: number;
}

/** Stored shape. The graph's UUID is the _id, so lookups need no extra index. */
export interface GraphDocument {
  _id: string;
  nodes: { id: string }[];
  edges: EdgeDocument[];
  createdAt: Date;
}

/** Keeps every uploaded graph in MongoDB. No 5-graph limit. */
export class MongoGraphRepository extends GraphRepository {
  private readonly collection: Collection<GraphDocument>;

  constructor(db: Db) {
    super();
    this.collection = db.collection<GraphDocument>(GRAPHS_COLLECTION);
  }

  async save(graph: Graph): Promise<void> {
    await this.collection.replaceOne({ _id: graph.id }, toDocument(graph), {
      upsert: true,
    });
  }

  async findById(id: string): Promise<Graph | undefined> {
    const doc = await this.collection.findOne({ _id: id });
    return doc ? toGraph(doc) : undefined;
  }
}

function toDocument(graph: Graph): GraphDocument {
  return {
    _id: graph.id,
    createdAt: graph.createdAt,
    nodes: graph.nodes.map((node) => ({ id: node.id })),
    edges: graph.edges.map((edge) => {
      const doc: EdgeDocument = {
        from: edge.from,
        to: edge.to,
        cost: edge.cost,
        noHazardous: edge.noHazardous,
        trafficMultiplier: edge.trafficMultiplier,
      };
      if (edge.maxWeight !== undefined) doc.maxWeight = edge.maxWeight;
      return doc;
    }),
  };
}

function toGraph(doc: GraphDocument): Graph {
  return {
    id: doc._id,
    createdAt: doc.createdAt,
    nodes: doc.nodes.map((node) => ({ id: node.id })),
    edges: doc.edges.map((edge): Edge => ({
      from: edge.from,
      to: edge.to,
      cost: edge.cost,
      maxWeight: edge.maxWeight,
      noHazardous: edge.noHazardous,
      trafficMultiplier: edge.trafficMultiplier,
    })),
  };
}
