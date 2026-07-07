import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

import { AppController } from './app.controller';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { AuthModule } from './core/auth/auth.module';
import { PeopleModule } from './domains/people/people.module';
import { PullRequestsModule } from './domains/pull-requests/pull-requests.module';
import { IngestionModule } from './domains/ingestion/ingestion.module';
import { MetricsModule } from './domains/metrics/metrics.module';
import { SchedulerModule } from './scheduler/scheduler.module';

import dataSource from '../data-source';
import { Person } from './domains/people/entities/person.entity';
import { PullRequest } from './domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from './domains/pull-requests/entities/pr-event.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      ...dataSource.options,
      entities: [Person, PullRequest, PrEvent],
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      synchronize: process.env.NODE_ENV !== 'production',
      migrationsRun: process.env.NODE_ENV === 'production',
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: configService.get('NODE_ENV') !== 'production',
        context: ({ req }) => ({ req }),
      }),
    }),

    InfrastructureModule,

    AuthModule,
    PeopleModule,
    PullRequestsModule,
    IngestionModule,
    MetricsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
