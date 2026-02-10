import { Module } from '@nestjs/common';
import { GlobalPoolService } from './global-pool.service';
import { GlobalPoolController } from './global-pool.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { GlobalPool } from './entities/global-pool.entity';

@Module({
  imports: [SequelizeModule.forFeature([GlobalPool])],
  controllers: [GlobalPoolController],
  providers: [GlobalPoolService],
})
export class GlobalPoolModule {}
