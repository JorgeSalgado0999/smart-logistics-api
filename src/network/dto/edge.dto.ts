import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

const FINITE = { allowNaN: false, allowInfinity: false } as const;

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
   * Base cost of travelling this edge. Must be >= 0.
   * @example 10
   */
  @IsNumber(FINITE)
  @Min(0)
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
   * Cost multiplier during peak hours. Defaults to 1.
   * @example 1.5
   */
  @ApiPropertyOptional(POSITIVE_SCHEMA)
  @IsOptional()
  @IsNumber(FINITE)
  @IsPositive()
  trafficMultiplier?: number;
}
