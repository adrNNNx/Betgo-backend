import { Test, TestingModule } from '@nestjs/testing';
import { PrizeClaimsController } from './prize-claims.controller';
import { PrizeClaimsService } from './prize-claims.service';

describe('PrizeClaimsController', () => {
  let controller: PrizeClaimsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrizeClaimsController],
      providers: [PrizeClaimsService],
    }).compile();

    controller = module.get<PrizeClaimsController>(PrizeClaimsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
