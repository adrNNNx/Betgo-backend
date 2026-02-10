import { Module } from '@nestjs/common';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { Bar } from './entities/bar.entity';

@Module({
  imports: [SequelizeModule.forFeature([Bar])],
  controllers: [BarsController],
  providers: [BarsService],
})
export class BarsModule {}
