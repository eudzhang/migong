import type { BabylonApp } from "../app/BabylonApp";
import { selectBowTarget, selectScytheTargets } from "./combat";
import { GAME_BALANCE } from "./config";
import { InputState } from "./input";
import { createNpc, disposeEnemy, updateEnemies, type Enemy, type NpcKind, type NpcMaterials } from "./npcs";
import {
  Color3,
  Color4,
  CreateBox,
  CreateCylinder,
  CreateGround,
  DirectionalLight,
  DynamicTexture,
  GlowLayer,
  HemisphericLight,
  Mesh,
  PointLight,
  Scene,
  StandardMaterial,
  Texture,
  UniversalCamera,
  Vector3
} from "../app/babylon";

type LevelDefinition = {
  id: string;
  name: string;
  subtitle: string;
  maze: string[];
  fogDensity: number;
  fogColor: Color3;
  groundName: string;
  wallName: string;
};

const LEVELS: LevelDefinition[] = [
  {
    id: "moon-maze",
    name: "第一关 月影迷宫",
    subtitle: "收集 3 个符文，开启出口。",
    maze: [
      "#################",
      "#S....#.....#...#",
      "#.###.#.###.#.#.#",
      "#...#...#K#...#.#",
      "###.#####.#####.#",
      "#...#.....#.....#",
      "#.###.###.#.###.#",
      "#.#...#...#.#K..#",
      "#.#.###.###.###.#",
      "#...#...K...#...#",
      "#.###.#####.#.###",
      "#.....#.....#...#",
      "#.#####.#######.#",
      "#..............E#",
      "#################"
    ],
    fogDensity: 0.028,
    fogColor: new Color3(0.08, 0.11, 0.16),
    groundName: "mossy-floor",
    wallName: "stone-brick"
  },
  {
    id: "mist-forest",
    name: "第二关 迷雾森林",
    subtitle: "森林更大，雾更浓，出口藏在更深处。",
    maze: [
      "#######################",
      "#S..#.....#.....#....K#",
      "###.#.###.#.###.#.###.#",
      "#...#...#...#...#...#.#",
      "#.#####.#####.#####.#.#",
      "#.....#.....#.....#...#",
      "#.###.###.#.###.#####.#",
      "#.#K#.....#...#.....#.#",
      "#.#.#########.#####.#.#",
      "#.#.......#...#...#...#",
      "#.#######.#.###.#.###.#",
      "#.....#...#.....#...#.#",
      "###.#.#.###########.#.#",
      "#...#.#.....K.....#...#",
      "#.###.#####.#####.###.#",
      "#.#...#...#.....#.....#",
      "#.#.###.#.#####.#####.#",
      "#...#...#.....#.....K.#",
      "#.###.#######.#####.#.#",
      "#.....#..........E....#",
      "#######################"
    ],
    fogDensity: 0.086,
    fogColor: new Color3(0.045, 0.105, 0.1),
    groundName: "forest-floor",
    wallName: "ancient-tree-wall"
  },
  {
    id: "desert-city",
    name: "第三关 沙漠之城",
    subtitle: "收集 5 个太阳符文，穿过机关古城。",
    maze: [
      "#########################",
      "#S..#.....#.......#....K#",
      "###.#.###.#.#####.#.###.#",
      "#...#...#...#...#...#...#",
      "#.#####.#####.#.#####.#.#",
      "#.....#.....#.#.....#.#.#",
      "#.###.#.###.#.###.#.#.#.#",
      "#.#K#.#...#.....#.#...#.#",
      "#.#.#.###.#######.#####.#",
      "#...#.....#.....#.....#.#",
      "#.#######.#.###.#####.#.#",
      "#.....#...#.#K#.....#...#",
      "###.#.#.###.#.#####.###.#",
      "#...#.#.....#.....#.....#",
      "#.###.###########.#####.#",
      "#.#...#.....K...#.....#.#",
      "#.#.###.#####.#.#####.#.#",
      "#...#...#.....#.....#...#",
      "#.###.#.#.#########.###.#",
      "#.....#.#.....#...#...K.#",
      "#.#####.#####.#.#.#####.#",
      "#.............#.#.....E.#",
      "#########################"
    ],
    fogDensity: 0.038,
    fogColor: new Color3(0.27, 0.2, 0.12),
    groundName: "wind-sand",
    wallName: "sunstone-wall"
  }
];

const TILE = 1.25;
const UNLOCKED_LEVELS_KEY = "moon-maze-unlocked-levels";

function readInitialLevelIndex(): number {
  const match = window.location.hash.match(/level-(\d+)/);
  const hashLevel = match ? Number.parseInt(match[1], 10) - 1 : 0;
  const requested = Math.max(0, Math.min(LEVELS.length - 1, Number.isFinite(hashLevel) ? hashLevel : 0));
  return Math.min(requested, getUnlockedLevelCount() - 1);
}

function getUnlockedLevelCount(): number {
  const stored = Number.parseInt(window.localStorage.getItem(UNLOCKED_LEVELS_KEY) ?? "1", 10);
  return Math.max(1, Math.min(LEVELS.length, Number.isFinite(stored) ? stored : 1));
}

function setUnlockedLevelCount(count: number): void {
  window.localStorage.setItem(UNLOCKED_LEVELS_KEY, `${Math.max(1, Math.min(LEVELS.length, count))}`);
}

let currentLevelIndex = readInitialLevelIndex();
let currentLevel = LEVELS[currentLevelIndex];
let currentMaze = currentLevel.maze;
let dynamicBlockedCells = new Set<string>();
let dynamicOpenCells = new Set<string>();

type Cell = { row: number; col: number };

function isForestLevel(): boolean {
  return currentLevel.id === "mist-forest";
}

function isDesertLevel(): boolean {
  return currentLevel.id === "desert-city";
}

function cellKey(cell: Cell): string {
  return `${cell.row}:${cell.col}`;
}

function worldFromCell(cell: Cell): Vector3 {
  const halfW = (currentMaze[0].length - 1) * TILE * 0.5;
  const halfH = (currentMaze.length - 1) * TILE * 0.5;
  return new Vector3(cell.col * TILE - halfW, 0, cell.row * TILE - halfH);
}

function cellFromWorld(position: Vector3): Cell {
  const halfW = (currentMaze[0].length - 1) * TILE * 0.5;
  const halfH = (currentMaze.length - 1) * TILE * 0.5;
  return {
    row: Math.round((position.z + halfH) / TILE),
    col: Math.round((position.x + halfW) / TILE)
  };
}

function isWall(row: number, col: number): boolean {
  const key = cellKey({ row, col });
  return row < 0 || col < 0 || row >= currentMaze.length || col >= currentMaze[row].length || (!dynamicOpenCells.has(key) && currentMaze[row][col] === "#") || dynamicBlockedCells.has(key);
}

function findCell(symbol: string): Cell {
  for (let row = 0; row < currentMaze.length; row += 1) {
    const col = currentMaze[row].indexOf(symbol);
    if (col >= 0) return { row, col };
  }
  throw new Error(`Missing maze symbol: ${symbol}`);
}

function openCells(): Cell[] {
  const cells: Cell[] = [];
  currentMaze.forEach((line, row) => {
    [...line].forEach((tile, col) => {
      if (tile !== "#") cells.push({ row, col });
    });
  });
  return cells;
}

function canMoveTo(position: Vector3): boolean {
  const radius = 0.28;
  const probes = [
    new Vector3(position.x + radius, 0, position.z + radius),
    new Vector3(position.x - radius, 0, position.z + radius),
    new Vector3(position.x + radius, 0, position.z - radius),
    new Vector3(position.x - radius, 0, position.z - radius)
  ];

  return probes.every((probe) => {
    const cell = cellFromWorld(probe);
    return !isWall(cell.row, cell.col);
  });
}

function makeMaterial(scene: Scene, name: string, color: Color3, emissive = Color3.Black()): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = emissive;
  material.specularColor = new Color3(0.04, 0.04, 0.04);
  return material;
}

type PixelPainter = (ctx: CanvasRenderingContext2D, size: number) => void;

function fillPixel(ctx: CanvasRenderingContext2D, x: number, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

function makePixelTexture(scene: Scene, name: string, painter: PixelPainter, size = 16): DynamicTexture {
  const texture = new DynamicTexture(name, { width: size, height: size }, scene, false);
  const context = texture.getContext() as unknown as CanvasRenderingContext2D;
  if ("imageSmoothingEnabled" in context) context.imageSmoothingEnabled = false;
  painter(context, size);
  texture.update(false);
  texture.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  return texture;
}

function makePixelMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  painter: PixelPainter,
  options: { emissive?: Color3; uScale?: number; vScale?: number } = {}
): StandardMaterial {
  const material = makeMaterial(scene, name, color, options.emissive ?? Color3.Black());
  const texture = makePixelTexture(scene, `${name}-texture`, painter);
  texture.uScale = options.uScale ?? 1;
  texture.vScale = options.vScale ?? 1;
  material.diffuseTexture = texture;
  material.diffuseColor = new Color3(1, 1, 1);
  return material;
}

function noisePainter(base: string, flecks: string[], lineColor?: string): PixelPainter {
  return (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const pick = (x * 13 + y * 19 + x * y * 7) % 17;
        if (pick < flecks.length) fillPixel(ctx, x, y, flecks[pick]);
      }
    }
    if (lineColor) {
      ctx.fillStyle = lineColor;
      ctx.fillRect(0, 7, size, 1);
      ctx.fillRect(0, 15, size, 1);
      ctx.fillRect(7, 0, 1, 7);
      ctx.fillRect(3, 8, 1, 7);
      ctx.fillRect(12, 8, 1, 7);
    }
  };
}

function clothPainter(base: string, shade: string, accent: string): PixelPainter {
  return (ctx, size) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if ((x + y * 2) % 7 === 0) fillPixel(ctx, x, y, shade);
        if ((x === 2 || x === 13) && y > 2 && y < 14) fillPixel(ctx, x, y, accent);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(4, 2, 3, 10);
  };
}

function skyPainter(ctx: CanvasRenderingContext2D, size: number): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, "#071129");
  gradient.addColorStop(0.58, "#10264a");
  gradient.addColorStop(1, "#1b2d45");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const seed = (x * 37 + y * 61 + x * y * 13) % 101;
      if (seed === 0 || seed === 3) fillPixel(ctx, x, y, "#f6fbff");
      else if (seed === 8) fillPixel(ctx, x, y, "#8fb5ff");
    }
  }

  ctx.fillStyle = "#dce8ff";
  ctx.fillRect(10, 3, 4, 4);
  ctx.fillStyle = "#071129";
  ctx.fillRect(9, 2, 3, 5);
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutSine(value: number): number {
  return -(Math.cos(Math.PI * value) - 1) / 2;
}

function addBlock(
  scene: Scene,
  name: string,
  size: { width: number; height: number; depth: number },
  position: Vector3,
  material: StandardMaterial,
  parent?: Mesh | UniversalCamera
): Mesh {
  const block = CreateBox(name, size, scene);
  block.position = position;
  block.material = material;
  if (parent) block.parent = parent;
  return block;
}

function makeHud(levelIndex: number): HTMLDivElement {
  const hud = document.querySelector<HTMLDivElement>("#hud");
  if (!hud) throw new Error("Missing #hud");
  const unlockedLevels = getUnlockedLevelCount();
  const levelButtons = LEVELS.map((level, index) => {
    const locked = index >= unlockedLevels;
    return `
      <button class="level-option ${index === levelIndex ? "selected" : ""}" data-level-index="${index}" type="button" ${locked ? "disabled" : ""}>
        <span>${level.name}</span>
        <small>${locked ? "未解锁" : level.subtitle}</small>
      </button>
    `;
  }).join("");

  hud.innerHTML = `
    <div id="start-screen" class="start-screen">
      <div class="start-levels">
        <button id="level-select-button" class="level-select-button" type="button">关卡</button>
        <div id="level-menu" class="level-menu hidden">
          ${levelButtons}
        </div>
      </div>
      <div class="start-copy">
        <button id="start-button" class="start-button" type="button" aria-label="开始探险">
          <img src="/assets/start-button.png" alt="开始探险" />
        </button>
      </div>
    </div>
    <div id="game-ui" class="game-ui hidden">
      <div class="hud-top">
        <div class="hud-panel">
          <span class="hud-label">关卡</span>
          <strong id="level-readout">${levelIndex + 1}</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">符文</span>
          <strong id="keys-readout">0 / 3</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">生命</span>
          <strong id="hearts-readout">3</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">水晶</span>
          <strong id="crystals-readout">0</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">道具</span>
          <strong id="items-readout">无</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">敌情</span>
          <strong id="threat-readout">安静</strong>
        </div>
        <div class="hud-panel">
          <span class="hud-label">状态</span>
          <strong id="status-readout">寻找钥匙</strong>
        </div>
      </div>
      <div class="crosshair"></div>
      <div class="vignette"></div>
      <div id="held-item" class="held-item hidden">
        <img id="held-item-image" src="" alt="" />
      </div>
      <div id="slash-effect" class="slash-effect"></div>
      <div id="combat-toast" class="combat-toast hidden"></div>
      <div id="exit-guide" class="exit-guide hidden">
        <span>出口已开启</span>
        <strong id="exit-guide-text">跟随指引前进</strong>
      </div>
      <div class="hud-tip">WASD移动，鼠标转向。左键/F/空格攻击，鼠标滚轮切换武器，E 打开商城，Esc/P 暂停。</div>
      <div id="damage-flash" class="damage-flash"></div>
      <div id="game-message" class="game-message hidden"></div>
    </div>
    <div id="shop-overlay" class="shop-overlay hidden">
      <div class="shop-panel">
        <div class="shop-heading">
          <span class="hud-label">水晶商城</span>
          <strong id="shop-crystals">0 橙晶</strong>
        </div>
        <button id="buy-shield" class="shop-item" type="button">
          <img src="/assets/item-shield.png" alt="" />
          <span><b>护盾</b><small>消耗 ${GAME_BALANCE.shop.shieldCost} 橙晶，抵挡一次攻击</small></span>
          <em>兑换</em>
        </button>
        <button id="buy-scythe" class="shop-item" type="button">
          <img src="/assets/item-scythe.png" alt="" />
          <span><b>镰刀</b><small>消耗 ${GAME_BALANCE.shop.scytheCost} 橙晶，永久解锁正面攻击</small></span>
          <em>兑换</em>
        </button>
        <button id="buy-bow" class="shop-item" type="button">
          <span class="shop-voxel-icon bow-icon" aria-hidden="true"><i></i></span>
          <span><b>弓箭</b><small>${levelIndex === 0 ? "第二关开放，远距离精准攻击" : `消耗 ${GAME_BALANCE.shop.bowCost} 橙晶，远距离精准攻击`}</small></span>
          <em>兑换</em>
        </button>
        <button id="close-shop" class="secondary-button" type="button">关闭</button>
      </div>
    </div>
    <div id="pause-overlay" class="pause-overlay hidden">
      <div class="pause-panel">
        <span class="hud-label">暂停</span>
        <strong>月影迷宫</strong>
        <p>整理一下呼吸，继续找出口，或者回到首页重新开始。</p>
        <button id="resume-button" class="menu-button primary-menu-button" type="button">继续游戏</button>
        <button id="restart-button" class="menu-button" type="button">重新开始</button>
        <button id="home-button" class="menu-button" type="button">返回首页</button>
      </div>
    </div>
  `;

  return hud;
}

export async function createScene(app: BabylonApp): Promise<Scene> {
  currentLevelIndex = readInitialLevelIndex();
  currentLevel = LEVELS[currentLevelIndex];
  currentMaze = currentLevel.maze;
  dynamicBlockedCells = new Set();
  dynamicOpenCells = new Set();
  if (window.location.hash !== `#level-${currentLevelIndex + 1}`) {
    window.history.replaceState(null, "", `#level-${currentLevelIndex + 1}`);
  }

  const scene = new Scene(app.engine);
  const input = new InputState();
  input.attach(app.canvas);
  scene.onDisposeObservable.add(() => input.detach(app.canvas));

  scene.clearColor = new Color4(0.03, 0.06, 0.12, 1);
  scene.fogMode = Scene.FOGMODE_EXP2;
  scene.fogDensity = currentLevel.fogDensity;
  scene.fogColor = currentLevel.fogColor;

  const glow = new GlowLayer("voxel-glow", scene);
  glow.intensity = 0.48;

  const allOpenCells = openCells();
  const start = worldFromCell(findCell("S"));
  const player = CreateBox("player-collider", { width: 0.2, height: 0.2, depth: 0.2 }, scene);
  player.position = start.add(new Vector3(0, 0.32, 0));
  player.isVisible = false;

  const camera = new UniversalCamera("first-person-camera", player.position.add(new Vector3(0, 0.92, 0)), scene);
  camera.fov = 1.03;
  camera.minZ = 0.04;
  camera.maxZ = 46;
  scene.activeCamera = camera;

  let yaw = 0;
  let pitch = 0;
  const onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== app.canvas || finished || paused || shopOpen || !gameStarted) return;
    yaw += event.movementX * 0.0028;
    pitch += event.movementY * 0.0022;
    pitch = Math.max(-0.66, Math.min(0.66, pitch));
  };

  const requestPointerLock = (): void => {
    try {
      const lockRequest = app.canvas.requestPointerLock?.();
      if (lockRequest instanceof Promise) lockRequest.catch(() => undefined);
    } catch {
      // Embedded browser checks can reject pointer lock; manual play remains fine.
    }
  };

  const onCanvasClick = (): void => {
    if (gameStarted && !finished && !paused && !shopOpen && document.pointerLockElement !== app.canvas) {
      requestPointerLock();
    }
  };

  const onCanvasPointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || !gameStarted || finished || paused || shopOpen) return;
    if (document.pointerLockElement !== app.canvas) {
      requestPointerLock();
      return;
    }
    useAttack();
  };
  window.addEventListener("mousemove", onMouseMove);
  app.canvas.addEventListener("click", onCanvasClick);
  app.canvas.addEventListener("pointerdown", onCanvasPointerDown);
  const onHashChange = (): void => {
    const requestedLevelIndex = readInitialLevelIndex();
    if (requestedLevelIndex !== currentLevelIndex) {
      window.location.reload();
      return;
    }
    if (window.location.hash !== `#level-${currentLevelIndex + 1}`) {
      window.history.replaceState(null, "", `#level-${currentLevelIndex + 1}`);
    }
  };
  window.addEventListener("hashchange", onHashChange);
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("hashchange", onHashChange);
    app.canvas.removeEventListener("click", onCanvasClick);
    app.canvas.removeEventListener("pointerdown", onCanvasPointerDown);
  });

  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.intensity = isForestLevel() ? 0.27 : isDesertLevel() ? 0.36 : 0.42;
  ambient.groundColor = isForestLevel() ? new Color3(0.04, 0.07, 0.06) : isDesertLevel() ? new Color3(0.22, 0.13, 0.06) : new Color3(0.1, 0.09, 0.09);

  const moon = new DirectionalLight("moon", new Vector3(-0.45, -1, 0.45), scene);
  moon.intensity = isForestLevel() ? 0.33 : isDesertLevel() ? 0.55 : 0.48;

  const grassMat = makePixelMaterial(
    scene,
    currentLevel.groundName,
    isForestLevel() ? new Color3(0.16, 0.33, 0.2) : isDesertLevel() ? new Color3(0.55, 0.38, 0.18) : new Color3(0.22, 0.38, 0.24),
    isForestLevel()
      ? noisePainter("#245b2d", ["#1b4727", "#34713a", "#5a7d3c", "#1b3026", "#5a442d"])
      : isDesertLevel()
        ? noisePainter("#9d7231", ["#c89745", "#735020", "#d9b86c", "#5c3718", "#e7c47a"])
      : noisePainter("#2f7131", ["#3e8d3b", "#266025", "#68a34d", "#1f4d24", "#7b5b31"]),
    { uScale: 12, vScale: 10 }
  );
  const stoneMat = makePixelMaterial(
    scene,
    currentLevel.wallName,
    isForestLevel() ? new Color3(0.27, 0.22, 0.16) : isDesertLevel() ? new Color3(0.68, 0.49, 0.25) : new Color3(0.45, 0.47, 0.48),
    isForestLevel()
      ? noisePainter("#4b3423", ["#5e432d", "#2f241a", "#684f31", "#203922", "#6e6a42"], "#1b261b")
      : isDesertLevel()
        ? noisePainter("#b27d36", ["#d9a95c", "#7f5724", "#e6c076", "#5a3618"], "#5b3518")
      : noisePainter("#777b7b", ["#8b8f8f", "#676b6d", "#55595c", "#9da0a0"], "#4d5357"),
    { uScale: 1.2, vScale: 2.6 }
  );
  const darkStoneMat = makePixelMaterial(
    scene,
    "dark-stone",
    new Color3(0.25, 0.28, 0.3),
    noisePainter("#3b4246", ["#2e3438", "#4c5458", "#252b2f"], "#22282c")
  );
  const ceilingMat = makePixelMaterial(
    scene,
    "cave-roof",
    new Color3(0.19, 0.21, 0.23),
    noisePainter("#394047", ["#2b333a", "#515a60", "#1f262c"]),
    { uScale: 12, vScale: 10 }
  );
  const dirtMat = makePixelMaterial(
    scene,
    "dirt-lines",
    new Color3(0.32, 0.22, 0.14),
    noisePainter("#6a4628", ["#7d5633", "#54341d", "#8f6b3d", "#35552a"])
  );
  const leafMat = makePixelMaterial(scene, "leaf-clump", new Color3(0.18, 0.48, 0.2), noisePainter("#2d7c30", ["#3e9a3e", "#1e5f22", "#71aa45"]));
  const mushroomMat = makePixelMaterial(scene, "mushroom-red", new Color3(0.72, 0.12, 0.12), noisePainter("#a52424", ["#f1d8c2", "#7d1717", "#c83b30"]));
  const keyMat = makePixelMaterial(
    scene,
    "rune-key",
    new Color3(0.2, 0.65, 1),
    noisePainter("#2aa7ff", ["#8bdcff", "#106ec9", "#d8f7ff"]),
    { emissive: new Color3(0.02, 0.5, 1) }
  );
  const sunRuneMat = makePixelMaterial(
    scene,
    "sun-rune",
    new Color3(1, 0.72, 0.16),
    noisePainter("#ffb72c", ["#fff0a6", "#c76912", "#f6d063", "#8f4312"]),
    { emissive: new Color3(0.85, 0.35, 0.03) }
  );
  const quicksandMat = makePixelMaterial(
    scene,
    "quicksand",
    new Color3(0.55, 0.36, 0.16),
    noisePainter("#8c6328", ["#c49344", "#5e3a16", "#d9b866", "#6f4a20"]),
    { emissive: new Color3(0.08, 0.04, 0.01) }
  );
  const spikeMat = makePixelMaterial(scene, "bronze-spike", new Color3(0.65, 0.44, 0.18), noisePainter("#9c6727", ["#d99a45", "#5b3517", "#f0be66"]));
  const exitMat = makePixelMaterial(
    scene,
    "gold-exit",
    new Color3(1, 0.78, 0.2),
    noisePainter("#d99b1b", ["#ffd86a", "#9b5d0c", "#fff1a8"], "#7d4a08"),
    { emissive: new Color3(0.45, 0.25, 0.03) }
  );
  const torchMat = makePixelMaterial(
    scene,
    "torch",
    new Color3(0.95, 0.5, 0.14),
    noisePainter("#9b5524", ["#df7b2a", "#5c3216", "#ffd36b"]),
    { emissive: new Color3(0.75, 0.22, 0.04) }
  );
  const skyMat = makePixelMaterial(scene, "night-sky", new Color3(1, 1, 1), skyPainter, {
    emissive: new Color3(0.42, 0.52, 0.78),
    uScale: 2,
    vScale: 1
  });
  skyMat.backFaceCulling = false;
  skyMat.disableLighting = true;
  const crystalMat = makePixelMaterial(
    scene,
    "orange-crystal",
    new Color3(1, 0.5, 0.1),
    noisePainter("#ff8b1a", ["#ffd36d", "#c75208", "#fff0aa", "#ffad33"]),
    { emissive: new Color3(0.9, 0.32, 0.04) }
  );
  const ginsengMat = makePixelMaterial(
    scene,
    "ginseng-root",
    new Color3(0.86, 0.68, 0.45),
    noisePainter("#d5a76f", ["#f4d09b", "#a87543", "#fff0c9", "#8c5e33"]),
    { emissive: new Color3(0.18, 0.08, 0.02) }
  );
  const ginsengLeafMat = makePixelMaterial(scene, "ginseng-leaf", new Color3(0.2, 0.58, 0.24), noisePainter("#2f8c35", ["#55b654", "#1f6f26", "#8ccf63"]));
  const altarMat = makePixelMaterial(
    scene,
    "altar-runes",
    new Color3(0.22, 0.16, 0.34),
    noisePainter("#34234a", ["#604187", "#ff8b1a", "#1c1429"], "#ff8b1a"),
    { emissive: new Color3(0.18, 0.07, 0.02) }
  );
  const bannerMat = makePixelMaterial(scene, "black-banner", new Color3(0.06, 0.05, 0.07), clothPainter("#16131b", "#0a080d", "#7a1020"));
  const boneMat = makePixelMaterial(scene, "bone-block", new Color3(0.78, 0.73, 0.63), noisePainter("#c9bf9f", ["#efe4c0", "#9f9477", "#71664e"]));
  const scytheHandleMat = makePixelMaterial(scene, "scythe-handle", new Color3(0.36, 0.22, 0.11), noisePainter("#5a3518", ["#76451f", "#3b220f", "#8a5728"]));
  const scytheSteelMat = makePixelMaterial(scene, "scythe-steel", new Color3(0.62, 0.65, 0.68), noisePainter("#9ca3a9", ["#cdd2d5", "#7c8389", "#565d63"]));
  const scytheEdgeMat = makePixelMaterial(
    scene,
    "scythe-edge",
    new Color3(0.9, 0.94, 0.96),
    noisePainter("#e5ebef", ["#ffffff", "#b6c0c8", "#8d98a2"]),
    { emissive: new Color3(0.16, 0.2, 0.22) }
  );
  const fogRibbonMat = new StandardMaterial("forest-fog-ribbon", scene);
  fogRibbonMat.diffuseColor = isForestLevel() ? new Color3(0.35, 0.62, 0.58) : isDesertLevel() ? new Color3(0.86, 0.64, 0.32) : new Color3(0.42, 0.46, 0.5);
  fogRibbonMat.emissiveColor = isForestLevel() ? new Color3(0.04, 0.11, 0.1) : isDesertLevel() ? new Color3(0.12, 0.07, 0.02) : new Color3(0.03, 0.04, 0.05);
  fogRibbonMat.alpha = isForestLevel() ? 0.48 : isDesertLevel() ? 0.34 : 0.22;

  const brideMat = makePixelMaterial(scene, "bride-white", new Color3(0.86, 0.86, 0.8), clothPainter("#dedbd1", "#b5b5ae", "#f8f3e2"), {
    emissive: new Color3(0.08, 0.08, 0.11)
  });
  const brideHairMat = makePixelMaterial(scene, "bride-hair", new Color3(0.08, 0.07, 0.08), noisePainter("#17151a", ["#2b2530", "#08070a"]));
  const zombieMat = makePixelMaterial(scene, "zombie-green", new Color3(0.28, 0.55, 0.3), noisePainter("#4c9947", ["#337236", "#74b060", "#1e4f25"]));
  const zombieClothMat = makePixelMaterial(scene, "zombie-cloth", new Color3(0.18, 0.32, 0.55), clothPainter("#255a8e", "#17385d", "#51a0c7"));
  const grannyMat = makePixelMaterial(scene, "granny-purple", new Color3(0.45, 0.3, 0.55), clothPainter("#704887", "#4c315f", "#b08ac8"));
  const skinMat = makePixelMaterial(scene, "pale-skin", new Color3(0.72, 0.62, 0.52), noisePainter("#b99678", ["#d2b291", "#8f6d56", "#caa68a"]));
  const grayHairMat = makePixelMaterial(scene, "gray-hair", new Color3(0.72, 0.72, 0.68), noisePainter("#b9b9b0", ["#e5e5d8", "#8d8d87", "#686862"]));
  const blackClothMat = makePixelMaterial(scene, "mourning-cloth", new Color3(0.04, 0.04, 0.05), clothPainter("#0d0d12", "#030306", "#2b2430"));
  const redMarkMat = makeMaterial(scene, "red-mark", new Color3(0.72, 0.02, 0.04), new Color3(0.42, 0, 0.02));
  const flowerMat = makeMaterial(scene, "dead-flower", new Color3(0.9, 0.04, 0.18), new Color3(0.22, 0, 0.04));
  const greenStemMat = makeMaterial(scene, "flower-stem", new Color3(0.16, 0.48, 0.16));
  const eyeMat = makeMaterial(scene, "red-eyes", new Color3(1, 0.1, 0.08), new Color3(0.8, 0.02, 0.02));
  const barkMat = makePixelMaterial(scene, "forest-bark", new Color3(0.3, 0.19, 0.1), noisePainter("#5a361d", ["#6d4527", "#3a2314", "#7b5630", "#25371f"], "#2b1b10"));
  const canopyMat = makePixelMaterial(scene, "forest-canopy", new Color3(0.12, 0.36, 0.17), noisePainter("#255a2b", ["#173d23", "#39753b", "#4c8035", "#15291e"]));

  function createHeldScytheModel(): Mesh {
    const root = new Mesh("held-scythe-root", scene);
    root.parent = camera;
    root.position = new Vector3(0.78, -0.6, 1.15);
    root.rotation = new Vector3(0.08, -0.34, -0.58);
    root.scaling = new Vector3(0.62, 0.62, 0.62);
    root.setEnabled(false);

    const parts: Mesh[] = [];
    const addWeaponBlock = (
      name: string,
      size: { width: number; height: number; depth: number },
      local: Vector3,
      material: StandardMaterial,
      rotationZ = 0
    ): void => {
      const block = addBlock(scene, name, size, local, material, root);
      block.rotation.z = rotationZ;
      block.isPickable = false;
      block.applyFog = false;
      block.renderingGroupId = 2;
      parts.push(block);
    };

    for (let index = 0; index < 8; index += 1) {
      addWeaponBlock(
        `held-scythe-handle-${index}`,
        { width: 0.07, height: 0.18, depth: 0.07 },
        new Vector3(-0.15 + index * 0.04, -0.34 + index * 0.09, 0),
        scytheHandleMat,
        -0.34
      );
    }

    addWeaponBlock("held-scythe-grip", { width: 0.15, height: 0.1, depth: 0.12 }, new Vector3(-0.17, -0.2, -0.02), skinMat, -0.22);
    addWeaponBlock("held-scythe-socket", { width: 0.16, height: 0.14, depth: 0.1 }, new Vector3(0.13, 0.28, 0), scytheSteelMat, -0.12);

    const blade = [
      [-0.02, 0.36, 0.12, 0.11, -0.08, scytheSteelMat],
      [0.08, 0.44, 0.12, 0.11, 0.1, scytheEdgeMat],
      [0.2, 0.48, 0.14, 0.1, 0.26, scytheEdgeMat],
      [0.32, 0.47, 0.14, 0.09, 0.48, scytheEdgeMat],
      [0.43, 0.4, 0.13, 0.085, 0.72, scytheEdgeMat],
      [0.51, 0.31, 0.11, 0.075, 0.92, scytheEdgeMat],
      [0.54, 0.21, 0.1, 0.065, 1.08, scytheSteelMat],
      [0.52, 0.13, 0.09, 0.06, 1.2, scytheSteelMat]
    ] as const;

    blade.forEach(([x, y, width, height, rotationZ, material], index) => {
      addWeaponBlock(`held-scythe-blade-${index}`, { width, height, depth: 0.075 }, new Vector3(x, y, 0), material, rotationZ);
    });

    return root;
  }

  function createHeldBowModel(): Mesh {
    const root = new Mesh("held-bow-root", scene);
    root.parent = camera;
    root.position = new Vector3(0.7, -0.46, 1.08);
    root.rotation = new Vector3(0.04, -0.18, -0.12);
    root.scaling = new Vector3(0.72, 0.72, 0.72);
    root.setEnabled(false);

    const addWeaponBlock = (
      name: string,
      size: { width: number; height: number; depth: number },
      local: Vector3,
      material: StandardMaterial,
      rotationZ = 0
    ): Mesh => {
      const block = addBlock(scene, name, size, local, material, root);
      block.rotation.z = rotationZ;
      block.isPickable = false;
      block.applyFog = false;
      block.renderingGroupId = 2;
      return block;
    };

    const bowCurve = [
      [-0.04, -0.46, -0.28],
      [-0.12, -0.3, -0.18],
      [-0.17, -0.12, -0.08],
      [-0.18, 0.08, 0.04],
      [-0.14, 0.28, 0.18],
      [-0.05, 0.46, 0.32]
    ] as const;

    bowCurve.forEach(([x, y, rotationZ], index) => {
      addWeaponBlock(`held-bow-arc-${index}`, { width: 0.1, height: 0.22, depth: 0.09 }, new Vector3(x, y, 0), scytheHandleMat, rotationZ);
    });
    addWeaponBlock("held-bow-grip", { width: 0.16, height: 0.22, depth: 0.12 }, new Vector3(-0.16, -0.02, -0.01), barkMat);
    addWeaponBlock("held-bow-hand", { width: 0.16, height: 0.12, depth: 0.14 }, new Vector3(-0.13, -0.2, -0.03), skinMat, -0.1);
    addWeaponBlock("held-bow-string-a", { width: 0.035, height: 0.98, depth: 0.035 }, new Vector3(0.08, 0, 0), scytheEdgeMat, -0.04);
    addWeaponBlock("held-arrow-shaft", { width: 0.06, height: 0.78, depth: 0.06 }, new Vector3(0.2, -0.02, -0.02), scytheSteelMat, Math.PI * 0.5);
    addWeaponBlock("held-arrow-head", { width: 0.12, height: 0.12, depth: 0.09 }, new Vector3(0.58, -0.02, -0.02), scytheEdgeMat, Math.PI * 0.5);
    addWeaponBlock("held-arrow-feather-a", { width: 0.12, height: 0.05, depth: 0.04 }, new Vector3(-0.18, 0.02, -0.02), redMarkMat, 0.4);
    addWeaponBlock("held-arrow-feather-b", { width: 0.12, height: 0.05, depth: 0.04 }, new Vector3(-0.18, -0.07, -0.02), redMarkMat, -0.4);

    return root;
  }

  const heldScytheModel = createHeldScytheModel();
  const heldBowModel = createHeldBowModel();

  const ground = CreateGround("ground", { width: currentMaze[0].length * TILE, height: currentMaze.length * TILE }, scene);
  ground.material = grassMat;

  const skybox = CreateBox("starry-night-sky", { size: 90 }, scene);
  skybox.material = skyMat;
  skybox.position.y = 18;
  skybox.infiniteDistance = true;

  const blockMoon = addBlock(scene, "block-moon", { width: 2.8, height: 2.8, depth: 0.28 }, new Vector3(-10, 12, 12), boneMat);
  blockMoon.rotation.y = -0.5;

  const mistBlocks: Mesh[] = [];
  const mistCount = isForestLevel() ? 48 : isDesertLevel() ? 30 : 14;
  for (let i = 0; i < mistCount; i += 1) {
    const cell = allOpenCells[(i * 11 + 7) % allOpenCells.length];
    const mist = addBlock(
      scene,
      "low-mist",
      { width: 1.45 + (i % 4) * 0.32, height: 0.035, depth: 0.32 + (i % 3) * 0.12 },
      worldFromCell(cell).add(new Vector3(0, 0.16 + (i % 3) * 0.07, 0)),
      fogRibbonMat
    );
    mist.rotation.y = (i % 5) * 0.22;
    mist.visibility = isForestLevel() ? 0.62 : isDesertLevel() ? 0.5 : 0.45;
    mistBlocks.push(mist);
  }

  type LivingTree = {
    root: Mesh;
    cell: Cell;
    target: Vector3;
    nextShiftAt: number;
  };
  type PressurePlate = {
    root: Mesh;
    cell: Cell;
    used: boolean;
    cooldownUntil: number;
  };
  type QuicksandTrap = {
    root: Mesh;
    cell: Cell;
  };
  type SpikeTrap = {
    root: Mesh;
    cell: Cell;
    phase: number;
    cooldownUntil: number;
  };
  const livingTrees: LivingTree[] = [];
  const pressurePlates: PressurePlate[] = [];
  const quicksandTraps: QuicksandTrap[] = [];
  const spikeTraps: SpikeTrap[] = [];
  const forestWallRoots = new Map<string, Mesh>();

  function chooseLivingTreeCell(used = new Set<string>()): Cell {
    const candidates = allOpenCells.filter((cell) => {
      const tile = currentMaze[cell.row][cell.col];
      const pos = worldFromCell(cell);
      return tile === "." && !used.has(cellKey(cell)) && Vector3.Distance(pos, start) > 4 && Vector3.Distance(pos, worldFromCell(findCell("E"))) > 3;
    });
    return candidates[Math.floor(Math.random() * candidates.length)] ?? allOpenCells[0];
  }

  function createLivingTree(cell: Cell, index: number): LivingTree {
    const root = new Mesh(`living-tree-${index}`, scene);
    root.position = worldFromCell(cell);
    addBlock(scene, "living-wall-core", { width: TILE * 0.92, height: 2.7, depth: TILE * 0.92 }, new Vector3(0, 1.35, 0), barkMat, root);
    addBlock(scene, "living-wall-moss", { width: TILE * 0.82, height: 0.46, depth: 0.07 }, new Vector3(0, 1.52, -TILE * 0.48), canopyMat, root);
    addBlock(scene, "living-wall-root-l", { width: 0.12, height: 2.16, depth: 0.1 }, new Vector3(-0.26, 1.05, -TILE * 0.52), darkStoneMat, root).rotation.z = 0.16;
    addBlock(scene, "living-wall-root-r", { width: 0.12, height: 1.9, depth: 0.1 }, new Vector3(0.28, 0.96, -TILE * 0.52), darkStoneMat, root).rotation.z = -0.14;
    addBlock(scene, "living-wall-canopy", { width: TILE, height: 0.36, depth: TILE }, new Vector3(0, 2.86, 0), canopyMat, root);
    addBlock(scene, "living-wall-eye-l", { width: 0.08, height: 0.08, depth: 0.045 }, new Vector3(-0.16, 1.58, -TILE * 0.55), eyeMat, root);
    addBlock(scene, "living-wall-eye-r", { width: 0.08, height: 0.08, depth: 0.045 }, new Vector3(0.16, 1.58, -TILE * 0.55), eyeMat, root);
    return {
      root,
      cell,
      target: worldFromCell(cell),
      nextShiftAt: Number.POSITIVE_INFINITY
    };
  }

  function choosePressurePlateCells(): Cell[] {
    const connectsPassages = (wall: Cell): boolean => {
      if (currentMaze[wall.row]?.[wall.col] !== "#") return false;
      const open = (cell: Cell) => currentMaze[cell.row]?.[cell.col] !== undefined && currentMaze[cell.row][cell.col] !== "#";
      return (open({ row: wall.row - 1, col: wall.col }) && open({ row: wall.row + 1, col: wall.col }))
        || (open({ row: wall.row, col: wall.col - 1 }) && open({ row: wall.row, col: wall.col + 1 }));
    };
    const candidates = allOpenCells.filter((cell) => {
      const tile = currentMaze[cell.row][cell.col];
      const pos = worldFromCell(cell);
      const nearOpenableWall = [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 }
      ].some(connectsPassages);
      return tile === "." && nearOpenableWall && Vector3.Distance(pos, start) > 5 && Vector3.Distance(pos, worldFromCell(findCell("E"))) > 4;
    });
    return candidates.filter((_, index) => index % Math.max(1, Math.floor(candidates.length / 9)) === 2).slice(0, 6);
  }

  function createPressurePlate(cell: Cell, index: number): PressurePlate {
    const root = new Mesh(`forest-pressure-plate-${index}`, scene);
    root.position = worldFromCell(cell).add(new Vector3(0, 0.045, 0));
    addBlock(scene, "pressure-plate-base", { width: 0.66, height: 0.05, depth: 0.66 }, new Vector3(0, 0, 0), darkStoneMat, root);
    addBlock(scene, "pressure-plate-rune-a", { width: 0.46, height: 0.025, depth: 0.08 }, new Vector3(0, 0.04, 0), redMarkMat, root);
    addBlock(scene, "pressure-plate-rune-b", { width: 0.08, height: 0.025, depth: 0.46 }, new Vector3(0, 0.045, 0), crystalMat, root);
    return { root, cell, used: false, cooldownUntil: 0 };
  }

  function createQuicksandTrap(cell: Cell, index: number): QuicksandTrap {
    const root = new Mesh(`quicksand-trap-${index}`, scene);
    root.position = worldFromCell(cell).add(new Vector3(0, 0.032, 0));
    addBlock(scene, "quicksand-pool", { width: TILE * 0.82, height: 0.035, depth: TILE * 0.82 }, new Vector3(0, 0, 0), quicksandMat, root);
    addBlock(scene, "quicksand-swirl-a", { width: TILE * 0.52, height: 0.02, depth: 0.08 }, new Vector3(0, 0.032, 0), dirtMat, root).rotation.y = 0.42;
    addBlock(scene, "quicksand-swirl-b", { width: TILE * 0.34, height: 0.02, depth: 0.07 }, new Vector3(0, 0.04, 0), dirtMat, root).rotation.y = -0.48;
    return { root, cell };
  }

  function createSpikeTrap(cell: Cell, index: number): SpikeTrap {
    const root = new Mesh(`spike-trap-${index}`, scene);
    root.position = worldFromCell(cell).add(new Vector3(0, 0.04, 0));
    addBlock(scene, "spike-base", { width: TILE * 0.72, height: 0.04, depth: TILE * 0.72 }, new Vector3(0, 0, 0), darkStoneMat, root);
    [-0.22, 0, 0.22].forEach((x) => {
      [-0.18, 0.18].forEach((z) => {
        addBlock(scene, "spike-tooth", { width: 0.1, height: 0.36, depth: 0.1 }, new Vector3(x, 0.12, z), spikeMat, root);
      });
    });
    return { root, cell, phase: index * 0.75, cooldownUntil: 0 };
  }

  if (isForestLevel() || isDesertLevel()) {
    choosePressurePlateCells().forEach((cell, index) => pressurePlates.push(createPressurePlate(cell, index)));
  }

  if (isDesertLevel()) {
    allOpenCells.forEach((cell, index) => {
      const tile = currentMaze[cell.row][cell.col];
      const pos = worldFromCell(cell);
      if (tile !== "." || Vector3.Distance(pos, start) < 4 || Vector3.Distance(pos, worldFromCell(findCell("E"))) < 3) return;
      if (index % 17 === 6 && quicksandTraps.length < 9) quicksandTraps.push(createQuicksandTrap(cell, quicksandTraps.length));
      else if (index % 19 === 9 && spikeTraps.length < 8) spikeTraps.push(createSpikeTrap(cell, spikeTraps.length));
    });
  }

  for (let row = 0; row < currentMaze.length; row += 1) {
    for (let col = 0; col < currentMaze[row].length; col += 1) {
      const tile = currentMaze[row][col];
      const pos = worldFromCell({ row, col });

      if (tile === "#") {
        if (isForestLevel()) {
          const root = new Mesh("forest-wall-root", scene);
          root.position = pos.clone();
          forestWallRoots.set(cellKey({ row, col }), root);
          const wall = addBlock(
            scene,
            "forest-wall-block",
            { width: TILE, height: 2.95, depth: TILE },
            new Vector3(0, 1.47, 0),
            stoneMat,
            root
          );
          addBlock(scene, "forest-wall-moss-face", { width: TILE * 0.94, height: 0.52, depth: 0.055 }, new Vector3(0, 0.48, -TILE * 0.505), canopyMat, wall);
          addBlock(scene, "forest-wall-root-a", { width: 0.1, height: 1.86, depth: 0.09 }, new Vector3(-0.32, 0.02, -TILE * 0.54), barkMat, wall).rotation.z = 0.08;
          addBlock(scene, "forest-wall-root-b", { width: 0.1, height: 1.36, depth: 0.09 }, new Vector3(0.3, -0.18, -TILE * 0.54), barkMat, wall).rotation.z = -0.12;
          addBlock(scene, "forest-wall-cap", { width: TILE * 1.04, height: 0.34, depth: TILE * 1.04 }, new Vector3(0, 1.64, 0), canopyMat, wall);
          if ((row + col) % 3 === 0) {
            addBlock(scene, "forest-wall-stone-chip", { width: 0.28, height: 0.18, depth: 0.06 }, new Vector3(0.22, 0.2, -TILE * 0.55), darkStoneMat, wall);
          }
        } else if (isDesertLevel()) {
          const root = new Mesh("desert-wall-root", scene);
          root.position = pos.clone();
          forestWallRoots.set(cellKey({ row, col }), root);
          const wall = addBlock(
            scene,
            "sunstone-wall-block",
            { width: TILE, height: 2.65, depth: TILE },
            new Vector3(0, 1.32, 0),
            stoneMat,
            root
          );
          addBlock(scene, "sunstone-band-low", { width: TILE * 0.96, height: 0.1, depth: TILE * 0.96 }, new Vector3(0, -0.48, 0), darkStoneMat, wall);
          addBlock(scene, "sunstone-band-high", { width: TILE * 0.96, height: 0.1, depth: TILE * 0.96 }, new Vector3(0, 0.48, 0), darkStoneMat, wall);
          addBlock(scene, "sunstone-glyph", { width: 0.34, height: 0.34, depth: 0.055 }, new Vector3(0, 0.18, -TILE * 0.52), sunRuneMat, wall);
          if ((row + col) % 4 === 0) {
            addBlock(scene, "sunstone-broken-cap", { width: TILE * 0.7, height: 0.22, depth: TILE * 0.68 }, new Vector3(0.08, 1.46, -0.05), stoneMat, wall);
          }
        } else {
          const wall = addBlock(
            scene,
            "stone-block",
            { width: TILE, height: 2.72, depth: TILE },
            pos.add(new Vector3(0, 1.36, 0)),
            stoneMat
          );

          if ((row + col) % 2 === 0) {
            addBlock(scene, "brick-band", { width: TILE * 0.92, height: 0.08, depth: TILE * 0.92 }, new Vector3(0, -0.48, 0), darkStoneMat, wall);
            addBlock(scene, "brick-band", { width: TILE * 0.92, height: 0.08, depth: TILE * 0.92 }, new Vector3(0, 0.42, 0), darkStoneMat, wall);
          }
        }
      } else if ((row + col) % 4 === 0) {
        addBlock(scene, "floor-patch", { width: TILE * 0.45, height: 0.025, depth: TILE * 0.45 }, pos.add(new Vector3(0, 0.02, 0)), dirtMat);
      }

      if (tile !== "#") {
        if ((row * 5 + col * 3) % 11 === 0) {
          addBlock(scene, "moss-clump", { width: 0.38, height: 0.04, depth: 0.32 }, pos.add(new Vector3(-0.24, 0.045, 0.18)), leafMat);
          addBlock(scene, "moss-clump", { width: 0.22, height: 0.05, depth: 0.2 }, pos.add(new Vector3(0.12, 0.055, -0.16)), leafMat);
        }
        if ((row * 7 + col) % 19 === 0) {
          const stem = addBlock(scene, "mushroom-stem", { width: 0.08, height: 0.16, depth: 0.08 }, pos.add(new Vector3(0.28, 0.1, 0.24)), skinMat);
          addBlock(scene, "mushroom-cap", { width: 0.2, height: 0.1, depth: 0.2 }, stem.position.add(new Vector3(0, 0.13, 0)), mushroomMat);
        }
        if (isForestLevel() && (row * 11 + col * 7) % 23 === 0) {
          const trunk = addBlock(scene, "forest-trunk", { width: 0.22, height: 1.55, depth: 0.22 }, pos.add(new Vector3(-0.34, 0.78, 0.32)), barkMat);
          addBlock(scene, "forest-canopy-low", { width: 0.82, height: 0.32, depth: 0.78 }, trunk.position.add(new Vector3(0, 0.98, 0)), canopyMat);
          addBlock(scene, "forest-canopy-high", { width: 0.58, height: 0.26, depth: 0.55 }, trunk.position.add(new Vector3(0.08, 1.22, -0.04)), canopyMat);
        }
        if (isForestLevel() && (row * 17 + col * 13) % 29 === 0) {
          addBlock(scene, "hanging-vine", { width: 0.06, height: 0.92, depth: 0.06 }, pos.add(new Vector3(0.42, 1.55, -0.34)), leafMat);
          const spore = addBlock(scene, "forest-spore", { width: 0.08, height: 0.08, depth: 0.08 }, pos.add(new Vector3(-0.18, 0.72, -0.28)), crystalMat);
          spore.metadata = { pulse: true };
        }
        if (isDesertLevel() && (row * 11 + col * 5) % 19 === 0) {
          const jar = addBlock(scene, "desert-jar", { width: 0.28, height: 0.38, depth: 0.28 }, pos.add(new Vector3(-0.32, 0.22, 0.28)), dirtMat);
          addBlock(scene, "desert-jar-neck", { width: 0.16, height: 0.12, depth: 0.16 }, jar.position.add(new Vector3(0, 0.24, 0)), dirtMat);
        }
        if (isDesertLevel() && (row * 7 + col * 13) % 31 === 0) {
          addBlock(scene, "sandstone-obelisk", { width: 0.24, height: 1.45, depth: 0.24 }, pos.add(new Vector3(0.36, 0.74, -0.3)), stoneMat);
          addBlock(scene, "obelisk-glow", { width: 0.16, height: 0.16, depth: 0.045 }, pos.add(new Vector3(0.36, 1.08, -0.43)), sunRuneMat);
        }
        if (isDesertLevel() && (row * 17 + col * 3) % 37 === 0) {
          const pole = addBlock(scene, "desert-banner-pole", { width: 0.07, height: 1.1, depth: 0.07 }, pos.add(new Vector3(-0.36, 0.58, -0.34)), darkStoneMat);
          addBlock(scene, "desert-torn-cloth", { width: 0.42, height: 0.58, depth: 0.045 }, pole.position.add(new Vector3(0.22, 0.06, 0)), bannerMat);
        }
        if ((row + col * 9) % 17 === 0) {
          addBlock(scene, "loose-stone", { width: 0.18, height: 0.1, depth: 0.16 }, pos.add(new Vector3(-0.32, 0.07, -0.28)), darkStoneMat);
        }
        if ((row * 13 + col * 5) % 31 === 0) {
          addBlock(scene, "bone-pile-a", { width: 0.34, height: 0.08, depth: 0.1 }, pos.add(new Vector3(0.2, 0.08, -0.28)), boneMat);
          addBlock(scene, "bone-pile-b", { width: 0.1, height: 0.08, depth: 0.34 }, pos.add(new Vector3(0.16, 0.1, -0.24)), boneMat);
        }
        if ((row * 3 + col * 17) % 37 === 0) {
          const pole = addBlock(scene, "banner-pole", { width: 0.08, height: 1.2, depth: 0.08 }, pos.add(new Vector3(-0.36, 0.62, 0.34)), darkStoneMat);
          addBlock(scene, "torn-banner", { width: 0.46, height: 0.72, depth: 0.05 }, pole.position.add(new Vector3(0.24, 0.12, 0)), bannerMat);
        }
      }

      if (tile === "." && row % 4 === 1 && col % 6 === 3) {
        const torch = addBlock(scene, "torch", { width: 0.18, height: 0.58, depth: 0.18 }, pos.add(new Vector3(0, 0.34, 0)), torchMat);
        torch.rotation.y = Math.PI * 0.25;

        const light = new PointLight("torch-light", pos.add(new Vector3(0, 1.15, 0)), scene);
        light.diffuse = new Color3(1, 0.55, 0.22);
        light.intensity = 0.95;
        light.range = 4.1;
      }
    }
  }

  const crystals: Mesh[] = [];
  allOpenCells.forEach((cell, index) => {
    const tile = currentMaze[cell.row][cell.col];
    if (tile !== "." || index % 7 !== 2) return;
    const pos = worldFromCell(cell);
    if (Vector3.Distance(pos, start) < 2.8) return;

    const crystal = CreateCylinder("orange-crystal", { height: 0.42, diameterTop: 0.12, diameterBottom: 0.34, tessellation: 4 }, scene);
    crystal.position = pos.add(new Vector3(0, 0.36, 0));
    crystal.rotation.x = Math.PI * 0.08;
    crystal.rotation.z = Math.PI * 0.25;
    crystal.material = crystalMat;
    crystals.push(crystal);

    if (crystals.length % 3 === 0) {
      const crystalLight = new PointLight("crystal-light", crystal.position.add(new Vector3(0, 0.25, 0)), scene);
      crystalLight.diffuse = new Color3(1, 0.45, 0.08);
      crystalLight.intensity = 0.35;
      crystalLight.range = 2.4;
    }
  });

  const ginsengs: Mesh[] = [];
  function createGinseng(position: Vector3): Mesh {
    const root = new Mesh("ginseng-pickup", scene);
    root.position = position.add(new Vector3(0, 0.12, 0));

    addBlock(scene, "ginseng-body", { width: 0.16, height: 0.42, depth: 0.12 }, new Vector3(0, 0.22, 0), ginsengMat, root);
    addBlock(scene, "ginseng-leg-l", { width: 0.06, height: 0.2, depth: 0.06 }, new Vector3(-0.07, 0.02, 0), ginsengMat, root).rotation.z = -0.25;
    addBlock(scene, "ginseng-leg-r", { width: 0.06, height: 0.2, depth: 0.06 }, new Vector3(0.07, 0.02, 0), ginsengMat, root).rotation.z = 0.25;
    addBlock(scene, "ginseng-arm-l", { width: 0.05, height: 0.18, depth: 0.05 }, new Vector3(-0.12, 0.22, 0), ginsengMat, root).rotation.z = 0.65;
    addBlock(scene, "ginseng-arm-r", { width: 0.05, height: 0.18, depth: 0.05 }, new Vector3(0.12, 0.22, 0), ginsengMat, root).rotation.z = -0.65;
    addBlock(scene, "ginseng-leaf-l", { width: 0.18, height: 0.05, depth: 0.12 }, new Vector3(-0.08, 0.48, 0), ginsengLeafMat, root).rotation.z = 0.35;
    addBlock(scene, "ginseng-leaf-r", { width: 0.18, height: 0.05, depth: 0.12 }, new Vector3(0.08, 0.5, 0), ginsengLeafMat, root).rotation.z = -0.35;
    return root;
  }

  allOpenCells.forEach((cell, index) => {
    const tile = currentMaze[cell.row][cell.col];
    if (tile !== "." || index % 29 !== 11 || ginsengs.length >= 3) return;
    const pos = worldFromCell(cell);
    if (Vector3.Distance(pos, start) < 3.5) return;
    ginsengs.push(createGinseng(pos));
  });

  const forestWisps: Mesh[] = [];
  if (isForestLevel()) {
    allOpenCells.forEach((cell, index) => {
      const tile = currentMaze[cell.row][cell.col];
      if (tile !== "." || index % 23 !== 5 || forestWisps.length >= 10) return;
      const pos = worldFromCell(cell);
      if (Vector3.Distance(pos, start) < 4) return;
      const wisp = addBlock(scene, "forest-wisp", { width: 0.12, height: 0.12, depth: 0.12 }, pos.add(new Vector3(0, 0.86, 0)), keyMat);
      const light = new PointLight("forest-wisp-light", wisp.position.add(new Vector3(0, 0.1, 0)), scene);
      light.diffuse = new Color3(0.28, 0.85, 0.7);
      light.intensity = 0.32;
      light.range = 2.7;
      wisp.metadata = { light, phase: index * 0.47 };
      forestWisps.push(wisp);
    });
  }

  const altarPosition = worldFromCell({ row: 5, col: 5 });
  const altar = addBlock(scene, "crystal-altar", { width: 0.95, height: 0.42, depth: 0.95 }, altarPosition.add(new Vector3(0, 0.24, 0)), altarMat);
  addBlock(scene, "altar-core", { width: 0.38, height: 0.72, depth: 0.38 }, altarPosition.add(new Vector3(0, 0.82, 0)), crystalMat);
  const altarLight = new PointLight("altar-light", altarPosition.add(new Vector3(0, 1.2, 0)), scene);
  altarLight.diffuse = new Color3(1, 0.35, 0.08);
  altarLight.intensity = 0.8;
  altarLight.range = 4.8;

  const playerLight = new PointLight("lantern", player.position.clone(), scene);
  playerLight.diffuse = new Color3(1, 0.72, 0.38);
  playerLight.intensity = isForestLevel() ? 0.95 : isDesertLevel() ? 1.08 : 1.22;
  playerLight.range = isForestLevel() ? 4.1 : isDesertLevel() ? 5.0 : 4.7;

  const keys: Mesh[] = [];
  currentMaze.forEach((line, row) => {
    [...line].forEach((tile, col) => {
      if (tile !== "K") return;
      const pos = worldFromCell({ row, col });
      const key = CreateCylinder("blue-rune", { height: 0.12, diameter: 0.55, tessellation: 4 }, scene);
      key.position = pos.add(new Vector3(0, 1.0, 0));
      key.rotation.x = Math.PI * 0.5;
      key.material = isDesertLevel() ? sunRuneMat : keyMat;
      keys.push(key);

      const light = new PointLight("rune-light", key.position, scene);
      light.diffuse = isDesertLevel() ? new Color3(1, 0.55, 0.08) : new Color3(0.15, 0.65, 1);
      light.intensity = isDesertLevel() ? 1.16 : 1.0;
      light.range = 4.5;
    });
  });

  function createExitGate(position: Vector3): Mesh {
    const root = new Mesh("skull-exit-gate", scene);
    root.position = position;

    const addGateBlock = (
      name: string,
      size: { width: number; height: number; depth: number },
      local: Vector3,
      material: StandardMaterial,
      rotation = new Vector3(0, 0, 0)
    ): Mesh => {
      const block = addBlock(scene, name, size, local, material, root);
      block.rotation = rotation;
      return block;
    };

    addGateBlock("gate-stone-base", { width: 2.7, height: 0.22, depth: 0.48 }, new Vector3(0, 0.12, 0), darkStoneMat);
    addGateBlock("gate-left-pillar", { width: 0.46, height: 2.55, depth: 0.5 }, new Vector3(-1.05, 1.35, 0), stoneMat);
    addGateBlock("gate-right-pillar", { width: 0.46, height: 2.55, depth: 0.5 }, new Vector3(1.05, 1.35, 0), stoneMat);
    addGateBlock("gate-left-cap", { width: 0.72, height: 0.42, depth: 0.58 }, new Vector3(-1.05, 2.84, 0), stoneMat);
    addGateBlock("gate-right-cap", { width: 0.72, height: 0.42, depth: 0.58 }, new Vector3(1.05, 2.84, 0), stoneMat);
    addGateBlock("gate-top-arch", { width: 1.72, height: 0.42, depth: 0.5 }, new Vector3(0, 2.55, 0), stoneMat);
    addGateBlock("gate-top-step-a", { width: 0.46, height: 0.42, depth: 0.5 }, new Vector3(-0.44, 2.88, 0), stoneMat);
    addGateBlock("gate-top-step-b", { width: 0.46, height: 0.42, depth: 0.5 }, new Vector3(0.44, 2.88, 0), stoneMat);

    addGateBlock("gate-door-back", { width: 1.36, height: 1.65, depth: 0.16 }, new Vector3(0, 1.0, -0.03), scytheHandleMat);
    for (let i = 0; i < 5; i += 1) {
      addGateBlock("gate-door-bar", { width: 0.08, height: 1.72, depth: 0.22 }, new Vector3(-0.52 + i * 0.26, 1.0, -0.16), darkStoneMat);
    }
    for (let i = 0; i < 3; i += 1) {
      addGateBlock("gate-door-crossbar", { width: 1.44, height: 0.08, depth: 0.24 }, new Vector3(0, 0.42 + i * 0.58, -0.18), darkStoneMat);
    }

    addGateBlock("gate-skull-head", { width: 0.72, height: 0.58, depth: 0.2 }, new Vector3(0, 2.08, -0.22), boneMat);
    addGateBlock("gate-skull-jaw", { width: 0.42, height: 0.28, depth: 0.18 }, new Vector3(0, 1.72, -0.23), boneMat);
    addGateBlock("gate-skull-eye-l", { width: 0.18, height: 0.18, depth: 0.04 }, new Vector3(-0.18, 2.1, -0.34), blackClothMat);
    addGateBlock("gate-skull-eye-r", { width: 0.18, height: 0.18, depth: 0.04 }, new Vector3(0.18, 2.1, -0.34), blackClothMat);
    addGateBlock("gate-skull-nose", { width: 0.12, height: 0.18, depth: 0.04 }, new Vector3(0, 1.94, -0.34), blackClothMat);
    for (let i = 0; i < 3; i += 1) {
      addGateBlock("gate-skull-tooth", { width: 0.08, height: 0.18, depth: 0.06 }, new Vector3(-0.1 + i * 0.1, 1.58, -0.32), boneMat);
    }

    [-1.42, 1.42].forEach((x, side) => {
      addGateBlock("gate-banner-pole", { width: 0.08, height: 1.32, depth: 0.08 }, new Vector3(x, 1.42, -0.02), darkStoneMat);
      addGateBlock("gate-banner", { width: 0.38, height: 0.92, depth: 0.04 }, new Vector3(x + (side === 0 ? -0.16 : 0.16), 1.34, -0.08), bannerMat);
      const torch = addGateBlock("gate-torch", { width: 0.16, height: 0.5, depth: 0.16 }, new Vector3(x * 0.72, 1.2, -0.38), torchMat, new Vector3(0, 0, side === 0 ? -0.18 : 0.18));
      const flame = addGateBlock("gate-flame", { width: 0.22, height: 0.26, depth: 0.22 }, torch.position.add(new Vector3(0, 0.36, -0.02)), exitMat);
      const light = new PointLight("gate-torch-light", position.add(flame.position).add(new Vector3(0, 0.1, 0)), scene);
      light.diffuse = new Color3(1, 0.5, 0.16);
      light.intensity = 0.78;
      light.range = 4.6;
    });

    [-0.72, 0.72].forEach((x) => {
      addGateBlock("gate-crystal-plinth", { width: 0.34, height: 0.22, depth: 0.34 }, new Vector3(x, 0.22, -0.36), darkStoneMat);
      addGateBlock("gate-crystal-cluster-a", { width: 0.12, height: 0.42, depth: 0.12 }, new Vector3(x, 0.58, -0.36), crystalMat, new Vector3(0.2, 0, 0.2));
      addGateBlock("gate-crystal-cluster-b", { width: 0.1, height: 0.3, depth: 0.1 }, new Vector3(x - 0.15, 0.5, -0.34), crystalMat, new Vector3(-0.2, 0, -0.28));
      addGateBlock("gate-crystal-cluster-c", { width: 0.1, height: 0.34, depth: 0.1 }, new Vector3(x + 0.15, 0.52, -0.34), crystalMat, new Vector3(0.18, 0, 0.28));
    });

    addGateBlock("gate-moss-vine-l", { width: 0.08, height: 1.24, depth: 0.07 }, new Vector3(-0.8, 1.88, -0.3), leafMat, new Vector3(0, 0, -0.15));
    addGateBlock("gate-moss-vine-r", { width: 0.08, height: 1.0, depth: 0.07 }, new Vector3(0.82, 1.76, -0.3), leafMat, new Vector3(0, 0, 0.15));

    return root;
  }

  const exit = createExitGate(worldFromCell(findCell("E")));

  const enemies: Enemy[] = [];
  const npcMaterials: NpcMaterials = {
    skin: skinMat,
    bride: brideMat,
    brideHair: brideHairMat,
    zombie: zombieMat,
    zombieCloth: zombieClothMat,
    granny: grannyMat,
    grayHair: grayHairMat,
    blackCloth: blackClothMat,
    darkStone: darkStoneMat,
    bone: boneMat,
    steel: scytheSteelMat,
    redMark: redMarkMat,
    flower: flowerMat,
    greenStem: greenStemMat,
    eye: eyeMat,
    bark: barkMat,
    leaf: canopyMat
  };
  let enemyPressureBonus = 0;

  function levelEnemyMax(): number {
    if (isForestLevel()) return GAME_BALANCE.enemies.maxAlive + 7 + enemyPressureBonus;
    if (isDesertLevel()) return GAME_BALANCE.enemies.maxAlive + 6;
    return GAME_BALANCE.enemies.maxAlive;
  }

  function pickSpawnCell(): Cell {
    const candidates = allOpenCells.filter((cell) => Vector3.Distance(worldFromCell(cell), player.position) > GAME_BALANCE.enemies.minSpawnDistance);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? findCell("E");
  }

  function spawnNpc(kind?: NpcKind): void {
    if (enemies.length >= levelEnemyMax()) return;
    const kinds = isForestLevel()
      ? [...GAME_BALANCE.enemies.initialKinds, "蝙蝠群", "蝙蝠群", "森林守卫"] as readonly NpcKind[]
      : isDesertLevel()
        ? ["骷髅兵", "骷髅兵", "毒蝎", "毒蝎", "老婆婆"] as readonly NpcKind[]
        : GAME_BALANCE.enemies.initialKinds as readonly NpcKind[];
    const chosen = kind ?? kinds[Math.floor(Math.random() * kinds.length)];
    enemies.push(createNpc(scene, chosen, worldFromCell(pickSpawnCell()).add(new Vector3(0, 0.02, 0)), npcMaterials));
  }

  if (isDesertLevel()) {
    spawnNpc("骷髅兵");
    spawnNpc("骷髅兵");
    spawnNpc("毒蝎");
    spawnNpc("毒蝎");
    spawnNpc("骷髅兵");
  } else {
    GAME_BALANCE.enemies.initialKinds.forEach((kind) => spawnNpc(kind));
  }
  if (isForestLevel()) {
    spawnNpc("僵尸");
    spawnNpc("鬼新娘");
    spawnNpc("老婆婆");
    spawnNpc("蝙蝠群");
    spawnNpc("蝙蝠群");
    spawnNpc("森林守卫");
  }

  const hud = makeHud(currentLevelIndex);
  const startScreen = hud.querySelector<HTMLDivElement>("#start-screen");
  const gameUi = hud.querySelector<HTMLDivElement>("#game-ui");
  const startButton = hud.querySelector<HTMLButtonElement>("#start-button");
  const levelSelectButton = hud.querySelector<HTMLButtonElement>("#level-select-button");
  const levelMenu = hud.querySelector<HTMLDivElement>("#level-menu");
  const levelOptionButtons = [...hud.querySelectorAll<HTMLButtonElement>(".level-option")];
  const shopOverlay = hud.querySelector<HTMLDivElement>("#shop-overlay");
  const pauseOverlay = hud.querySelector<HTMLDivElement>("#pause-overlay");
  const shopCrystals = hud.querySelector<HTMLElement>("#shop-crystals");
  const buyShieldButton = hud.querySelector<HTMLButtonElement>("#buy-shield");
  const buyScytheButton = hud.querySelector<HTMLButtonElement>("#buy-scythe");
  const buyScytheLabel = buyScytheButton?.querySelector<HTMLElement>("em");
  const buyBowButton = hud.querySelector<HTMLButtonElement>("#buy-bow");
  const buyBowLabel = buyBowButton?.querySelector<HTMLElement>("em");
  const closeShopButton = hud.querySelector<HTMLButtonElement>("#close-shop");
  const resumeButton = hud.querySelector<HTMLButtonElement>("#resume-button");
  const restartButton = hud.querySelector<HTMLButtonElement>("#restart-button");
  const homeButton = hud.querySelector<HTMLButtonElement>("#home-button");
  const heldItem = hud.querySelector<HTMLDivElement>("#held-item");
  const heldItemImage = hud.querySelector<HTMLImageElement>("#held-item-image");
  const slashEffect = hud.querySelector<HTMLDivElement>("#slash-effect");
  const combatToast = hud.querySelector<HTMLDivElement>("#combat-toast");
  const keysReadout = hud.querySelector<HTMLElement>("#keys-readout");
  const heartsReadout = hud.querySelector<HTMLElement>("#hearts-readout");
  const crystalsReadout = hud.querySelector<HTMLElement>("#crystals-readout");
  const itemsReadout = hud.querySelector<HTMLElement>("#items-readout");
  const statusReadout = hud.querySelector<HTMLElement>("#status-readout");
  const threatReadout = hud.querySelector<HTMLElement>("#threat-readout");
  const exitGuide = hud.querySelector<HTMLDivElement>("#exit-guide");
  const exitGuideText = hud.querySelector<HTMLElement>("#exit-guide-text");
  const message = hud.querySelector<HTMLDivElement>("#game-message");
  const damageFlash = hud.querySelector<HTMLDivElement>("#damage-flash");

  let collected = 0;
  let crystalCount = 0;
  let hasScythe = false;
  let hasBow = false;
  let shields = 0;
  let lives: number = GAME_BALANCE.player.lives;
  let invulnerable = 0;
  let finished = false;
  let gameStarted = false;
  let shopOpen = false;
  let paused = false;
  let elapsed = 0;
  let spawnTimer: number = isForestLevel() ? 8 : isDesertLevel() ? 10 : GAME_BALANCE.enemies.initialSpawnSeconds;
  let attackCooldown = 0;
  let selectedWeapon: "scythe" | "bow" | null = null;
  let heldOverride: "shield" | "scythe" | "bow" | null = null;
  let heldOverrideUntil = 0;
  let combatToastTimer = 0;
  let slashEffectTimer = 0;
  let scytheSwingUntil = 0;
  let bowDrawUntil = 0;
  let safeUntil = 0;

  function showMessage(text: string, win = false): void {
    if (!message) return;
    message.textContent = text;
    message.className = `game-message ${win ? "win" : "lose"}`;
  }

  function showCombatToast(text: string, tone: "good" | "warn" | "danger" = "good"): void {
    if (!combatToast) return;
    window.clearTimeout(combatToastTimer);
    combatToast.textContent = text;
    combatToast.className = `combat-toast ${tone}`;
    void combatToast.offsetWidth;
    combatToast.classList.add("pop");
    combatToastTimer = window.setTimeout(() => combatToast.classList.add("hidden"), 720);
  }

  function directionToExit(): string {
    const toExit = exit.position.subtract(player.position);
    const exitAngle = Math.atan2(toExit.x, toExit.z);
    const angle = Math.atan2(Math.sin(exitAngle - yaw), Math.cos(exitAngle - yaw));
    const abs = Math.abs(angle);
    if (abs < 0.38) return "向前";
    if (abs < 1.18) return angle > 0 ? "右前方" : "左前方";
    if (abs < 2.15) return angle > 0 ? "右侧" : "左侧";
    return "身后";
  }

  function updateExitGuide(): void {
    const opened = gameStarted && !finished && collected === keys.length;
    exitGuide?.classList.toggle("hidden", !opened);
    if (!opened || !exitGuideText) return;
    const distance = Math.max(0, Math.round(Vector3.Distance(player.position, exit.position)));
    exitGuideText.textContent = `${directionToExit()}，约 ${distance} 格`;
  }

  function shiftLivingTree(tree: LivingTree, announce = true): void {
    dynamicBlockedCells.delete(cellKey(tree.cell));
    const used = new Set(livingTrees.filter((item) => item !== tree).map((item) => cellKey(item.cell)));
    const candidates = allOpenCells.filter((cell) => {
      const tile = currentMaze[cell.row][cell.col];
      const pos = worldFromCell(cell);
      return (
        tile === "." &&
        !used.has(cellKey(cell)) &&
        Vector3.Distance(pos, player.position) > 3.2 &&
        Vector3.Distance(pos, start) > 4 &&
        Vector3.Distance(pos, exit.position) > 3
      );
    });
    const nextCell = candidates[Math.floor(Math.random() * candidates.length)] ?? tree.cell;
    tree.cell = nextCell;
    tree.target = worldFromCell(nextCell);
    dynamicBlockedCells.add(cellKey(nextCell));
    tree.nextShiftAt = Number.POSITIVE_INFINITY;
    if (announce) showCombatToast("森林在移动", "warn");
  }

  function isOpenForMechanism(cell: Cell): boolean {
    if (cell.row < 0 || cell.col < 0 || cell.row >= currentMaze.length || cell.col >= currentMaze[cell.row].length) return false;
    const key = cellKey(cell);
    return dynamicOpenCells.has(key) || (currentMaze[cell.row][cell.col] !== "#" && !dynamicBlockedCells.has(key));
  }

  function wallConnectsPassages(cell: Cell): boolean {
    if (currentMaze[cell.row]?.[cell.col] !== "#" || dynamicOpenCells.has(cellKey(cell))) return false;
    const north = isOpenForMechanism({ row: cell.row - 1, col: cell.col });
    const south = isOpenForMechanism({ row: cell.row + 1, col: cell.col });
    const west = isOpenForMechanism({ row: cell.row, col: cell.col - 1 });
    const east = isOpenForMechanism({ row: cell.row, col: cell.col + 1 });
    return (north && south) || (west && east);
  }

  function findWallToOpenNear(cell: Cell): Cell | null {
    const candidates: Array<{ cell: Cell; score: number }> = [];
    currentMaze.forEach((line, row) => {
      [...line].forEach((tile, col) => {
        if (tile !== "#") return;
        const candidate = { row, col };
        if (!wallConnectsPassages(candidate)) return;
        const distance = Math.abs(row - cell.row) + Math.abs(col - cell.col);
        candidates.push({ cell: candidate, score: distance + Math.random() * 0.6 });
      });
    });
    return candidates
      .filter((candidate) => candidate.score <= 4.6)
      .sort((a, b) => a.score - b.score)[0]?.cell
      ?? candidates.sort((a, b) => a.score - b.score)[0]?.cell
      ?? null;
  }

  function triggerPressurePlate(plate: PressurePlate): void {
    if (plate.used || elapsed < plate.cooldownUntil) return;
    const openedCell = findWallToOpenNear(plate.cell);
    if (!openedCell) {
      plate.used = true;
      plate.cooldownUntil = elapsed + 3;
      plate.root.scaling.set(0.94, 0.5, 0.94);
      plate.root.setEnabled(false);
      showCombatToast("机关沉默", "warn");
      return;
    }
    plate.used = true;
    plate.cooldownUntil = elapsed + 7.5;
    plate.root.scaling.set(0.94, 0.5, 0.94);
    plate.root.setEnabled(false);
    const key = cellKey(openedCell);
    dynamicOpenCells.add(key);
    const wall = forestWallRoots.get(key);
    if (wall) wall.position.y = -3.2;
    showCombatToast("机关触发，墙壁永久移开", "warn");
  }

  function ownedWeapons(): Array<"scythe" | "bow"> {
    const weapons: Array<"scythe" | "bow"> = [];
    if (hasScythe) weapons.push("scythe");
    if (hasBow) weapons.push("bow");
    return weapons;
  }

  function chooseFallbackWeapon(): "scythe" | "bow" | null {
    const weapons = ownedWeapons();
    return weapons.includes(selectedWeapon as "scythe" | "bow") ? selectedWeapon : weapons[0] ?? null;
  }

  function cycleWeapon(direction: 1 | -1): void {
    if (!gameStarted || finished || paused || shopOpen) return;
    const weapons = ownedWeapons();
    if (weapons.length === 0) {
      showCombatToast("还没有武器", "warn");
      return;
    }
    const current = chooseFallbackWeapon();
    const currentIndex = Math.max(0, weapons.indexOf(current as "scythe" | "bow"));
    selectedWeapon = weapons[(currentIndex + direction + weapons.length) % weapons.length];
    heldOverride = null;
    showCombatToast(selectedWeapon === "bow" ? "切换：弓箭" : "切换：镰刀", "good");
    updateHud();
  }

  function preferredHeldItem(): "shield" | "scythe" | "bow" | null {
    if (heldOverride && elapsed < heldOverrideUntil) return heldOverride;
    const weapon = chooseFallbackWeapon();
    if (weapon) return weapon;
    if (shields > 0) return "shield";
    return null;
  }

  function updateHeldItem(mode = preferredHeldItem()): void {
    if (!heldItem || !heldItemImage) return;
    if (!gameStarted || paused || shopOpen || finished || !mode || mode === "scythe" || mode === "bow") {
      heldItem.classList.add("hidden");
      return;
    }
    heldItem.classList.remove("hidden");
    heldItem.dataset.item = mode;
    heldItemImage.src = mode === "shield" ? "/assets/item-shield.png" : "/assets/item-scythe.png";
    heldItemImage.alt = mode === "shield" ? "护盾" : "镰刀";
  }

  function updateHeldScytheModel(): void {
    const visible = gameStarted && !paused && !shopOpen && !finished && preferredHeldItem() === "scythe";
    heldScytheModel.setEnabled(visible);
    if (!visible) return;

    const swingRemaining = Math.max(0, scytheSwingUntil - elapsed);
    const swing = swingRemaining > 0 ? 1 - swingRemaining / GAME_BALANCE.combat.scytheSwingSeconds : 0;
    const draw = swing > 0 ? easeOutCubic(Math.min(1, swing / 0.36)) : 0;
    const recover = swing > 0 ? easeInOutSine(Math.max(0, (swing - 0.36) / 0.64)) : 0;
    const arc = swing > 0 ? Math.sin(swing * Math.PI) : 0;
    const sweep = draw * (1 - recover * 0.22);
    heldScytheModel.position.x = 0.78 - sweep * 0.46 + recover * 0.06;
    heldScytheModel.position.y = -0.6 + arc * 0.13 - recover * 0.02;
    heldScytheModel.position.z = 1.15 - sweep * 0.08 + arc * 0.09;
    heldScytheModel.rotation.x = 0.08 + arc * 0.11 - recover * 0.03;
    heldScytheModel.rotation.y = -0.34 + sweep * 0.38;
    heldScytheModel.rotation.z = -0.58 - sweep * 1.02 + recover * 0.42;
    const scale = 0.62 + arc * 0.06;
    heldScytheModel.scaling.set(scale, scale, scale);
  }

  function updateHeldBowModel(): void {
    const visible = gameStarted && !paused && !shopOpen && !finished && preferredHeldItem() === "bow";
    heldBowModel.setEnabled(visible);
    if (!visible) return;

    const drawRemaining = Math.max(0, bowDrawUntil - elapsed);
    const draw = drawRemaining > 0 ? 1 - drawRemaining / GAME_BALANCE.combat.bowDrawSeconds : 0;
    const pull = draw > 0 ? Math.sin(draw * Math.PI) : 0;
    heldBowModel.position.x = 0.7 - pull * 0.08;
    heldBowModel.position.y = -0.46 + pull * 0.04;
    heldBowModel.position.z = 1.08 - pull * 0.12;
    heldBowModel.rotation.x = 0.04 - pull * 0.03;
    heldBowModel.rotation.y = -0.18 + pull * 0.08;
    heldBowModel.rotation.z = -0.12 - pull * 0.16;
    const scale = 0.72 + pull * 0.04;
    heldBowModel.scaling.set(scale, scale, scale);
  }

  function playSlashEffect(impact: "hit" | "miss"): void {
    if (!slashEffect) return;
    window.clearTimeout(slashEffectTimer);
    slashEffect.className = `slash-effect ${impact}`;
    void slashEffect.offsetWidth;
    slashEffect.classList.add("show");
    slashEffectTimer = window.setTimeout(() => slashEffect.className = "slash-effect", 430);
  }

  function playHeldAction(mode: "shield" | "scythe" | "bow", action: "attack" | "defend", impact?: "hit" | "miss"): void {
    if (!heldItem) return;
    heldOverride = mode;
    heldOverrideUntil = elapsed + 0.5;
    updateHeldItem(mode);
    heldItem.classList.remove("attack", "defend");
    void heldItem.offsetWidth;
    heldItem.classList.add(action);
    window.setTimeout(() => heldItem.classList.remove(action), 520);
    if (mode === "scythe" && action === "attack") scytheSwingUntil = elapsed + GAME_BALANCE.combat.scytheSwingSeconds;
    if (mode === "bow" && action === "attack") bowDrawUntil = elapsed + GAME_BALANCE.combat.bowDrawSeconds;
    if (action === "attack" && impact) playSlashEffect(impact);
  }

  function damageTrap(source: string): void {
    if (finished || invulnerable > 0 || elapsed < safeUntil) return;
    if (shields > 0) {
      shields -= 1;
      invulnerable = GAME_BALANCE.player.blockInvulnerableSeconds;
      playHeldAction("shield", "defend");
      showCombatToast(`护盾挡住${source}`, "good");
      updateHud();
      return;
    }
    lives -= 1;
    invulnerable = GAME_BALANCE.player.hitInvulnerableSeconds;
    damageFlash?.classList.remove("hit");
    damageFlash?.offsetHeight;
    damageFlash?.classList.add("hit");
    showCombatToast(`${source}造成伤害`, "danger");
    updateHud();
    if (lives <= 0) {
      finished = true;
      showMessage(`你倒在了${currentLevel.name}的机关中。按 R 重新开始。`);
      updateHud();
    }
  }

  function damagePlayer(source: NpcKind): void {
    if (finished || invulnerable > 0 || elapsed < safeUntil) return;
    if (shields > 0) {
      shields -= 1;
      invulnerable = GAME_BALANCE.player.blockInvulnerableSeconds;
      playHeldAction("shield", "defend");
      showCombatToast("护盾格挡", "good");
      updateHud(source);
      return;
    }
    lives -= 1;
    invulnerable = GAME_BALANCE.player.hitInvulnerableSeconds;
    damageFlash?.classList.remove("hit");
    damageFlash?.offsetHeight;
    damageFlash?.classList.add("hit");
    showCombatToast(`被${source}击中`, "danger");
    updateHud(source);
    if (lives <= 0) {
      finished = true;
      showMessage(`${source}把你拖进了迷宫深处。按 R 重新开始。`);
      updateHud(source);
    }
  }

  function updateHud(alert?: NpcKind): void {
    if (keysReadout) keysReadout.textContent = `${collected} / ${keys.length}`;
    if (heartsReadout) heartsReadout.textContent = "♥".repeat(Math.max(0, lives));
    if (crystalsReadout) crystalsReadout.textContent = `${crystalCount}`;
    if (shopCrystals) shopCrystals.textContent = `${crystalCount} 橙晶`;
    if (buyShieldButton) buyShieldButton.disabled = crystalCount < GAME_BALANCE.shop.shieldCost;
    if (buyScytheButton) buyScytheButton.disabled = hasScythe || crystalCount < GAME_BALANCE.shop.scytheCost;
    if (buyBowButton) buyBowButton.disabled = currentLevelIndex === 0 || hasBow || crystalCount < GAME_BALANCE.shop.bowCost;
    if (buyScytheLabel) buyScytheLabel.textContent = hasScythe ? "已解锁" : "兑换";
    if (buyBowLabel) buyBowLabel.textContent = hasBow ? "已解锁" : "兑换";
    if (itemsReadout) {
      const parts = [];
      if (shields > 0) parts.push(`盾 ${shields}`);
      if (hasScythe) parts.push(selectedWeapon === "scythe" ? "镰刀*" : "镰刀");
      if (hasBow) parts.push(selectedWeapon === "bow" ? "弓*" : "弓");
      itemsReadout.textContent = parts.length > 0 ? parts.join(" / ") : "无";
    }
    if (threatReadout) threatReadout.textContent = alert ? `${alert}靠近` : enemies.length > 0 ? `${enemies.length} 个目标` : "安静";
    if (statusReadout) {
      statusReadout.textContent = paused ? "已暂停" : shopOpen ? "水晶商城" : collected === keys.length ? "出口已开启" : "寻找符文";
    }
    updateExitGuide();
    updateHeldItem();
    updateHeldScytheModel();
    updateHeldBowModel();
  }

  function damageEnemy(targetIndex: number, damage: number): boolean {
    const enemy = enemies[targetIndex];
    if (!enemy) return false;
    enemy.health -= damage;
    if (enemy.health > 0) {
      showCombatToast(`${enemy.kind} 受创 ${enemy.health}`, "warn");
      return false;
    }
    const [defeated] = enemies.splice(targetIndex, 1);
    if (defeated) disposeEnemy(defeated);
    return true;
  }

  function useBlast(): void {
    if (!hasScythe || attackCooldown > 0 || finished || !gameStarted || shopOpen || paused) return;

    const targetIndexes = selectScytheTargets(
      { x: player.position.x, z: player.position.z },
      yaw,
      enemies.map((enemy, index) => ({ index, x: enemy.root.position.x, z: enemy.root.position.z })),
      GAME_BALANCE.combat
    );

    if (targetIndexes.length === 0) {
      playHeldAction("scythe", "attack", "miss");
      showCombatToast("范围外", "warn");
      attackCooldown = GAME_BALANCE.combat.scytheMissCooldown;
      updateHud();
      return;
    }
    playHeldAction("scythe", "attack", "hit");
    let defeatedCount = 0;
    targetIndexes.sort((a, b) => b - a).forEach((targetIndex) => {
      if (damageEnemy(targetIndex, 1)) defeatedCount += 1;
    });
    attackCooldown = GAME_BALANCE.combat.scytheHitCooldown;
    if (defeatedCount > 0) showCombatToast(defeatedCount > 1 ? `横扫击倒 ${defeatedCount} 个` : "斩击命中", "good");
    updateHud();
  }

  function useBow(): void {
    if (!hasBow || attackCooldown > 0 || finished || !gameStarted || shopOpen || paused) return;

    const targetIndex = selectBowTarget(
      { x: player.position.x, z: player.position.z },
      yaw,
      enemies.map((enemy, index) => ({ index, x: enemy.root.position.x, z: enemy.root.position.z })),
      GAME_BALANCE.combat
    );

    if (targetIndex === null) {
      playHeldAction("bow", "attack", "miss");
      showCombatToast("箭矢落空", "warn");
      attackCooldown = GAME_BALANCE.combat.bowCooldown;
      updateHud();
      return;
    }

    playHeldAction("bow", "attack", "hit");
    const defeated = damageEnemy(targetIndex, 2);
    attackCooldown = GAME_BALANCE.combat.bowCooldown;
    if (defeated) showCombatToast("箭矢命中", "good");
    updateHud();
  }

  function useAttack(): void {
    const weapon = chooseFallbackWeapon();
    if (weapon === "bow") {
      useBow();
      return;
    }
    if (weapon === "scythe") useBlast();
    else showCombatToast("先兑换武器", "warn");
  }

  function setShopOpen(open: boolean): void {
    if (!gameStarted || finished || (paused && open)) return;
    shopOpen = open;
    shopOverlay?.classList.toggle("hidden", !open);
    if (open && document.pointerLockElement) document.exitPointerLock();
    updateHud();
  }

  function setPaused(open: boolean): void {
    if (!gameStarted || finished) return;
    paused = open;
    if (open) {
      shopOpen = false;
      shopOverlay?.classList.add("hidden");
      if (document.pointerLockElement) document.exitPointerLock();
    }
    pauseOverlay?.classList.toggle("hidden", !open);
    updateHud();
  }

  function buyItem(type: "shield" | "scythe" | "bow"): void {
    const cost = type === "shield" ? GAME_BALANCE.shop.shieldCost : type === "scythe" ? GAME_BALANCE.shop.scytheCost : GAME_BALANCE.shop.bowCost;
    if (!shopOpen || crystalCount < cost) return;
    if (type === "scythe" && hasScythe) return;
    if (type === "bow" && hasBow) return;
    crystalCount -= cost;
    if (type === "shield") {
      shields += 1;
      playHeldAction("shield", "defend");
      showCombatToast("护盾已装备", "good");
    } else if (type === "scythe") {
      hasScythe = true;
      selectedWeapon = "scythe";
      playHeldAction("scythe", "attack", "hit");
      showCombatToast("镰刀已装备", "good");
    } else {
      hasBow = true;
      selectedWeapon = "bow";
      playHeldAction("bow", "attack", "hit");
      showCombatToast("弓箭已装备", "good");
    }
    updateHud();
  }

  function resetRun(): void {
    dynamicBlockedCells = new Set();
    dynamicOpenCells = new Set();
    forestWallRoots.forEach((wall) => {
      wall.position.y = 0;
      wall.setEnabled(true);
    });
    player.position = start.add(new Vector3(0, 0.32, 0));
    yaw = 0;
    pitch = 0;
    keys.forEach((key) => key.setEnabled(true));
    crystals.forEach((crystal) => crystal.setEnabled(true));
    ginsengs.forEach((ginseng) => ginseng.setEnabled(true));
    enemies.splice(0).forEach(disposeEnemy);
    if (isDesertLevel()) {
      spawnNpc("骷髅兵");
      spawnNpc("骷髅兵");
      spawnNpc("毒蝎");
      spawnNpc("毒蝎");
      spawnNpc("骷髅兵");
    } else {
      GAME_BALANCE.enemies.initialKinds.forEach((kind) => spawnNpc(kind));
    }
    if (isForestLevel()) {
      spawnNpc("僵尸");
      spawnNpc("鬼新娘");
      spawnNpc("老婆婆");
      spawnNpc("蝙蝠群");
      spawnNpc("蝙蝠群");
      spawnNpc("森林守卫");
    }
    if (isForestLevel()) {
      const used = new Set<string>();
      livingTrees.forEach((tree) => {
        const cell = chooseLivingTreeCell(used);
        used.add(cellKey(cell));
        tree.cell = cell;
        tree.target = worldFromCell(cell);
        tree.root.position = tree.target.clone();
        tree.nextShiftAt = Number.POSITIVE_INFINITY;
        dynamicBlockedCells.add(cellKey(cell));
      });
    }
    pressurePlates.forEach((plate) => {
      plate.used = false;
      plate.cooldownUntil = 0;
      plate.root.scaling.set(1, 1, 1);
      plate.root.setEnabled(true);
    });
    spikeTraps.forEach((trap) => {
      trap.cooldownUntil = 0;
      trap.root.position.y = 0.04;
      trap.root.setEnabled(true);
    });
    quicksandTraps.forEach((trap) => {
      trap.root.scaling.set(1, 1, 1);
      trap.root.setEnabled(true);
    });
    collected = 0;
    crystalCount = 0;
    hasScythe = false;
    hasBow = false;
    selectedWeapon = null;
    enemyPressureBonus = 0;
    shields = 0;
    lives = GAME_BALANCE.player.lives;
    invulnerable = 0;
    attackCooldown = 0;
    spawnTimer = isForestLevel() ? 8 : isDesertLevel() ? 10 : GAME_BALANCE.enemies.initialSpawnSeconds;
    finished = false;
    paused = false;
    shopOpen = false;
    heldOverride = null;
    heldOverrideUntil = 0;
    scytheSwingUntil = 0;
    bowDrawUntil = 0;
    safeUntil = elapsed + 5;
    window.clearTimeout(combatToastTimer);
    window.clearTimeout(slashEffectTimer);
    shopOverlay?.classList.add("hidden");
    pauseOverlay?.classList.add("hidden");
    message?.classList.add("hidden");
    exitGuide?.classList.add("hidden");
    heldItem?.classList.add("hidden");
    heldItem?.classList.remove("attack", "defend");
    heldScytheModel.setEnabled(false);
    heldBowModel.setEnabled(false);
    slashEffect?.classList.remove("show", "hit", "miss");
    combatToast?.classList.add("hidden");
    updateHud();
  }

  function startGame(): void {
    paused = false;
    gameStarted = true;
    safeUntil = elapsed + 5;
    startScreen?.classList.add("hidden");
    gameUi?.classList.remove("hidden");
    levelMenu?.classList.add("hidden");
    showCombatToast(currentLevel.name, "good");
    updateHud();
  }

  function returnHome(): void {
    resetRun();
    gameStarted = false;
    startScreen?.classList.remove("hidden");
    gameUi?.classList.add("hidden");
    updateHud();
  }

  function completeLevel(): void {
    finished = true;
    if (currentLevelIndex < LEVELS.length - 1) {
      const nextIndex = currentLevelIndex + 1;
      setUnlockedLevelCount(nextIndex + 1);
      showMessage(`出口开启。即将进入：${LEVELS[nextIndex].name}`, true);
      window.sessionStorage.setItem("moon-maze-auto-start", "1");
      window.setTimeout(() => {
        window.location.hash = `level-${nextIndex + 1}`;
        window.location.reload();
      }, 1100);
      return;
    }
    showMessage(`你穿过了${currentLevel.name}，Demo 关卡已完成。按 R 重新挑战本关。`, true);
  }

  const onActionKeyDown = (event: KeyboardEvent): void => {
    if (event.repeat) return;
    if ((event.code === "Escape" || event.code === "KeyP") && gameStarted && !finished) {
      event.preventDefault();
      if (shopOpen) setShopOpen(false);
      else setPaused(!paused);
    }
    if (event.code === "KeyE" && gameStarted && !finished && !paused) {
      event.preventDefault();
      setShopOpen(!shopOpen);
    }
    if ((event.code === "KeyF" || event.code === "Space") && gameStarted && !finished && !paused && !shopOpen) {
      event.preventDefault();
      useAttack();
    }
    if (event.code === "KeyR" && finished) {
      event.preventDefault();
      resetRun();
    }
  };

  const onWeaponWheel = (event: WheelEvent): void => {
    if (!gameStarted || finished || paused || shopOpen) return;
    if (ownedWeapons().length < 2) return;
    event.preventDefault();
    cycleWeapon(event.deltaY > 0 ? 1 : -1);
  };

  window.addEventListener("keydown", onActionKeyDown);
  window.addEventListener("wheel", onWeaponWheel, { passive: false });
  scene.onDisposeObservable.add(() => {
    window.removeEventListener("keydown", onActionKeyDown);
    window.removeEventListener("wheel", onWeaponWheel);
  });

  startButton?.addEventListener("click", () => startGame());
  levelSelectButton?.addEventListener("click", () => levelMenu?.classList.toggle("hidden"));
  levelOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      const index = Number.parseInt(button.dataset.levelIndex ?? "0", 10);
      window.location.hash = `level-${index + 1}`;
      window.location.reload();
    });
  });
  buyShieldButton?.addEventListener("click", () => buyItem("shield"));
  buyScytheButton?.addEventListener("click", () => buyItem("scythe"));
  buyBowButton?.addEventListener("click", () => buyItem("bow"));
  closeShopButton?.addEventListener("click", () => setShopOpen(false));
  resumeButton?.addEventListener("click", () => setPaused(false));
  restartButton?.addEventListener("click", () => resetRun());
  homeButton?.addEventListener("click", () => returnHome());

  updateHud();

  if (window.sessionStorage.getItem("moon-maze-auto-start") === "1") {
    window.sessionStorage.removeItem("moon-maze-auto-start");
    startGame();
  }

  scene.onBeforeRenderObservable.add(() => {
    const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05);
    elapsed += delta;
    attackCooldown = Math.max(0, attackCooldown - delta);
    skybox.rotation.y += delta * 0.006;
    altar.rotation.y += delta * 0.25;
    altarLight.intensity = 0.72 + Math.sin(elapsed * 4) * 0.16;
    mistBlocks.forEach((mist, index) => {
      mist.position.x += Math.sin(elapsed * 0.7 + index) * delta * 0.04;
      const baseMistVisibility = isForestLevel() ? 0.66 : isDesertLevel() ? 0.5 : 0.34;
      mist.visibility = baseMistVisibility + Math.sin(elapsed * 1.3 + index) * 0.08;
    });
    forestWisps.forEach((wisp, index) => {
      const phase = (wisp.metadata?.phase as number | undefined) ?? index;
      wisp.rotation.y += delta * 1.6;
      wisp.position.y += Math.sin(elapsed * 2.1 + phase) * delta * 0.08;
      const light = wisp.metadata?.light as PointLight | undefined;
      if (light) {
        light.position = wisp.position.add(new Vector3(0, 0.1, 0));
        light.intensity = 0.22 + Math.sin(elapsed * 3.4 + phase) * 0.08;
      }
    });
    livingTrees.forEach((tree, index) => {
      if (isForestLevel() && !finished && gameStarted && !shopOpen && !paused && elapsed >= tree.nextShiftAt) shiftLivingTree(tree);
      tree.root.position = Vector3.Lerp(tree.root.position, tree.target, 0.025);
      tree.root.rotation.y = Math.sin(elapsed * 0.7 + index) * 0.08;
      tree.root.scaling.y = 1 + Math.sin(elapsed * 1.8 + index) * 0.025;
    });

    if (!finished && gameStarted && !shopOpen && !paused) {
      if (isForestLevel()) {
        const nextPressureBonus = Math.min(8, Math.floor(Math.max(0, elapsed - 25) / 35));
        if (nextPressureBonus > enemyPressureBonus) {
          enemyPressureBonus = nextPressureBonus;
          spawnTimer = Math.min(spawnTimer, 1.2);
          showCombatToast(`迷雾更躁动：敌群 +${enemyPressureBonus}`, "danger");
          updateHud();
        }
      }

      const movement = new Vector3(0, 0, 0);
      if (input.isDown("KeyW") || input.isDown("ArrowUp")) movement.z += 1;
      if (input.isDown("KeyS") || input.isDown("ArrowDown")) movement.z -= 1;
      if (input.isDown("KeyA") || input.isDown("ArrowLeft")) movement.x -= 1;
      if (input.isDown("KeyD") || input.isDown("ArrowRight")) movement.x += 1;

      if (movement.lengthSquared() > 0) {
        movement.normalize();
        const forward = new Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const right = new Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const inQuicksand = quicksandTraps.some((trap) => trap.root.isEnabled() && Vector3.Distance(trap.root.position, player.position) < 0.62);
        const trapSpeedMultiplier = inQuicksand ? 0.48 : 1;
        const step = forward.scale(movement.z).add(right.scale(movement.x)).scaleInPlace(delta * GAME_BALANCE.player.moveSpeed * trapSpeedMultiplier);
        const nextX = player.position.add(new Vector3(step.x, 0, 0));
        const nextZ = player.position.add(new Vector3(0, 0, step.z));
        if (canMoveTo(nextX)) player.position.x = nextX.x;
        if (canMoveTo(nextZ)) player.position.z = nextZ.z;
      }

      spawnTimer -= delta;
      if (spawnTimer <= 0) {
        spawnNpc();
        const levelMinSpawnSeconds = isForestLevel() ? 5.5 : isDesertLevel() ? 6.5 : GAME_BALANCE.enemies.minSpawnSeconds;
        const levelBaseSpawnSeconds = isForestLevel() ? Math.max(7.5, 12 - enemyPressureBonus * 0.65) : isDesertLevel() ? 13 : GAME_BALANCE.enemies.baseSpawnSeconds;
        const levelSpawnRamp = isForestLevel() ? 0.04 : isDesertLevel() ? 0.02 : GAME_BALANCE.enemies.spawnRampPerSecond;
        spawnTimer = Math.max(
          levelMinSpawnSeconds,
          levelBaseSpawnSeconds - elapsed * levelSpawnRamp
        );
        updateHud();
      }
    }

    const breath = Math.sin(elapsed * 2.5) * 0.018;
    camera.position = Vector3.Lerp(camera.position, player.position.add(new Vector3(0, 1.02 + breath, 0)), 0.55);
    camera.rotation.x = pitch + Math.sin(elapsed * 1.7) * 0.004;
    camera.rotation.y = yaw;
    camera.rotation.z = Math.sin(elapsed * 1.2) * 0.0025;
    playerLight.position = camera.position.add(new Vector3(0, -0.05, 0));
    const basePlayerLight = isForestLevel() ? 0.82 : isDesertLevel() ? 0.98 : 1.12;
    playerLight.intensity = basePlayerLight + Math.sin(elapsed * 9) * 0.05;
    updateHeldScytheModel();
    updateHeldBowModel();

    keys.forEach((key) => {
      if (!key.isEnabled()) return;
      key.rotation.z += delta * 1.8;
      key.position.y = 1 + Math.sin(elapsed * 3.2 + key.position.x) * 0.08;
      if (gameStarted && !shopOpen && !paused && Vector3.Distance(key.position, player.position) < GAME_BALANCE.player.runeCollectRadius) {
        key.setEnabled(false);
        collected += 1;
        showCombatToast(`符文 ${collected}/${keys.length}`, "good");
        updateHud();
      }
    });

    crystals.forEach((crystal) => {
      if (!crystal.isEnabled()) return;
      crystal.rotation.y += delta * 2.4;
      crystal.position.y = 0.36 + Math.sin(elapsed * 3.7 + crystal.position.x) * 0.07;
      if (gameStarted && !shopOpen && !paused && Vector3.Distance(crystal.position, player.position) < GAME_BALANCE.player.crystalCollectRadius) {
        crystal.setEnabled(false);
        crystalCount += 1;
        showCombatToast("+1 橙晶", "good");
        updateHud();
      }
    });

    ginsengs.forEach((ginseng, index) => {
      if (!ginseng.isEnabled()) return;
      ginseng.rotation.y += delta * 1.3;
      ginseng.position.y = 0.12 + Math.sin(elapsed * 2.4 + index) * 0.045;
      if (
        gameStarted &&
        !shopOpen &&
        !paused &&
        lives < GAME_BALANCE.player.lives &&
        Vector3.Distance(ginseng.position, player.position) < GAME_BALANCE.player.healthPickupRadius
      ) {
        ginseng.setEnabled(false);
        lives = Math.min(GAME_BALANCE.player.lives, lives + 1);
        showCombatToast("人参 +1 生命", "good");
        updateHud();
      }
    });

    pressurePlates.forEach((plate, index) => {
      if (!plate.root.isEnabled()) return;
      if (plate.used) {
        plate.root.rotation.y = Math.sin(elapsed * 0.25 + index) * 0.025;
        plate.root.scaling = Vector3.Lerp(plate.root.scaling, new Vector3(0.94, 0.5, 0.94), 0.08);
        return;
      }
      const active = elapsed < plate.cooldownUntil;
      const idlePulse = 1 + Math.sin(elapsed * 2.2 + index) * 0.025;
      if (!active) plate.root.scaling.set(idlePulse, 1, idlePulse);
      else plate.root.scaling = Vector3.Lerp(plate.root.scaling, new Vector3(1, 1, 1), 0.035);
      plate.root.rotation.y = Math.sin(elapsed * 0.6 + index) * 0.04;
      if (
        gameStarted &&
        !finished &&
        !shopOpen &&
        !paused &&
        (isForestLevel() || isDesertLevel()) &&
        Vector3.Distance(plate.root.position, player.position) < 0.58
      ) {
        triggerPressurePlate(plate);
      }
    });

    quicksandTraps.forEach((trap, index) => {
      if (!trap.root.isEnabled()) return;
      trap.root.rotation.y += delta * (0.18 + index * 0.006);
      trap.root.scaling.x = 1 + Math.sin(elapsed * 1.7 + index) * 0.035;
      trap.root.scaling.z = 1 + Math.cos(elapsed * 1.5 + index) * 0.035;
    });

    spikeTraps.forEach((trap, index) => {
      if (!trap.root.isEnabled()) return;
      const pulse = (Math.sin(elapsed * 3.1 + trap.phase) + 1) * 0.5;
      const armed = pulse > 0.62;
      trap.root.position.y = armed ? 0.02 + pulse * 0.16 : -0.06 + pulse * 0.05;
      trap.root.rotation.y = Math.sin(elapsed * 0.35 + index) * 0.03;
      if (
        armed &&
        gameStarted &&
        !finished &&
        !shopOpen &&
        !paused &&
        elapsed >= trap.cooldownUntil &&
        Vector3.Distance(trap.root.position, player.position) < 0.62
      ) {
        trap.cooldownUntil = elapsed + 1.25;
        damageTrap("尖刺机关");
      }
    });

    const exitPulse = collected === keys.length ? 1 + Math.sin(elapsed * 4) * 0.025 : 1;
    exit.scaling.x = exitPulse;
    exit.scaling.y = exitPulse;
    exit.scaling.z = exitPulse;
    exitMat.emissiveColor = collected === keys.length ? new Color3(0.8, 0.45, 0.07) : new Color3(0.18, 0.1, 0.02);
    updateExitGuide();

    const enemyUpdate = updateEnemies(
      enemies,
      player.position,
      delta,
      elapsed,
      canMoveTo,
      !finished && gameStarted && !shopOpen && !paused,
      damagePlayer
    );
    const closestThreat = enemyUpdate.closestKind;
    const closestDistance = enemyUpdate.closestDistance;
    if (closestDistance < GAME_BALANCE.enemies.hudThreatDistance) updateHud(closestThreat);
    else if (Math.floor(elapsed * 2) % 2 === 0) updateHud();

    if (invulnerable > 0) invulnerable -= delta;

    if (!finished && gameStarted && !paused && collected === keys.length && Vector3.Distance(player.position, exit.position) < GAME_BALANCE.player.exitRadius) {
      completeLevel();
      updateHud();
    }
  });

  return scene;
}
