import { Test, TestingModule } from '@nestjs/testing';
import { GlobalPoolService } from './global-pool.service';

describe('GlobalPoolService', () => {
  let service: GlobalPoolService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalPoolService],
    }).compile();

    service = module.get<GlobalPoolService>(GlobalPoolService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
