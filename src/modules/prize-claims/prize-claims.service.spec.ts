import { Test, TestingModule } from '@nestjs/testing';
import { PrizeClaimsService } from './prize-claims.service';

describe('PrizeClaimsService', () => {
  let service: PrizeClaimsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrizeClaimsService],
    }).compile();

    service = module.get<PrizeClaimsService>(PrizeClaimsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
