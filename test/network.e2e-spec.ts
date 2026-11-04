import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';

const README_GRAPH = {
  edges: [
    {
      from: 'A',
      to: 'B',
      cost: 10,
      maxWeight: 10000,
      noHazardous: false,
      trafficMultiplier: 1.0,
    },
    {
      from: 'A',
      to: 'C',
      cost: 15,
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.5,
    },
    {
      from: 'B',
      to: 'D',
      cost: 12,
      maxWeight: 10000,
      noHazardous: false,
      trafficMultiplier: 2.0,
    },
    {
      from: 'C',
      to: 'D',
      cost: 5,
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.0,
    },
    {
      from: 'D',
      to: 'E',
      cost: 10,
      maxWeight: 8000,
      noHazardous: false,
      trafficMultiplier: 1.2,
    },
  ],
};

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('Network (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  const upload = (body: unknown) =>
    request(app.getHttpServer())
      .post('/network/upload')
      .send(body as object);

  it('uploads the README graph and lists its nodes', async () => {
    const res = await upload(README_GRAPH).expect(201);
    expect(res.body).toEqual({ id: expect.stringMatching(UUID_V4) });

    const nodes = await request(app.getHttpServer())
      .get(`/network/nodes/${res.body.id}`)
      .expect(200);
    expect(nodes.body).toEqual({
      graphId: res.body.id,
      nodes: [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }],
    });
  });

  it('accepts edges with only the required fields', async () => {
    await upload({ edges: [{ from: 'A', to: 'C', cost: 5 }] }).expect(201);
  });

  it('returns 404 for an unknown graph id', async () => {
    await request(app.getHttpServer())
      .get('/network/nodes/3f1c2b9e-8d4a-4c6e-9b7a-2e5f1d0c8a41')
      .expect(404);
  });

  it('returns 400 for an id that is not a UUID', async () => {
    await request(app.getHttpServer())
      .get('/network/nodes/not-a-uuid')
      .expect(400);
  });

  it.each([
    ['missing edges', {}],
    ['empty edges', { edges: [] }],
    ['edges not an array', { edges: 'A-B' }],
    ['null edge', { edges: [null] }],
    ['negative cost', { edges: [{ from: 'A', to: 'B', cost: -1 }] }],
    ['string cost', { edges: [{ from: 'A', to: 'B', cost: '10' }] }],
    ['missing to', { edges: [{ from: 'A', cost: 1 }] }],
    ['empty from', { edges: [{ from: '', to: 'B', cost: 1 }] }],
    [
      'zero maxWeight',
      { edges: [{ from: 'A', to: 'B', cost: 1, maxWeight: 0 }] },
    ],
    [
      'non-boolean noHazardous',
      { edges: [{ from: 'A', to: 'B', cost: 1, noHazardous: 'yes' }] },
    ],
    [
      'negative trafficMultiplier',
      { edges: [{ from: 'A', to: 'B', cost: 1, trafficMultiplier: -2 }] },
    ],
    [
      'unknown edge field',
      { edges: [{ from: 'A', to: 'B', cost: 1, speed: 90 }] },
    ],
    [
      'unknown top-level field',
      { edges: [{ from: 'A', to: 'B', cost: 1 }], name: 'x' },
    ],
  ])('returns 400 for %s', async (_name, body) => {
    await upload(body).expect(400);
  });

  it('keeps only the last 5 graphs', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await upload(README_GRAPH).expect(201);
      ids.push(res.body.id as string);
    }

    await request(app.getHttpServer())
      .get(`/network/nodes/${ids[0]}`)
      .expect(404);
    for (const id of ids.slice(1)) {
      await request(app.getHttpServer())
        .get(`/network/nodes/${id}`)
        .expect(200);
    }
  });
});
