import { Module } from '@nestjs/common';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { UserDailyPlaysController } from './user-daily-plays.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserDailyPlay } from './entities/user-daily-play.entity';

@Module({
  imports: [SequelizeModule.forFeature([UserDailyPlay])],
  controllers: [UserDailyPlaysController],
  providers: [UserDailyPlaysService],
})
export class UserDailyPlaysModule {}
