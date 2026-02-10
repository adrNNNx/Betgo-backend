import { PartialType } from '@nestjs/mapped-types';
import { CreatePrizeClaimDto } from './create-prize-claim.dto';

export class UpdatePrizeClaimDto extends PartialType(CreatePrizeClaimDto) {}
