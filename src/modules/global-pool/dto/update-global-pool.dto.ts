import { PartialType } from '@nestjs/mapped-types';
import { CreateGlobalPoolDto } from './create-global-pool.dto';

export class UpdateGlobalPoolDto extends PartialType(CreateGlobalPoolDto) {}
