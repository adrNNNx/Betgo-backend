import { Test, TestingModule } from '@nestjs/testing';
import { UserDailyPlaysService } from './user-daily-plays.service';

describe('UserDailyPlaysService', () => {
  let service: UserDailyPlaysService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UserDailyPlaysService],
    }).compile();

    service = module.get<UserDailyPlaysService>(UserDailyPlaysService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
