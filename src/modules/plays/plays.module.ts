import { Module } from '@nestjs/common';
import { PlaysService } from './plays.service';
import { PlaysController } from './plays.controller';
import { Play } from './entities/play.entity';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([Play])],
  controllers: [PlaysController],
  providers: [PlaysService],
})
export class PlaysModule {}
