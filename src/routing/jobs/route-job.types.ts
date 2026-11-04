import {
  ROUTE_ERROR_CODES,
  type RouteError,
  type RouteErrorCode,
  type RouteResult,
} from '../route-planner.js';

export const JOB_STATUSES = [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export type JobErrorCode = RouteErrorCode | 'INTERNAL_ERROR';
/** For Swagger enums. */
export const JOB_ERROR_CODES = [
  ...ROUTE_ERROR_CODES,
  'INTERNAL_ERROR',
] as const satisfies readonly JobErrorCode[];

export interface JobResult extends RouteResult {
  /** Time spent calculating the route, in milliseconds. */
  readonly durationMs: number;
}

/** Route errors carry extra fields; INTERNAL_ERROR never exposes details. */
export type JobError =
  RouteError | { readonly code: 'INTERNAL_ERROR'; readonly message: string };

/**
 * A route calculation job. Records are replaced, never mutated: each status
 * change saves a new object.
 */
export interface RouteJob {
  readonly id: string;
  readonly graphId: string;
  readonly status: JobStatus;
  readonly createdAt: Date;
  readonly startedAt?: Date;
  readonly completedAt?: Date;
  /** Set when COMPLETED. */
  readonly result?: JobResult;
  /** Set when FAILED. */
  readonly error?: JobError;
}

export function isFinished(job: RouteJob): boolean {
  return job.status === 'COMPLETED' || job.status === 'FAILED';
}

/** Current time. Injected so tests can control it. */
export type Clock = () => Date;
export const CLOCK = Symbol('CLOCK');
