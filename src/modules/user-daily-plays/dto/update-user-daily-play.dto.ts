import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDailyPlayDto } from './create-user-daily-play.dto';

export class UpdateUserDailyPlayDto extends PartialType(CreateUserDailyPlayDto) {}
