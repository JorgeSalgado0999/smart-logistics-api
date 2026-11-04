import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { MongoModule } from './database/mongo.module.js';
import { NetworkModule } from './network/network.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // Jest sets NODE_ENV=test; tests must not pick up a developer's .env.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    // Opens a Mongo connection only when it is the chosen storage.
    ConditionalModule.registerWhen(
      MongoModule,
      (env) => env.STORAGE?.trim() === 'mongo',
    ),
    NetworkModule,
  ],
})
export class AppModule {}
