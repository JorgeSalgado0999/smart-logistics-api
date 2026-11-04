import { JobRepository } from './job.repository.js';
import { type Clock, isFinished, type RouteJob } from './route-job.types.js';

export interface JobStoreLimits {
  /** How long a finished job stays readable, in ms. */
  readonly ttlMs: number;
  /** Soft cap. Over it, the oldest finished jobs are dropped first. */
  readonly maxJobs: number;
}

export const DEFAULT_JOB_STORE_LIMITS: JobStoreLimits = {
  ttlMs: 60 * 60 * 1000,
  maxJobs: 10_000,
};

/**
 * Keeps route jobs in memory. Finished jobs expire after `ttlMs`. Cleanup
 * runs on each save, so no background timer is needed; reads also hide
 * expired jobs. Jobs still PENDING or PROCESSING are never dropped.
 */
export class InMemoryJobRepository extends JobRepository {
  /** Insertion order = creation order, since updates keep a key's position. */
  private readonly jobs = new Map<string, RouteJob>();

  constructor(
    private readonly limits: JobStoreLimits,
    private readonly clock: Clock,
  ) {
    super();
    if (
      !(limits.ttlMs > 0) ||
      !Number.isInteger(limits.maxJobs) ||
      limits.maxJobs < 1
    ) {
      throw new Error(
        `Invalid job store limits: ttlMs=${limits.ttlMs}, maxJobs=${limits.maxJobs}`,
      );
    }
  }

  save(job: RouteJob): Promise<void> {
    this.jobs.set(job.id, job);
    this.prune();
    return Promise.resolve();
  }

  findById(id: string): Promise<RouteJob | undefined> {
    const job = this.jobs.get(id);
    if (job && this.isExpired(job, this.clock().getTime())) {
      this.jobs.delete(id);
      return Promise.resolve(undefined);
    }
    return Promise.resolve(job);
  }

  private prune(): void {
    const now = this.clock().getTime();
    for (const [id, job] of this.jobs) {
      if (this.isExpired(job, now)) this.jobs.delete(id);
    }

    for (const [id, job] of this.jobs) {
      if (this.jobs.size <= this.limits.maxJobs) break;
      if (isFinished(job)) this.jobs.delete(id);
    }
  }

  private isExpired(job: RouteJob, now: number): boolean {
    return (
      isFinished(job) &&
      job.completedAt !== undefined &&
      now - job.completedAt.getTime() >= this.limits.ttlMs
    );
  }
}
