import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  /**
   * Génère un code privé court et unique (6 caractères)
   */
  private generatePrivateCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Sans I, O, 0, 1 pour éviter confusion
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Crée une nouvelle partie en attente d'un adversaire
   */
  async createGame(player1Id: number, roomId: string, isPrivate = false) {
    const privateCode = isPrivate ? this.generatePrivateCode() : null;

    return await this.prisma.game.create({
      data: {
        roomId,
        player1Id,
        status: 'waiting',
        isPrivate,
        privateCode,
      },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Récupère toutes les parties PUBLIQUES en attente d'un joueur
   */
  async getAvailableGames() {
    return await this.prisma.game.findMany({
      where: {
        status: 'waiting',
        isPrivate: false, // Uniquement les parties publiques
      },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * Récupère une partie par son code privé
   */
  async getGameByPrivateCode(privateCode: string) {
    return await this.prisma.game.findUnique({
      where: { privateCode: privateCode.toUpperCase() },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Récupère une partie par son ID
   */
  async getGameById(id: number) {
    return await this.prisma.game.findUnique({
      where: { id },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Récupère une partie par son roomId
   */
  async getGameByRoomId(roomId: string) {
    return await this.prisma.game.findUnique({
      where: { roomId },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Ajoute le deuxième joueur à une partie et démarre la partie
   */
  async joinGame(gameId: number, player2Id: number) {
    return await this.prisma.game.update({
      where: { id: gameId },
      data: {
        player2Id,
        status: 'playing',
      },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Termine une partie et enregistre le gagnant
   */
  async finishGame(
    gameId: number,
    winnerId: number,
    duration?: number,
    player1FinalHP?: number,
    player2FinalHP?: number,
  ) {
    return await this.prisma.game.update({
      where: { id: gameId },
      data: {
        winnerId,
        status: 'finished',
        duration,
        player1FinalHP,
        player2FinalHP,
        finishedAt: new Date(),
      },
    });
  }

  /**
   * Récupère l'historique des parties d'un joueur
   */
  async getPlayerHistory(playerId: number) {
    return await this.prisma.game.findMany({
      where: {
        OR: [{ player1Id: playerId }, { player2Id: playerId }],
        status: 'finished',
      },
      include: {
        player1: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
        player2: {
          select: {
            id: true,
            firstname: true,
            lastname: true,
          },
        },
      },
      orderBy: {
        finishedAt: 'desc',
      },
    });
  }

  /**
   * Annule une partie en attente (le créateur est parti avant qu'un adversaire ne rejoigne)
   */
  async cancelGame(gameId: number) {
    return await this.prisma.game.update({
      where: { id: gameId },
      data: {
        status: 'cancelled',
        finishedAt: new Date(),
      },
    });
  }

  /**
   * Supprime une partie (nettoyage)
   */
  async deleteGame(gameId: number) {
    return await this.prisma.game.delete({
      where: { id: gameId },
    });
  }
}
