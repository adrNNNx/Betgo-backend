import { Injectable } from '@nestjs/common';
import { CreateUserDailyPlayDto } from './dto/create-user-daily-play.dto';
import { UpdateUserDailyPlayDto } from './dto/update-user-daily-play.dto';

@Injectable()
export class UserDailyPlaysService {
  create(createUserDailyPlayDto: CreateUserDailyPlayDto) {
    return 'This action adds a new userDailyPlay';
  }

  findAll() {
    return `This action returns all userDailyPlays`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userDailyPlay`;
  }

  update(id: number, updateUserDailyPlayDto: UpdateUserDailyPlayDto) {
    return `This action updates a #${id} userDailyPlay`;
  }

  remove(id: number) {
    return `This action removes a #${id} userDailyPlay`;
  }
}
