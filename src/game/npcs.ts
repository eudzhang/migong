import { Color3, CreateBox, Mesh, PointLight, Scene, StandardMaterial, Vector3 } from "../app/babylon";

export type NpcKind = "鬼新娘" | "僵尸" | "老婆婆" | "森林守卫" | "蝙蝠群";

export type Enemy = {
  kind: NpcKind;
  root: Mesh;
  parts: Mesh[];
  light: PointLight;
  speed: number;
  health: number;
  attackCooldown: number;
  rageUntil: number;
  rageCooldown: number;
  wobble: number;
};

export type EnemyUpdateResult = {
  closestKind?: NpcKind;
  closestDistance: number;
};

type EnemyBehaviorProfile = {
  alertDistance: number;
  attackDistance: number;
  attackCooldown: number;
  speedMultiplier: number;
};

const ENEMY_BEHAVIOR: Record<NpcKind, EnemyBehaviorProfile> = {
  "鬼新娘": {
    alertDistance: 7.4,
    attackDistance: 0.48,
    attackCooldown: 2.2,
    speedMultiplier: 0.86
  },
  "僵尸": {
    alertDistance: 6.6,
    attackDistance: 0.5,
    attackCooldown: 2.35,
    speedMultiplier: 0.82
  },
  "老婆婆": {
    alertDistance: 8.2,
    attackDistance: 0.46,
    attackCooldown: 2.5,
    speedMultiplier: 0.76
  },
  "森林守卫": {
    alertDistance: 14.5,
    attackDistance: 1.05,
    attackCooldown: 1.08,
    speedMultiplier: 1.28
  },
  "蝙蝠群": {
    alertDistance: 10.5,
    attackDistance: 0.62,
    attackCooldown: 1.15,
    speedMultiplier: 1.55
  }
};

export type NpcMaterials = {
  skin: StandardMaterial;
  bride: StandardMaterial;
  brideHair: StandardMaterial;
  zombie: StandardMaterial;
  zombieCloth: StandardMaterial;
  granny: StandardMaterial;
  grayHair: StandardMaterial;
  blackCloth: StandardMaterial;
  darkStone: StandardMaterial;
  bone: StandardMaterial;
  steel: StandardMaterial;
  redMark: StandardMaterial;
  flower: StandardMaterial;
  greenStem: StandardMaterial;
  eye: StandardMaterial;
  bark: StandardMaterial;
  leaf: StandardMaterial;
};

function addNpcBlock(
  scene: Scene,
  name: string,
  size: { width: number; height: number; depth: number },
  position: Vector3,
  material: StandardMaterial,
  parent?: Mesh
): Mesh {
  const block = CreateBox(name, size, scene);
  block.position = position;
  block.material = material;
  if (parent) block.parent = parent;
  return block;
}

export function createNpc(scene: Scene, kind: NpcKind, position: Vector3, materials: NpcMaterials): Enemy {
  const root = addNpcBlock(scene, `${kind}-root`, { width: 0.05, height: 0.05, depth: 0.05 }, position, materials.skin);
  root.isVisible = false;

  const parts: Mesh[] = [];
  const addPart = (
    name: string,
    size: { width: number; height: number; depth: number },
    local: Vector3,
    material: StandardMaterial,
    rotation = new Vector3(0, 0, 0)
  ): void => {
    const part = addNpcBlock(scene, name, size, local, material, root);
    part.rotation = rotation;
    part.metadata = {
      baseRotation: rotation.clone(),
      animationWeight:
        name.includes("arm") || name.includes("hair") || name.includes("veil") || name.includes("skirt") || name.includes("cane") || name.includes("wing") ? 1 : 0.18
    };
    parts.push(part);
  };

  if (kind === "鬼新娘") {
    addPart("bride-dress-core", { width: 0.52, height: 0.78, depth: 0.34 }, new Vector3(0, 0.68, 0), materials.bride);
    addPart("bride-waist-sash", { width: 0.58, height: 0.08, depth: 0.38 }, new Vector3(0, 0.94, -0.01), materials.redMark);
    addPart("bride-skirt-front", { width: 0.72, height: 0.45, depth: 0.42 }, new Vector3(0, 0.24, -0.01), materials.bride);
    addPart("bride-skirt-left", { width: 0.18, height: 0.52, depth: 0.36 }, new Vector3(-0.42, 0.3, 0), materials.bride, new Vector3(0, 0, -0.08));
    addPart("bride-skirt-right", { width: 0.18, height: 0.52, depth: 0.36 }, new Vector3(0.42, 0.3, 0), materials.bride, new Vector3(0, 0, 0.08));
    addPart("bride-head", { width: 0.42, height: 0.42, depth: 0.42 }, new Vector3(0, 1.27, 0), materials.skin);
    addPart("bride-hair-cap", { width: 0.48, height: 0.2, depth: 0.48 }, new Vector3(0, 1.49, 0), materials.brideHair);
    addPart("bride-hair-left", { width: 0.16, height: 0.74, depth: 0.14 }, new Vector3(-0.27, 1.14, -0.01), materials.brideHair);
    addPart("bride-hair-right", { width: 0.16, height: 0.74, depth: 0.14 }, new Vector3(0.27, 1.14, -0.01), materials.brideHair);
    addPart("bride-veil-back", { width: 0.68, height: 0.98, depth: 0.07 }, new Vector3(0, 1.0, 0.25), materials.bride);
    addPart("bride-veil-front", { width: 0.46, height: 0.48, depth: 0.045 }, new Vector3(0, 1.23, -0.25), materials.bride);
    addPart("bride-arm-left", { width: 0.13, height: 0.52, depth: 0.13 }, new Vector3(-0.38, 0.82, -0.08), materials.skin, new Vector3(0.35, 0, -0.12));
    addPart("bride-arm-right", { width: 0.13, height: 0.52, depth: 0.13 }, new Vector3(0.38, 0.82, -0.08), materials.skin, new Vector3(0.35, 0, 0.12));
    addPart("bride-bouquet-stem", { width: 0.08, height: 0.3, depth: 0.08 }, new Vector3(0.28, 0.65, -0.33), materials.greenStem, new Vector3(0.65, 0, 0.12));
    addPart("bride-bouquet-head", { width: 0.24, height: 0.18, depth: 0.2 }, new Vector3(0.34, 0.82, -0.44), materials.flower);
    addPart("bride-eye-l", { width: 0.08, height: 0.08, depth: 0.03 }, new Vector3(-0.11, 1.28, -0.22), materials.eye);
    addPart("bride-eye-r", { width: 0.08, height: 0.08, depth: 0.03 }, new Vector3(0.11, 1.28, -0.22), materials.eye);
    addPart("bride-mouth", { width: 0.12, height: 0.04, depth: 0.035 }, new Vector3(0, 1.14, -0.23), materials.brideHair);
  } else if (kind === "僵尸") {
    addPart("zombie-body", { width: 0.54, height: 0.74, depth: 0.34 }, new Vector3(0, 0.68, 0), materials.zombieCloth, new Vector3(0, 0, -0.06));
    addPart("zombie-shirt-rip-a", { width: 0.18, height: 0.24, depth: 0.035 }, new Vector3(-0.16, 0.82, -0.19), materials.zombie);
    addPart("zombie-shirt-rip-b", { width: 0.14, height: 0.18, depth: 0.035 }, new Vector3(0.14, 0.56, -0.19), materials.skin);
    addPart("zombie-head", { width: 0.44, height: 0.42, depth: 0.42 }, new Vector3(0.03, 1.25, -0.02), materials.zombie, new Vector3(0, 0, 0.1));
    addPart("zombie-brow", { width: 0.32, height: 0.06, depth: 0.035 }, new Vector3(0.02, 1.35, -0.23), materials.darkStone, new Vector3(0, 0, -0.08));
    addPart("zombie-arm-l-upper", { width: 0.16, height: 0.16, depth: 0.48 }, new Vector3(-0.36, 0.86, -0.31), materials.zombie, new Vector3(0.05, 0.08, 0));
    addPart("zombie-arm-r-upper", { width: 0.16, height: 0.16, depth: 0.48 }, new Vector3(0.38, 0.86, -0.31), materials.zombie, new Vector3(-0.05, -0.08, 0));
    addPart("zombie-hand-l", { width: 0.18, height: 0.14, depth: 0.18 }, new Vector3(-0.38, 0.84, -0.62), materials.zombie);
    addPart("zombie-hand-r", { width: 0.18, height: 0.14, depth: 0.18 }, new Vector3(0.4, 0.84, -0.62), materials.zombie);
    addPart("zombie-leg-l", { width: 0.18, height: 0.44, depth: 0.2 }, new Vector3(-0.15, 0.12, -0.02), materials.zombieCloth, new Vector3(0, 0, 0.08));
    addPart("zombie-leg-r", { width: 0.18, height: 0.44, depth: 0.2 }, new Vector3(0.15, 0.12, 0.03), materials.zombieCloth, new Vector3(0, 0, -0.12));
    addPart("zombie-bone-l", { width: 0.08, height: 0.24, depth: 0.08 }, new Vector3(-0.42, 0.82, -0.06), materials.bone, new Vector3(0.2, 0, 0.18));
    addPart("zombie-eye-l", { width: 0.07, height: 0.07, depth: 0.03 }, new Vector3(-0.1, 1.25, -0.22), materials.eye);
    addPart("zombie-eye-r", { width: 0.07, height: 0.07, depth: 0.03 }, new Vector3(0.1, 1.25, -0.22), materials.eye);
    addPart("zombie-mouth", { width: 0.16, height: 0.05, depth: 0.035 }, new Vector3(0, 1.12, -0.22), materials.darkStone);
  } else if (kind === "老婆婆") {
    addPart("granny-body", { width: 0.5, height: 0.66, depth: 0.34 }, new Vector3(0, 0.58, 0), materials.granny, new Vector3(0, 0, 0.05));
    addPart("granny-apron", { width: 0.34, height: 0.38, depth: 0.04 }, new Vector3(0, 0.55, -0.2), materials.bride);
    addPart("granny-head", { width: 0.4, height: 0.4, depth: 0.4 }, new Vector3(0, 1.14, 0), materials.skin);
    addPart("granny-hair-cap", { width: 0.46, height: 0.18, depth: 0.44 }, new Vector3(0, 1.38, 0), materials.grayHair);
    addPart("granny-hair-bun", { width: 0.26, height: 0.24, depth: 0.22 }, new Vector3(0, 1.49, 0.18), materials.grayHair);
    addPart("granny-shawl", { width: 0.66, height: 0.18, depth: 0.4 }, new Vector3(0, 0.88, -0.02), materials.blackCloth);
    addPart("granny-arm-l", { width: 0.13, height: 0.46, depth: 0.13 }, new Vector3(-0.34, 0.58, -0.04), materials.skin, new Vector3(0, 0, 0.18));
    addPart("granny-arm-r", { width: 0.13, height: 0.48, depth: 0.13 }, new Vector3(0.36, 0.62, -0.08), materials.skin, new Vector3(0.1, 0, -0.2));
    addPart("granny-cane", { width: 0.07, height: 0.94, depth: 0.07 }, new Vector3(0.5, 0.42, -0.12), materials.darkStone, new Vector3(0, 0, -0.18));
    addPart("granny-cane-hook", { width: 0.22, height: 0.07, depth: 0.07 }, new Vector3(0.44, 0.9, -0.12), materials.darkStone);
    addPart("granny-leg-l", { width: 0.14, height: 0.34, depth: 0.16 }, new Vector3(-0.12, 0.09, 0), materials.skin);
    addPart("granny-leg-r", { width: 0.14, height: 0.34, depth: 0.16 }, new Vector3(0.12, 0.09, 0), materials.skin);
    addPart("granny-eye-l", { width: 0.07, height: 0.07, depth: 0.03 }, new Vector3(-0.1, 1.19, -0.21), materials.eye);
    addPart("granny-eye-r", { width: 0.07, height: 0.07, depth: 0.03 }, new Vector3(0.1, 1.19, -0.21), materials.eye);
    addPart("granny-glasses-bar", { width: 0.34, height: 0.04, depth: 0.035 }, new Vector3(0, 1.2, -0.22), materials.darkStone);
    addPart("granny-glasses-l", { width: 0.12, height: 0.12, depth: 0.025 }, new Vector3(-0.1, 1.2, -0.235), materials.steel);
    addPart("granny-glasses-r", { width: 0.12, height: 0.12, depth: 0.025 }, new Vector3(0.1, 1.2, -0.235), materials.steel);
    addPart("granny-mouth", { width: 0.12, height: 0.04, depth: 0.035 }, new Vector3(0, 1.08, -0.21), materials.darkStone);
  } else if (kind === "蝙蝠群") {
    [-0.34, 0, 0.34].forEach((x, index) => {
      const y = 1.05 + (index % 2) * 0.18;
      const z = (index - 1) * 0.12;
      addPart(`bat-body-${index}`, { width: 0.18, height: 0.14, depth: 0.16 }, new Vector3(x, y, z), materials.blackCloth);
      addPart(`bat-head-${index}`, { width: 0.14, height: 0.12, depth: 0.12 }, new Vector3(x, y + 0.08, z - 0.1), materials.darkStone);
      addPart(`bat-ear-l-${index}`, { width: 0.05, height: 0.1, depth: 0.04 }, new Vector3(x - 0.05, y + 0.18, z - 0.1), materials.blackCloth, new Vector3(0, 0, -0.2));
      addPart(`bat-ear-r-${index}`, { width: 0.05, height: 0.1, depth: 0.04 }, new Vector3(x + 0.05, y + 0.18, z - 0.1), materials.blackCloth, new Vector3(0, 0, 0.2));
      addPart(`bat-wing-l-${index}`, { width: 0.34, height: 0.06, depth: 0.22 }, new Vector3(x - 0.24, y + 0.02, z), materials.blackCloth, new Vector3(0, 0.12, -0.34));
      addPart(`bat-wing-r-${index}`, { width: 0.34, height: 0.06, depth: 0.22 }, new Vector3(x + 0.24, y + 0.02, z), materials.blackCloth, new Vector3(0, -0.12, 0.34));
      addPart(`bat-eye-l-${index}`, { width: 0.035, height: 0.035, depth: 0.025 }, new Vector3(x - 0.035, y + 0.09, z - 0.165), materials.eye);
      addPart(`bat-eye-r-${index}`, { width: 0.035, height: 0.035, depth: 0.025 }, new Vector3(x + 0.035, y + 0.09, z - 0.165), materials.eye);
    });
  } else {
    addPart("warden-root-body", { width: 0.7, height: 0.96, depth: 0.46 }, new Vector3(0, 0.72, 0), materials.bark);
    addPart("warden-bark-chest", { width: 0.46, height: 0.52, depth: 0.06 }, new Vector3(0, 0.76, -0.27), materials.darkStone);
    addPart("warden-head", { width: 0.58, height: 0.52, depth: 0.52 }, new Vector3(0, 1.43, -0.02), materials.bark);
    addPart("warden-brow", { width: 0.52, height: 0.09, depth: 0.05 }, new Vector3(0, 1.52, -0.29), materials.darkStone);
    addPart("warden-horn-l", { width: 0.18, height: 0.46, depth: 0.18 }, new Vector3(-0.34, 1.78, 0), materials.bone, new Vector3(0, 0, -0.36));
    addPart("warden-horn-r", { width: 0.18, height: 0.46, depth: 0.18 }, new Vector3(0.34, 1.78, 0), materials.bone, new Vector3(0, 0, 0.36));
    addPart("warden-leaf-crown-a", { width: 0.72, height: 0.16, depth: 0.5 }, new Vector3(0, 1.68, 0.02), materials.leaf);
    addPart("warden-leaf-crown-b", { width: 0.44, height: 0.12, depth: 0.72 }, new Vector3(0, 1.74, 0.02), materials.leaf);
    addPart("warden-arm-l", { width: 0.18, height: 0.76, depth: 0.18 }, new Vector3(-0.52, 0.74, -0.08), materials.bark, new Vector3(0.18, 0, -0.18));
    addPart("warden-arm-r", { width: 0.18, height: 0.76, depth: 0.18 }, new Vector3(0.52, 0.74, -0.08), materials.bark, new Vector3(0.18, 0, 0.18));
    addPart("warden-claw-l", { width: 0.28, height: 0.12, depth: 0.22 }, new Vector3(-0.58, 0.34, -0.2), materials.bone);
    addPart("warden-claw-r", { width: 0.28, height: 0.12, depth: 0.22 }, new Vector3(0.58, 0.34, -0.2), materials.bone);
    addPart("warden-leg-l", { width: 0.22, height: 0.54, depth: 0.24 }, new Vector3(-0.22, 0.16, 0), materials.bark, new Vector3(0, 0, 0.12));
    addPart("warden-leg-r", { width: 0.22, height: 0.54, depth: 0.24 }, new Vector3(0.22, 0.16, 0), materials.bark, new Vector3(0, 0, -0.12));
    addPart("warden-eye-l", { width: 0.1, height: 0.1, depth: 0.035 }, new Vector3(-0.14, 1.44, -0.29), materials.eye);
    addPart("warden-eye-r", { width: 0.1, height: 0.1, depth: 0.035 }, new Vector3(0.14, 1.44, -0.29), materials.eye);
    addPart("warden-mouth", { width: 0.22, height: 0.05, depth: 0.035 }, new Vector3(0, 1.27, -0.3), materials.eye);
  }

  if (kind === "森林守卫") root.scaling.set(1.28, 1.28, 1.28);

  const light = new PointLight(`${kind}-warning-light`, position.add(new Vector3(0, 1, 0)), scene);
  light.diffuse = kind === "鬼新娘" ? new Color3(0.75, 0.8, 1) : kind === "僵尸" ? new Color3(0.2, 1, 0.25) : kind === "森林守卫" ? new Color3(0.45, 1, 0.35) : kind === "蝙蝠群" ? new Color3(0.7, 0.12, 1) : new Color3(0.8, 0.25, 1);
  light.intensity = kind === "森林守卫" ? 0.98 : kind === "蝙蝠群" ? 0.62 : 0.55;
  light.range = kind === "森林守卫" ? 4.4 : kind === "蝙蝠群" ? 3.2 : 2.8;

  return {
    kind,
    root,
    parts,
    light,
    speed: kind === "僵尸" ? 1.25 : kind === "鬼新娘" ? 1.45 : kind === "森林守卫" ? 1.62 : kind === "蝙蝠群" ? 2.08 : 1.05,
    health: kind === "森林守卫" ? 16 : 1,
    attackCooldown: 0,
    rageUntil: 0,
    rageCooldown: 4 + Math.random() * 5,
    wobble: Math.random() * Math.PI * 2
  };
}

export function disposeEnemy(enemy: Enemy): void {
  enemy.parts.forEach((part) => part.dispose());
  enemy.root.dispose();
  enemy.light.dispose();
}

export function updateEnemyVisual(enemy: Enemy, elapsed: number): void {
  const raging = elapsed < enemy.rageUntil;
  enemy.root.position.y = 0.02 + Math.sin(elapsed * (raging ? 8 : 4) + enemy.wobble) * (raging ? 0.055 : 0.035);
  enemy.parts.forEach((part, index) => {
    const baseRotation = part.metadata?.baseRotation as Vector3 | undefined;
    const animationWeight = (part.metadata?.animationWeight as number | undefined) ?? 0.2;
    if (!baseRotation) return;
    const sway = Math.sin(elapsed * (raging ? 9 : 5) + enemy.wobble + index) * (raging ? 0.06 : 0.035) * animationWeight;
    part.rotation.x = baseRotation.x + Math.sin(elapsed * (raging ? 6.2 : 3.2) + index) * (raging ? 0.022 : 0.012) * animationWeight;
    part.rotation.y = baseRotation.y;
    part.rotation.z = baseRotation.z + sway;
  });
  enemy.light.position = enemy.root.position.add(new Vector3(0, 1.1, 0));
  enemy.light.intensity = (raging ? 0.95 : 0.45) + Math.sin(elapsed * 7 + enemy.wobble) * 0.12;
}

export function updateEnemies(
  enemies: Enemy[],
  playerPosition: Vector3,
  delta: number,
  elapsed: number,
  canMoveTo: (position: Vector3) => boolean,
  canAct: boolean,
  onAttack: (kind: NpcKind) => void
): EnemyUpdateResult {
  let closestKind: NpcKind | undefined;
  let closestDistance = Number.POSITIVE_INFINITY;

  enemies.forEach((enemy) => {
    enemy.attackCooldown = Math.max(0, enemy.attackCooldown - delta);
    enemy.rageCooldown = Math.max(0, enemy.rageCooldown - delta);
    const toPlayer = playerPosition.subtract(enemy.root.position);
    const distance = Math.sqrt(toPlayer.x * toPlayer.x + toPlayer.z * toPlayer.z);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestKind = enemy.kind;
    }

    const profile = ENEMY_BEHAVIOR[enemy.kind];
    if (canAct && enemy.kind !== "森林守卫" && enemy.rageCooldown <= 0 && distance < profile.alertDistance + 2) {
      enemy.rageUntil = elapsed + 2.4 + Math.random() * 1.4;
      enemy.rageCooldown = 8 + Math.random() * 8;
    }
    const raging = elapsed < enemy.rageUntil;
    if (canAct && distance < profile.alertDistance) {
      const direction = new Vector3(toPlayer.x, 0, toPlayer.z);
      if (direction.lengthSquared() > 0.001) {
        const rageMultiplier = raging ? 2.05 : 1;
        direction.normalize().scaleInPlace(delta * enemy.speed * profile.speedMultiplier * rageMultiplier);
        const nextX = enemy.root.position.add(new Vector3(direction.x, 0, 0));
        const nextZ = enemy.root.position.add(new Vector3(0, 0, direction.z));
        if (canMoveTo(nextX)) enemy.root.position.x = nextX.x;
        if (canMoveTo(nextZ)) enemy.root.position.z = nextZ.z;
        enemy.root.rotation.y = Math.atan2(direction.x, direction.z);
      }
    }

    updateEnemyVisual(enemy, elapsed);

    if (canAct && distance < profile.attackDistance && enemy.attackCooldown <= 0) {
      enemy.attackCooldown = profile.attackCooldown;
      onAttack(enemy.kind);
    }
  });

  return { closestKind, closestDistance };
}
