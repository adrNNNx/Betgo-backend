import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { SymbolsService } from './symbols.service';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';

@Controller('symbols')
export class SymbolsController {
  constructor(private readonly symbolsService: SymbolsService) {}

  @Post()
  create(@Body() createSymbolDto: CreateSymbolDto) {
    return this.symbolsService.create(createSymbolDto);
  }

  @Get()
  findAll() {
    return this.symbolsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.symbolsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSymbolDto: UpdateSymbolDto) {
    return this.symbolsService.update(+id, updateSymbolDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.symbolsService.remove(+id);
  }
}
