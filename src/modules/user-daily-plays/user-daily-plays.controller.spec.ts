import { Test, TestingModule } from '@nestjs/testing';
import { UserDailyPlaysController } from './user-daily-plays.controller';
import { UserDailyPlaysService } from './user-daily-plays.service';

describe('UserDailyPlaysController', () => {
  let controller: UserDailyPlaysController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserDailyPlaysController],
      providers: [UserDailyPlaysService],
    }).compile();

    controller = module.get<UserDailyPlaysController>(UserDailyPlaysController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
