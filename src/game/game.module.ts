import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { GameGateway } from './game.gateway';
import { PrismaService } from '../../prisma/prisma.service';
import { GameEngineService } from './game-engine.service';

@Module({
  controllers: [GameController],
  providers: [GameService, GameGateway, PrismaService, GameEngineService],
  exports: [GameService],
})
export class GameModule {}
