import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Db } from 'mongodb';
import type { EnvConfig } from '../config/env.validation.js';
import { MONGO_DB } from '../database/mongo.module.js';
import {
  GRAPH_CAPACITY,
  GraphRepository,
} from './repository/graph.repository.js';
import { InMemoryGraphRepository } from './repository/in-memory-graph.repository.js';
import { MongoGraphRepository } from './repository/mongo-graph.repository.js';
import { NetworkController } from './network.controller.js';
import { NetworkService } from './network.service.js';

/** The brief asks the in-memory store to keep the last 5 networks. */
const DEFAULT_GRAPH_CAPACITY = 5;

@Module({
  controllers: [NetworkController],
  providers: [
    NetworkService,
    { provide: GRAPH_CAPACITY, useValue: DEFAULT_GRAPH_CAPACITY },
    {
      provide: GraphRepository,
      inject: [
        ConfigService,
        GRAPH_CAPACITY,
        { token: MONGO_DB, optional: true },
      ],
      useFactory: (
        config: ConfigService<EnvConfig, true>,
        capacity: number,
        db?: Db,
      ): GraphRepository => {
        if (config.get('STORAGE', { infer: true }) !== 'mongo') {
          return new InMemoryGraphRepository(capacity);
        }
        if (!db) {
          throw new Error('STORAGE=mongo but MongoModule is not loaded');
        }
        return new MongoGraphRepository(db);
      },
    },
  ],
  exports: [NetworkService],
})
export class NetworkModule {}
