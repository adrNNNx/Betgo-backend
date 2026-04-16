// src/modules/prize-claims/prize-claims.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrizeClaimsService } from './prize-claims.service';
import { PrizeClaimsController } from './prize-claims.controller';
import { PrizeClaim } from './entities/prize-claim.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [SequelizeModule.forFeature([PrizeClaim, Prize]), StaffModule],
  controllers: [PrizeClaimsController],
  providers: [PrizeClaimsService],
  exports: [PrizeClaimsService],
})
export class PrizeClaimsModule {}
