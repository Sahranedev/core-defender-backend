export const GAME_CONFIG = {
  BOARD_WIDTH: 1100,
  BOARD_HEIGHT: 650,

  INITIAL_RESOURCES: 1000,

  CORE_HP: 1000,
  CORE_WIDTH: 70,
  CORE_HEIGHT: 70,
};

export const DEFENSE_TEMPLATES = {
  WALL: {
    name: 'Mur',
    hp: 500,
    cost: 100,
    width: 40,
    height: 40,
  },

  TURRET: {
    name: 'Tourelle',
    hp: 200,
    cost: 350,
    damage: 25,
    fireRate: 2000, // millisecondes entre chaque tir (2 secondes)
    range: 950, // Portée longue - couvre presque toute la map
    width: 50,
    height: 50,
  },

  TRAP: {
    name: 'Piège',
    hp: 100,
    cost: 150,
    damage: 100,
    width: 30,
    height: 30,
  },

  HEAL_BLOCK: {
    name: 'Bloc de Guérison',
    hp: 200,
    cost: 250,
    healAmount: 50,
    healRate: 5000,
    width: 35,
    height: 35,
  },
};

export const PROJECTILE_TEMPLATES = {
  BASIC: {
    name: 'Projectile Basique',
    speed: 5, // pixels par frame
    damage: 50,
    cost: 50,
    width: 10,
    height: 10,
  },

  FAST: {
    name: 'Projectile Rapide',
    speed: 10,
    damage: 30,
    cost: 75,
    width: 8,
    height: 8,
  },

  HEAVY: {
    name: 'Projectile Lourd',
    speed: 3,
    damage: 100,
    cost: 150,
    width: 20,
    height: 20,
  },
};

export const GAME_TEMPLATES = {
  config: GAME_CONFIG,
  defenses: DEFENSE_TEMPLATES,
  projectiles: PROJECTILE_TEMPLATES,
};

export type DefenseType = keyof typeof DEFENSE_TEMPLATES;
export type ProjectileType = keyof typeof PROJECTILE_TEMPLATES;
