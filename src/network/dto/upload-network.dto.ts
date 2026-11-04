import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, ValidateNested } from 'class-validator';
import { EdgeDto } from './edge.dto.js';

export class UploadNetworkDto {
  /** Directed edges of the network. Nodes are derived from them. */
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => EdgeDto)
  edges: EdgeDto[];
}
