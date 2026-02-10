import { Injectable } from '@nestjs/common';
import { CreateRechargeCodeDto } from './dto/create-recharge-code.dto';
import { UpdateRechargeCodeDto } from './dto/update-recharge-code.dto';

@Injectable()
export class RechargeCodesService {
  create(createRechargeCodeDto: CreateRechargeCodeDto) {
    return 'This action adds a new rechargeCode';
  }

  findAll() {
    return `This action returns all rechargeCodes`;
  }

  findOne(id: number) {
    return `This action returns a #${id} rechargeCode`;
  }

  update(id: number, updateRechargeCodeDto: UpdateRechargeCodeDto) {
    return `This action updates a #${id} rechargeCode`;
  }

  remove(id: number) {
    return `This action removes a #${id} rechargeCode`;
  }
}
