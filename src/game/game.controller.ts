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
   * GET /games/room/:roomId
   * Récupère une partie par son roomId (doit être avant :id)
   */
  @Get('room/:roomId')
  async getGameByRoomId(@Param('roomId') roomId: string) {
    return await this.gameService.getGameByRoomId(roomId);
  }

  /**
   * GET /games/code/:code
   * Récupère une partie par son code privé
   */
  @Get('code/:code')
  async getGameByPrivateCode(@Param('code') code: string) {
    const game = await this.gameService.getGameByPrivateCode(code);
    if (!game) {
      return { error: 'Partie introuvable', success: false };
    }
    return { data: game, success: true };
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
   * GET /games/:id
   * Récupère une partie spécifique par son ID (doit être en dernier)
   */
  @Get(':id')
  async getGameById(@Param('id') id: string) {
    return await this.gameService.getGameById(parseInt(id));
  }

  /**
   * POST /games/create
   * Crée une nouvelle partie (publique ou privée)
   * Body: { player1Id: number, isPrivate?: boolean }
   */
  @Post('create')
  async createGame(@Body() body: { player1Id: number; isPrivate?: boolean }) {
    // Génère un roomId unique
    const roomId = `room-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    return await this.gameService.createGame(
      body.player1Id,
      roomId,
      body.isPrivate ?? false,
    );
  }
}
