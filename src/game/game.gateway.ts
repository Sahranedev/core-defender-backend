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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  },
})
export class GameGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  // ← MODIF
  @WebSocketServer()
  server: Server;

  // Tracking des joueurs connectés : socketId -> {roomId, userId}
  private playerConnections: Map<string, { roomId: string; userId: number }> =
    new Map();

  // Timers de déconnexion : "roomId-userId" -> NodeJS.Timeout
  private disconnectionTimers: Map<string, NodeJS.Timeout> = new Map();

  // Timeout de déconnexion en millisecondes (10 secondes)
  private readonly DISCONNECT_TIMEOUT = 10000;

  constructor(
    private gameService: GameService,
    private gameEngine: GameEngineService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connecté: ${client.id}`);

    // Envoie les templates au client dès la connexion
    client.emit('game:templates', GAME_TEMPLATES);
  }

  async handleDisconnect(client: Socket) {
    const playerInfo = this.playerConnections.get(client.id);

    if (!playerInfo) {
      return;
    }

    const { roomId, userId } = playerInfo;
    const game = await this.gameService.getGameByRoomId(roomId);

    if (!game) {
      this.playerConnections.delete(client.id);
      return;
    }

    // Partie déjà terminée ou annulée → on nettoie simplement
    if (game.status === 'finished' || game.status === 'cancelled') {
      this.playerConnections.delete(client.id);
      return;
    }

    // CAS 1: Partie en attente (le créateur part avant qu'un adversaire ne rejoigne)
    if (game.status === 'waiting') {
      await this.gameService.cancelGame(game.id);

      // Notifie tous les clients que la partie est annulée (pour mettre à jour la liste)
      this.server.emit('game:roomCancelled', { roomId: game.roomId });

      this.playerConnections.delete(client.id);
      return;
    }

    // CAS 2: Partie en cours → Timer de reconnexion de 10 secondes
    const timerKey = `${roomId}-${userId}`;

    this.server.to(roomId).emit('game:playerDisconnected', {
      userId,
      message: `Un joueur s'est déconnecté. Reconnexion possible dans 10 secondes...`,
    });

    const timer = setTimeout(() => {
      void (async () => {
        const currentGame = await this.gameService.getGameByRoomId(roomId);
        if (!currentGame || currentGame.status !== 'playing') return;

        const winnerId =
          currentGame.player1Id === userId
            ? currentGame.player2Id
            : currentGame.player1Id;

        if (winnerId) {
          await this.gameService.finishGame(currentGame.id, winnerId);
        }

        this.gameEngine.cleanupGame(roomId);

        this.server.to(roomId).emit('game:abandoned', {
          reason: 'Un joueur a abandonné la partie',
          winnerId,
          loserId: userId,
        });

        this.playerConnections.delete(client.id);
        this.disconnectionTimers.delete(timerKey);
      })();
    }, this.DISCONNECT_TIMEOUT);

    this.disconnectionTimers.set(timerKey, timer);
  }

  afterInit(server: Server) {
    this.gameEngine.setServer(server);
    console.log('WebSocket Gateway initialisé');
  }

  @SubscribeMessage('game:createRoom')
  async handleCreateRoom(
    @MessageBody() data: { roomId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.getGameByRoomId(data.roomId);

    if (!game) {
      client.emit('game:error', { message: 'Partie introuvable' });
      return;
    }

    await client.join(game.roomId);

    // Enregistre la connexion du joueur
    this.playerConnections.set(client.id, {
      roomId: game.roomId,
      userId: data.userId,
    });

    // Annule le timer de déconnexion si c'est une reconnexion
    this.cancelDisconnectionTimer(game.roomId, data.userId);

    console.log(`Joueur ${data.userId} a créé la room ${game.roomId}`);

    this.server.emit('game:roomCreated', { roomId: game.roomId, game });
  }

  @SubscribeMessage('game:joinRoom')
  async handleJoinRoom(
    @MessageBody() data: { roomId: string; userId: number },
    @ConnectedSocket() client: Socket,
  ) {
    const game = await this.gameService.getGameByRoomId(data.roomId);

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

    // Empêche un joueur de rejoindre sa propre partie
    if (game.player1Id === data.userId) {
      client.emit('game:error', {
        message: 'Vous ne pouvez pas rejoindre votre propre partie',
      });
      return;
    }

    const updatedGame = await this.gameService.joinGame(game.id, data.userId);

    await client.join(updatedGame.roomId);

    // Enregistre la connexion du joueur
    this.playerConnections.set(client.id, {
      roomId: updatedGame.roomId,
      userId: data.userId,
    });

    // Annule le timer de déconnexion si c'est une reconnexion
    this.cancelDisconnectionTimer(updatedGame.roomId, data.userId);

    console.log(
      `Joueur ${data.userId} a rejoint la room ${updatedGame.roomId}`,
    );

    this.gameEngine.initializeGame(
      updatedGame.roomId,
      updatedGame.id,
      updatedGame.player1Id,
      updatedGame.player2Id!,
    );

    // Notifie les joueurs dans la room que la partie démarre
    this.server.to(updatedGame.roomId).emit('game:start', {
      game: updatedGame,
      message: 'La partie commence !',
    });

    this.server.emit('game:roomStarted', {
      roomId: updatedGame.roomId,
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

  /**
   * Annule le timer de déconnexion d'un joueur (en cas de reconnexion)
   */
  private cancelDisconnectionTimer(roomId: string, userId: number) {
    const timerKey = `${roomId}-${userId}`;
    const timer = this.disconnectionTimers.get(timerKey);

    if (timer) {
      clearTimeout(timer);
      this.disconnectionTimers.delete(timerKey);

      console.log(
        `✅ Joueur ${userId} s'est reconnecté à temps. Timer annulé.`,
      );

      // Notifie les autres joueurs que le joueur est revenu
      this.server.to(roomId).emit('game:playerReconnected', {
        userId,
        message: "Le joueur s'est reconnecté !",
      });
    }
  }
}
