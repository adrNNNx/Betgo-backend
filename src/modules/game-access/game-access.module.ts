// src/modules/game-access/game-access.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { GameAccessService } from './game-access.service';
import { GameAccessController } from './game-access.controller';

// Módulos de servicios inyectados
import { BarsModule } from '../bars/bars.module';
import { PlaysModule } from '../plays/plays.module';
import { UserDailyPlaysModule } from '../user-daily-plays/user-daily-plays.module';

// Modelos que aún no tienen service propio
import { User } from '../users/entities/user.entity';
import { GlobalPool } from '../global-pool/entities/global-pool.entity';
import { PoolMovement } from '../pool-movements/entities/pool-movement.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    // Módulos con services exportados
    BarsModule,
    PlaysModule,
    UserDailyPlaysModule,

    // Modelos directos (migrar a modules propios en el futuro)
    SequelizeModule.forFeature([User, GlobalPool, PoolMovement, Transaction]),
  ],
  controllers: [GameAccessController],
  providers: [GameAccessService],
  exports: [GameAccessService],
})
export class GameAccessModule {}
