import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { JackpotClaimsService } from './jackpot-claims.service';
import { JackpotClaimsController } from './jackpot-claims.controller';
import { JackpotClaim } from './entities/jackpot-claim.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { StaffModule } from '../staff/staff.module';

@Module({
  imports: [
    SequelizeModule.forFeature([JackpotClaim, GlobalPool]),
    StaffModule,
  ],
  controllers: [JackpotClaimsController],
  providers: [JackpotClaimsService],
  exports: [JackpotClaimsService],
})
export class JackpotClaimsModule {}
