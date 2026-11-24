import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PrizesService } from './prizes.service';
import { PrizesController } from './prizes.controller';
import { PrizeInventoryService } from './prize-inventory.service';
import { Prize } from './entities/prize.entity';
import { Bar } from '../bars/entities/bar.entity';
import { PrizeClaim } from '../prize-claims/entities/prize-claim.entity';

@Module({
  // PrizeClaim sólo como modelo: el inventario cuenta comprobantes, pero este
  // módulo no importa PrizeClaimsModule (que depende de éste) y no hay ciclo.
  imports: [SequelizeModule.forFeature([Prize, Bar, PrizeClaim])],
  controllers: [PrizesController],
  providers: [PrizesService, PrizeInventoryService],
  exports: [PrizesService, PrizeInventoryService],
})
export class PrizesModule {}
