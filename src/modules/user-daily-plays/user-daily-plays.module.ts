// src/modules/user-daily-plays/user-daily-plays.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { UserDailyPlaysController } from './user-daily-plays.controller';
import { UserDailyPlay } from './entities/user-daily-play.entity';
import { Bar } from '../bars/entities/bar.entity';
import { User } from '../users/entities/user.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';

@Module({
  imports: [SequelizeModule.forFeature([UserDailyPlay, Bar, User, AuditLog])],
  controllers: [UserDailyPlaysController],
  providers: [UserDailyPlaysService],
  exports: [UserDailyPlaysService],
})
export class UserDailyPlaysModule {}
