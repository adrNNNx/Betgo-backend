import { Module } from '@nestjs/common';
import { GlobalPoolService } from './global-pool.service';
import { GlobalPoolController } from './global-pool.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { GlobalPool } from './entities/global-pool.entity';
import { PoolMovement } from '../pool-movements/entities/pool-movement.entity';

@Module({
  imports: [SequelizeModule.forFeature([GlobalPool, PoolMovement])],
  controllers: [GlobalPoolController],
  providers: [GlobalPoolService],
})
export class GlobalPoolModule {}
