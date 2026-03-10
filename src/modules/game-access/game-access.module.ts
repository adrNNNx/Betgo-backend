// src/modules/game-access/game-access.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { GameAccessService } from './game-access.service';
import { GameAccessController } from './game-access.controller';

// Entidades necesarias
import { Bar } from '../bars/entities/bar.entity';
import { UserDailyPlay } from '../user-daily-plays/entities/user-daily-play.entity';
import { User } from '../users/entities/user.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { Play } from '../plays/entities/play.entity';
import { PrizeClaim } from '../prize-claims/entities/prize-claim.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { PoolMovement } from '../pool-movements/entities/pool-movement.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Bar,
      UserDailyPlay,
      User,
      Symbol,
      Prize,
      Play,
      PrizeClaim,
      GlobalPool,
      PoolMovement,
      Transaction,
    ]),
  ],
  controllers: [GameAccessController],
  providers: [GameAccessService],
  exports: [GameAccessService],
})
export class GameAccessModule {}
