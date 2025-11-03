import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  GAME_CONFIG,
  DEFENSE_TEMPLATES,
  PROJECTILE_TEMPLATES,
  DefenseType,
  ProjectileType,
} from './constants/templates';

// Types pour l'état du jeu en mémoire

interface Player {
  id: number;
  resources: number;
  coreHP: number;
  corePosition: { x: number; y: number };
}

interface Defense {
  id: string;
  type: DefenseType;
  playerId: number;
  x: number;
  y: number;
  hp: number;
  createdAt: number;
}

interface Projectile {
  id: string;
  type: ProjectileType;
  playerId: number;
  targetPlayerId: number;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  damage: number;
}

interface GameState {
  roomId: string;
  gameId: number;
  status: 'waiting' | 'playing' | 'finished';
  players: Map<number, Player>;
  defenses: Defense[];
  projectiles: Projectile[];
  startTime: number;
  lastUpdate: number;
}

@Injectable()
export class GameEngineService {
  // Map pour stocker l'état de toutes les parties en cours
  // Key = roomId, Value = GameState
  private games: Map<string, GameState> = new Map();

  // Référence au serveur WebSocket (sera injectée depuis le Gateway)
  private server: Server;

  setServer(server: Server) {
    this.server = server;
  }

  /**
   * Initialise une nouvelle partie en mémoire
   */
  initializeGame(
    roomId: string,
    gameId: number,
    player1Id: number,
    player2Id: number,
  ) {
    const gameState: GameState = {
      roomId,
      gameId,
      status: 'playing',
      players: new Map([
        [
          player1Id,
          {
            id: player1Id,
            resources: GAME_CONFIG.INITIAL_RESOURCES,
            coreHP: GAME_CONFIG.CORE_HP,
            corePosition: { x: 100, y: GAME_CONFIG.BOARD_HEIGHT / 2 },
          },
        ],
        [
          player2Id,
          {
            id: player2Id,
            resources: GAME_CONFIG.INITIAL_RESOURCES,
            coreHP: GAME_CONFIG.CORE_HP,
            corePosition: {
              x: GAME_CONFIG.BOARD_WIDTH - 100,
              y: GAME_CONFIG.BOARD_HEIGHT / 2,
            },
          },
        ],
      ]),
      defenses: [],
      projectiles: [],
      startTime: Date.now(),
      lastUpdate: Date.now(),
    };

    this.games.set(roomId, gameState);

    // Lance le game loop pour cette partie
    this.startGameLoop(roomId);

    console.log(`Partie ${roomId} initialisée`);
    return gameState;
  }

  /**
   * Place une défense pour un joueur
   */
  placeDefense(
    roomId: string,
    playerId: number,
    defenseType: DefenseType,
    x: number,
    y: number,
  ): { success: boolean; error?: string } {
    const game = this.games.get(roomId);
    if (!game) return { success: false, error: 'Partie introuvable' };

    const player = game.players.get(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    const template = DEFENSE_TEMPLATES[defenseType];
    if (!template) return { success: false, error: 'Type de défense invalide' };

    // Vérifie les ressources
    if (player.resources < template.cost) {
      return { success: false, error: 'Ressources insuffisantes' };
    }

    // Déduit les ressources
    player.resources -= template.cost;

    // Crée la défense
    const defense: Defense = {
      id: `defense-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: defenseType,
      playerId,
      x,
      y,
      hp: template.hp,
      createdAt: Date.now(),
    };

    game.defenses.push(defense);

    // Broadcast l'état mis à jour
    this.broadcastGameState(roomId);

    return { success: true };
  }

  /**
   * Lance un projectile vers l'adversaire
   */
  launchProjectile(
    roomId: string,
    playerId: number,
    projectileType: ProjectileType,
    targetPlayerId: number,
  ): { success: boolean; error?: string } {
    const game = this.games.get(roomId);
    if (!game) return { success: false, error: 'Partie introuvable' };

    const player = game.players.get(playerId);
    if (!player) return { success: false, error: 'Joueur introuvable' };

    const targetPlayer = game.players.get(targetPlayerId);
    if (!targetPlayer)
      return { success: false, error: 'Adversaire introuvable' };

    const template = PROJECTILE_TEMPLATES[projectileType];
    if (!template)
      return { success: false, error: 'Type de projectile invalide' };

    // Vérifie les ressources
    if (player.resources < template.cost) {
      return { success: false, error: 'Ressources insuffisantes' };
    }

    // Déduit les ressources
    player.resources -= template.cost;

    // Position de départ (depuis le core de l'attaquant)
    const startX = player.corePosition.x;
    const startY = player.corePosition.y;

    // Position cible (le core de l'adversaire)
    const targetX = targetPlayer.corePosition.x;
    const targetY = targetPlayer.corePosition.y;

    // Crée le projectile
    const projectile: Projectile = {
      id: `projectile-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: projectileType,
      playerId,
      targetPlayerId,
      x: startX,
      y: startY,
      targetX,
      targetY,
      speed: template.speed,
      damage: template.damage,
    };

    game.projectiles.push(projectile);

    console.log(
      `Projectile ${projectileType} lancé de (${startX},${startY}) vers (${targetX},${targetY})`,
    );

    return { success: true };
  }

  /**
   * Game Loop - S'exécute à 60 FPS pour chaque partie
   */
  private startGameLoop(roomId: string) {
    const FPS = 60;
    const FRAME_TIME = 1000 / FPS; // ~16.67ms

    const loop = () => {
      const game = this.games.get(roomId);

      // Si la partie n'existe plus ou est terminée, arrête la boucle
      if (!game || game.status === 'finished') {
        return;
      }

      // Met à jour le jeu
      this.updateGame(roomId);

      // Broadcast l'état aux clients
      this.broadcastGameState(roomId);

      // Planifie la prochaine frame
      setTimeout(loop, FRAME_TIME);
    };

    // Démarre la boucle
    loop();
  }

  /**
   * Met à jour l'état du jeu (déplacement des projectiles, collisions, etc.)
   */
  private updateGame(roomId: string) {
    const game = this.games.get(roomId);
    if (!game) return;

    const now = Date.now();
    const deltaTime = now - game.lastUpdate;
    game.lastUpdate = now;

    // Met à jour les projectiles
    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      const projectile = game.projectiles[i];

      // Calcule la direction du mouvement
      const dx = projectile.targetX - projectile.x;
      const dy = projectile.targetY - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Si le projectile a atteint sa cible
      if (distance < projectile.speed) {
        // Applique les dégâts au core
        this.applyDamageToCore(
          game,
          projectile.targetPlayerId,
          projectile.damage,
        );

        // Retire le projectile
        game.projectiles.splice(i, 1);
        continue;
      }

      // Déplace le projectile
      const normalizedDx = dx / distance;
      const normalizedDy = dy / distance;

      projectile.x += normalizedDx * projectile.speed;
      projectile.y += normalizedDy * projectile.speed;

      // Vérifie les collisions avec les défenses
      this.checkProjectileDefenseCollision(game, projectile, i);
    }

    // Vérifie si un joueur a gagné
    this.checkVictoryCondition(game);
  }

  /**
   * Vérifie la collision entre un projectile et les défenses
   */
  private checkProjectileDefenseCollision(
    game: GameState,
    projectile: Projectile,
    projectileIndex: number,
  ) {
    for (let i = game.defenses.length - 1; i >= 0; i--) {
      const defense = game.defenses[i];

      // Le projectile ne collisionne qu'avec les défenses du joueur adverse
      if (defense.playerId === projectile.playerId) continue;

      // Calcule la distance entre le projectile et la défense
      const dx = projectile.x - defense.x;
      const dy = projectile.y - defense.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const template = DEFENSE_TEMPLATES[defense.type];

      // Collision détectée (approximation simple avec un cercle)
      if (distance < template.width / 2) {
        // Applique les dégâts à la défense
        defense.hp -= projectile.damage;

        // Si la défense est détruite
        if (defense.hp <= 0) {
          game.defenses.splice(i, 1);
        }

        // Retire le projectile
        game.projectiles.splice(projectileIndex, 1);
        return;
      }
    }
  }

  /**
   * Applique des dégâts au core d'un joueur
   */
  private applyDamageToCore(game: GameState, playerId: number, damage: number) {
    const player = game.players.get(playerId);
    if (!player) return;

    player.coreHP -= damage;
    console.log(`Core du joueur ${playerId} : ${player.coreHP} HP restants`);
  }

  /**
   * Vérifie la condition de victoire
   */
  private checkVictoryCondition(game: GameState) {
    const players = Array.from(game.players.values());

    for (const player of players) {
      if (player.coreHP <= 0) {
        // Un joueur a perdu, l'autre a gagné
        const winner = players.find((p) => p.id !== player.id);
        if (winner) {
          this.endGame(game, winner.id);
        }
      }
    }
  }

  /**
   * Termine la partie
   */
  private endGame(game: GameState, winnerId: number) {
    game.status = 'finished';

    const duration = Math.floor((Date.now() - game.startTime) / 1000);
    const players = Array.from(game.players.values());

    // Notifie tous les clients
    this.server.to(game.roomId).emit('game:end', {
      winnerId,
      duration,
      finalState: {
        player1HP: players[0].coreHP,
        player2HP: players[1].coreHP,
      },
    });

    console.log(`Partie ${game.roomId} terminée. Gagnant : ${winnerId}`);

    // Supprime la partie de la mémoire après quelques secondes
    setTimeout(() => {
      this.games.delete(game.roomId);
    }, 5000);
  }

  /**
   * Broadcast l'état complet du jeu à tous les clients de la room
   */
  private broadcastGameState(roomId: string) {
    const game = this.games.get(roomId);
    if (!game || !this.server) return;

    // Prépare l'état à envoyer
    const state = {
      players: Array.from(game.players.values()),
      defenses: game.defenses,
      projectiles: game.projectiles,
      status: game.status,
    };

    this.server.to(roomId).emit('game:stateUpdate', state);
  }

  /**
   * Récupère l'état d'une partie
   */
  getGameState(roomId: string): GameState | undefined {
    return this.games.get(roomId);
  }
}
