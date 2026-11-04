import { Module } from '@nestjs/common';
import { NetworkModule } from './network/network.module.js';

@Module({
  imports: [NetworkModule],
})
export class AppModule {}
