import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Bar } from './entities/bar.entity';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';
import { BarQRService } from './services/bar-qr.service';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { PoolMovement } from '../pool-movements/entities/pool-movement.entity';
import { Transaction } from '../transactions/entities/transaction.entity';
import { UserDailyPlaysModule } from '../user-daily-plays/user-daily-plays.module';

@Module({
  imports: [
    SequelizeModule.forFeature([Bar, GlobalPool, PoolMovement, Transaction]),
    UserDailyPlaysModule,
  ],
  controllers: [BarsController],
  providers: [BarsService, BarQRService],
  exports: [BarsService, BarQRService],
})
export class BarsModule {}
