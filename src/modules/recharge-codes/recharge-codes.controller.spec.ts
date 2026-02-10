import { Test, TestingModule } from '@nestjs/testing';
import { RechargeCodesController } from './recharge-codes.controller';
import { RechargeCodesService } from './recharge-codes.service';

describe('RechargeCodesController', () => {
  let controller: RechargeCodesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RechargeCodesController],
      providers: [RechargeCodesService],
    }).compile();

    controller = module.get<RechargeCodesController>(RechargeCodesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
