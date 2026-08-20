import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AreaRule } from './entities/area-rule.entity';
import { PrAreaService } from './pr-area.service';

@Module({
  imports: [TypeOrmModule.forFeature([AreaRule])],
  providers: [PrAreaService],
  exports: [PrAreaService],
})
export class PrAreaModule {}
