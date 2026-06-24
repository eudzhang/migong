export const GAME_BALANCE = {
  player: {
    moveSpeed: 2.8,
    lives: 5,
    blockInvulnerableSeconds: 0.65,
    hitInvulnerableSeconds: 1.7,
    runeCollectRadius: 0.85,
    crystalCollectRadius: 0.8,
    healthPickupRadius: 0.9,
    exitRadius: 1.1
  },
  shop: {
    shieldCost: 4,
    scytheCost: 3,
    bowCost: 6
  },
  combat: {
    scytheRange: 4.8,
    scytheCloseSweepRadius: 1.8,
    scytheAimHalfWidth: 0.95,
    scytheAimAngleDegrees: 42,
    scytheMissCooldown: 0.25,
    scytheHitCooldown: 0.28,
    scytheSwingSeconds: 0.34,
    bowRange: 23,
    bowAimHalfWidth: 1.15,
    bowAimAngleDegrees: 18,
    bowCooldown: 0.55,
    bowDrawSeconds: 0.34
  },
  enemies: {
    initialKinds: ["僵尸", "鬼新娘", "老婆婆"],
    maxAlive: 5,
    minSpawnDistance: 7,
    initialSpawnSeconds: 13,
    minSpawnSeconds: 8,
    baseSpawnSeconds: 16,
    spawnRampPerSecond: 0.025,
    hudThreatDistance: 3.2
  }
} as const;
