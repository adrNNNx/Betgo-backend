// src/modules/symbols/symbols.module.ts
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { SymbolsService } from './symbols.service';
import { SymbolsController } from './symbols.controller';
import { Symbol } from './entities/symbol.entity';
import { Bar } from '../bars/entities/bar.entity';
import { Prize } from '../prizes/entities/prize.entity';

@Module({
  imports: [SequelizeModule.forFeature([Symbol, Bar, Prize])],
  controllers: [SymbolsController],
  providers: [SymbolsService],
  exports: [SymbolsService],
})
export class SymbolsModule {}
