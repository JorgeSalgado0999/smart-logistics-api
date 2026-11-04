import { Logger } from '@nestjs/common';

export type JobTask = () => Promise<void>;

/**
 * Runs job tasks outside the request. Abstract class so it works as a DI
 * token; tests use a manual scheduler, and a worker-thread version could
 * replace this one later.
 */
export abstract class JobScheduler {
  abstract schedule(task: JobTask): void;
}

/**
 * Runs each task on a later turn of the event loop (setImmediate), so the
 * HTTP response is sent before routing starts.
 */
export class ImmediateJobScheduler extends JobScheduler {
  private readonly logger = new Logger(ImmediateJobScheduler.name);

  schedule(task: JobTask): void {
    setImmediate(() => {
      task().catch((error: unknown) => {
        // Tasks handle their own errors; this is a last-resort log.
        this.logger.error('Unhandled error in job task', error);
      });
    });
  }
}
