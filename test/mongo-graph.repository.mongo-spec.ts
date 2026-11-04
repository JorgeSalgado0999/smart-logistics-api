import { type Db, MongoClient } from 'mongodb';
import type { Graph } from '../src/domain/graph.types.js';
import {
  type GraphDocument,
  GRAPHS_COLLECTION,
  MongoGraphRepository,
} from '../src/network/repository/mongo-graph.repository.js';

/** Own database, so it can run beside the network e2e suite. */
const DB_NAME = 'smart_logistics_test_repo';

function makeGraph(id: string): Graph {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    edges: [
      {
        from: 'A',
        to: 'B',
        cost: 10,
        maxWeight: 5000,
        noHazardous: true,
        trafficMultiplier: 1.5,
      },
      {
        from: 'A',
        to: 'C',
        cost: 5,
        maxWeight: undefined,
        noHazardous: false,
        trafficMultiplier: 1,
      },
    ],
  };
}

describe('MongoGraphRepository (MongoDB)', () => {
  let client: MongoClient;
  let db: Db;
  let repo: MongoGraphRepository;

  beforeAll(async () => {
    client = new MongoClient(process.env.MONGO_URI!, {
      serverSelectionTimeoutMS: 5000,
    });
    await client.connect();
    db = client.db(DB_NAME);
  });

  beforeEach(async () => {
    await db.dropDatabase();
    repo = new MongoGraphRepository(db);
  });

  afterAll(async () => {
    await db?.dropDatabase();
    await client?.close();
  });

  it('reads back a saved graph', async () => {
    await repo.save(makeGraph('g1'));

    expect(await repo.findById('g1')).toEqual(makeGraph('g1'));
  });

  it('returns undefined for an unknown id', async () => {
    expect(await repo.findById('missing')).toBeUndefined();
  });

  it('uses the graph id as _id and leaves out a missing maxWeight', async () => {
    await repo.save(makeGraph('g1'));
    const raw = await db
      .collection<GraphDocument>(GRAPHS_COLLECTION)
      .findOne({ _id: 'g1' });

    expect(raw?._id).toBe('g1');
    expect(raw?.edges[0].maxWeight).toBe(5000);
    expect(raw?.edges[1]).not.toHaveProperty('maxWeight');
  });

  it('returns createdAt as a Date', async () => {
    await repo.save(makeGraph('g1'));
    const graph = await repo.findById('g1');

    expect(graph?.createdAt).toBeInstanceOf(Date);
    expect(graph?.createdAt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('replaces a graph saved again with the same id', async () => {
    await repo.save(makeGraph('g1'));
    await repo.save({ ...makeGraph('g1'), nodes: [{ id: 'Z' }] });

    expect((await repo.findById('g1'))?.nodes).toEqual([{ id: 'Z' }]);
    expect(
      await db
        .collection<GraphDocument>(GRAPHS_COLLECTION)
        .countDocuments({ _id: 'g1' }),
    ).toBe(1);
  });

  it('keeps more than 5 graphs', async () => {
    for (let i = 1; i <= 7; i++) await repo.save(makeGraph(`g${i}`));

    for (let i = 1; i <= 7; i++) {
      expect(await repo.findById(`g${i}`)).toBeDefined();
    }
  });
});
