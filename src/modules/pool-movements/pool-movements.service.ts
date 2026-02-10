import { Injectable } from '@nestjs/common';
import { CreatePoolMovementDto } from './dto/create-pool-movement.dto';
import { UpdatePoolMovementDto } from './dto/update-pool-movement.dto';

@Injectable()
export class PoolMovementsService {
  create(createPoolMovementDto: CreatePoolMovementDto) {
    return 'This action adds a new poolMovement';
  }

  findAll() {
    return `This action returns all poolMovements`;
  }

  findOne(id: number) {
    return `This action returns a #${id} poolMovement`;
  }

  update(id: number, updatePoolMovementDto: UpdatePoolMovementDto) {
    return `This action updates a #${id} poolMovement`;
  }

  remove(id: number) {
    return `This action removes a #${id} poolMovement`;
  }
}
