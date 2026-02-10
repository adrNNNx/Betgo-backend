import { Injectable } from '@nestjs/common';
import { CreateSymbolDto } from './dto/create-symbol.dto';
import { UpdateSymbolDto } from './dto/update-symbol.dto';

@Injectable()
export class SymbolsService {
  create(createSymbolDto: CreateSymbolDto) {
    return 'This action adds a new symbol';
  }

  findAll() {
    return `This action returns all symbols`;
  }

  findOne(id: number) {
    return `This action returns a #${id} symbol`;
  }

  update(id: number, updateSymbolDto: UpdateSymbolDto) {
    return `This action updates a #${id} symbol`;
  }

  remove(id: number) {
    return `This action removes a #${id} symbol`;
  }
}
