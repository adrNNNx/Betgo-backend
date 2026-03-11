// src/modules/user-daily-plays/user-daily-plays.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { UserDailyPlaysController } from './user-daily-plays.controller';
import { UserDailyPlay } from './entities/user-daily-play.entity';
import { Bar } from '../bars/entities/bar.entity';

@Module({
  imports: [SequelizeModule.forFeature([UserDailyPlay, Bar])],
  controllers: [UserDailyPlaysController],
  providers: [UserDailyPlaysService],
  exports: [UserDailyPlaysService],
})
export class UserDailyPlaysModule {}
