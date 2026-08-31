import { Module } from '@nestjs/common';
import { PoolMovementsService } from './pool-movements.service';
import { PoolMovementsController } from './pool-movements.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { PoolMovement } from './entities/pool-movement.entity';
import { JackpotClaim } from '../jackpot-claims/entities/jackpot-claim.entity';

@Module({
  imports: [SequelizeModule.forFeature([PoolMovement, JackpotClaim])],
  controllers: [PoolMovementsController],
  providers: [PoolMovementsService],
})
export class PoolMovementsModule {}
