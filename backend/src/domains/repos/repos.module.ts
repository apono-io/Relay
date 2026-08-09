import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Repo } from './entities/repo.entity';
import { AreaRule } from './entities/area-rule.entity';
import { ReposService } from './repos.service';
import { ReposResolver } from './repos.resolver';
import { IngestionModule } from '@/domains/ingestion/ingestion.module';

@Module({
  imports: [TypeOrmModule.forFeature([Repo, AreaRule]), IngestionModule],
  providers: [ReposService, ReposResolver],
  exports: [ReposService],
})
export class ReposModule {}
