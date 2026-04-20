import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrizesService } from './prizes.service';
import { PrizesController } from './prizes.controller';
import { Prize } from './entities/prize.entity';
import { Bar } from '../bars/entities/bar.entity';

@Module({
  imports: [SequelizeModule.forFeature([Prize, Bar])],
  controllers: [PrizesController],
  providers: [PrizesService],
  exports: [PrizesService],
})
export class PrizesModule {}
