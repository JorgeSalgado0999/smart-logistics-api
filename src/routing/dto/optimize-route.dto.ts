import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDefined,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DEPARTURE_TIME_PATTERN } from '../constraints/departure-time.js';

export const MAX_WAYPOINTS = 100;

export class VehicleProfileDto {
  /**
   * Vehicle kind. Informational; routing uses weight and hazardous.
   * @example 'truck'
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type: string;

  /**
   * Vehicle weight. Edges with a lower maxWeight are skipped.
   * @example 4000
   */
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  weight: number;

  /**
   * Carries hazardous materials. Edges marked noHazardous are skipped.
   * @example false
   */
  @IsBoolean()
  hazardous: boolean;
}

export class OptimizeRouteDto {
  /** @example 'A' */
  @IsString()
  @IsNotEmpty()
  originNodeId: string;

  /** @example 'E' */
  @IsString()
  @IsNotEmpty()
  destinationNodeId: string;

  /**
   * Stops visited in this order between origin and destination.
   * @example ['C']
   */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_WAYPOINTS)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  waypoints?: string[];

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => VehicleProfileDto)
  vehicleProfile: VehicleProfileDto;

  /**
   * 24-hour HH:MM. Departing 07:00-09:00 or 17:00-19:00 applies each
   * edge's trafficMultiplier.
   * @example '08:00'
   */
  // The Swagger plugin ignores @Matches, so the pattern is stated here.
  @ApiProperty({ pattern: DEPARTURE_TIME_PATTERN.source })
  @IsString()
  @Matches(DEPARTURE_TIME_PATTERN, {
    message: 'departureTime must be 24-hour HH:MM, e.g. 08:00',
  })
  departureTime: string;
}
