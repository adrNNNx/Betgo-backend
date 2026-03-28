// src/modules/recharge-codes/recharge-codes.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { RechargeCodesService } from './recharge-codes.service';
import { RechargeCodesController } from './recharge-codes.controller';
import { RechargeCode } from './entities/recharge-code.entity';
import { User } from '../users/entities/user.entity';
import { Staff } from '../staff/entities/staff.entity';
import { Transaction } from '../transactions/entities/transaction.entity';

@Module({
  imports: [
    SequelizeModule.forFeature([RechargeCode, User, Staff, Transaction]),
  ],
  controllers: [RechargeCodesController],
  providers: [RechargeCodesService],
  exports: [RechargeCodesService],
})
export class RechargeCodesModule {}
