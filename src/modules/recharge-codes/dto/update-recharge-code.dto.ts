import { PartialType } from '@nestjs/mapped-types';
import { CreateRechargeCodeDto } from './create-recharge-code.dto';

export class UpdateRechargeCodeDto extends PartialType(CreateRechargeCodeDto) {}
