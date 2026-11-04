import { NotFoundException } from '@nestjs/common';
import { NetworkService } from './network.service.js';
import { InMemoryGraphRepository } from './repository/in-memory-graph.repository.js';

describe('NetworkService', () => {
  let service: NetworkService;

  beforeEach(() => {
    service = new NetworkService(new InMemoryGraphRepository(5));
  });

  it('derives unique nodes in order of first appearance', () => {
    const id = service.upload({
      edges: [
        { from: 'C', to: 'A', cost: 1 },
        { from: 'A', to: 'B', cost: 1 },
        { from: 'B', to: 'C', cost: 1 },
      ],
    });

    expect(service.getGraph(id).nodes).toEqual([
      { id: 'C' },
      { id: 'A' },
      { id: 'B' },
    ]);
  });

  it('fills defaults for optional edge fields', () => {
    const id = service.upload({ edges: [{ from: 'A', to: 'B', cost: 5 }] });

    expect(service.getGraph(id).edges[0]).toEqual({
      from: 'A',
      to: 'B',
      cost: 5,
      maxWeight: undefined,
      noHazardous: false,
      trafficMultiplier: 1,
    });
  });

  it('keeps provided edge fields', () => {
    const edge = {
      from: 'A',
      to: 'B',
      cost: 10,
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.5,
    };
    const id = service.upload({ edges: [edge] });

    expect(service.getGraph(id).edges[0]).toEqual(edge);
  });

  it('keeps duplicate edges and self-loops', () => {
    const id = service.upload({
      edges: [
        { from: 'A', to: 'B', cost: 1 },
        { from: 'A', to: 'B', cost: 2 },
        { from: 'A', to: 'A', cost: 3 },
      ],
    });

    expect(service.getGraph(id).edges).toHaveLength(3);
    expect(service.getGraph(id).nodes).toEqual([{ id: 'A' }, { id: 'B' }]);
  });

  it('gives each upload a new UUID', () => {
    const dto = { edges: [{ from: 'A', to: 'B', cost: 1 }] };
    const first = service.upload(dto);
    const second = service.upload(dto);

    expect(first).not.toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('throws NotFoundException for an unknown id', () => {
    expect(() => service.getGraph('missing')).toThrow(NotFoundException);
  });
});
