/* eslint-disable @typescript-eslint/require-await */
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit, // ← AJOUT
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameService } from './game.service';
import { GameEngineService } from './game-engine.service'; // ← AJOUT
import { GAME_TEMPLATES } from './constants/templates';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  // ← MODIF
  @WebSocketServer()
  server: Server;

  constructor(
    private gameService: GameService,
    private gameEngine: GameEngineService,
  ) {}

  /**
   * Quand un client se connecte au WebSocket
   */
  handleConnection(client: Socket) {
    console.log(`Client connecté: ${client.id}`);

    // Envoie les templates au client dès la connexion
    client.emit('game:templates', GAME_TEMPLATES);
  }

  /**
   * Quand un client se déconnecte
   */
  async handleDisconnect(client: Socket) {
    console.log(`Client déconnecté: ${client.id}`);

    // TODO: Gérer la déconnexion pendant une partie
    // Si le client était dans une partie, il perd automatiquement
  }

  afterInit(server: Server) {
    // ← AJOUT DE TOUTE CETTE MÉTHODE
    this.gameEngine.setServer(server);
    console.log('WebSocket Gateway initialisé');
  }

  /**
   * Événement: Un joueur crée une room
   * Le client envoie: { gameId: number, userId: number }
   */
  @SubscribeMessage('game:createRoom')
  async handleCreateRoom(
    @MessageBody() data: { roomId: string; userId: number }, // ← roomId au lieu de gameId
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.getGameByRoomId(data.roomId); // ← Changé

    if (!game) {
      client.emit('game:error', { message: 'Partie introuvable' });
      return;
    }

    client.join(game.roomId);

    console.log(`Joueur ${data.userId} a créé la room ${game.roomId}`);

    client.emit('game:roomCreated', {
      roomId: game.roomId,
      game,
    });
  }

  /**
   * Événement: Un joueur rejoint une room existante
   * Le client envoie: { gameId: number, userId: number }
   */
  @SubscribeMessage('game:joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; userId: number }, // ← roomId au lieu de gameId
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.getGameByRoomId(data.roomId); // ← Changé

    if (!game) {
      client.emit('game:error', { message: 'Partie introuvable' });
      return;
    }

    if (game.status !== 'waiting') {
      client.emit('game:error', {
        message: 'Cette partie a déjà commencé ou est terminée',
      });
      return;
    }

    const updatedGame = await this.gameService.joinGame(game.id, data.userId);
    client.join(updatedGame.roomId);

    console.log(
      `Joueur ${data.userId} a rejoint la room ${updatedGame.roomId}`,
    );

    // Initialise le jeu dans le Game Engine
    this.gameEngine.initializeGame(
      updatedGame.roomId,
      updatedGame.id,
      updatedGame.player1Id,
      updatedGame.player2Id!,
    );

    this.server.to(updatedGame.roomId).emit('game:start', {
      game: updatedGame,
      message: 'La partie commence !',
    });
  }
  /**
   * Événement: Un joueur place une défense
   * Le client envoie: { roomId: string, defenseType: string, x: number, y: number, playerId: number }
   */
  @SubscribeMessage('game:placeDefense')
  async handlePlaceDefense(
    @MessageBody()
    data: {
      roomId: string;
      defenseType: string;
      x: number;
      y: number;
      playerId: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const result = this.gameEngine.placeDefense(
      data.roomId,
      data.playerId,
      data.defenseType as any,
      data.x,
      data.y,
    );

    if (!result.success) {
      client.emit('game:error', { message: result.error });
    }
  }

  @SubscribeMessage('game:launchProjectile')
  async handleLaunchProjectile(
    @MessageBody()
    data: {
      roomId: string;
      projectileType: string;
      targetPlayerId: number;
      playerId: number;
    },
    @ConnectedSocket() client: Socket,
  ) {
    const result = this.gameEngine.launchProjectile(
      data.roomId,
      data.playerId,
      data.projectileType as any,
      data.targetPlayerId,
    );

    if (!result.success) {
      client.emit('game:error', { message: result.error });
    }
  }
}
