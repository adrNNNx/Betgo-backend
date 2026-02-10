import { Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { TablesController } from './tables.controller';
import { TableEntity } from './entities/table.entity';
import { SequelizeModule } from '@nestjs/sequelize';

@Module({
  imports: [SequelizeModule.forFeature([TableEntity])],
  controllers: [TablesController],
  providers: [TablesService],
})
export class TablesModule {}
