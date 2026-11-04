export class NodeDto {
  /** @example 'A' */
  id: string;
}

export class NetworkNodesResponseDto {
  /**
   * Id of the graph.
   * @example '3f1c2b9e-8d4a-4c6e-9b7a-2e5f1d0c8a41'
   */
  graphId: string;

  /** Unique nodes, in the order they first appear in the uploaded edges. */
  nodes: NodeDto[];
}
