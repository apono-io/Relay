import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { join } from 'path';

import { AppController } from './app.controller';
import { formatGraphqlError } from './infrastructure/graphql/format-error';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { RbacModule } from './core/rbac/rbac.module';
import { AuthModule } from './core/auth/auth.module';
import { PeopleModule } from './domains/people/people.module';
import { PullRequestsModule } from './domains/pull-requests/pull-requests.module';
import { IngestionModule } from './domains/ingestion/ingestion.module';
import { MetricsModule } from './domains/metrics/metrics.module';
import { SchedulerModule } from './scheduler/scheduler.module';

import dataSource from '../data-source';
import { Person } from './domains/people/entities/person.entity';
import { GithubIdentity } from './domains/people/entities/github-identity.entity';
import { PullRequest } from './domains/pull-requests/entities/pull-request.entity';
import { PrEvent } from './domains/pull-requests/entities/pr-event.entity';
import { Repo } from './domains/repos/entities/repo.entity';
import { AreaRule } from './domains/repos/entities/area-rule.entity';
import { Suggestion } from './domains/assignment/entities/suggestion.entity';
import { AppSetting } from './domains/assignment/entities/app-setting.entity';
import { PersonSettings } from './domains/people/entities/person-settings.entity';
import { ReposModule } from './domains/repos/repos.module';
import { AssignmentModule } from './domains/assignment/assignment.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      ...dataSource.options,
      entities: [
        Person,
        GithubIdentity,
        PersonSettings,
        PullRequest,
        PrEvent,
        Repo,
        AreaRule,
        Suggestion,
        AppSetting,
      ],
      migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
      synchronize: false,
      migrationsRun: true,
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
        formatError: formatGraphqlError,
      }),
    }),

    InfrastructureModule,
    RbacModule,

    AuthModule,
    PeopleModule,
    PullRequestsModule,
    IngestionModule,
    ReposModule,
    AssignmentModule,
    MetricsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
