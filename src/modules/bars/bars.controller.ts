import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BarsService } from './bars.service';
import { CreateBarDto } from './dto/create-bar.dto';
import { UpdateBarDto } from './dto/update-bar.dto';

@Controller('bars')
export class BarsController {
  constructor(private readonly barsService: BarsService) {}

  @Post()
  create(@Body() createBarDto: CreateBarDto) {
    return this.barsService.create(createBarDto);
  }

  @Get()
  findAll() {
    return this.barsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.barsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBarDto: UpdateBarDto) {
    return this.barsService.update(+id, updateBarDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.barsService.remove(+id);
  }
}
