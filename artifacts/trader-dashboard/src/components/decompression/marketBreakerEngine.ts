import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
} from "three";
import { gameAudio } from "./gameAudioSynthesizer";

export interface MarketBreakerCallbacks {
  onScoreUpdate: (data: { score: number; bricksLeft: number; lives: number; level: number; aurei: number }) => void;
  onLevelClear: (level: number, aureiEarned: number) => void;
  onGameOver: (data: { score: number; aurei: number }) => void;
  onStateChange: (state: "ready" | "running" | "paused" | "over" | "victory") => void;
}

export interface MarketBreakerController {
  start: () => void;
  pause: () => void;
  resume: () => void;
  restart: () => void;
  setLevel: (levelIndex: number) => void;
  setPaddleX: (normalizedX: number) => void; // -1 to +1
  movePaddle: (delta: number) => void;
  fireLasers: () => void;
  dispose: () => void;
}

export type BrickType = "ask_red" | "armored_ask" | "bid_green" | "gold_core" | "black_swan";

interface Brick3D {
  mesh: Mesh;
  type: BrickType;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
}

interface Orb3D {
  mesh: Mesh;
  light: PointLight;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

interface PowerUp3D {
  mesh: Group;
  type: "multi_orb" | "wide_paddle" | "laser" | "squeeze" | "coin";
  x: number;
  y: number;
  vy: number;
}

interface Laser3D {
  mesh: Mesh;
  x: number;
  y: number;
  vy: number;
}

const ARENA_WIDTH = 14;
const ARENA_HEIGHT = 18;
const PADDLE_Y = -7.5;
const BASE_PADDLE_WIDTH = 3.2;

export function createMarketBreakerEngine(
  container: HTMLDivElement,
  callbacks: MarketBreakerCallbacks,
  initialLevel = 1,
): MarketBreakerController | null {
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
  scene.fog = new FogExp2(0x07080b, 0.018);

  const camera = new PerspectiveCamera(52, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, -6.5, 17.5);
  camera.lookAt(0, 0.8, 0);

  // Lighting
  const ambientLight = new AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const goldKeyLight = new DirectionalLight(0xc5a059, 1.8);
  goldKeyLight.position.set(5, 10, 15);
  scene.add(goldKeyLight);

  // Materials Cache
  const goldMaterial = new MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.85,
    roughness: 0.25,
  });
  const darkGoldMaterial = new MeshStandardMaterial({
    color: 0x7c6128,
    metalness: 0.9,
    roughness: 0.35,
  });
  const redAskMaterial = new MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.6,
    roughness: 0.25,
    emissive: 0x4a1010,
  });
  const armoredAskMaterial = new MeshStandardMaterial({
    color: 0x991b1b,
    metalness: 0.8,
    roughness: 0.2,
    emissive: 0x300505,
  });
  const greenBidMaterial = new MeshStandardMaterial({
    color: 0x10b981,
    metalness: 0.4,
    roughness: 0.25,
    emissive: 0x064e3b,
  });
  const goldCoreMaterial = new MeshStandardMaterial({
    color: 0xe8c56a,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0x5a420b,
  });
  const blackSwanMaterial = new MeshStandardMaterial({
    color: 0xa855f7,
    metalness: 0.7,
    roughness: 0.2,
    emissive: 0x3b0764,
  });
  const borderMaterial = new MeshStandardMaterial({
    color: 0x1e2433,
    metalness: 0.9,
    roughness: 0.4,
  });

  // Arena Borders & Backdrop Grid
  const arenaGroup = new Group();
  const floorGeo = new PlaneGeometry(ARENA_WIDTH + 1, ARENA_HEIGHT + 1);
  const floorMat = new MeshStandardMaterial({ color: 0x090a10, roughness: 0.9 });
  const floorMesh = new Mesh(floorGeo, floorMat);
  floorMesh.position.z = -0.5;
  arenaGroup.add(floorMesh);

  // Left & Right Wall Borders
  [-ARENA_WIDTH / 2 - 0.3, ARENA_WIDTH / 2 + 0.3].forEach((xPos) => {
    const wallGeo = new BoxGeometry(0.5, ARENA_HEIGHT + 1, 1.2);
    const wallMesh = new Mesh(wallGeo, borderMaterial);
    wallMesh.position.set(xPos, 0, 0);
    arenaGroup.add(wallMesh);
  });

  // Top Ceiling Border
  const ceilingGeo = new BoxGeometry(ARENA_WIDTH + 1.2, 0.5, 1.2);
  const ceilingMesh = new Mesh(ceilingGeo, borderMaterial);
  ceilingMesh.position.set(0, ARENA_HEIGHT / 2 + 0.3, 0);
  arenaGroup.add(ceilingMesh);

  scene.add(arenaGroup);

  // Particle System
  const PARTICLE_COUNT = 150;
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
    size: 0.22,
    transparent: true,
    opacity: 0.9,
  });
  const particleSystem = new Points(particleGeo, particleMat);
  scene.add(particleSystem);

  function triggerBurst(pos: { x: number; y: number; z: number }, colorHex = 0xc5a059, count = 20) {
    particleMat.color.setHex(colorHex);
    let spawned = 0;
    for (let i = 0; i < PARTICLE_COUNT && spawned < count; i++) {
      if (particleVelocities[i].life <= 0) {
        particlePositions[i * 3] = pos.x;
        particlePositions[i * 3 + 1] = pos.y;
        particlePositions[i * 3 + 2] = pos.z;
        particleVelocities[i] = {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 0.5) * 10,
          z: Math.random() * 4,
          life: 0.6 + Math.random() * 0.4,
        };
        spawned++;
      }
    }
    particleGeo.attributes.position.needsUpdate = true;
  }

  // 3D Paddle Assembly ("Il Sestante Istituzionale")
  const paddleGroup = new Group();
  let currentPaddleWidth = BASE_PADDLE_WIDTH;

  const paddleChassis = new Mesh(new BoxGeometry(BASE_PADDLE_WIDTH, 0.45, 0.7), goldMaterial);
  paddleGroup.add(paddleChassis);

  const paddleCore = new Mesh(new BoxGeometry(0.8, 0.55, 0.8), darkGoldMaterial);
  paddleGroup.add(paddleCore);

  const paddleGlow = new PointLight(0xc5a059, 1.2, 5);
  paddleGlow.position.set(0, 0.2, 0.5);
  paddleGroup.add(paddleGlow);

  paddleGroup.position.set(0, PADDLE_Y, 0);
  scene.add(paddleGroup);

  // Entities state
  let bricks: Brick3D[] = [];
  let orbs: Orb3D[] = [];
  let powerUps: PowerUp3D[] = [];
  let lasers: Laser3D[] = [];

  // Game state
  let gameState: "ready" | "running" | "paused" | "over" | "victory" = "ready";
  let currentLevel = initialLevel;
  let score = 0;
  let lives = 3;
  let aureiCollected = 0;
  let widePaddleTimer = 0;
  let laserTimer = 0;
  let squeezeTimer = 0;

  let animFrameId = 0;
  let lastTimestamp = 0;

  // Level Generator
  function buildLevel(levelIdx: number) {
    // Clear existing
    bricks.forEach((b) => scene.remove(b.mesh));
    bricks = [];
    powerUps.forEach((p) => scene.remove(p.mesh));
    powerUps = [];
    lasers.forEach((l) => scene.remove(l.mesh));
    lasers = [];
    orbs.forEach((o) => {
      scene.remove(o.mesh);
      scene.remove(o.light);
    });
    orbs = [];

    const rows = 4 + Math.min(3, levelIdx);
    const cols = 7;
    const brickW = 1.6;
    const brickH = 0.65;
    const startY = ARENA_HEIGHT / 2 - 2.0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = (c - (cols - 1) / 2) * (brickW + 0.2);
        const y = startY - r * (brickH + 0.25);

        let type: BrickType = "ask_red";
        let hp = 1;

        if (r === 0 && levelIdx >= 2) {
          type = "armored_ask";
          hp = 2;
        } else if (r === rows - 1) {
          type = "bid_green";
        } else if (c === 0 || c === cols - 1) {
          type = "gold_core";
        } else if (levelIdx >= 3 && Math.random() < 0.15) {
          type = "black_swan";
        }

        let mat = redAskMaterial;
        if (type === "armored_ask") mat = armoredAskMaterial;
        else if (type === "bid_green") mat = greenBidMaterial;
        else if (type === "gold_core") mat = goldCoreMaterial;
        else if (type === "black_swan") mat = blackSwanMaterial;

        const mesh = new Mesh(new BoxGeometry(brickW, brickH, 0.5), mat);
        mesh.position.set(x, y, 0);
        scene.add(mesh);

        bricks.push({ mesh, type, x, y, hp, maxHp: hp });
      }
    }

    // Spawn Initial Orb
    spawnOrb(0, PADDLE_Y + 0.8, 6.0, 9.0);
  }

  function spawnOrb(x: number, y: number, vx: number, vy: number) {
    const orbMesh = new Mesh(
      new SphereGeometry(0.32, 16, 16),
      new MeshStandardMaterial({ color: 0xe8c56a, metalness: 0.9, roughness: 0.1, emissive: 0x7c6128 }),
    );
    orbMesh.position.set(x, y, 0);

    const light = new PointLight(0xe8c56a, 1.5, 4);
    light.position.set(x, y, 0.4);

    scene.add(orbMesh);
    scene.add(light);

    orbs.push({ mesh: orbMesh, light, x, y, vx, vy, radius: 0.32 });
  }

  function spawnPowerUp(x: number, y: number) {
    const types: PowerUp3D["type"][] = ["multi_orb", "wide_paddle", "laser", "squeeze", "coin"];
    const type = types[Math.floor(Math.random() * types.length)];

    const pGroup = new Group();
    const pMesh = new Mesh(
      new CylinderGeometry(0.3, 0.3, 0.2, 8),
      type === "coin" ? goldMaterial : type === "laser" ? redAskMaterial : greenBidMaterial,
    );
    pMesh.rotation.x = Math.PI / 2;
    pGroup.add(pMesh);
    pGroup.position.set(x, y, 0);
    scene.add(pGroup);

    powerUps.push({ mesh: pGroup, type, x, y, vy: -3.5 });
  }

  function destroyBrick(bIdx: number) {
    const b = bricks[bIdx];
    if (!b) return;

    triggerBurst(b.mesh.position, b.type === "bid_green" ? 0x10b981 : 0xc5a059, 18);
    scene.remove(b.mesh);
    bricks.splice(bIdx, 1);

    score += b.type === "armored_ask" ? 50 : 25;

    // Drop power-up or Aurei
    if (b.type === "gold_core" || Math.random() < 0.2) {
      spawnPowerUp(b.x, b.y);
    } else if (b.type === "bid_green") {
      aureiCollected += 5;
      gameAudio.playCoin();
    }

    // Black swan explosion (blows up nearby bricks)
    if (b.type === "black_swan") {
      gameAudio.playExplosion();
      triggerBurst(b.mesh.position, 0xa855f7, 35);
      for (let j = bricks.length - 1; j >= 0; j--) {
        const other = bricks[j];
        const dist = Math.hypot(other.x - b.x, other.y - b.y);
        if (dist < 2.5) {
          destroyBrick(j);
        }
      }
    }

    // Check Level Clear
    if (bricks.length === 0) {
      gameAudio.playVictory();
      gameState = "victory";
      callbacks.onStateChange("victory");
      const bonus = 100 * currentLevel;
      aureiCollected += bonus;
      callbacks.onLevelClear(currentLevel, bonus);
    }
  }

  function fireLasers() {
    if (laserTimer <= 0) return;
    gameAudio.playLaser();
    [-currentPaddleWidth * 0.35, currentPaddleWidth * 0.35].forEach((xOff) => {
      const lMesh = new Mesh(
        new BoxGeometry(0.12, 0.7, 0.2),
        new MeshBasicMaterial({ color: 0xef4444 }),
      );
      lMesh.position.set(paddleGroup.position.x + xOff, PADDLE_Y + 0.6, 0);
      scene.add(lMesh);
      lasers.push({ mesh: lMesh, x: paddleGroup.position.x + xOff, y: PADDLE_Y + 0.6, vy: 16 });
    });
  }

  // Animation Loop
  function tick(timestamp: number) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    const dt = Math.min((timestamp - lastTimestamp) / 1000, 0.06);
    lastTimestamp = timestamp;

    if (gameState === "running") {
      // PowerUp timers
      if (widePaddleTimer > 0) {
        widePaddleTimer -= dt;
        currentPaddleWidth = BASE_PADDLE_WIDTH * 1.5;
        paddleChassis.scale.x = 1.5;
      } else {
        currentPaddleWidth = BASE_PADDLE_WIDTH;
        paddleChassis.scale.x = 1.0;
      }

      if (laserTimer > 0) laserTimer -= dt;
      if (squeezeTimer > 0) squeezeTimer -= dt;

      const speedFactor = squeezeTimer > 0 ? 0.65 : 1.0;

      // Update Orbs
      for (let i = orbs.length - 1; i >= 0; i--) {
        const o = orbs[i];
        o.x += o.vx * speedFactor * dt;
        o.y += o.vy * speedFactor * dt;

        // Wall collisions
        if (o.x < -ARENA_WIDTH / 2 + o.radius) {
          o.x = -ARENA_WIDTH / 2 + o.radius;
          o.vx = Math.abs(o.vx);
          gameAudio.playBrickHit(false);
        } else if (o.x > ARENA_WIDTH / 2 - o.radius) {
          o.x = ARENA_WIDTH / 2 - o.radius;
          o.vx = -Math.abs(o.vx);
          gameAudio.playBrickHit(false);
        }

        // Ceiling collision
        if (o.y > ARENA_HEIGHT / 2 - o.radius) {
          o.y = ARENA_HEIGHT / 2 - o.radius;
          o.vy = -Math.abs(o.vy);
          gameAudio.playBrickHit(false);
        }

        // Paddle Collision
        const pX = paddleGroup.position.x;
        const pHalfW = currentPaddleWidth / 2;
        if (
          o.y - o.radius <= PADDLE_Y + 0.25 &&
          o.y + o.radius >= PADDLE_Y - 0.25 &&
          o.x >= pX - pHalfW &&
          o.x <= pX + pHalfW &&
          o.vy < 0
        ) {
          o.y = PADDLE_Y + 0.25 + o.radius;
          // Hit angle calculation
          const offset = (o.x - pX) / pHalfW; // -1 to +1
          const speed = Math.hypot(o.vx, o.vy);
          const bounceAngle = offset * (Math.PI / 3); // max 60 deg
          o.vx = speed * Math.sin(bounceAngle);
          o.vy = speed * Math.cos(bounceAngle);
          gameAudio.playShieldAbsorb();
          triggerBurst(paddleGroup.position, 0xc5a059, 10);
        }

        // Brick Collisions
        for (let bIdx = bricks.length - 1; bIdx >= 0; bIdx--) {
          const b = bricks[bIdx];
          const halfBW = 0.8;
          const halfBH = 0.32;

          if (
            o.x + o.radius >= b.x - halfBW &&
            o.x - o.radius <= b.x + halfBW &&
            o.y + o.radius >= b.y - halfBH &&
            o.y - o.radius <= b.y + halfBH
          ) {
            // Hit brick!
            b.hp -= 1;
            gameAudio.playBrickHit(b.hp > 0);

            // Rebound direction
            const dx = o.x - b.x;
            const dy = o.y - b.y;
            if (Math.abs(dx) > Math.abs(dy)) {
              o.vx = -o.vx;
            } else {
              o.vy = -o.vy;
            }

            if (b.hp <= 0) {
              destroyBrick(bIdx);
            }
            break;
          }
        }

        // Bottom Fall / Loss
        if (o.y < PADDLE_Y - 1.5) {
          scene.remove(o.mesh);
          scene.remove(o.light);
          orbs.splice(i, 1);

          if (orbs.length === 0) {
            lives -= 1;
            gameAudio.playCrash();
            if (lives <= 0) {
              gameState = "over";
              callbacks.onStateChange("over");
              callbacks.onGameOver({ score, aurei: aureiCollected });
            } else {
              // Re-serve orb
              spawnOrb(paddleGroup.position.x, PADDLE_Y + 0.8, 5.0, 8.5);
            }
          }
          continue;
        }

        // Sync 3D mesh & light
        o.mesh.position.set(o.x, o.y, 0);
        o.light.position.set(o.x, o.y, 0.4);
      }

      // Update PowerUps
      for (let i = powerUps.length - 1; i >= 0; i--) {
        const p = powerUps[i];
        p.y += p.vy * dt;
        p.mesh.position.y = p.y;
        p.mesh.rotation.y += dt * 3;

        // Paddle Catch
        const pX = paddleGroup.position.x;
        if (Math.abs(p.y - PADDLE_Y) < 0.45 && Math.abs(p.x - pX) < currentPaddleWidth / 2) {
          scene.remove(p.mesh);
          powerUps.splice(i, 1);
          gameAudio.playPowerup();

          if (p.type === "multi_orb") {
            const first = orbs[0];
            if (first) {
              spawnOrb(first.x, first.y, -first.vx, first.vy);
            }
          } else if (p.type === "wide_paddle") {
            widePaddleTimer = 15;
          } else if (p.type === "laser") {
            laserTimer = 12;
          } else if (p.type === "squeeze") {
            squeezeTimer = 10;
          } else if (p.type === "coin") {
            aureiCollected += 20;
          }
          continue;
        }

        if (p.y < PADDLE_Y - 2) {
          scene.remove(p.mesh);
          powerUps.splice(i, 1);
        }
      }

      // Update Lasers
      for (let i = lasers.length - 1; i >= 0; i--) {
        const l = lasers[i];
        l.y += l.vy * dt;
        l.mesh.position.y = l.y;

        // Brick collision with laser
        for (let bIdx = bricks.length - 1; bIdx >= 0; bIdx--) {
          const b = bricks[bIdx];
          if (Math.abs(l.x - b.x) < 0.8 && Math.abs(l.y - b.y) < 0.35) {
            scene.remove(l.mesh);
            lasers.splice(i, 1);
            b.hp -= 1;
            gameAudio.playBrickHit(b.hp > 0);
            if (b.hp <= 0) destroyBrick(bIdx);
            break;
          }
        }

        if (l.y > ARENA_HEIGHT / 2) {
          scene.remove(l.mesh);
          lasers.splice(i, 1);
        }
      }

      callbacks.onScoreUpdate({
        score,
        bricksLeft: bricks.length,
        lives,
        level: currentLevel,
        aurei: aureiCollected,
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
        activeParticles++;
      } else {
        particlePositions[i * 3 + 1] = -100;
      }
    }
    if (activeParticles > 0) {
      particleGeo.attributes.position.needsUpdate = true;
    }

    renderer.render(scene, camera);
    animFrameId = requestAnimationFrame(tick);
  }

  animFrameId = requestAnimationFrame(tick);

  // Mouse & Touch tracking for Paddle
  function handlePointerMove(e: PointerEvent) {
    if (gameState !== "running") return;
    const rect = canvas.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width; // 0 to 1
    const normX = (relX - 0.5) * 2; // -1 to +1
    setPaddleX(normX);
  }
  canvas.addEventListener("pointermove", handlePointerMove);

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") {
      movePaddle(-0.8);
    } else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") {
      movePaddle(0.8);
    } else if (e.key === " " || e.key === "w" || e.key === "W") {
      fireLasers();
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

  function setPaddleX(normX: number) {
    const maxX = ARENA_WIDTH / 2 - currentPaddleWidth / 2;
    paddleGroup.position.x = Math.max(-maxX, Math.min(maxX, normX * maxX));
  }

  function movePaddle(delta: number) {
    const maxX = ARENA_WIDTH / 2 - currentPaddleWidth / 2;
    paddleGroup.position.x = Math.max(-maxX, Math.min(maxX, paddleGroup.position.x + delta));
  }

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
    lives = 3;
    score = 0;
    aureiCollected = 0;
    widePaddleTimer = 0;
    laserTimer = 0;
    squeezeTimer = 0;
    buildLevel(currentLevel);
    gameState = "running";
    callbacks.onStateChange("running");
    lastTimestamp = performance.now();
  }

  function setLevel(lvl: number) {
    currentLevel = lvl;
    restart();
  }

  function dispose() {
    cancelAnimationFrame(animFrameId);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("pointermove", handlePointerMove);

    bricks.forEach((b) => scene.remove(b.mesh));
    orbs.forEach((o) => {
      scene.remove(o.mesh);
      scene.remove(o.light);
    });
    powerUps.forEach((p) => scene.remove(p.mesh));
    lasers.forEach((l) => scene.remove(l.mesh));

    scene.remove(paddleGroup);
    scene.remove(arenaGroup);
    scene.remove(particleSystem);

    renderer.dispose();
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }
  }

  // Initialize Level Bricks
  buildLevel(initialLevel);

  return {
    start,
    pause,
    resume,
    restart,
    setLevel,
    setPaddleX,
    movePaddle,
    fireLasers,
    dispose,
  };
}
