import { Module } from '@nestjs/common';
import { NetworkModule } from '../network/network.module.js';
import {
  DEFAULT_JOB_STORE_LIMITS,
  InMemoryJobRepository,
} from './jobs/in-memory-job.repository.js';
import { JobRepository } from './jobs/job.repository.js';
import { ImmediateJobScheduler, JobScheduler } from './jobs/job-scheduler.js';
import { CLOCK, type Clock } from './jobs/route-job.types.js';
import { RouteController } from './route.controller.js';
import { RouteService } from './route.service.js';

@Module({
  imports: [NetworkModule],
  controllers: [RouteController],
  providers: [
    RouteService,
    { provide: CLOCK, useValue: (() => new Date()) satisfies Clock },
    {
      provide: JobRepository,
      inject: [CLOCK],
      useFactory: (clock: Clock) =>
        new InMemoryJobRepository(DEFAULT_JOB_STORE_LIMITS, clock),
    },
    { provide: JobScheduler, useClass: ImmediateJobScheduler },
  ],
})
export class RoutingModule {}
