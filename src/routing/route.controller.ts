import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { OptimizeRouteResponseDto } from './dto/optimize-route-response.dto.js';
import { OptimizeRouteDto } from './dto/optimize-route.dto.js';
import { STATUS_EXAMPLES } from './dto/route-status.examples.js';
import { RouteStatusResponseDto } from './dto/route-status-response.dto.js';
import type { RouteJob } from './jobs/route-job.types.js';
import { RouteService } from './route.service.js';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('route')
@Controller('route')
export class RouteController {
  constructor(private readonly routes: RouteService) {}

  @Post('optimize/:id')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Start an async route calculation',
    description:
      'Returns a jobId immediately. Poll GET /route/status/{jobId} for the result.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Graph id' })
  @ApiBody({
    type: OptimizeRouteDto,
    examples: {
      readmeExample: {
        summary: 'Truck through waypoint C at peak hour',
        value: {
          originNodeId: 'A',
          destinationNodeId: 'E',
          waypoints: ['C'],
          vehicleProfile: { type: 'truck', weight: 4000, hazardous: false },
          departureTime: '08:00',
        },
      },
      testCase1: {
        summary: 'README Test Case 1 (standard path)',
        value: {
          originNodeId: 'A',
          destinationNodeId: 'E',
          vehicleProfile: { type: 'van', weight: 3000, hazardous: false },
          departureTime: '12:00',
        },
      },
    },
  })
  @ApiAcceptedResponse({ type: OptimizeRouteResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid request body or graph id',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Graph not found or evicted',
    type: ErrorResponseDto,
  })
  async optimize(
    @Param('id', UUID_V4) graphId: string,
    @Body() dto: OptimizeRouteDto,
  ): Promise<OptimizeRouteResponseDto> {
    const jobId = await this.routes.submit(graphId, {
      originNodeId: dto.originNodeId,
      destinationNodeId: dto.destinationNodeId,
      waypoints: dto.waypoints ?? [],
      vehicle: {
        type: dto.vehicleProfile.type,
        weight: dto.vehicleProfile.weight,
        hazardous: dto.vehicleProfile.hazardous,
      },
      departureTime: dto.departureTime,
    });
    return { jobId };
  }

  @Get('status/:jobId')
  @ApiOperation({ summary: 'Get the status and result of a route job' })
  @ApiParam({ name: 'jobId', format: 'uuid' })
  @ApiOkResponse({
    type: RouteStatusResponseDto,
    description:
      'COMPLETED jobs carry `result`; FAILED jobs carry `error` with a code.',
    examples: STATUS_EXAMPLES,
  })
  @ApiBadRequestResponse({
    description: 'Job id is not a UUID',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Job not found or expired',
    type: ErrorResponseDto,
  })
  async status(
    @Param('jobId', UUID_V4) jobId: string,
  ): Promise<RouteStatusResponseDto> {
    return toStatusResponse(await this.routes.getJob(jobId));
  }
}

function toStatusResponse(job: RouteJob): RouteStatusResponseDto {
  const response: RouteStatusResponseDto = {
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
  };
  if (job.startedAt) response.startedAt = job.startedAt;
  if (job.completedAt) response.completedAt = job.completedAt;
  if (job.result) response.result = job.result;
  if (job.error) response.error = job.error;
  return response;
}
