import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { PrismaService } from 'prisma/prisma.service';
import { GameModule } from './game/game.module';
import { StatsModule } from './stats/stats.module';

@Module({
  imports: [UsersModule, AuthModule, GameModule, StatsModule],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
