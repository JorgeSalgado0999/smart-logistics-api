import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { EnvConfig } from './config/env.validation.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  configureApp(app);

  const config = app.get(ConfigService<EnvConfig, true>);
  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
