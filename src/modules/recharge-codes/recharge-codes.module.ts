import { Module } from '@nestjs/common';
import { RechargeCodesService } from './recharge-codes.service';
import { RechargeCodesController } from './recharge-codes.controller';
import { SequelizeModule } from '@nestjs/sequelize';
import { RechargeCode } from './entities/recharge-code.entity';

@Module({
  imports: [SequelizeModule.forFeature([RechargeCode])],
  controllers: [RechargeCodesController],
  providers: [RechargeCodesService],
})
export class RechargeCodesModule {}
