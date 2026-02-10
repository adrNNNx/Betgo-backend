import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { BarsModule } from './modules/bars/bars.module';
import { TablesModule } from './modules/tables/tables.module';
import { UsersModule } from './modules/users/users.module';
import { StaffModule } from './modules/staff/staff.module';
import { SymbolsModule } from './modules/symbols/symbols.module';
import { PrizesModule } from './modules/prizes/prizes.module';
import { GlobalPoolModule } from './modules/global-pool/global-pool.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { PlaysModule } from './modules/plays/plays.module';
import { UserDailyPlaysModule } from './modules/user-daily-plays/user-daily-plays.module';
import { RechargeCodesModule } from './modules/recharge-codes/recharge-codes.module';
import { PrizeClaimsModule } from './modules/prize-claims/prize-claims.module';
import { PoolMovementsModule } from './modules/pool-movements/pool-movements.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    DatabaseModule,
    BarsModule,
    TablesModule,
    UsersModule,
    StaffModule,
    SymbolsModule,
    PrizesModule,
    GlobalPoolModule,
    TransactionsModule,
    PlaysModule,
    UserDailyPlaysModule,
    RechargeCodesModule,
    PrizeClaimsModule,
    PoolMovementsModule,
    AuditLogsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
