import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PrizeClaimsService } from './prize-claims.service';
import { CreatePrizeClaimDto } from './dto/create-prize-claim.dto';
import { UpdatePrizeClaimDto } from './dto/update-prize-claim.dto';

@Controller('prize-claims')
export class PrizeClaimsController {
  constructor(private readonly prizeClaimsService: PrizeClaimsService) {}

  @Post()
  create(@Body() createPrizeClaimDto: CreatePrizeClaimDto) {
    return this.prizeClaimsService.create(createPrizeClaimDto);
  }

  @Get()
  findAll() {
    return this.prizeClaimsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prizeClaimsService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePrizeClaimDto: UpdatePrizeClaimDto) {
    return this.prizeClaimsService.update(+id, updatePrizeClaimDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prizeClaimsService.remove(+id);
  }
}
