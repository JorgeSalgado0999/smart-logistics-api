import { ApiProperty } from '@nestjs/swagger';

/** Body of a 4xx response, as NestJS sends it. */
export class ErrorResponseDto {
  /** @example 400 */
  statusCode: number;

  /** One message, or one per failed validation rule. */
  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: ['departureTime must be 24-hour HH:MM, e.g. 08:00'],
  })
  message: string | string[];

  /** @example 'Bad Request' */
  error: string;
}
