import type { RouteJob } from './route-job.types.js';

/**
 * Storage for route jobs. Abstract class so it works as a DI token and the
 * in-memory store can be swapped later.
 */
export abstract class JobRepository {
  /** Inserts or replaces the job with the same id. */
  abstract save(job: RouteJob): Promise<void>;
  abstract findById(id: string): Promise<RouteJob | undefined>;
}
