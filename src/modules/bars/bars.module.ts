import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Bar } from './entities/bar.entity';
import { BarsService } from './bars.service';
import { BarsController } from './bars.controller';
import { BarQRService } from './services/bar-qr.service';

@Module({
  imports: [SequelizeModule.forFeature([Bar])],
  controllers: [BarsController],
  providers: [BarsService, BarQRService],
  exports: [BarsService, BarQRService],
})
export class BarsModule {}
