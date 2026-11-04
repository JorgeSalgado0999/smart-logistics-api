import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Graph } from '../domain/graph.types.js';
import { NetworkService } from '../network/network.service.js';
import { JobRepository } from './jobs/job.repository.js';
import { JobScheduler } from './jobs/job-scheduler.js';
import { CLOCK, type Clock, type RouteJob } from './jobs/route-job.types.js';
import { planRoute, type RouteRequest } from './route-planner.js';

@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);

  constructor(
    private readonly network: NetworkService,
    private readonly jobs: JobRepository,
    private readonly scheduler: JobScheduler,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * Creates a PENDING job and schedules it. Returns the job id right away.
   * Throws 404 if the graph doesn't exist. The job keeps the graph read
   * here, so it still runs if the graph is evicted meanwhile.
   */
  async submit(graphId: string, request: RouteRequest): Promise<string> {
    const graph = await this.network.getGraph(graphId);
    const job: RouteJob = {
      id: randomUUID(),
      graphId: graph.id,
      status: 'PENDING',
      createdAt: this.clock(),
    };
    await this.jobs.save(job);
    this.scheduler.schedule(() => this.run(job, graph, request));
    return job.id;
  }

  /** Throws 404 if the job doesn't exist or has expired. */
  async getJob(jobId: string): Promise<RouteJob> {
    const job = await this.jobs.findById(jobId);
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  /** Runs one job to COMPLETED or FAILED. Never rejects. */
  private async run(
    pending: RouteJob,
    graph: Graph,
    request: RouteRequest,
  ): Promise<void> {
    const processing: RouteJob = {
      ...pending,
      status: 'PROCESSING',
      startedAt: this.clock(),
    };
    try {
      await this.jobs.save(processing);

      const start = performance.now();
      const plan = planRoute(graph, request);
      const durationMs = Math.round((performance.now() - start) * 1000) / 1000;

      await this.jobs.save(
        plan.ok
          ? {
              ...processing,
              status: 'COMPLETED',
              completedAt: this.clock(),
              result: { ...plan.result, durationMs },
            }
          : {
              ...processing,
              status: 'FAILED',
              completedAt: this.clock(),
              error: plan.error,
            },
      );
    } catch (error) {
      this.logger.error(`Job ${pending.id} failed unexpectedly`, error);
      await this.jobs
        .save({
          ...processing,
          status: 'FAILED',
          completedAt: this.clock(),
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Unexpected error while calculating the route',
          },
        })
        .catch((saveError: unknown) =>
          this.logger.error(`Could not save job ${pending.id}`, saveError),
        );
    }
  }
}
