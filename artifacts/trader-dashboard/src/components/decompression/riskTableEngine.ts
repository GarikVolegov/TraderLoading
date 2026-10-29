/**
 * LIMEN PROTOCOL — Il Banco del Rischio (Trans-Limen Roguelite Poker 3D)
 * Native Three.js 3D Engine: Aristocratic Obsidian & Gold Table, Procedural 3D Cards,
 * Interactive Raycast Selection, Particle FX, and Dynamic Scoring Animations.
 */

import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
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
  Raycaster,
  RingGeometry,
  Scene,
  SpotLight,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { MarketCard, MarketSuit } from "./riskTableTypes";
import { SUIT_INFO, getRankLabel } from "./riskTableData";
import { gameAudio } from "./gameAudioSynthesizer";

export interface RiskTableCallbacks {
  onCardToggleSelect: (cardId: string) => void;
  onAnimationFinished?: () => void;
}

export interface RiskTableController {
  setHand: (cards: MarketCard[], selectedIds: string[]) => void;
  setSelectedCards: (selectedIds: string[]) => void;
  playHandAnimation: (cards: MarketCard[], onComplete: () => void) => void;
  playFoldAnimation: (onComplete: () => void) => void;
  triggerSqueezeBurst: () => void;
  triggerVictoryFanfare: () => void;
  dispose: () => void;
}

interface Card3DObject {
  group: Group;
  mesh: Mesh;
  card: MarketCard;
  targetPos: Vector3;
  targetRot: Vector3;
  isSelected: boolean;
  isHovered: boolean;
  baseY: number;
}

export function initRiskTableEngine(
  container: HTMLDivElement,
  callbacks: RiskTableCallbacks
): RiskTableController {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 500;

  // Scene & Fog
  const scene = new Scene();
  scene.background = new Color(0x06070a);
  scene.fog = new FogExp2(0x06070a, 0.04);

  // Camera
  const camera = new PerspectiveCamera(42, width / height, 0.1, 100);
  camera.position.set(0, 5.8, 6.2);
  camera.lookAt(0, 0, 0.2);

  // Renderer
  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // -----------------------------------------------------------
  // LIGHTING & AMBIENCE
  // -----------------------------------------------------------
  const ambientLight = new AmbientLight(0xd4af37, 0.45);
  scene.add(ambientLight);

  const overheadSpot = new SpotLight(0xfff6dc, 2.6, 18, Math.PI / 3.5, 0.35, 1.2);
  overheadSpot.position.set(0, 8.5, 2);
  overheadSpot.target.position.set(0, 0, 0);
  scene.add(overheadSpot);
  scene.add(overheadSpot.target);

  const goldRimLight = new PointLight(0xc5a059, 1.8, 12);
  goldRimLight.position.set(-4.5, 2.5, 2.5);
  scene.add(goldRimLight);

  const emeraldRimLight = new PointLight(0x10b981, 1.4, 12);
  emeraldRimLight.position.set(4.5, 2.5, 2.5);
  scene.add(emeraldRimLight);

  const squeezeLight = new PointLight(0xef4444, 0, 10);
  squeezeLight.position.set(0, 4, 1);
  scene.add(squeezeLight);

  // -----------------------------------------------------------
  // 3D CASINO TABLE MESHES
  // -----------------------------------------------------------
  const tableGroup = new Group();

  // Dark obsidian-green felt top
  const feltGeo = new CylinderGeometry(4.8, 4.8, 0.3, 64);
  const feltMat = new MeshStandardMaterial({
    color: 0x090d0b,
    roughness: 0.85,
    metalness: 0.1,
  });
  const feltMesh = new Mesh(feltGeo, feltMat);
  feltMesh.position.y = -0.15;
  feltMesh.scale.set(1.4, 1, 0.9); // Semi-oval / broad shape
  tableGroup.add(feltMesh);

  // Table Rim in 24k Imperial Aureus & Mahogany
  const rimGeo = new TorusGeometry(5.2, 0.22, 16, 64);
  const rimMat = new MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.85,
    roughness: 0.3,
  });
  const rimMesh = new Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.y = -0.05;
  rimMesh.scale.set(1.3, 0.85, 1);
  tableGroup.add(rimMesh);

  // Decorative Central Inlay / Watermark Ring
  const inlayGeo = new RingGeometry(1.6, 1.66, 64);
  const inlayMat = new MeshBasicMaterial({
    color: 0xc5a059,
    side: DoubleSide,
    transparent: true,
    opacity: 0.22,
  });
  const inlayMesh = new Mesh(inlayGeo, inlayMat);
  inlayMesh.rotation.x = -Math.PI / 2;
  inlayMesh.position.y = 0.005;
  tableGroup.add(inlayMesh);

  // 3D Stacks of Aurei Chips on the Table Corners
  function createChipStack(x: number, z: number, count: number, colorHex: number) {
    const stack = new Group();
    const chipGeo = new CylinderGeometry(0.24, 0.24, 0.045, 24);
    const chipMat = new MeshStandardMaterial({
      color: colorHex,
      metalness: 0.8,
      roughness: 0.3,
    });
    for (let i = 0; i < count; i++) {
      const chip = new Mesh(chipGeo, chipMat);
      chip.position.set(0, i * 0.05, 0);
      stack.add(chip);
    }
    stack.position.set(x, 0.01, z);
    return stack;
  }

  tableGroup.add(createChipStack(-3.4, -0.6, 8, 0xc5a059)); // Gold chips
  tableGroup.add(createChipStack(-3.1, -1.0, 5, 0x10b981)); // Emerald chips
  tableGroup.add(createChipStack(3.4, -0.6, 6, 0xc5a059));  // Gold chips right
  tableGroup.add(createChipStack(3.1, -1.0, 4, 0x38bdf8));  // Sapphire chips right

  scene.add(tableGroup);

  // -----------------------------------------------------------
  // FLOATING PARTICLES (GOLDEN DUST)
  // -----------------------------------------------------------
  const particleCount = 120;
  const particleGeo = new BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePos[i] = (Math.random() - 0.5) * 12;
    particlePos[i + 1] = Math.random() * 5 + 0.2;
    particlePos[i + 2] = (Math.random() - 0.5) * 10;
  }
  particleGeo.setAttribute("position", new Float32BufferAttribute(particlePos, 3));
  const particleMat = new PointsMaterial({
    color: 0xe8c56a,
    size: 0.045,
    transparent: true,
    opacity: 0.45,
  });
  const particleMesh = new Points(particleGeo, particleMat);
  scene.add(particleMesh);

  // -----------------------------------------------------------
  // PROCEDURAL 3D CARD TEXTURE GENERATOR
  // -----------------------------------------------------------
  const cardTextureCache = new Map<string, CanvasTexture>();

  function getCardFrontTexture(card: MarketCard): CanvasTexture {
    const key = `${card.suit}_${card.rank}_${card.foil || "none"}`;
    if (cardTextureCache.has(key)) {
      return cardTextureCache.get(key)!;
    }

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      const dummy = new CanvasTexture(canvas);
      return dummy;
    }

    const suit = SUIT_INFO[card.suit];
    const rankLabel = getRankLabel(card.rank);

    // Card background: deep obsidian gradient with subtle satin
    const bgGrad = ctx.createLinearGradient(0, 0, 0, 384);
    bgGrad.addColorStop(0, "#0e1118");
    bgGrad.addColorStop(0.5, "#08090d");
    bgGrad.addColorStop(1, "#050608");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 256, 384);

    // Inner glowing border in suit color
    ctx.lineWidth = 6;
    ctx.strokeStyle = suit.hex;
    ctx.strokeRect(8, 8, 240, 368);

    // Thin luxury gold fillet
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(197, 160, 89, 0.45)";
    ctx.strokeRect(16, 16, 224, 352);

    // Corner Ranks & Suit Icon (Top-Left)
    ctx.fillStyle = suit.hex;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(rankLabel, 26, 26);

    ctx.font = "24px sans-serif";
    ctx.fillText(suit.symbol, 26, 60);

    // Corner Ranks & Suit Icon (Bottom-Right, Inverted)
    ctx.save();
    ctx.translate(230, 358);
    ctx.rotate(Math.PI);
    ctx.fillStyle = suit.hex;
    ctx.font = "bold 28px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(rankLabel, 0, 0);
    ctx.font = "24px sans-serif";
    ctx.fillText(suit.symbol, 0, 34);
    ctx.restore();

    // Centerpiece: Large Sigil / Suit Geometry
    ctx.save();
    ctx.translate(128, 192);

    // Center emblem circle
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(197, 160, 89, 0.08)";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = suit.hex;
    ctx.stroke();

    // Suit Large Symbol
    ctx.font = "54px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(suit.symbol, 0, -8);

    // Suit Title Text
    ctx.font = "bold 13px monospace";
    ctx.fillStyle = "#E8C56A";
    ctx.fillText(suit.label.toUpperCase(), 0, 34);

    ctx.restore();

    // Footer Chips indicator
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.fillText(`+${card.baseChips} CHIPS`, 128, 335);

    const texture = new CanvasTexture(canvas);
    cardTextureCache.set(key, texture);
    return texture;
  }

  function getCardBackTexture(): CanvasTexture {
    const key = "limen_card_back";
    if (cardTextureCache.has(key)) return cardTextureCache.get(key)!;

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext("2d");
    if (!ctx) return new CanvasTexture(canvas);

    ctx.fillStyle = "#07080b";
    ctx.fillRect(0, 0, 256, 384);

    ctx.lineWidth = 6;
    ctx.strokeStyle = "#C5A059";
    ctx.strokeRect(10, 10, 236, 364);

    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(232, 197, 106, 0.3)";
    ctx.strokeRect(18, 18, 220, 348);

    // Limen Monogram Inlay
    ctx.save();
    ctx.translate(128, 192);
    ctx.strokeStyle = "#C5A059";
    ctx.lineWidth = 2.5;

    // Diamond
    ctx.beginPath();
    ctx.moveTo(0, -60);
    ctx.lineTo(50, 0);
    ctx.lineTo(0, 60);
    ctx.lineTo(-50, 0);
    ctx.closePath();
    ctx.stroke();

    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "#E8C56A";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("AUREUS", 0, -4);
    ctx.font = "9px monospace";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("PROTOCOL", 0, 14);

    ctx.restore();

    const texture = new CanvasTexture(canvas);
    cardTextureCache.set(key, texture);
    return texture;
  }

  // -----------------------------------------------------------
  // CARD 3D MESH BUILDER
  // -----------------------------------------------------------
  const cardCardGeom = new BoxGeometry(1.05, 1.55, 0.02);
  const cardBackTexture = getCardBackTexture();
  const cardBackMat = new MeshStandardMaterial({
    map: cardBackTexture,
    metalness: 0.35,
    roughness: 0.45,
  });

  const edgeMat = new MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.8,
    roughness: 0.25,
  });

  let cardObjects: Card3DObject[] = [];

  function buildCardMesh(card: MarketCard): { group: Group; mesh: Mesh } {
    const group = new Group();
    const frontMat = new MeshStandardMaterial({
      map: getCardFrontTexture(card),
      metalness: 0.3,
      roughness: 0.4,
    });

    // Box geometry materials array: [right, left, top, bottom, front, back]
    const materials = [edgeMat, edgeMat, edgeMat, edgeMat, frontMat, cardBackMat];
    const mesh = new Mesh(cardCardGeom, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    return { group, mesh };
  }

  // -----------------------------------------------------------
  // LAYOUT & POSITIONING HAND IN A 3D FAN
  // -----------------------------------------------------------
  function updateCardLayout(animateFast: boolean = false) {
    const total = cardObjects.length;
    if (total === 0) return;

    const spreadWidth = Math.min(total * 0.95, 5.2);
    const startX = -spreadWidth / 2 + 0.45;
    const stepX = total > 1 ? spreadWidth / (total - 1) : 0;

    cardObjects.forEach((item, index) => {
      const normalizedIndex = total > 1 ? index / (total - 1) - 0.5 : 0; // -0.5 to +0.5
      const posX = startX + index * stepX;
      const posY = 0.55 - Math.abs(normalizedIndex) * 0.22;
      const posZ = 2.4 - Math.abs(normalizedIndex) * 0.45;

      const rotZ = -normalizedIndex * 0.16; // Fan tilt
      const rotX = -0.42; // Tilted toward camera for high legibility
      const rotY = normalizedIndex * 0.08;

      item.baseY = posY;

      // Selezionato: si alza di 0.45 e si raddrizza leggermente
      const elevation = item.isSelected ? 0.45 : item.isHovered ? 0.2 : 0;
      const zOffset = item.isSelected ? 0.2 : item.isHovered ? 0.1 : 0;

      item.targetPos.set(posX, posY + elevation, posZ + zOffset);
      item.targetRot.set(rotX, rotY, rotZ);

      if (animateFast) {
        item.group.position.copy(item.targetPos);
        item.group.rotation.set(item.targetRot.x, item.targetRot.y, item.targetRot.z);
      }
    });
  }

  // -----------------------------------------------------------
  // RAYCASTING & INTERACTION
  // -----------------------------------------------------------
  const raycaster = new Raycaster();
  const mouse = new Vector2(-999, -999);
  let hoveredCardId: string | null = null;

  function onPointerMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Slight camera parallax for 3D depth
    camera.position.x = mouse.x * 0.4;
    camera.position.y = 5.8 + mouse.y * 0.3;
    camera.lookAt(0, 0, 0.2);

    raycaster.setFromCamera(mouse, camera);
    const meshes = cardObjects.map((c) => c.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as Mesh;
      const hitItem = cardObjects.find((c) => c.mesh === hitMesh);
      if (hitItem && hoveredCardId !== hitItem.card.id) {
        hoveredCardId = hitItem.card.id;
        cardObjects.forEach((c) => {
          c.isHovered = c.card.id === hoveredCardId;
        });
        updateCardLayout();
        container.style.cursor = "pointer";
      }
    } else if (hoveredCardId !== null) {
      hoveredCardId = null;
      cardObjects.forEach((c) => {
        c.isHovered = false;
      });
      updateCardLayout();
      container.style.cursor = "default";
    }
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button !== 0) return; // Left click only
    raycaster.setFromCamera(mouse, camera);
    const meshes = cardObjects.map((c) => c.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as Mesh;
      const hitItem = cardObjects.find((c) => c.mesh === hitMesh);
      if (hitItem) {
        gameAudio.playCardSelect();
        callbacks.onCardToggleSelect(hitItem.card.id);
      }
    }
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const rect = container.getBoundingClientRect();
    mouse.x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const meshes = cardObjects.map((c) => c.mesh);
    const intersects = raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const hitMesh = intersects[0].object as Mesh;
      const hitItem = cardObjects.find((c) => c.mesh === hitMesh);
      if (hitItem) {
        gameAudio.playCardSelect();
        callbacks.onCardToggleSelect(hitItem.card.id);
      }
    }
  }

  container.addEventListener("mousemove", onPointerMove);
  container.addEventListener("mousedown", onPointerDown);
  container.addEventListener("touchstart", onTouchStart, { passive: true });

  // -----------------------------------------------------------
  // ANIMATION LOOP (LERP & PARTICLES)
  // -----------------------------------------------------------
  let isRunning = true;
  let animFrameId: number;

  function animate() {
    if (!isRunning) return;
    animFrameId = requestAnimationFrame(animate);

    // Smooth lerp card positions and rotations
    for (const item of cardObjects) {
      item.group.position.lerp(item.targetPos, 0.16);
      item.group.rotation.x += (item.targetRot.x - item.group.rotation.x) * 0.16;
      item.group.rotation.y += (item.targetRot.y - item.group.rotation.y) * 0.16;
      item.group.rotation.z += (item.targetRot.z - item.group.rotation.z) * 0.16;
    }

    // Gentle particle drift
    const posAttr = particleGeo.getAttribute("position") as Float32BufferAttribute;
    const array = posAttr.array as Float32Array;
    for (let i = 1; i < particleCount * 3; i += 3) {
      array[i] += 0.003;
      if (array[i] > 5) array[i] = 0.2;
    }
    posAttr.needsUpdate = true;

    // Decay squeeze light pulse if active
    if (squeezeLight.intensity > 0) {
      squeezeLight.intensity *= 0.95;
      if (squeezeLight.intensity < 0.05) squeezeLight.intensity = 0;
    }

    renderer.render(scene, camera);
  }

  animate();

  // -----------------------------------------------------------
  // CONTROLLER METHODS
  // -----------------------------------------------------------
  function setHand(cards: MarketCard[], selectedIds: string[]) {
    // Rimuovi card correnti dalla scena
    for (const item of cardObjects) {
      scene.remove(item.group);
    }
    cardObjects = [];

    cards.forEach((card, index) => {
      const { group, mesh } = buildCardMesh(card);
      // Fai partire la carta dal mazzo (dietro a destra) per un deal smooth
      group.position.set(3.5, 1.2, -1.5);
      group.rotation.set(-Math.PI / 2, 0, Math.PI / 4);

      scene.add(group);

      const isSelected = selectedIds.includes(card.id);
      cardObjects.push({
        group,
        mesh,
        card,
        targetPos: new Vector3(),
        targetRot: new Vector3(),
        isSelected,
        isHovered: false,
        baseY: 0.5,
      });

      // Suono di deal sfalsato
      setTimeout(() => {
        gameAudio.playCardSlide();
      }, index * 45);
    });

    updateCardLayout();
  }

  function setSelectedCards(selectedIds: string[]) {
    for (const item of cardObjects) {
      item.isSelected = selectedIds.includes(item.card.id);
    }
    updateCardLayout();
  }

  function playHandAnimation(scoredCards: MarketCard[], onComplete: () => void) {
    const scoredIds = scoredCards.map((c) => c.id);
    const toPlay = cardObjects.filter((c) => scoredIds.includes(c.card.id));

    // Fai scivolare le carte al centro del tavolo (Stage di Valutazione)
    toPlay.forEach((item, idx) => {
      const offsetX = (idx - (toPlay.length - 1) / 2) * 0.9;
      item.targetPos.set(offsetX, 0.45, 0.1);
      item.targetRot.set(-0.25, 0, 0);
    });

    gameAudio.playChipClink();

    // Dopo 700ms, fallasparire nel discard verso l'alto
    setTimeout(() => {
      toPlay.forEach((item) => {
        item.targetPos.set(0, 3.5, -3.5);
        item.targetRot.set(-Math.PI / 2, 0, 0);
      });
      gameAudio.playCardSlide();

      setTimeout(() => {
        onComplete();
      }, 400);
    }, 750);
  }

  function playFoldAnimation(onComplete: () => void) {
    gameAudio.playFold();

    // Le carte scivolano ordinatamente verso la cassaforte a destra
    cardObjects.forEach((item, idx) => {
      item.targetPos.set(4.2 + idx * 0.05, 0.6, -1.0);
      item.targetRot.set(-0.5, 0.4, 0.3);
    });

    setTimeout(() => {
      onComplete();
    }, 700);
  }

  function triggerSqueezeBurst() {
    squeezeLight.intensity = 5.0;
    gameAudio.playSqueeze();

    // Scuoti la camera leggermente
    const origY = camera.position.y;
    camera.position.y += 0.25;
    setTimeout(() => {
      camera.position.y = origY;
    }, 120);
  }

  function triggerVictoryFanfare() {
    gameAudio.playVictory();
    // Impulso luce oro sul tavolo
    overheadSpot.intensity = 4.5;
    setTimeout(() => {
      overheadSpot.intensity = 2.6;
    }, 800);
  }

  function handleResize() {
    if (!container) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 500;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", handleResize);

  function dispose() {
    isRunning = false;
    cancelAnimationFrame(animFrameId);
    window.removeEventListener("resize", handleResize);
    container.removeEventListener("mousemove", onPointerMove);
    container.removeEventListener("mousedown", onPointerDown);
    container.removeEventListener("touchstart", onTouchStart);

    // Dispose geometries & materials
    feltGeo.dispose();
    feltMat.dispose();
    rimGeo.dispose();
    rimMat.dispose();
    inlayGeo.dispose();
    inlayMat.dispose();
    cardCardGeom.dispose();
    particleGeo.dispose();
    particleMat.dispose();

    cardTextureCache.forEach((tex) => tex.dispose());
    cardTextureCache.clear();

    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return {
    setHand,
    setSelectedCards,
    playHandAnimation,
    playFoldAnimation,
    triggerSqueezeBurst,
    triggerVictoryFanfare,
    dispose,
  };
}
