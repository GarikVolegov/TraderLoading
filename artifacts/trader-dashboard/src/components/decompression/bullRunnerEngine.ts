import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { gameAudio } from "./gameAudioSynthesizer";
import { type CampaignChapter, type BullRunnerSkills } from "./chronicles/chroniclesTypes";

export type Lane = -1 | 0 | 1;

export interface GameEngineCallbacks {
  onScoreUpdate: (data: {
    score: number;
    multiplier: number;
    coins: number;
    distance: number;
    spikesAvoided: number;
  }) => void;
  onGameOver: (data: { score: number; coins: number; distance: number }) => void;
  onChapterComplete?: (chapterId: number, coinsEarned: number) => void;
  onBossHpUpdate?: (currentHp: number, maxHp: number) => void;
  onShieldChange: (hasShield: boolean, charges: number) => void;
  onBoostChange: (hasBoost: boolean) => void;
  onStateChange: (state: "ready" | "running" | "paused" | "over" | "victory") => void;
}

export interface BullRunnerController {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  setChapter: (chapter: CampaignChapter) => void;
  setSkills: (skills: BullRunnerSkills) => void;
  moveLeft: () => void;
  moveRight: () => void;
  jump: () => void;
  slide: () => void;
  dispose: () => void;
}

interface ActiveEntity {
  mesh: Group | Mesh;
  type: "coin" | "liquidity" | "shield" | "boost" | "breakout_orb" | "spike" | "wall";
  lane: Lane;
  z: number;
  cleared?: boolean;
}

const LANE_SPACING = 2.4;
const INITIAL_SPEED = 24;
const MAX_SPEED = 46;
const GRAVITY = -42;
const JUMP_FORCE = 14;

export function createBullRunnerEngine(
  container: HTMLDivElement,
  callbacks: GameEngineCallbacks,
  initialChapter?: CampaignChapter,
  initialSkills?: BullRunnerSkills,
): BullRunnerController | null {
  const canvas = document.createElement("canvas");
  const context =
    canvas.getContext("webgl2", { alpha: false, antialias: true }) ||
    canvas.getContext("webgl", { alpha: false, antialias: true });
  if (!context) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      context: context as WebGLRenderingContext,
      antialias: true,
      alpha: false,
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x07080b, 1.0);
  renderer.setSize(container.clientWidth, container.clientHeight);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.outline = "none";
  container.appendChild(canvas);

  const scene = new Scene();
  scene.fog = new FogExp2(0x07080b, 0.024);

  const camera = new PerspectiveCamera(62, container.clientWidth / container.clientHeight, 0.1, 150);
  camera.position.set(0, 3.8, 6.8);
  camera.lookAt(0, 1.2, -6.0);

  // Lighting
  const ambientLight = new AmbientLight(0xffffff, 0.7);
  scene.add(ambientLight);

  const sunLight = new DirectionalLight(0xc5a059, 1.6);
  sunLight.position.set(6, 14, 8);
  scene.add(sunLight);

  const emeraldGlow = new DirectionalLight(0x10b981, 0.5);
  emeraldGlow.position.set(-8, 6, -10);
  scene.add(emeraldGlow);

  // Active Chapter & Skills Configuration
  let currentChapter: CampaignChapter | null = initialChapter || null;
  let currentSkills: BullRunnerSkills = initialSkills || {
    magnetismLevel: 0,
    shieldCharges: 1,
    bulletTimeEnabled: false,
    activeSkin: "gold",
  };

  // Materials Cache
  const goldMaterial = new MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.85,
    roughness: 0.25,
  });
  const darkGoldMaterial = new MeshStandardMaterial({
    color: 0x8f7236,
    metalness: 0.9,
    roughness: 0.35,
  });
  const hornMaterial = new MeshStandardMaterial({
    color: 0xf3d88c,
    metalness: 0.7,
    roughness: 0.15,
  });
  const eyeMaterial = new MeshBasicMaterial({ color: 0x10b981 });

  // Update skin appearance
  function applySkin(skin: "gold" | "obsidian" | "emerald") {
    if (skin === "obsidian") {
      goldMaterial.color.setHex(0x181a20);
      goldMaterial.metalness = 0.95;
      darkGoldMaterial.color.setHex(0x0a0c10);
      hornMaterial.color.setHex(0x06b6d4); // neon cyan
      eyeMaterial.color.setHex(0xa855f7); // neon purple
    } else if (skin === "emerald") {
      goldMaterial.color.setHex(0x10b981);
      goldMaterial.metalness = 0.4;
      goldMaterial.roughness = 0.2;
      darkGoldMaterial.color.setHex(0x064e3b);
      hornMaterial.color.setHex(0xf3d88c);
      eyeMaterial.color.setHex(0xffffff);
    } else {
      goldMaterial.color.setHex(0xc5a059);
      goldMaterial.metalness = 0.85;
      goldMaterial.roughness = 0.25;
      darkGoldMaterial.color.setHex(0x8f7236);
      hornMaterial.color.setHex(0xf3d88c);
      eyeMaterial.color.setHex(0x10b981);
    }
  }
  applySkin(currentSkills.activeSkin);

  const emeraldMaterial = new MeshStandardMaterial({
    color: 0x10b981,
    metalness: 0.3,
    roughness: 0.2,
    emissive: 0x054d36,
  });
  const breakoutOrbMaterial = new MeshStandardMaterial({
    color: 0x06b6d4,
    metalness: 0.6,
    roughness: 0.1,
    emissive: 0x0891b2,
  });
  const redMaterial = new MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.5,
    roughness: 0.3,
    emissive: 0x5a1111,
  });
  const gridLineMaterial = new MeshBasicMaterial({ color: 0xc5a059, transparent: true, opacity: 0.2 });
  const roadMaterial = new MeshStandardMaterial({ color: 0x0c0e14, roughness: 0.85 });

  // Road Track
  const roadGroup = new Group();
  const roadGeo = new PlaneGeometry(8.5, 200);
  const roadMesh = new Mesh(roadGeo, roadMaterial);
  roadMesh.rotation.x = -Math.PI / 2;
  roadMesh.position.z = -80;
  roadGroup.add(roadMesh);

  // Lane separator dashed lines
  [-LANE_SPACING / 2, LANE_SPACING / 2].forEach((xPos) => {
    for (let z = 10; z > -180; z -= 6) {
      const lineGeo = new PlaneGeometry(0.12, 3);
      const lineMesh = new Mesh(lineGeo, gridLineMaterial);
      lineMesh.rotation.x = -Math.PI / 2;
      lineMesh.position.set(xPos, 0.01, z);
      roadGroup.add(lineMesh);
    }
  });

  // Border curb rails
  [-4.2, 4.2].forEach((xPos) => {
    const curbGeo = new BoxGeometry(0.25, 0.2, 200);
    const curbMesh = new Mesh(curbGeo, goldMaterial);
    curbMesh.position.set(xPos, 0.1, -80);
    roadGroup.add(curbMesh);
  });
  scene.add(roadGroup);

  // Scenery Candlesticks (decorations in the background)
  const sceneryCandles: Group[] = [];
  function createSceneryCandle(isGreen: boolean): Group {
    const candle = new Group();
    const height = 3 + Math.random() * 6;
    const bodyMat = isGreen ? emeraldMaterial : redMaterial;
    const body = new Mesh(new BoxGeometry(1.2, height, 1.2), bodyMat);
    body.position.y = height / 2;
    candle.add(body);

    const wickHeight = height + 3 + Math.random() * 3;
    const wick = new Mesh(new CylinderGeometry(0.08, 0.08, wickHeight, 6), bodyMat);
    wick.position.y = wickHeight / 2;
    candle.add(wick);
    return candle;
  }

  for (let z = 10; z > -180; z -= 8) {
    [-6.5 - Math.random() * 6, 6.5 + Math.random() * 6].forEach((xPos) => {
      const isGreen = Math.random() > 0.45;
      const c = createSceneryCandle(isGreen);
      c.position.set(xPos, 0, z);
      scene.add(c);
      sceneryCandles.push(c);
    });
  }

  // Player Bull Assembly (Low-poly Golden Cyber Bull)
  const playerGroup = new Group();

  const bodyGeo = new BoxGeometry(1.1, 0.95, 1.9);
  const bodyMesh = new Mesh(bodyGeo, goldMaterial);
  bodyMesh.position.y = 0.9;
  playerGroup.add(bodyMesh);

  const humpGeo = new BoxGeometry(1.15, 0.4, 0.8);
  const humpMesh = new Mesh(humpGeo, darkGoldMaterial);
  humpMesh.position.set(0, 1.45, -0.3);
  playerGroup.add(humpMesh);

  const headGeo = new BoxGeometry(0.7, 0.65, 0.8);
  const headMesh = new Mesh(headGeo, goldMaterial);
  headMesh.position.set(0, 1.2, -1.25);
  playerGroup.add(headMesh);

  const hornGeo = new ConeGeometry(0.12, 0.75, 6);
  const leftHorn = new Mesh(hornGeo, hornMaterial);
  leftHorn.position.set(-0.45, 1.55, -1.35);
  leftHorn.rotation.set(-0.3, 0, -0.6);
  playerGroup.add(leftHorn);

  const rightHorn = new Mesh(hornGeo, hornMaterial);
  rightHorn.position.set(0.45, 1.55, -1.35);
  rightHorn.rotation.set(-0.3, 0, 0.6);
  playerGroup.add(rightHorn);

  const eyeGeo = new BoxGeometry(0.1, 0.08, 0.2);
  const leftEye = new Mesh(eyeGeo, eyeMaterial);
  leftEye.position.set(-0.36, 1.3, -1.3);
  playerGroup.add(leftEye);

  const rightEye = new Mesh(eyeGeo, eyeMaterial);
  rightEye.position.set(0.36, 1.3, -1.3);
  playerGroup.add(rightEye);

  const legGeo = new BoxGeometry(0.24, 0.7, 0.28);
  const flLeg = new Mesh(legGeo, darkGoldMaterial);
  flLeg.position.set(-0.45, 0.35, -0.65);
  playerGroup.add(flLeg);

  const frLeg = new Mesh(legGeo, darkGoldMaterial);
  frLeg.position.set(0.45, 0.35, -0.65);
  playerGroup.add(frLeg);

  const blLeg = new Mesh(legGeo, darkGoldMaterial);
  blLeg.position.set(-0.45, 0.35, 0.65);
  playerGroup.add(blLeg);

  const brLeg = new Mesh(legGeo, darkGoldMaterial);
  brLeg.position.set(0.45, 0.35, 0.65);
  playerGroup.add(brLeg);

  // Trailing Shield Bubble
  const shieldGeo = new IcosahedronGeometry(1.5, 1);
  const shieldMat = new MeshStandardMaterial({
    color: 0xf3d88c,
    transparent: true,
    opacity: 0.35,
    metalness: 0.9,
    roughness: 0.1,
    wireframe: true,
  });
  const shieldMesh = new Mesh(shieldGeo, shieldMat);
  shieldMesh.position.y = 1.0;
  shieldMesh.visible = false;
  playerGroup.add(shieldMesh);

  // Golden Ground Shadow
  const shadowGeo = new PlaneGeometry(1.4, 2.2);
  const shadowMat = new MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.45 });
  const shadowMesh = new Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  playerGroup.add(shadowMesh);

  scene.add(playerGroup);

  // -------------------------------------------------------------
  // THE BEAR TITAN (BOSS 3D) FOR CHAPTER IV
  // -------------------------------------------------------------
  const bearTitanGroup = new Group();
  let bossActive = false;
  let bossHp = 6;
  const bossMaxHp = 6;
  let bossTargetZ = -38;
  let bossActionTimer = 0;

  function buildBearTitan() {
    bearTitanGroup.clear();
    const bearMat = new MeshStandardMaterial({
      color: 0x5a1818,
      metalness: 0.8,
      roughness: 0.3,
    });
    const armorMat = new MeshStandardMaterial({
      color: 0x1f1414,
      metalness: 0.9,
      roughness: 0.2,
    });
    const redEyeMat = new MeshBasicMaterial({ color: 0xef4444 });

    // Massive Torso
    const bBody = new Mesh(new BoxGeometry(3.0, 3.2, 2.4), bearMat);
    bBody.position.y = 2.4;
    bearTitanGroup.add(bBody);

    // Armored Chest Plate
    const bPlate = new Mesh(new BoxGeometry(3.1, 1.8, 1.2), armorMat);
    bPlate.position.set(0, 2.7, 0.7);
    bearTitanGroup.add(bPlate);

    // Bear Head
    const bHead = new Mesh(new BoxGeometry(1.8, 1.6, 1.8), bearMat);
    bHead.position.set(0, 4.4, 0.4);
    bearTitanGroup.add(bHead);

    // Snout
    const bSnout = new Mesh(new BoxGeometry(1.0, 0.7, 1.1), armorMat);
    bSnout.position.set(0, 4.0, 1.4);
    bearTitanGroup.add(bSnout);

    // Glowing Red Eyes
    const bEyeL = new Mesh(new BoxGeometry(0.2, 0.15, 0.2), redEyeMat);
    bEyeL.position.set(-0.5, 4.6, 1.3);
    bearTitanGroup.add(bEyeL);
    const bEyeR = new Mesh(new BoxGeometry(0.2, 0.15, 0.2), redEyeMat);
    bEyeR.position.set(0.5, 4.6, 1.3);
    bearTitanGroup.add(bEyeR);

    // Armored Claws / Paws
    const bPawL = new Mesh(new BoxGeometry(0.9, 2.2, 0.9), armorMat);
    bPawL.position.set(-2.0, 2.0, 0.3);
    bearTitanGroup.add(bPawL);
    const bPawR = new Mesh(new BoxGeometry(0.9, 2.2, 0.9), armorMat);
    bPawR.position.set(2.0, 2.0, 0.3);
    bearTitanGroup.add(bPawR);

    bearTitanGroup.position.set(0, 0, bossTargetZ);
    scene.add(bearTitanGroup);
  }

  // Particle System
  const PARTICLE_COUNT = 140;
  const particleGeo = new BufferGeometry();
  const particlePositions = new Float32Array(PARTICLE_COUNT * 3);
  const particleVelocities: { x: number; y: number; z: number; life: number }[] = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    particlePositions[i * 3] = 0;
    particlePositions[i * 3 + 1] = -100;
    particlePositions[i * 3 + 2] = 0;
    particleVelocities.push({ x: 0, y: 0, z: 0, life: 0 });
  }
  particleGeo.setAttribute("position", new Float32BufferAttribute(particlePositions, 3));
  const particleMat = new PointsMaterial({
    color: 0xc5a059,
    size: 0.24,
    transparent: true,
    opacity: 0.9,
  });
  const particleSystem = new Points(particleGeo, particleMat);
  scene.add(particleSystem);

  function triggerBurst(pos: { x: number; y: number; z: number }, colorHex = 0xc5a059, count = 28) {
    particleMat.color.setHex(colorHex);
    let spawned = 0;
    for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
      if (particleVelocities[i].life <= 0) {
        particlePositions[i * 3] = pos.x;
        particlePositions[i * 3 + 1] = pos.y;
        particlePositions[i * 3 + 2] = pos.z;
        particleVelocities[i] = {
          x: (Math.random() - 0.5) * 14,
          y: Math.random() * 9 + 2,
          z: (Math.random() - 0.5) * 14,
          life: 0.8 + Math.random() * 0.4,
        };
        spawned++;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
  }

  // Active track entities
  const activeEntities: ActiveEntity[] = [];

  // Game State Variables
  let gameState: "ready" | "running" | "paused" | "over" | "victory" = "ready";
  let currentLane: Lane = 0;
  let targetX = 0;
  let posY = 0;
  let velY = 0;
  let isJumping = false;
  let isSliding = false;
  let slideTimer = 0;

  let speed = INITIAL_SPEED;
  let score = 0;
  let distanceMeters = 0;
  let coinsCount = 0;
  let spikesAvoided = 0;
  let multiplier = 1;
  let zenStreakTimer = 0;

  let shieldChargesRemaining = currentSkills.shieldCharges;
  let hasBoost = false;
  let boostTimer = 0;
  let bulletTimeCooldown = 0;

  let nextSpawnZ = -20;
  let clockTime = 0;
  let animFrameId = 0;
  let lastTimestamp = 0;

  // Spawner Helpers
  function spawnEntity() {
    const laneOptions: Lane[] = [-1, 0, 1];
    const lane = laneOptions[Math.floor(Math.random() * laneOptions.length)];
    const roll = Math.random();

    let entity: ActiveEntity;

    // In Boss Chapter, occasionally spawn Breakout Orbs that damage the Bear!
    if (currentChapter?.isBossChapter && bossActive && roll < 0.28) {
      const bGroup = new Group();
      const bMesh = new Mesh(new SphereGeometry(0.52, 16, 16), breakoutOrbMaterial);
      const bRing = new Mesh(new TorusGeometry(0.72, 0.05, 8, 20), hornMaterial);
      bRing.rotation.x = Math.PI / 2;
      bGroup.add(bMesh);
      bGroup.add(bRing);
      bGroup.position.set(lane * LANE_SPACING, 1.1, nextSpawnZ);
      scene.add(bGroup);
      entity = { mesh: bGroup, type: "breakout_orb", lane, z: nextSpawnZ };
    } else if (roll < 0.48) {
      // 1. Aureo (Coin)
      const coinGroup = new Group();
      const coinMesh = new Mesh(new CylinderGeometry(0.38, 0.38, 0.08, 16), goldMaterial);
      coinMesh.rotation.x = Math.PI / 2;
      const coinRing = new Mesh(new TorusGeometry(0.44, 0.04, 8, 16), hornMaterial);
      coinGroup.add(coinMesh);
      coinGroup.add(coinRing);
      coinGroup.position.set(lane * LANE_SPACING, 0.85, nextSpawnZ);
      scene.add(coinGroup);
      entity = { mesh: coinGroup, type: "coin", lane, z: nextSpawnZ };
    } else if (roll < 0.62) {
      // 2. Liquidity Pool Orb
      const liqGroup = new Group();
      const liqMesh = new Mesh(new SphereGeometry(0.48, 16, 16), emeraldMaterial);
      const liqRing = new Mesh(new TorusGeometry(0.68, 0.03, 8, 24), eyeMaterial);
      liqRing.rotation.x = Math.PI / 2;
      liqGroup.add(liqMesh);
      liqGroup.add(liqRing);
      liqGroup.position.set(lane * LANE_SPACING, 1.0, nextSpawnZ);
      scene.add(liqGroup);
      entity = { mesh: liqGroup, type: "liquidity", lane, z: nextSpawnZ };
    } else if (roll < 0.69) {
      // 3. Power-Up (Shield or Boost)
      const isShield = Math.random() > 0.4;
      const pGroup = new Group();
      if (isShield) {
        const sMesh = new Mesh(new IcosahedronGeometry(0.45, 0), hornMaterial);
        pGroup.add(sMesh);
        pGroup.position.set(lane * LANE_SPACING, 1.0, nextSpawnZ);
        scene.add(pGroup);
        entity = { mesh: pGroup, type: "shield", lane, z: nextSpawnZ };
      } else {
        const bMesh = new Mesh(new OctahedronGeometry(0.45, 0), emeraldMaterial);
        pGroup.add(bMesh);
        pGroup.position.set(lane * LANE_SPACING, 1.0, nextSpawnZ);
        scene.add(pGroup);
        entity = { mesh: pGroup, type: "boost", lane, z: nextSpawnZ };
      }
    } else if (roll < 0.86) {
      // 4. Red Wick Spike
      const spikeGroup = new Group();
      const spike = new Mesh(new ConeGeometry(0.42, 1.1, 6), redMaterial);
      spike.position.y = 0.55;
      spikeGroup.add(spike);
      spikeGroup.position.set(lane * LANE_SPACING, 0, nextSpawnZ);
      scene.add(spikeGroup);
      entity = { mesh: spikeGroup, type: "spike", lane, z: nextSpawnZ };
    } else {
      // 5. Congestion Barrier (Wall)
      const wallGroup = new Group();
      const topBar = new Mesh(new BoxGeometry(LANE_SPACING * 0.92, 0.9, 0.35), redMaterial);
      topBar.position.y = 1.6;
      const postL = new Mesh(new BoxGeometry(0.15, 2.0, 0.15), darkGoldMaterial);
      postL.position.set(-LANE_SPACING * 0.44, 1.0, 0);
      const postR = new Mesh(new BoxGeometry(0.15, 2.0, 0.15), darkGoldMaterial);
      postR.position.set(LANE_SPACING * 0.44, 1.0, 0);
      wallGroup.add(topBar);
      wallGroup.add(postL);
      wallGroup.add(postR);
      wallGroup.position.set(lane * LANE_SPACING, 0, nextSpawnZ);
      scene.add(wallGroup);
      entity = { mesh: wallGroup, type: "wall", lane, z: nextSpawnZ };
    }

    activeEntities.push(entity);
    const minSpacing = 14 - Math.min(6, (speed - INITIAL_SPEED) * 0.25);
    nextSpawnZ -= minSpacing + Math.random() * 8;
  }

  for (let i = 0; i < 7; i++) {
    spawnEntity();
  }

  // Setup Chapter Boss if needed
  function initChapterState() {
    if (currentChapter?.isBossChapter) {
      bossActive = true;
      bossHp = currentChapter.bossMaxHp || 6;
      buildBearTitan();
      callbacks.onBossHpUpdate?.(bossHp, currentChapter.bossMaxHp || 6);
    } else {
      bossActive = false;
      bearTitanGroup.clear();
      scene.remove(bearTitanGroup);
    }
  }
  initChapterState();

  // Input Handlers
  function moveLeft() {
    if (gameState !== "running") return;
    if (currentLane > -1) {
      currentLane = (currentLane - 1) as Lane;
      targetX = currentLane * LANE_SPACING;
      gameAudio.playLaneSwitch();
    }
  }

  function moveRight() {
    if (gameState !== "running") return;
    if (currentLane < 1) {
      currentLane = (currentLane + 1) as Lane;
      targetX = currentLane * LANE_SPACING;
      gameAudio.playLaneSwitch();
    }
  }

  function jump() {
    if (gameState !== "running") return;
    if (!isJumping && posY <= 0.05) {
      isJumping = true;
      velY = JUMP_FORCE;
      gameAudio.playJump();
    }
  }

  function slide() {
    if (gameState !== "running") return;
    if (!isSliding) {
      isSliding = true;
      slideTimer = 0.65;
      gameAudio.playSlide();
    }
  }

  function triggerVictory() {
    gameState = "victory";
    callbacks.onStateChange("victory");
    gameAudio.playVictory();
    triggerBurst(playerGroup.position, 0xe8c56a, 60);
    const reward = currentChapter ? currentChapter.rewardAurei : 150;
    callbacks.onChapterComplete?.(currentChapter?.id || 1, reward);
  }

  function hitObstacle(entity: ActiveEntity) {
    if (hasBoost) {
      triggerBurst(entity.mesh.position, 0x10b981);
      scene.remove(entity.mesh);
      entity.cleared = true;
      score += 150 * multiplier;
      gameAudio.playLiquidity();
      return;
    }

    if (shieldChargesRemaining > 0) {
      shieldChargesRemaining -= 1;
      if (shieldChargesRemaining === 0) {
        shieldMesh.visible = false;
        callbacks.onShieldChange(false, 0);
      } else {
        callbacks.onShieldChange(true, shieldChargesRemaining);
      }
      gameAudio.playShieldAbsorb();
      triggerBurst(playerGroup.position, 0xf3d88c);
      entity.cleared = true;
      scene.remove(entity.mesh);
      return;
    }

    // Fatal Crash
    gameState = "over";
    callbacks.onStateChange("over");
    gameAudio.playCrash();
    triggerBurst(playerGroup.position, 0xef4444);

    callbacks.onGameOver({
      score: Math.floor(score),
      coins: coinsCount,
      distance: Math.floor(distanceMeters),
    });
  }

  // Animation Loop
  function tick(timestamp: number) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    let dt = Math.min((timestamp - lastTimestamp) / 1000, 0.08);
    lastTimestamp = timestamp;

    if (gameState === "running") {
      clockTime += dt;

      // Bullet Time Skill Check
      if (currentSkills.bulletTimeEnabled && bulletTimeCooldown <= 0) {
        const nextObstacle = activeEntities.find(
          (e) => !e.cleared && (e.type === "spike" || e.type === "wall") && e.z > -6.5 && e.z < -2.0,
        );
        if (nextObstacle && Math.abs(nextObstacle.lane - currentLane) === 0) {
          dt *= 0.45; // Slow down time for dramatic reaction
          bulletTimeCooldown = 2.0; // Cooldown after triggering
        }
      }
      if (bulletTimeCooldown > 0) bulletTimeCooldown -= dt;

      distanceMeters += speed * dt;
      speed = Math.min(MAX_SPEED, INITIAL_SPEED + (distanceMeters / 120) * 1.5);
      score += dt * speed * 2 * multiplier;

      // Zen Streak Multiplier
      zenStreakTimer += dt;
      if (zenStreakTimer > 35) multiplier = 5;
      else if (zenStreakTimer > 20) multiplier = 3;
      else if (zenStreakTimer > 10) multiplier = 2;
      else multiplier = 1;

      // Boost handling
      if (hasBoost) {
        boostTimer -= dt;
        if (boostTimer <= 0) {
          hasBoost = false;
          callbacks.onBoostChange(false);
        }
      }

      // Check Chapter Victory condition
      if (currentChapter && !currentChapter.isBossChapter) {
        const distDone = distanceMeters >= currentChapter.targetMeters;
        const coinsDone = !currentChapter.targetAurei || coinsCount >= currentChapter.targetAurei;
        const spikesDone = !currentChapter.targetSpikesAvoided || spikesAvoided >= currentChapter.targetSpikesAvoided;
        if (distDone && coinsDone && spikesDone) {
          triggerVictory();
          return;
        }
      }

      // Smooth horizontal lane transition
      playerGroup.position.x += (targetX - playerGroup.position.x) * Math.min(1, dt * 16);
      playerGroup.rotation.z = (playerGroup.position.x - targetX) * 0.15;

      // Handle Jump physics
      if (isJumping || posY > 0) {
        posY += velY * dt;
        velY += GRAVITY * dt;
        if (posY <= 0) {
          posY = 0;
          velY = 0;
          isJumping = false;
        }
      }

      // Handle Slide physics
      if (isSliding) {
        slideTimer -= dt;
        playerGroup.scale.y = 0.42;
        playerGroup.position.y = posY + 0.2;
        if (slideTimer <= 0) {
          isSliding = false;
          playerGroup.scale.y = 1.0;
        }
      } else {
        playerGroup.position.y = posY;
      }

      // Gallop cycle
      const runCycle = clockTime * (speed * 0.7);
      flLeg.rotation.x = Math.sin(runCycle) * 0.45;
      brLeg.rotation.x = Math.sin(runCycle) * 0.45;
      frLeg.rotation.x = Math.sin(runCycle + Math.PI) * 0.45;
      blLeg.rotation.x = Math.sin(runCycle + Math.PI) * 0.45;
      bodyMesh.rotation.x = Math.sin(runCycle * 2) * 0.04;
      headMesh.rotation.x = Math.sin(runCycle * 2) * 0.06;

      if (shieldChargesRemaining > 0) {
        shieldMesh.rotation.y += dt * 3;
        shieldMesh.rotation.x += dt * 2;
      }

      // Bear Titan Boss Logic & Animation
      if (bossActive && bearTitanGroup) {
        bossActionTimer += dt;
        // Float and sway menacingly
        bearTitanGroup.position.x = Math.sin(bossActionTimer * 1.5) * (LANE_SPACING * 0.8);
        bearTitanGroup.position.y = Math.sin(bossActionTimer * 3.0) * 0.35;
        bearTitanGroup.rotation.y = Math.sin(bossActionTimer * 1.5) * 0.15;

        // Boss periodic roar / ground slam
        if (bossActionTimer > 5.0) {
          bossActionTimer = 0;
          gameAudio.playCrash();
          triggerBurst(bearTitanGroup.position, 0xef4444, 20);
        }
      }

      // Move Track scenery
      const deltaZ = speed * dt;
      roadMesh.position.z += deltaZ;
      if (roadMesh.position.z > -40) {
        roadMesh.position.z -= 60;
      }

      sceneryCandles.forEach((c) => {
        c.position.z += deltaZ;
        if (c.position.z > 20) {
          c.position.z -= 200;
        }
      });

      // Move and check Active Entities
      for (let i = activeEntities.length - 1; i >= 0; i--) {
        const ent = activeEntities[i];
        ent.z += deltaZ;
        ent.mesh.position.z = ent.z;

        if (ent.type === "coin" || ent.type === "shield" || ent.type === "boost" || ent.type === "breakout_orb") {
          ent.mesh.rotation.y += dt * 4;
        } else if (ent.type === "liquidity") {
          ent.mesh.rotation.y += dt * 3;
          ent.mesh.rotation.z += dt * 2;
        }

        // Magnetism Skill & Boost attraction
        const hasMagnetism = currentSkills.magnetismLevel > 0 || hasBoost;
        if (hasMagnetism && (ent.type === "coin" || ent.type === "liquidity") && ent.z < 14 && ent.z > -16) {
          const laneDiff = Math.abs(ent.lane - currentLane);
          const allowedLanes = currentSkills.magnetismLevel >= 2 || hasBoost ? 2 : 1;
          if (laneDiff <= allowedLanes) {
            ent.mesh.position.x += (playerGroup.position.x - ent.mesh.position.x) * dt * (8 + currentSkills.magnetismLevel * 3);
          }
        }

        // Collision Check with Player
        const zDist = Math.abs(ent.z);
        const xDist = Math.abs(ent.mesh.position.x - playerGroup.position.x);

        if (!ent.cleared && zDist < 0.95 && xDist < 0.85) {
          if (ent.type === "coin") {
            ent.cleared = true;
            coinsCount += 1;
            score += 10 * multiplier;
            gameAudio.playCoin();
            triggerBurst(ent.mesh.position, 0xc5a059);
            scene.remove(ent.mesh);
            activeEntities.splice(i, 1);
            continue;
          } else if (ent.type === "liquidity") {
            ent.cleared = true;
            coinsCount += 5;
            score += 50 * multiplier;
            gameAudio.playLiquidity();
            triggerBurst(ent.mesh.position, 0x10b981);
            scene.remove(ent.mesh);
            activeEntities.splice(i, 1);
            continue;
          } else if (ent.type === "shield") {
            ent.cleared = true;
            shieldChargesRemaining = currentSkills.shieldCharges;
            shieldMesh.visible = true;
            callbacks.onShieldChange(true, shieldChargesRemaining);
            gameAudio.playPowerup();
            triggerBurst(ent.mesh.position, 0xf3d88c);
            scene.remove(ent.mesh);
            activeEntities.splice(i, 1);
            continue;
          } else if (ent.type === "boost") {
            ent.cleared = true;
            hasBoost = true;
            boostTimer = 4.5;
            callbacks.onBoostChange(true);
            gameAudio.playPowerup();
            triggerBurst(ent.mesh.position, 0x10b981);
            scene.remove(ent.mesh);
            activeEntities.splice(i, 1);
            continue;
          } else if (ent.type === "breakout_orb") {
            // Hit Bear Titan with Breakout Orb!
            ent.cleared = true;
            scene.remove(ent.mesh);
            activeEntities.splice(i, 1);
            triggerBurst(ent.mesh.position, 0x06b6d4, 30);
            gameAudio.playBossHit();

            if (bossActive) {
              bossHp -= 1;
              callbacks.onBossHpUpdate?.(bossHp, bossMaxHp);
              triggerBurst(bearTitanGroup.position, 0xef4444, 45);

              if (bossHp <= 0) {
                bossActive = false;
                scene.remove(bearTitanGroup);
                triggerVictory();
                return;
              }
            }
            continue;
          } else if (ent.type === "spike") {
            if (posY > 0.75) {
              // Jumped safely over spike
              spikesAvoided += 1;
            } else {
              hitObstacle(ent);
            }
          } else if (ent.type === "wall") {
            if (isSliding) {
              // Slid safely under barrier
            } else {
              hitObstacle(ent);
            }
          }
        }

        if (ent.z > 14) {
          scene.remove(ent.mesh);
          activeEntities.splice(i, 1);
        }
      }

      nextSpawnZ += deltaZ;
      if (nextSpawnZ > -70) {
        spawnEntity();
      }

      callbacks.onScoreUpdate({
        score: Math.floor(score),
        multiplier,
        coins: coinsCount,
        distance: Math.floor(distanceMeters),
        spikesAvoided,
      });
    }

    // Update Particles
    let activeParticles = 0;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (particleVelocities[i].life > 0) {
        particleVelocities[i].life -= dt;
        particlePositions[i * 3] += particleVelocities[i].x * dt;
        particlePositions[i * 3 + 1] += particleVelocities[i].y * dt;
        particlePositions[i * 3 + 2] += particleVelocities[i].z * dt;
        particleVelocities[i].y += GRAVITY * 0.25 * dt;
        activeParticles++;
      } else {
        particlePositions[i * 3 + 1] = -100;
      }
    }
    if (activeParticles > 0) {
      particleGeo.attributes.position.needsUpdate = true;
    }

    camera.position.x += (playerGroup.position.x * 0.35 - camera.position.x) * 0.1;
    renderer.render(scene, camera);

    animFrameId = requestAnimationFrame(tick);
  }

  animFrameId = requestAnimationFrame(tick);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.repeat) return;
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      moveLeft();
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      moveRight();
    } else if (e.key === "ArrowUp" || e.key === "w" || e.key === "W" || e.key === " ") {
      e.preventDefault();
      jump();
    } else if (e.key === "ArrowDown" || e.key === "s" || e.key === "S") {
      e.preventDefault();
      slide();
    } else if (e.key === "p" || e.key === "P" || e.key === "Escape") {
      if (gameState === "running") pause();
      else if (gameState === "paused") resume();
    }
  }
  window.addEventListener("keydown", handleKeyDown);

  function handleResize() {
    if (!container || !renderer) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener("resize", handleResize);

  function handleVisibilityChange() {
    if (document.hidden && gameState === "running") {
      pause();
    }
  }
  document.addEventListener("visibilitychange", handleVisibilityChange);

  function start() {
    gameState = "running";
    callbacks.onStateChange("running");
  }

  function pause() {
    if (gameState === "running") {
      gameState = "paused";
      callbacks.onStateChange("paused");
    }
  }

  function resume() {
    if (gameState === "paused") {
      gameState = "running";
      lastTimestamp = performance.now();
      callbacks.onStateChange("running");
    }
  }

  function restart() {
    activeEntities.forEach((ent) => scene.remove(ent.mesh));
    activeEntities.length = 0;

    currentLane = 0;
    targetX = 0;
    posY = 0;
    velY = 0;
    isJumping = false;
    isSliding = false;
    playerGroup.position.set(0, 0, 0);
    playerGroup.scale.set(1, 1, 1);

    speed = INITIAL_SPEED;
    score = 0;
    distanceMeters = 0;
    coinsCount = 0;
    spikesAvoided = 0;
    multiplier = 1;
    zenStreakTimer = 0;

    shieldChargesRemaining = currentSkills.shieldCharges;
    hasBoost = false;
    boostTimer = 0;
    shieldMesh.visible = false;
    callbacks.onShieldChange(false, 0);
    callbacks.onBoostChange(false);

    initChapterState();

    nextSpawnZ = -20;
    for (let i = 0; i < 7; i++) {
      spawnEntity();
    }

    gameState = "running";
    callbacks.onStateChange("running");
    lastTimestamp = performance.now();
  }

  function setChapter(chapter: CampaignChapter) {
    currentChapter = chapter;
    restart();
  }

  function setSkills(skills: BullRunnerSkills) {
    currentSkills = skills;
    shieldChargesRemaining = skills.shieldCharges;
    applySkin(skills.activeSkin);
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    activeEntities.forEach((ent) => scene.remove(ent.mesh));
    roadGroup.children.forEach((c) => scene.remove(c));
    sceneryCandles.forEach((c) => scene.remove(c));
    scene.remove(playerGroup);
    scene.remove(bearTitanGroup);
    scene.remove(particleSystem);

    renderer.dispose();
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }

  return {
    start,
    pause,
    resume,
    restart,
    setChapter,
    setSkills,
    moveLeft,
    moveRight,
    jump,
    slide,
    dispose,
  };
}
