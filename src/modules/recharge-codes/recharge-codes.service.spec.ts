import { Test, TestingModule } from '@nestjs/testing';
import { RechargeCodesService } from './recharge-codes.service';

describe('RechargeCodesService', () => {
  let service: RechargeCodesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RechargeCodesService],
    }).compile();

    service = module.get<RechargeCodesService>(RechargeCodesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
