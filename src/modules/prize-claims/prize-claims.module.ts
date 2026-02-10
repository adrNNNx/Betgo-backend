import { Module } from '@nestjs/common';
import { PrizeClaimsService } from './prize-claims.service';
import { PrizeClaimsController } from './prize-claims.controller';
import { PrizeClaim } from './entities/prize-claim.entity';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([PrizeClaim])],
  controllers: [PrizeClaimsController],
  providers: [PrizeClaimsService],
})
export class PrizeClaimsModule {}
