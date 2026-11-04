import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
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
    NetworkModule,
  ],
})
export class AppModule {}
