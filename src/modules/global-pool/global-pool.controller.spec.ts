import { Test, TestingModule } from '@nestjs/testing';
import { GlobalPoolController } from './global-pool.controller';
import { GlobalPoolService } from './global-pool.service';

describe('GlobalPoolController', () => {
  let controller: GlobalPoolController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalPoolController],
      providers: [GlobalPoolService],
    }).compile();

    controller = module.get<GlobalPoolController>(GlobalPoolController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
