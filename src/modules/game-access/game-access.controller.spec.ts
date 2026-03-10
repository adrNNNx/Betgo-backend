import { Test, TestingModule } from '@nestjs/testing';
import { GameAccessController } from './game-access.controller';
import { GameAccessService } from './game-access.service';

describe('GameAccessController', () => {
  let controller: GameAccessController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameAccessController],
      providers: [GameAccessService],
    }).compile();

    controller = module.get<GameAccessController>(GameAccessController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
