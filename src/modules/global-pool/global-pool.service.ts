import { Injectable } from '@nestjs/common';
import { CreateGlobalPoolDto } from './dto/create-global-pool.dto';
import { UpdateGlobalPoolDto } from './dto/update-global-pool.dto';

@Injectable()
export class GlobalPoolService {
  create(createGlobalPoolDto: CreateGlobalPoolDto) {
    return 'This action adds a new globalPool';
  }

  findAll() {
    return `This action returns all globalPool`;
  }

  findOne(id: number) {
    return `This action returns a #${id} globalPool`;
  }

  update(id: number, updateGlobalPoolDto: UpdateGlobalPoolDto) {
    return `This action updates a #${id} globalPool`;
  }

  remove(id: number) {
    return `This action removes a #${id} globalPool`;
  }
}
