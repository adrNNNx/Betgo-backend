import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { GlobalPoolService } from './global-pool.service';
import { CreateGlobalPoolDto } from './dto/create-global-pool.dto';
import { UpdateGlobalPoolDto } from './dto/update-global-pool.dto';

@Controller('global-pool')
export class GlobalPoolController {
  constructor(private readonly globalPoolService: GlobalPoolService) {}

  @Post()
  create(@Body() createGlobalPoolDto: CreateGlobalPoolDto) {
    return this.globalPoolService.create(createGlobalPoolDto);
  }

  @Get()
  findAll() {
    return this.globalPoolService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.globalPoolService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGlobalPoolDto: UpdateGlobalPoolDto) {
    return this.globalPoolService.update(+id, updateGlobalPoolDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.globalPoolService.remove(+id);
  }
}
