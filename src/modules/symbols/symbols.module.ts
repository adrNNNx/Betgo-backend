import { Module } from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import { SymbolsController } from './symbols.controller';
import { Symbol } from './entities/symbol.entity';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([Symbol])],
  controllers: [SymbolsController],
  providers: [SymbolsService],
})
export class SymbolsModule {}
