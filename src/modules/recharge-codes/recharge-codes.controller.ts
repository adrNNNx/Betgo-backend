import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RechargeCodesService } from './recharge-codes.service';
import { CreateRechargeCodeDto } from './dto/create-recharge-code.dto';
import { UpdateRechargeCodeDto } from './dto/update-recharge-code.dto';

@Controller('recharge-codes')
export class RechargeCodesController {
  constructor(private readonly rechargeCodesService: RechargeCodesService) {}

  @Post()
  create(@Body() createRechargeCodeDto: CreateRechargeCodeDto) {
    return this.rechargeCodesService.create(createRechargeCodeDto);
  }

  @Get()
  findAll() {
    return this.rechargeCodesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rechargeCodesService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateRechargeCodeDto: UpdateRechargeCodeDto) {
    return this.rechargeCodesService.update(+id, updateRechargeCodeDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.rechargeCodesService.remove(+id);
  }
}
