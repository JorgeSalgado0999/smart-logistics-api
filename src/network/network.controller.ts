import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { ErrorResponseDto } from '../common/dto/error-response.dto.js';
import { NetworkNodesResponseDto } from './dto/network-nodes-response.dto.js';
import { UploadNetworkResponseDto } from './dto/upload-network-response.dto.js';
import { UploadNetworkDto } from './dto/upload-network.dto.js';
import { NetworkService } from './network.service.js';

const README_GRAPH = {
  edges: [
    {
      from: 'A',
      to: 'B',
      cost: 10,
      maxWeight: 10000,
      noHazardous: false,
      trafficMultiplier: 1.0,
    },
    {
      from: 'A',
      to: 'C',
      cost: 15,
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.5,
    },
    {
      from: 'B',
      to: 'D',
      cost: 12,
      maxWeight: 10000,
      noHazardous: false,
      trafficMultiplier: 2.0,
    },
    {
      from: 'C',
      to: 'D',
      cost: 5,
      maxWeight: 5000,
      noHazardous: true,
      trafficMultiplier: 1.0,
    },
    {
      from: 'D',
      to: 'E',
      cost: 10,
      maxWeight: 8000,
      noHazardous: false,
      trafficMultiplier: 1.2,
    },
  ],
};

@ApiTags('network')
@Controller('network')
export class NetworkController {
  constructor(private readonly network: NetworkService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a graph (directed edges) and get its id' })
  @ApiBody({
    type: UploadNetworkDto,
    examples: {
      validationGraph: {
        summary: 'README validation graph',
        value: README_GRAPH,
      },
    },
  })
  @ApiCreatedResponse({ type: UploadNetworkResponseDto })
  @ApiBadRequestResponse({
    description: 'Invalid graph definition',
    type: ErrorResponseDto,
  })
  async upload(
    @Body() dto: UploadNetworkDto,
  ): Promise<UploadNetworkResponseDto> {
    return { id: await this.network.upload(dto) };
  }

  @Get('nodes/:id')
  @ApiOperation({ summary: 'List the nodes of a stored graph' })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: NetworkNodesResponseDto })
  @ApiBadRequestResponse({
    description: 'Id is not a UUID',
    type: ErrorResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Graph not found or evicted',
    type: ErrorResponseDto,
  })
  async getNodes(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<NetworkNodesResponseDto> {
    const graph = await this.network.getGraph(id);
    return {
      graphId: graph.id,
      nodes: graph.nodes.map((node) => ({ id: node.id })),
    };
  }
}
