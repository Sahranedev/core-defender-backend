import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { GameService } from './game.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('games')
@UseGuards(AuthGuard) // Toutes les routes nécessitent une authentification
export class GameController {
  constructor(private readonly gameService: GameService) {}

  /**
   * GET /games/available
   * Récupère la liste des parties en attente
   */
  @Get('available')
  async getAvailableGames() {
    return await this.gameService.getAvailableGames();
  }

  /**
   * GET /games/:id
   * Récupère une partie spécifique par son ID
   */
  @Get(':id')
  async getGameById(@Param('id') id: string) {
    return await this.gameService.getGameById(parseInt(id));
  }

  /**
   * GET /games/player/:playerId/history
   * Récupère l'historique des parties d'un joueur
   */
  @Get('player/:playerId/history')
  async getPlayerHistory(@Param('playerId') playerId: string) {
    return await this.gameService.getPlayerHistory(parseInt(playerId));
  }

  /**
   * POST /games/create
   * Crée une nouvelle partie
   * Body: { player1Id: number }
   */
  @Post('create')
  async createGame(@Body() body: { player1Id: number }) {
    // Génère un roomId unique
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    return await this.gameService.createGame(body.player1Id, roomId);
  }
}
