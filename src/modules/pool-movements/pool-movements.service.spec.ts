import { Test, TestingModule } from '@nestjs/testing';
import { PoolMovementsService } from './pool-movements.service';

describe('PoolMovementsService', () => {
  let service: PoolMovementsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PoolMovementsService],
    }).compile();

    service = module.get<PoolMovementsService>(PoolMovementsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
