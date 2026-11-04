import {
  Global,
  Inject,
  Logger,
  Module,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient } from 'mongodb';
import type { EnvConfig } from '../config/env.validation.js';

/** DI token for the app's Mongo database handle. */
export const MONGO_DB = Symbol('MONGO_DB');

/** Fail startup quickly when Mongo can't be reached. */
const CONNECT_TIMEOUT_MS = 5000;

/**
 * Opens one MongoClient for the app and closes it on shutdown. Only loaded
 * when STORAGE=mongo (see AppModule).
 */
@Global()
@Module({
  providers: [
    {
      provide: MongoClient,
      inject: [ConfigService],
      useFactory: async (config: ConfigService<EnvConfig, true>) => {
        const client = new MongoClient(
          config.get('MONGO_URI', { infer: true })!,
          {
            serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
          },
        );
        try {
          await client.connect();
          await client.db('admin').command({ ping: 1 });
        } catch (error) {
          await client.close().catch(() => undefined);
          // The URI may hold credentials, so it is not part of the message.
          throw new Error(
            `Could not connect to MongoDB (check MONGO_URI): ${(error as Error).message}`,
          );
        }
        return client;
      },
    },
    {
      provide: MONGO_DB,
      inject: [MongoClient, ConfigService],
      useFactory: (
        client: MongoClient,
        config: ConfigService<EnvConfig, true>,
      ) => client.db(config.get('MONGO_DB', { infer: true })),
    },
  ],
  exports: [MONGO_DB],
})
export class MongoModule implements OnModuleDestroy {
  private readonly logger = new Logger(MongoModule.name);

  constructor(@Inject(MongoClient) private readonly client: MongoClient) {}

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
    this.logger.log('MongoDB connection closed');
  }
}
