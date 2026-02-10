import { PartialType } from '@nestjs/mapped-types';
import { CreatePoolMovementDto } from './create-pool-movement.dto';

export class UpdatePoolMovementDto extends PartialType(CreatePoolMovementDto) {}
