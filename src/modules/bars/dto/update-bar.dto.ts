import { PartialType } from '@nestjs/mapped-types';
import { CreateBarDto } from './create-bar.dto';

export class UpdateBarDto extends PartialType(CreateBarDto) {}
