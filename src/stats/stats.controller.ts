import { Controller, Get, Query } from '@nestjs/common';
import { StatsService } from './stats.service';

@Controller('stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('leaderboard/wins')
  async getTopPlayersByWins(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return await this.statsService.getTopPlayersByWins(limitNumber);
  }

  @Get('leaderboard/ratio')
  async getTopPlayersByWinRatio(
    @Query('limit') limit?: string,
    @Query('minGames') minGames?: string,
  ) {
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    const minGamesNumber = minGames ? parseInt(minGames, 10) : 5;
    return await this.statsService.getTopPlayersByWinRatio(
      limitNumber,
      minGamesNumber,
    );
  }

  @Get('leaderboard/games')
  async getTopPlayersByGamesPlayed(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit, 10) : 20;
    return await this.statsService.getTopPlayersByGamesPlayed(limitNumber);
  }
}
