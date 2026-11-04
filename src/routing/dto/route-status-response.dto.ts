import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BLOCKING_CONSTRAINTS,
  type BlockingConstraint,
} from '../route-planner.js';
import {
  JOB_ERROR_CODES,
  JOB_STATUSES,
  type JobErrorCode,
  type JobStatus,
} from '../jobs/route-job.types.js';

export class RouteLegDto {
  /** @example 'A' */
  from: string;
  /** @example 'C' */
  to: string;
  /** @example ['A', 'C'] */
  path: string[];
  /** @example 15 */
  cost: number;
}

export class RouteResultDto {
  /** @example '3f1c2b9e-8d4a-4c6e-9b7a-2e5f1d0c8a41' */
  graphId: string;

  /**
   * Sum of edge costs, with peak multipliers applied. Rounded to 6 decimals.
   * @example 30
   */
  totalCost: number;

  /**
   * Nodes from origin to destination through every waypoint.
   * @example ['A', 'C', 'D', 'E']
   */
  path: string[];

  /**
   * Time spent calculating the route, in milliseconds.
   * @example 0.214
   */
  durationMs: number;

  /** One entry per origin -> waypoint -> ... -> destination step. */
  legs: RouteLegDto[];
}

export class FailedLegDto {
  /**
   * 0-based leg number: 0 is origin -> first stop.
   * @example 0
   */
  index: number;
  /** @example 'A' */
  from: string;
  /** @example 'E' */
  to: string;
}

export class RouteErrorDto {
  /**
   * INVALID_NODE: a requested node isn't in the graph.
   * UNREACHABLE: no path exists for a leg, whatever the vehicle.
   * CONSTRAINTS_BLOCK_ROUTE: a path exists, but not for this vehicle.
   * INTERNAL_ERROR: unexpected failure.
   */
  @ApiProperty({ enum: JOB_ERROR_CODES, example: 'CONSTRAINTS_BLOCK_ROUTE' })
  code: JobErrorCode;

  /** @example "Vehicle can't reach E from A: blocked by weight limit (leg 1 of 1)" */
  message: string;

  /**
   * INVALID_NODE only: unknown ids, in request order.
   * @example ['X']
   */
  unknownNodes?: string[];

  /** UNREACHABLE and CONSTRAINTS_BLOCK_ROUTE only. */
  @ApiPropertyOptional({ type: FailedLegDto })
  failedLeg?: FailedLegDto;

  /** CONSTRAINTS_BLOCK_ROUTE only: the vehicle rules that block the leg. */
  @ApiPropertyOptional({
    enum: BLOCKING_CONSTRAINTS,
    isArray: true,
    example: ['WEIGHT'],
  })
  blockedBy?: BlockingConstraint[];
}

export class RouteStatusResponseDto {
  /** @example '7b3e5a52-1f0c-4c55-9d1e-6a2f3c8b9e10' */
  jobId: string;

  @ApiProperty({ enum: JOB_STATUSES, example: 'COMPLETED' })
  status: JobStatus;

  createdAt: Date;

  /** Set once processing starts. */
  startedAt?: Date;

  /** Set when COMPLETED or FAILED. */
  completedAt?: Date;

  /** Present when status is COMPLETED. */
  @ApiPropertyOptional({ type: RouteResultDto })
  result?: RouteResultDto;

  /** Present when status is FAILED. */
  @ApiPropertyOptional({ type: RouteErrorDto })
  error?: RouteErrorDto;
}
