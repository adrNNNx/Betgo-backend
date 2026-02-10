import { Module } from '@nestjs/common';
import { PrizesService } from './prizes.service';
import { PrizesController } from './prizes.controller';
import { Prize } from './entities/prize.entity';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([Prize])],
  controllers: [PrizesController],
  providers: [PrizesService],
})
export class PrizesModule {}
