import { Module } from '@nestjs/common';
import {
  GRAPH_CAPACITY,
  GraphRepository,
} from './repository/graph.repository.js';
import { InMemoryGraphRepository } from './repository/in-memory-graph.repository.js';
import { NetworkController } from './network.controller.js';
import { NetworkService } from './network.service.js';

/** The brief asks the in-memory store to keep the last 5 networks. */
const DEFAULT_GRAPH_CAPACITY = 5;

@Module({
  controllers: [NetworkController],
  providers: [
    NetworkService,
    { provide: GRAPH_CAPACITY, useValue: DEFAULT_GRAPH_CAPACITY },
    { provide: GraphRepository, useClass: InMemoryGraphRepository },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
