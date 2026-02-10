import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PoolMovementsService } from './pool-movements.service';
import { CreatePoolMovementDto } from './dto/create-pool-movement.dto';
import { UpdatePoolMovementDto } from './dto/update-pool-movement.dto';

@Controller('pool-movements')
export class PoolMovementsController {
  constructor(private readonly poolMovementsService: PoolMovementsService) {}

  @Post()
  create(@Body() createPoolMovementDto: CreatePoolMovementDto) {
    return this.poolMovementsService.create(createPoolMovementDto);
  }

  @Get()
  findAll() {
    return this.poolMovementsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.poolMovementsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePoolMovementDto: UpdatePoolMovementDto) {
    return this.poolMovementsService.update(+id, updatePoolMovementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.poolMovementsService.remove(+id);
  }
}
