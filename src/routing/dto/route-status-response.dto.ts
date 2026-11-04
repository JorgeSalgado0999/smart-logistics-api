import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class RouteErrorDto {
  @ApiProperty({ enum: JOB_ERROR_CODES, example: 'UNREACHABLE' })
  code: JobErrorCode;

  /** @example 'No route from A to E (leg 1 of 1)' */
  message: string;
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
