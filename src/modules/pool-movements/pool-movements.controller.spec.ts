import { Test, TestingModule } from '@nestjs/testing';
import { PoolMovementsController } from './pool-movements.controller';
import { PoolMovementsService } from './pool-movements.service';

describe('PoolMovementsController', () => {
  let controller: PoolMovementsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PoolMovementsController],
      providers: [PoolMovementsService],
    }).compile();

    controller = module.get<PoolMovementsController>(PoolMovementsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
