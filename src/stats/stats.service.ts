import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface PlayerStats {
  userId: number;
  firstname: string;
  lastname: string;
  wins: number;
  totalGames: number;
  winRatio: number;
}

@Injectable()
export class StatsService {
  constructor(private prisma: PrismaService) {}

  // Calcule les statistiques d'un joueur à partir de ses parties

  private calculatePlayerStats(user: {
    id: number;
    firstname: string;
    lastname: string;
    email: string;
    gamesAsPlayer1: Array<{
      status: string;
      player2Id: number | null;
      winnerId: number | null;
    }>;
    gamesAsPlayer2: Array<{
      status: string;
      winnerId: number | null;
    }>;
  }): PlayerStats {
    const winsAsPlayer1 = user.gamesAsPlayer1.filter(
      (game) => game.winnerId === user.id,
    ).length;
    const winsAsPlayer2 = user.gamesAsPlayer2.filter(
      (game) => game.winnerId === user.id,
    ).length;
    const wins = winsAsPlayer1 + winsAsPlayer2;

    const gamesAsPlayer1 = user.gamesAsPlayer1.filter(
      (game) => game.status === 'finished' && game.player2Id !== null,
    ).length;
    const gamesAsPlayer2 = user.gamesAsPlayer2.filter(
      (game) => game.status === 'finished',
    ).length;
    const totalGames = gamesAsPlayer1 + gamesAsPlayer2;

    const winRatio = totalGames > 0 ? wins / totalGames : 0;

    return {
      userId: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      wins,
      totalGames,
      winRatio: Math.round(winRatio * 10000) / 100,
    };
  }

  private async getAllUsersWithFinishedGames() {
    return await this.prisma.user.findMany({
      include: {
        gamesAsPlayer1: {
          where: {
            status: 'finished',
            player2Id: { not: null }, // Seulement les parties avec un adversaire
          },
        },
        gamesAsPlayer2: {
          where: {
            status: 'finished',
          },
        },
      },
    });
  }

  async getTopPlayersByWins(limit: number = 20): Promise<PlayerStats[]> {
    const users = await this.getAllUsersWithFinishedGames();

    const stats: PlayerStats[] = users.map((user) =>
      this.calculatePlayerStats(user),
    );

    // Trie par nombre de victoires (décroissant) et retourne le top N
    return stats
      .filter((stat) => stat.totalGames > 0) // j'excluse les joueurs sans parties pour ne pas polluer le ranking
      .sort((a, b) => b.wins - a.wins)
      .slice(0, limit);
  }

  async getTopPlayersByWinRatio(
    limit: number = 20,
    minGames: number = 5,
  ): Promise<PlayerStats[]> {
    const users = await this.getAllUsersWithFinishedGames();

    const stats: PlayerStats[] = users.map((user) =>
      this.calculatePlayerStats(user),
    );

    return stats
      .filter((stat) => stat.totalGames >= minGames)
      .sort((a, b) => b.winRatio - a.winRatio)
      .slice(0, limit);
  }

  async getTopPlayersByGamesPlayed(limit: number = 20): Promise<PlayerStats[]> {
    const users = await this.getAllUsersWithFinishedGames();

    const stats: PlayerStats[] = users.map((user) =>
      this.calculatePlayerStats(user),
    );

    return stats
      .filter((stat) => stat.totalGames > 0)
      .sort((a, b) => b.totalGames - a.totalGames)
      .slice(0, limit);
  }
}
