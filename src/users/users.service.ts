import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

export interface UserProfile {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  isVerified: boolean;
  stats: {
    wins: number;
    losses: number;
    totalGames: number;
    winRatio: number;
  };
  recentGames: Array<{
    id: number;
    roomId: string;
    opponent: { id: number; firstname: string; lastname: string } | null;
    result: 'win' | 'loss' | 'in_progress';
    duration: number | null;
    createdAt: Date;
    finishedAt: Date | null;
  }>;
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany();
  }

  create(createUserDto: CreateUserDto) {
    return this.prisma.user.create({
      data: {
        firstname: createUserDto.firstname,
        lastname: createUserDto.lastname,
        email: createUserDto.email,
        password: createUserDto.password,
      },
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: number): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async getUserProfile(userId: number): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        gamesAsPlayer1: {
          where: { status: 'finished', player2Id: { not: null } },
          include: {
            player2: { select: { id: true, firstname: true, lastname: true } },
          },
          orderBy: { finishedAt: 'desc' },
          take: 20,
        },
        gamesAsPlayer2: {
          where: { status: 'finished' },
          include: {
            player1: { select: { id: true, firstname: true, lastname: true } },
          },
          orderBy: { finishedAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!user) return null;

    // Calcul des stats
    const winsAsPlayer1 = user.gamesAsPlayer1.filter(
      (g) => g.winnerId === userId,
    ).length;
    const winsAsPlayer2 = user.gamesAsPlayer2.filter(
      (g) => g.winnerId === userId,
    ).length;
    const wins = winsAsPlayer1 + winsAsPlayer2;
    const totalGames = user.gamesAsPlayer1.length + user.gamesAsPlayer2.length;
    const losses = totalGames - wins;
    const winRatio =
      totalGames > 0 ? Math.round((wins / totalGames) * 10000) / 100 : 0;

    // Fusion et tri des parties récentes
    const allGames = [
      ...user.gamesAsPlayer1.map((g) => ({
        id: g.id,
        roomId: g.roomId,
        opponent: g.player2,
        result: (g.winnerId === userId ? 'win' : 'loss') as
          | 'win'
          | 'loss'
          | 'in_progress',
        duration: g.duration,
        createdAt: g.createdAt,
        finishedAt: g.finishedAt,
      })),
      ...user.gamesAsPlayer2.map((g) => ({
        id: g.id,
        roomId: g.roomId,
        opponent: g.player1,
        result: (g.winnerId === userId ? 'win' : 'loss') as
          | 'win'
          | 'loss'
          | 'in_progress',
        duration: g.duration,
        createdAt: g.createdAt,
        finishedAt: g.finishedAt,
      })),
    ]
      .sort(
        (a, b) =>
          (b.finishedAt?.getTime() || 0) - (a.finishedAt?.getTime() || 0),
      )
      .slice(0, 10);

    return {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      email: user.email,
      isVerified: user.isVerified,
      stats: { wins, losses, totalGames, winRatio },
      recentGames: allGames,
    };
  }
}
