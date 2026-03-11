// src/modules/plays/plays.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { PlaysService } from './plays.service';
import { PlaysController } from './plays.controller';
import { Play } from './entities/play.entity';
import { Symbol } from '../symbols/entities/symbol.entity';
import { Prize } from '../prizes/entities/prize.entity';
import { PrizeClaim } from '../prize-claims/entities/prize-claim.entity';

@Module({
  imports: [SequelizeModule.forFeature([Play, Symbol, Prize, PrizeClaim])],
  controllers: [PlaysController],
  providers: [PlaysService],
  exports: [PlaysService],
})
export class PlaysModule {}
