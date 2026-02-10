import { Test, TestingModule } from '@nestjs/testing';
import { BarsController } from './bars.controller';
import { BarsService } from './bars.service';

describe('BarsController', () => {
  let controller: BarsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [BarsController],
      providers: [BarsService],
    }).compile();

    controller = module.get<BarsController>(BarsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
