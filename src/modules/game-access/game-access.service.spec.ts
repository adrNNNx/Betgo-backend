import { Test, TestingModule } from '@nestjs/testing';
import { GameAccessService } from './game-access.service';

describe('GameAccessService', () => {
  let service: GameAccessService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GameAccessService],
    }).compile();

    service = module.get<GameAccessService>(GameAccessService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
