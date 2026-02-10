import { Injectable } from '@nestjs/common';
import { CreatePrizeClaimDto } from './dto/create-prize-claim.dto';
import { UpdatePrizeClaimDto } from './dto/update-prize-claim.dto';

@Injectable()
export class PrizeClaimsService {
  create(createPrizeClaimDto: CreatePrizeClaimDto) {
    return 'This action adds a new prizeClaim';
  }

  findAll() {
    return `This action returns all prizeClaims`;
  }

  findOne(id: number) {
    return `This action returns a #${id} prizeClaim`;
  }

  update(id: number, updatePrizeClaimDto: UpdatePrizeClaimDto) {
    return `This action updates a #${id} prizeClaim`;
  }

  remove(id: number) {
    return `This action removes a #${id} prizeClaim`;
  }
}
