import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types.js';
import type { Db } from 'mongodb';
import { AppModule } from './../src/app.module.js';
import { configureApp } from './../src/app.setup.js';
import { MONGO_DB } from './../src/database/mongo.module.js';

/** `memory` for `npm run test:e2e`, `mongo` for `npm run test:e2e:mongo`. */
const storage = process.env.STORAGE === 'mongo' ? 'mongo' : 'memory';

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
const UNKNOWN_UUID = '3f1c2b9e-8d4a-4c6e-9b7a-2e5f1d0c8a41';

function body(overrides: Record<string, unknown> = {}) {
  return {
    originNodeId: 'A',
    destinationNodeId: 'E',
    vehicleProfile: { type: 'van', weight: 3000, hazardous: false },
    departureTime: '12:00',
    ...overrides,
  };
}

describe(`Route (e2e, ${storage} storage)`, () => {
  let app: INestApplication<App>;
  let graphId: string;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    await dropTestDatabase();

    const res = await request(app.getHttpServer())
      .post('/network/upload')
      .send(README_GRAPH)
      .expect(201);
    graphId = res.body.id as string;
  });

  afterEach(async () => {
    await dropTestDatabase();
    await app.close();
  });

  /** Mongo runs use a throwaway database (see test/setup/mongo-env.ts). */
  async function dropTestDatabase(): Promise<void> {
    if (storage === 'mongo') await app.get<Db>(MONGO_DB).dropDatabase();
  }

  const optimize = (payload: unknown, id = graphId) =>
    request(app.getHttpServer())
      .post(`/route/optimize/${id}`)
      .send(payload as object);

  /** Polls the status endpoint until the job finishes. */
  async function waitForJob(jobId: string) {
    for (let attempt = 0; attempt < 100; attempt++) {
      const res = await request(app.getHttpServer())
        .get(`/route/status/${jobId}`)
        .expect(200);
      if (res.body.status === 'COMPLETED' || res.body.status === 'FAILED') {
        return res.body as Record<string, any>;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Job ${jobId} did not finish`);
  }

  async function run(payload: unknown) {
    const res = await optimize(payload).expect(202);
    expect(res.body).toEqual({ jobId: expect.stringMatching(UUID_V4) });
    return waitForJob(res.body.jobId as string);
  }

  it.each([
    ['README Test Case 1: standard path', body(), ['A', 'C', 'D', 'E'], 30],
    [
      'README Test Case 2: weight constraint',
      body({
        vehicleProfile: { type: 'truck', weight: 6000, hazardous: false },
      }),
      ['A', 'B', 'D', 'E'],
      32,
    ],
    [
      'README Test Case 3: hazardous constraint',
      body({
        vehicleProfile: { type: 'truck', weight: 3000, hazardous: true },
      }),
      ['A', 'B', 'D', 'E'],
      32,
    ],
    [
      'peak hour at 08:00',
      body({ departureTime: '08:00' }),
      ['A', 'C', 'D', 'E'],
      39.5,
    ],
    ['waypoint B', body({ waypoints: ['B'] }), ['A', 'B', 'D', 'E'], 32],
  ])('%s', async (_name, payload, path, totalCost) => {
    const job = await run(payload);

    expect(job).toMatchObject({
      status: 'COMPLETED',
      result: { graphId, path, totalCost },
    });
    expect(job.error).toBeUndefined();
    expect(typeof job.result.durationMs).toBe('number');
  });

  it('returns the full status shape for a completed job', async () => {
    const job = await run(body());

    expect(job).toEqual({
      jobId: expect.stringMatching(UUID_V4),
      status: 'COMPLETED',
      createdAt: expect.any(String),
      startedAt: expect.any(String),
      completedAt: expect.any(String),
      result: {
        graphId,
        totalCost: 30,
        path: ['A', 'C', 'D', 'E'],
        durationMs: expect.any(Number),
        legs: [{ from: 'A', to: 'E', path: ['A', 'C', 'D', 'E'], cost: 30 }],
      },
    });
  });

  it('fails the job when the destination is unreachable', async () => {
    const job = await run(body({ originNodeId: 'E', destinationNodeId: 'A' }));

    expect(job).toMatchObject({
      status: 'FAILED',
      error: {
        code: 'UNREACHABLE',
        message: 'No route from E to A (leg 1 of 1)',
      },
    });
    expect(job.result).toBeUndefined();
  });

  it('returns 404 for an unknown graph', async () => {
    await optimize(body(), UNKNOWN_UUID).expect(404);
  });

  it('returns 400 for a graph id that is not a UUID', async () => {
    await optimize(body(), 'not-a-uuid').expect(400);
  });

  it('returns 404 for an unknown job', async () => {
    await request(app.getHttpServer())
      .get(`/route/status/${UNKNOWN_UUID}`)
      .expect(404);
  });

  it('returns 400 for a job id that is not a UUID', async () => {
    await request(app.getHttpServer()).get('/route/status/job-987').expect(400);
  });

  it.each([
    ['missing vehicleProfile', { ...body(), vehicleProfile: undefined }],
    ['vehicleProfile not an object', body({ vehicleProfile: 'truck' })],
    ['missing departureTime', { ...body(), departureTime: undefined }],
    ['departureTime 25:00', body({ departureTime: '25:00' })],
    ['departureTime 8:00', body({ departureTime: '8:00' })],
    [
      'negative weight',
      body({ vehicleProfile: { type: 'truck', weight: -1, hazardous: false } }),
    ],
    [
      'string weight',
      body({
        vehicleProfile: { type: 'truck', weight: '10', hazardous: false },
      }),
    ],
    [
      'missing hazardous',
      body({ vehicleProfile: { type: 'truck', weight: 1 } }),
    ],
    [
      'empty type',
      body({ vehicleProfile: { type: '', weight: 1, hazardous: false } }),
    ],
    ['waypoints not an array', body({ waypoints: 'C' })],
    ['empty waypoint', body({ waypoints: [''] })],
    [
      '101 waypoints',
      body({ waypoints: Array.from({ length: 101 }, () => 'B') }),
    ],
    ['empty originNodeId', body({ originNodeId: '' })],
    ['unknown top-level field', body({ priority: 'high' })],
    [
      'unknown vehicle field',
      body({
        vehicleProfile: { type: 'van', weight: 1, hazardous: false, axles: 3 },
      }),
    ],
  ])('returns 400 for %s', async (_name, payload) => {
    await optimize(payload).expect(400);
  });
});
