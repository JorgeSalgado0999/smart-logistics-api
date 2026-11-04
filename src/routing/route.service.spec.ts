import { jest } from '@jest/globals';
import { Logger, NotFoundException } from '@nestjs/common';
import { NetworkService } from '../network/network.service.js';
import { InMemoryGraphRepository } from '../network/repository/in-memory-graph.repository.js';
import { InMemoryJobRepository } from './jobs/in-memory-job.repository.js';
import { JobScheduler, type JobTask } from './jobs/job-scheduler.js';
import type { RouteJob } from './jobs/route-job.types.js';
import type { RouteRequest } from './route-planner.js';
import { RouteService } from './route.service.js';

/** Holds tasks until the test runs them. */
class ManualScheduler extends JobScheduler {
  readonly tasks: JobTask[] = [];

  schedule(task: JobTask): void {
    this.tasks.push(task);
  }

  async runAll(): Promise<void> {
    while (this.tasks.length > 0) await this.tasks.shift()!();
  }
}

const README_EDGES = {
  edges: [
    { from: 'A', to: 'B', cost: 10, maxWeight: 10000 },
    { from: 'A', to: 'C', cost: 15, maxWeight: 5000, noHazardous: true },
    { from: 'B', to: 'D', cost: 12, maxWeight: 10000 },
    { from: 'C', to: 'D', cost: 5, maxWeight: 5000, noHazardous: true },
    { from: 'D', to: 'E', cost: 10, maxWeight: 8000 },
  ],
};

function request(overrides: Partial<RouteRequest> = {}): RouteRequest {
  return {
    originNodeId: 'A',
    destinationNodeId: 'E',
    waypoints: [],
    vehicle: { type: 'van', weight: 3000, hazardous: false },
    departureTime: '12:00',
    ...overrides,
  };
}

describe('RouteService', () => {
  const NOW = new Date('2026-01-01T12:00:00Z');
  let network: NetworkService;
  let jobs: InMemoryJobRepository;
  let scheduler: ManualScheduler;
  let service: RouteService;
  let graphId: string;

  beforeEach(async () => {
    network = new NetworkService(new InMemoryGraphRepository(5));
    jobs = new InMemoryJobRepository(
      { ttlMs: 60_000, maxJobs: 100 },
      () => NOW,
    );
    scheduler = new ManualScheduler();
    service = new RouteService(network, jobs, scheduler, () => NOW);
    graphId = await network.upload(README_EDGES);
  });

  it('returns a PENDING job and schedules it without running it', async () => {
    const jobId = await service.submit(graphId, request());

    expect(await service.getJob(jobId)).toEqual({
      id: jobId,
      graphId,
      status: 'PENDING',
      createdAt: NOW,
    });
    expect(scheduler.tasks).toHaveLength(1);
  });

  it('completes the job with the route and a duration', async () => {
    const jobId = await service.submit(graphId, request());
    await scheduler.runAll();

    const job = await service.getJob(jobId);
    expect(job).toMatchObject({
      status: 'COMPLETED',
      startedAt: NOW,
      completedAt: NOW,
      result: { graphId, totalCost: 30, path: ['A', 'C', 'D', 'E'] },
    });
    expect(job.result?.durationMs).toBeGreaterThanOrEqual(0);
    expect(job.error).toBeUndefined();
  });

  it('fails the job with UNREACHABLE when no route exists', async () => {
    const jobId = await service.submit(
      graphId,
      request({ originNodeId: 'E', destinationNodeId: 'A' }),
    );
    await scheduler.runAll();

    expect(await service.getJob(jobId)).toMatchObject({
      status: 'FAILED',
      completedAt: NOW,
      error: {
        code: 'UNREACHABLE',
        message: 'No route from E to A (leg 1 of 1)',
      },
    });
  });

  it('fails with INTERNAL_ERROR, without leaking details, if routing throws', async () => {
    // An invalid departure time can't pass the DTO; here it makes planRoute throw.
    const logError = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const jobId = await service.submit(
      graphId,
      request({ departureTime: '99:99' }),
    );
    await scheduler.runAll();

    const job = await service.getJob(jobId);
    expect(job.status).toBe('FAILED');
    expect(job.error).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'Unexpected error while calculating the route',
    });
    expect(logError).toHaveBeenCalledTimes(1);
    logError.mockRestore();
  });

  it('shows PROCESSING while the route is being calculated', async () => {
    const seen: RouteJob['status'][] = [];
    const save = jobs.save.bind(jobs);
    jobs.save = async (job) => {
      seen.push(job.status);
      await save(job);
    };

    await service.submit(graphId, request());
    await scheduler.runAll();

    expect(seen).toEqual(['PENDING', 'PROCESSING', 'COMPLETED']);
  });

  it('still runs a job whose graph was evicted after submit', async () => {
    const jobId = await service.submit(graphId, request());
    for (let i = 0; i < 5; i++) await network.upload(README_EDGES);
    await expect(network.getGraph(graphId)).rejects.toThrow(NotFoundException);

    await scheduler.runAll();

    expect((await service.getJob(jobId)).status).toBe('COMPLETED');
  });

  it('throws 404 and creates no job for an unknown graph', async () => {
    await expect(service.submit('missing', request())).rejects.toThrow(
      NotFoundException,
    );
    expect(scheduler.tasks).toHaveLength(0);
  });

  it('throws 404 for an unknown job', async () => {
    await expect(service.getJob('missing')).rejects.toThrow(NotFoundException);
  });
});
