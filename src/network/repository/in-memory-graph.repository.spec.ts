import type { Graph } from '../../domain/graph.types.js';
import { InMemoryGraphRepository } from './in-memory-graph.repository.js';

function makeGraph(id: string): Graph {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    nodes: [{ id: 'A' }, { id: 'B' }],
    edges: [
      { from: 'A', to: 'B', cost: 1, noHazardous: false, trafficMultiplier: 1 },
    ],
  };
}

describe('InMemoryGraphRepository', () => {
  it('returns a saved graph by id', async () => {
    const repo = new InMemoryGraphRepository(5);
    await repo.save(makeGraph('g1'));

    expect(await repo.findById('g1')).toEqual(makeGraph('g1'));
  });

  it('returns undefined for an unknown id', async () => {
    const repo = new InMemoryGraphRepository(5);

    expect(await repo.findById('missing')).toBeUndefined();
  });

  it('evicts the oldest graph once capacity is exceeded', async () => {
    const repo = new InMemoryGraphRepository(5);
    for (let i = 1; i <= 6; i++) await repo.save(makeGraph(`g${i}`));

    expect(await repo.findById('g1')).toBeUndefined();
    for (let i = 2; i <= 6; i++)
      expect(await repo.findById(`g${i}`)).toBeDefined();
  });

  it('evicts by upload order, not by last read', async () => {
    const repo = new InMemoryGraphRepository(2);
    await repo.save(makeGraph('g1'));
    await repo.save(makeGraph('g2'));
    await repo.findById('g1');
    await repo.save(makeGraph('g3'));

    expect(await repo.findById('g1')).toBeUndefined();
    expect(await repo.findById('g2')).toBeDefined();
  });

  it('stores a copy, so changing the input later has no effect', async () => {
    const repo = new InMemoryGraphRepository(5);
    const graph = makeGraph('g1');
    await repo.save(graph);

    (graph.edges as unknown as { cost: number }[])[0].cost = 999;
    (graph.nodes as unknown as { id: string }[]).push({ id: 'Z' });

    expect((await repo.findById('g1'))?.edges[0].cost).toBe(1);
    expect((await repo.findById('g1'))?.nodes).toHaveLength(2);
  });

  it('returns a frozen graph that readers cannot change', async () => {
    const repo = new InMemoryGraphRepository(5);
    await repo.save(makeGraph('g1'));
    const stored = (await repo.findById('g1'))!;

    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.edges)).toBe(true);
    expect(Object.isFrozen(stored.edges[0])).toBe(true);
    expect(Object.isFrozen(stored.nodes[0])).toBe(true);
  });

  it.each([0, -1, 1.5, Number.NaN])(
    'rejects invalid capacity %p',
    (capacity) => {
      expect(() => new InMemoryGraphRepository(capacity)).toThrow();
    },
  );
});
