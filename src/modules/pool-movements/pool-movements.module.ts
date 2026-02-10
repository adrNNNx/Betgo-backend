import { Module } from '@nestjs/common';
import { PoolMovementsService } from './pool-movements.service';
import { PoolMovementsController } from './pool-movements.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { PoolMovement } from './entities/pool-movement.entity';

@Module({
  imports: [SequelizeModule.forFeature([PoolMovement])],
  controllers: [PoolMovementsController],
  providers: [PoolMovementsService],
})
export class PoolMovementsModule {}
