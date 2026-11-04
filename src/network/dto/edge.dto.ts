import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const FINITE = { allowNaN: false, allowInfinity: false } as const;

/**
 * Upper bounds keep every route cost finite: even a path over thousands of
 * max-cost edges at max multiplier stays far below Number.MAX_VALUE.
 */
export const MAX_EDGE_COST = 1e9;
export const MAX_TRAFFIC_MULTIPLIER = 1000;

/** The Swagger plugin reads @IsPositive() as minimum 1; values like 0.5 are valid. */
const POSITIVE_SCHEMA = { minimum: 0, exclusiveMinimum: true } as const;

export class EdgeDto {
  /**
   * Start node id.
   * @example 'A'
   */
  @IsString()
  @IsNotEmpty()
  from: string;

  /**
   * End node id. Edges are directed: from -> to only.
   * @example 'B'
   */
  @IsString()
  @IsNotEmpty()
  to: string;

  /**
   * Base cost of travelling this edge. From 0 to 1e9.
   * @example 10
   */
  @IsNumber(FINITE)
  @Min(0)
  @Max(MAX_EDGE_COST)
  cost: number;

  /**
   * Max vehicle weight allowed. Omit for no limit.
   * @example 5000
   */
  @ApiPropertyOptional(POSITIVE_SCHEMA)
  @IsOptional()
  @IsNumber(FINITE)
  @IsPositive()
  maxWeight?: number;

  /**
   * When true, hazardous vehicles cannot use this edge. Defaults to false.
   * @example true
   */
  @IsOptional()
  @IsBoolean()
  noHazardous?: boolean;

  /**
   * Cost multiplier during peak hours. Above 0, at most 1000. Defaults to 1.
   * @example 1.5
   */
  @ApiPropertyOptional({
    ...POSITIVE_SCHEMA,
    maximum: MAX_TRAFFIC_MULTIPLIER,
  })
  @IsOptional()
  @IsNumber(FINITE)
  @IsPositive()
  @Max(MAX_TRAFFIC_MULTIPLIER)
  trafficMultiplier?: number;
}
