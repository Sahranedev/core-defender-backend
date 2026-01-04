// ============================================
// CONFIGURATION GÉNÉRALE DU JEU
// ============================================
export const GAME_CONFIG = {
  BOARD_WIDTH: 1100,
  BOARD_HEIGHT: 650,

  INITIAL_RESOURCES: 500,
  RESOURCE_PER_SECOND: 50,

  CORE_HP: 2500,
  CORE_WIDTH: 70,
  CORE_HEIGHT: 70,
};

// ============================================
// LIMITES DE DÉFENSES PAR TYPE
// ============================================
export const DEFENSE_LIMITS: { [key: string]: number } = {
  WALL: 10,
  TURRET: 6,
  TRAP: 4,
  HEAL_BLOCK: 3,
};

// ============================================
// TEMPLATES DES DÉFENSES
// ============================================
export const DEFENSE_TEMPLATES = {
  WALL: {
    name: 'Mur',
    hp: 400,
    cost: 150,
    width: 40,
    height: 40,
  },

  TURRET: {
    name: 'Tourelle',
    hp: 150,
    cost: 400,
    damage: 30,
    fireRate: 2000,
    range: 950,
    width: 50,
    height: 50,
  },

  TRAP: {
    name: 'Piège',
    hp: 100,
    cost: 200,
    damage: 100,
    width: 30,
    height: 30,
  },

  HEAL_BLOCK: {
    name: 'Bloc de Guérison',
    hp: 200,
    cost: 300,
    healAmount: 50,
    healRate: 5000,
    width: 35,
    height: 35,
  },
};

// ============================================
// TEMPLATES DES PROJECTILES
// ============================================
export const PROJECTILE_TEMPLATES = {
  BASIC: {
    name: 'Projectile Basique',
    speed: 5,
    damage: 50,
    cost: 75,
    width: 10,
    height: 10,
  },

  FAST: {
    name: 'Projectile Rapide',
    speed: 10,
    damage: 30,
    cost: 100,
    width: 8,
    height: 8,
  },

  HEAVY: {
    name: 'Projectile Lourd',
    speed: 3,
    damage: 100,
    cost: 200,
    width: 20,
    height: 20,
  },
};

// ============================================
// EXPORT GLOBAL POUR LE CLIENT
// ============================================
export const GAME_TEMPLATES = {
  config: GAME_CONFIG,
  defenses: DEFENSE_TEMPLATES,
  defenseLimits: DEFENSE_LIMITS,
  projectiles: PROJECTILE_TEMPLATES,
};

export type DefenseType = keyof typeof DEFENSE_TEMPLATES;
export type ProjectileType = keyof typeof PROJECTILE_TEMPLATES;
