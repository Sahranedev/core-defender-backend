import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';
import {
  GAME_CONFIG,
  DEFENSE_TEMPLATES,
  DEFENSE_LIMITS,
  PROJECTILE_TEMPLATES,
  DefenseType,
  ProjectileType,
} from './constants/templates';
import { GameService } from './game.service';

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
  lastFired?: number;
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
  lastResourceGeneration: number;
}

@Injectable()
export class GameEngineService {
  private games: Map<string, GameState> = new Map();

  private server: Server;

  constructor(private gameService: GameService) {}

  setServer(server: Server) {
    this.server = server;
  }

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
            corePosition: { x: 120, y: GAME_CONFIG.BOARD_HEIGHT / 2 },
          },
        ],
        [
          player2Id,
          {
            id: player2Id,
            resources: GAME_CONFIG.INITIAL_RESOURCES,
            coreHP: GAME_CONFIG.CORE_HP,
            corePosition: {
              x: GAME_CONFIG.BOARD_WIDTH - 120,
              y: GAME_CONFIG.BOARD_HEIGHT / 2,
            },
          },
        ],
      ]),
      defenses: [],
      projectiles: [],
      startTime: Date.now(),
      lastUpdate: Date.now(),
      lastResourceGeneration: Date.now(),
    };

    this.games.set(roomId, gameState);

    this.startGameLoop(roomId);

    console.log(`Partie ${roomId} initialisée`);
    return gameState;
  }

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

    // Vérification de la limite de défenses par type
    const playerDefensesOfType = game.defenses.filter(
      (d) => d.playerId === playerId && d.type === defenseType,
    ).length;
    const maxAllowed = DEFENSE_LIMITS[defenseType] ?? 10;

    if (playerDefensesOfType >= maxAllowed) {
      return {
        success: false,
        error: `Limite atteinte (${maxAllowed} ${template.name}s maximum)`,
      };
    }

    // Validation de la zone de placement
    const isPlayer1 = player.corePosition.x < GAME_CONFIG.BOARD_WIDTH / 2;
    const ZONE_PLAYER1_END = 480;
    const ZONE_PLAYER2_START = 620;

    if (isPlayer1 && x > ZONE_PLAYER1_END) {
      return {
        success: false,
        error: 'Vous ne pouvez placer que dans votre zone',
      };
    }
    if (!isPlayer1 && x < ZONE_PLAYER2_START) {
      return {
        success: false,
        error: 'Vous ne pouvez placer que dans votre zone',
      };
    }

    if (player.resources < template.cost) {
      return { success: false, error: 'Ressources insuffisantes' };
    }

    // Déduit les ressources
    player.resources -= template.cost;

    const defense: Defense = {
      id: `defense-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type: defenseType,
      playerId,
      x,
      y,
      hp: template.hp,
      createdAt: Date.now(),
      lastFired: defenseType === 'TURRET' ? Date.now() : undefined, // Initialise le timer pour les tourelles
    };

    game.defenses.push(defense);

    this.broadcastGameState(roomId);

    return { success: true };
  }

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

    if (player.resources < template.cost) {
      return { success: false, error: 'Ressources insuffisantes' };
    }

    player.resources -= template.cost;

    // Position de départ notre core
    const startX = player.corePosition.x;
    const startY = player.corePosition.y;

    // Position du core adverse
    const targetX = targetPlayer.corePosition.x;
    const targetY = targetPlayer.corePosition.y;

    const projectile: Projectile = {
      id: `projectile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
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

  private startGameLoop(roomId: string) {
    const FPS = 40;
    const FRAME_TIME = 1000 / FPS;

    const loop = () => {
      const game = this.games.get(roomId);

      if (!game || game.status === 'finished') {
        return;
      }

      this.updateGame(roomId);

      this.broadcastGameState(roomId);

      setTimeout(loop, FRAME_TIME);
    };

    loop();
  }

  private updateGame(roomId: string) {
    const game = this.games.get(roomId);
    if (!game) return;

    const now = Date.now();
    game.lastUpdate = now;

    // Régénération passive de ressources par seconde
    if (now - game.lastResourceGeneration >= 1000) {
      game.players.forEach((player) => {
        player.resources += GAME_CONFIG.RESOURCE_PER_SECOND;
      });
      game.lastResourceGeneration = now;
    }

    this.updateTurrets(game);

    for (let i = game.projectiles.length - 1; i >= 0; i--) {
      const projectile = game.projectiles[i];

      const dx = projectile.targetX - projectile.x;
      const dy = projectile.targetY - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < projectile.speed) {
        this.applyDamageToCore(
          game,
          projectile.targetPlayerId,
          projectile.damage,
        );

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
   * Met à jour les tourelles (tir automatique)
   * Priorité de ciblage : Tourelles ennemies > Core ennemi
   */
  private updateTurrets(game: GameState) {
    const now = Date.now();

    game.defenses.forEach((turret) => {
      if (turret.type !== 'TURRET') return;

      const template = DEFENSE_TEMPLATES.TURRET;

      // Vérifie si la tourelle peut tirer (cooldown)
      if (now - (turret.lastFired || 0) < template.fireRate) return;

      // PRIORITÉ 1 : Cherche une tourelle ennemie à portée
      let targetX: number | null = null;
      let targetY: number | null = null;
      let targetPlayerId: number | null = null;
      let minDistance = Infinity;

      // Parcourt les tourelles ennemies
      for (const defense of game.defenses) {
        if (defense.type !== 'TURRET') continue;
        if (defense.playerId === turret.playerId) continue; // Ignore nos propres tourelles

        const dx = defense.x - turret.x;
        const dy = defense.y - turret.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= template.range && distance < minDistance) {
          minDistance = distance;
          targetX = defense.x;
          targetY = defense.y;
          targetPlayerId = defense.playerId;
        }
      }

      // PRIORITÉ 2 : Si pas de tourelle ennemie, cible le core ennemi
      if (targetX === null) {
        const enemyPlayers = Array.from(game.players.values()).filter(
          (p) => p.id !== turret.playerId,
        );

        for (const enemy of enemyPlayers) {
          const dx = enemy.corePosition.x - turret.x;
          const dy = enemy.corePosition.y - turret.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance <= template.range && distance < minDistance) {
            minDistance = distance;
            targetX = enemy.corePosition.x;
            targetY = enemy.corePosition.y;
            targetPlayerId = enemy.id;
          }
        }
      }

      // Tire si une cible a été trouvée
      if (targetX !== null && targetY !== null && targetPlayerId !== null) {
        const projectile: Projectile = {
          id: `turret-projectile-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
          type: 'BASIC',
          playerId: turret.playerId,
          targetPlayerId,
          x: turret.x,
          y: turret.y,
          targetX,
          targetY,
          speed: 5,
          damage: template.damage,
        };

        game.projectiles.push(projectile);
        turret.lastFired = now;
      }
    });
  }

  private checkProjectileDefenseCollision(
    game: GameState,
    projectile: Projectile,
    projectileIndex: number,
  ) {
    for (let i = game.defenses.length - 1; i >= 0; i--) {
      const defense = game.defenses[i];

      // Le projectile ne collisionne qu'avec les défenses du joueur adverse
      if (defense.playerId === projectile.playerId) continue;

      const template = DEFENSE_TEMPLATES[defense.type];

      // Utilise une hitbox carrée pour une meilleure détection
      const halfWidth = template.width / 2;
      const halfHeight = template.height / 2;

      // Vérifie si le projectile est dans la zone de la défense
      const inXRange =
        projectile.x >= defense.x - halfWidth &&
        projectile.x <= defense.x + halfWidth;
      const inYRange =
        projectile.y >= defense.y - halfHeight &&
        projectile.y <= defense.y + halfHeight;

      if (inXRange && inYRange) {
        defense.hp -= projectile.damage;

        console.log(
          `💥 Collision! Projectile de ${projectile.playerId} touche défense ${defense.type} (${defense.hp} HP restants)`,
        );

        // Si la défense est détruite
        if (defense.hp <= 0) {
          console.log(`💀 Défense ${defense.type} détruite!`);

          // Récompense le joueur attaquant avec +50 ressources
          const attacker = game.players.get(projectile.playerId);
          if (attacker) {
            attacker.resources += 50;
            console.log(
              `💰 Joueur ${projectile.playerId} gagne 50 ressources (total: ${attacker.resources})`,
            );
          }

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

  private endGame(game: GameState, winnerId: number) {
    game.status = 'finished';

    const duration = Math.floor((Date.now() - game.startTime) / 1000);
    const players = Array.from(game.players.values());

    // Met à jour le statut en base de données
    this.gameService
      .finishGame(
        game.gameId,
        winnerId,
        duration,
        players[0].coreHP,
        players[1].coreHP,
      )
      .then(() => {
        console.log(`✅ Partie ${game.roomId} enregistrée en BDD`);
      })
      .catch((error) => {
        console.error(
          `❌ Erreur lors de l'enregistrement de la partie ${game.roomId}:`,
          error,
        );
      });

    // Notifie tous les clients
    this.server.to(game.roomId).emit('game:end', {
      winnerId,
      duration,
      finalState: {
        player1HP: players[0].coreHP,
        player2HP: players[1].coreHP,
      },
    });

    console.log(`🏆 Partie ${game.roomId} terminée. Gagnant : ${winnerId}`);

    // Supprime la partie de la mémoire après quelques secondes
    setTimeout(() => {
      this.games.delete(game.roomId);
    }, 5000);
  }

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
   * Nettoie l'état d'une partie (abandon/déconnexion)
   */
  cleanupGame(roomId: string) {
    const game = this.games.get(roomId);
    if (!game) {
      console.log(
        `⚠️ Tentative de nettoyage d'une partie inexistante: ${roomId}`,
      );
      return;
    }

    console.log(`🧹 Nettoyage de la partie ${roomId}`);

    // Supprime la partie de la mémoire
    this.games.delete(roomId);
  }

  /**
   * Récupère l'état d'une partie
   */
  getGameState(roomId: string): GameState | undefined {
    return this.games.get(roomId);
  }
}
