import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { UserDailyPlaysService } from './user-daily-plays.service';
import { CreateUserDailyPlayDto } from './dto/create-user-daily-play.dto';
import { UpdateUserDailyPlayDto } from './dto/update-user-daily-play.dto';

@Controller('user-daily-plays')
export class UserDailyPlaysController {
  constructor(private readonly userDailyPlaysService: UserDailyPlaysService) {}

  @Post()
  create(@Body() createUserDailyPlayDto: CreateUserDailyPlayDto) {
    return this.userDailyPlaysService.create(createUserDailyPlayDto);
  }

  @Get()
  findAll() {
    return this.userDailyPlaysService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userDailyPlaysService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDailyPlayDto: UpdateUserDailyPlayDto) {
    return this.userDailyPlaysService.update(+id, updateUserDailyPlayDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userDailyPlaysService.remove(+id);
  }
}
