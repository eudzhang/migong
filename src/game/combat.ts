export type FlatPosition = {
  x: number;
  z: number;
};

export type ScytheTargetCandidate = FlatPosition & {
  index: number;
};

export type ScytheCombatConfig = {
  scytheRange: number;
  scytheCloseSweepRadius: number;
  scytheAimHalfWidth: number;
  scytheAimAngleDegrees: number;
};

export type BowCombatConfig = {
  bowRange: number;
  bowAimHalfWidth: number;
  bowAimAngleDegrees: number;
};

export function selectScytheTargets(
  player: FlatPosition,
  yaw: number,
  enemies: ScytheTargetCandidate[],
  config: ScytheCombatConfig
): number[] {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const aimHalfAngle = config.scytheAimAngleDegrees * Math.PI / 180;
  const inRangeTargets: Array<{ index: number; distance: number; inSweep: boolean }> = [];

  enemies.forEach((enemy) => {
    const toEnemyX = enemy.x - player.x;
    const toEnemyZ = enemy.z - player.z;
    const distance = Math.sqrt(toEnemyX * toEnemyX + toEnemyZ * toEnemyZ);
    if (distance > config.scytheRange || distance <= 0.001) return;

    const closeSweep = distance <= config.scytheCloseSweepRadius;
    const forwardDistance = toEnemyX * forwardX + toEnemyZ * forwardZ;
    const lateralDistance = Math.sqrt(Math.max(0, distance * distance - forwardDistance * forwardDistance));
    const allowedLateral = Math.max(config.scytheAimHalfWidth, Math.tan(aimHalfAngle) * Math.max(0, forwardDistance));

    inRangeTargets.push({
      index: enemy.index,
      distance,
      inSweep: closeSweep || (forwardDistance >= -0.5 && lateralDistance <= allowedLateral)
    });
  });

  const sweepTargets = inRangeTargets.filter((target) => target.inSweep);
  return (sweepTargets.length > 0 ? sweepTargets : inRangeTargets)
    .sort((a, b) => a.distance - b.distance)
    .map((target) => target.index);
}

export function selectBowTarget(
  player: FlatPosition,
  yaw: number,
  enemies: ScytheTargetCandidate[],
  config: BowCombatConfig
): number | null {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const aimAngle = config.bowAimAngleDegrees * Math.PI / 180;
  let bestIndex: number | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  enemies.forEach((enemy) => {
    const toEnemyX = enemy.x - player.x;
    const toEnemyZ = enemy.z - player.z;
    const distance = Math.sqrt(toEnemyX * toEnemyX + toEnemyZ * toEnemyZ);
    if (distance > config.bowRange || distance <= 0.001) return;

    const forwardDistance = toEnemyX * forwardX + toEnemyZ * forwardZ;
    if (forwardDistance <= 0) return;
    const lateralDistance = Math.sqrt(Math.max(0, distance * distance - forwardDistance * forwardDistance));
    const allowedLateral = Math.max(config.bowAimHalfWidth, Math.tan(aimAngle) * forwardDistance);
    if (lateralDistance > allowedLateral) return;
    if (distance < bestDistance) {
      bestIndex = enemy.index;
      bestDistance = distance;
    }
  });

  return bestIndex;
}
