/**
 * LIMEN PROTOCOL — Il Cockpit Tattico dell'Ordine (Trans-Limen Tactical Battlefield 3D)
 * Motore di Rendering Nativo Three.js WebGL: Griglia Olografica del Book, Moduli Istituzionali 3D,
 * Vettori di Sweep Algoritmici e Indicatori di Zona Tattica.
 */

import * as THREE from "three";
import {
  GridCoordinate,
  TileType,
  TacticalUnit,
  TelegraphedSweep,
} from "./cockpitTypes";

export interface Cockpit3dCallbacks {
  onTileClick: (row: number, col: number) => void;
  onUnitClick: (unitId: string) => void;
}

export interface Cockpit3dController {
  dispose: () => void;
  setScenario: (
    rows: number,
    cols: number,
    specialTiles: { coord: GridCoordinate; type: TileType }[]
  ) => void;
  updateUnits: (units: TacticalUnit[], selectedUnitId: string | null) => void;
  setTargetedTiles: (coords: GridCoordinate[], dangerLevel?: number) => void;
  setLegalMoveTiles: (coords: GridCoordinate[]) => void;
  animateUnitMove: (
    unitId: string,
    from: GridCoordinate,
    to: GridCoordinate,
    onComplete: () => void
  ) => void;
  triggerSweepExecutionAnimation: (
    sweeps: TelegraphedSweep[],
    onComplete: () => void
  ) => void;
  triggerVictoryFanfare: () => void;
}

export function initCockpit3dEngine(
  container: HTMLDivElement,
  callbacks: Cockpit3dCallbacks
): Cockpit3dController {
  let isDisposed = false;

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07080b);
  scene.fog = new THREE.FogExp2(0x07080b, 0.035);

  const camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / Math.max(1, container.clientHeight),
    0.1,
    1000
  );
  camera.position.set(0, 15, 17);
  camera.lookAt(0, 0, 0);

  // WebGL Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  container.appendChild(renderer.domElement);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xe8c56a, 1.8);
  keyLight.position.set(12, 22, 10);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 1024;
  keyLight.shadow.mapSize.height = 1024;
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0x38bdf8, 1.2, 35);
  fillLight.position.set(-12, 10, -10);
  scene.add(fillLight);

  const redWarningLight = new THREE.PointLight(0xef4444, 0, 25);
  redWarningLight.position.set(0, 8, 0);
  scene.add(redWarningLight);

  // Group Roots
  const boardGroup = new THREE.Group();
  scene.add(boardGroup);

  const unitsGroup = new THREE.Group();
  scene.add(unitsGroup);

  const overlaysGroup = new THREE.Group();
  scene.add(overlaysGroup);

  const fxGroup = new THREE.Group();
  scene.add(fxGroup);

  // Materials Cache
  const goldMaterial = new THREE.MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.85,
    roughness: 0.25,
  });

  const obsidianMaterial = new THREE.MeshStandardMaterial({
    color: 0x0f1118,
    metalness: 0.3,
    roughness: 0.6,
  });

  const emeraldGlowMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x059669,
    emissiveIntensity: 0.6,
    metalness: 0.5,
    roughness: 0.3,
  });

  const fvgGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0284c7,
    emissiveIntensity: 0.5,
    metalness: 0.4,
    roughness: 0.4,
  });

  const dangerBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.3,
  });

  // State Trackers
  let currentRows = 7;
  let currentCols = 7;
  let tileMeshes: { row: number; col: number; mesh: THREE.Mesh }[] = [];
  let unitMeshesMap = new Map<string, THREE.Group>();
  let legalMoveDisks: THREE.Mesh[] = [];
  let targetedSweepMarkers: THREE.Mesh[] = [];

  // Raycasting
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function gridToWorld(row: number, col: number, rows = currentRows, cols = currentCols): THREE.Vector3 {
    const tileSpacing = 1.45;
    const offsetX = ((cols - 1) * tileSpacing) / 2;
    const offsetZ = ((rows - 1) * tileSpacing) / 2;
    return new THREE.Vector3(col * tileSpacing - offsetX, 0.1, row * tileSpacing - offsetZ);
  }

  // -----------------------------------------------------------------
  // BOARD BUILDER
  // -----------------------------------------------------------------
  function buildBoard(
    rows: number,
    cols: number,
    specialTiles: { coord: GridCoordinate; type: TileType }[]
  ) {
    // Clear old board
    while (boardGroup.children.length > 0) {
      const obj = boardGroup.children.pop();
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
      }
    }
    tileMeshes = [];

    currentRows = rows;
    currentCols = cols;

    // Platform Base
    const tileSpacing = 1.45;
    const baseWidth = cols * tileSpacing + 1.2;
    const baseDepth = rows * tileSpacing + 1.2;

    const baseGeo = new THREE.BoxGeometry(baseWidth, 0.6, baseDepth);
    const baseMesh = new THREE.Mesh(baseGeo, obsidianMaterial);
    baseMesh.position.set(0, -0.3, 0);
    baseMesh.receiveShadow = true;
    boardGroup.add(baseMesh);

    // Golden Edge Trim
    const trimGeo = new THREE.BoxGeometry(baseWidth + 0.15, 0.1, baseDepth + 0.15);
    const trimMesh = new THREE.Mesh(trimGeo, goldMaterial);
    trimMesh.position.set(0, -0.05, 0);
    boardGroup.add(trimMesh);

    // Tiles
    const tileGeo = new THREE.BoxGeometry(1.35, 0.15, 1.35);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const special = specialTiles.find((s) => s.coord[0] === r && s.coord[1] === c);
        let mat = obsidianMaterial.clone();

        if (special) {
          if (special.type === "liquidity_pool") {
            mat = emeraldGlowMat;
          } else if (special.type === "fair_value_gap") {
            mat = fvgGlowMat;
          } else if (special.type === "mitigation_zone") {
            mat = goldMaterial;
          }
        }

        const tileMesh = new THREE.Mesh(tileGeo, mat);
        const pos = gridToWorld(r, c, rows, cols);
        tileMesh.position.set(pos.x, 0.08, pos.z);
        tileMesh.receiveShadow = true;
        tileMesh.userData = { row: r, col: c };

        boardGroup.add(tileMesh);
        tileMeshes.push({ row: r, col: c, mesh: tileMesh });
      }
    }
  }

  // -----------------------------------------------------------------
  // UNIT 3D PROCEDURAL GENERATORS
  // -----------------------------------------------------------------

  function createCoreVaultMesh(): THREE.Group {
    const group = new THREE.Group();

    // Base stepped plinth
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), goldMaterial);
    plinth.castShadow = true;
    group.add(plinth);

    // Central Monolith
    const monolith = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 0.9, 8), obsidianMaterial);
    monolith.position.y = 0.55;
    monolith.castShadow = true;
    group.add(monolith);

    // Floating Golden Diamond Crown
    const crown = new THREE.Mesh(new THREE.OctahedronGeometry(0.3, 0), goldMaterial);
    crown.position.y = 1.3;
    crown.castShadow = true;
    group.add(crown);

    group.userData.crownMesh = crown;
    return group;
  }

  function createSweepHunterMesh(): THREE.Group {
    const group = new THREE.Group();

    // Sleek Interceptor Diamond
    const hull = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1.1, 4), goldMaterial);
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 0.5;
    hull.castShadow = true;
    group.add(hull);

    // Core Sensor Beacon
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), emeraldGlowMat);
    beacon.position.set(0, 0.55, 0.2);
    group.add(beacon);

    return group;
  }

  function createOrderBlockMesh(): THREE.Group {
    const group = new THREE.Group();

    // Fortified Heavy Bastion
    const bastion = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.95, 0.85), obsidianMaterial);
    bastion.position.y = 0.5;
    bastion.castShadow = true;
    group.add(bastion);

    // Shield Plate Facing Front
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.85, 0.1), goldMaterial);
    plate.position.set(0, 0.55, 0.42);
    plate.castShadow = true;
    group.add(plate);

    return group;
  }

  function createRiskSentinelMesh(): THREE.Group {
    const group = new THREE.Group();

    // Hovering Gimbal Ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.06, 8, 24), goldMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.65;
    group.add(ring);

    // Central Floating Eye / Core
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), fvgGlowMat);
    eye.position.y = 0.65;
    group.add(eye);

    // Hex Shield Halo on Floor
    const haloGeo = new THREE.RingGeometry(0.9, 1.05, 6);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5,
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.16;
    group.add(halo);

    group.userData.eyeMesh = eye;
    return group;
  }

  function updateUnits(units: TacticalUnit[], selectedUnitId: string | null) {
    // Remove dead units
    const currentUnitIds = new Set(units.map((u) => u.id));
    for (const [id, meshGroup] of unitMeshesMap.entries()) {
      if (!currentUnitIds.has(id)) {
        unitsGroup.remove(meshGroup);
        unitMeshesMap.delete(id);
      }
    }

    // Add or update living units
    units.forEach((unit) => {
      let group = unitMeshesMap.get(unit.id);

      if (!group) {
        if (unit.type === "core_vault") group = createCoreVaultMesh();
        else if (unit.type === "sweep_hunter") group = createSweepHunterMesh();
        else if (unit.type === "order_block") group = createOrderBlockMesh();
        else group = createRiskSentinelMesh();

        group.userData = { unitId: unit.id };
        unitsGroup.add(group);
        unitMeshesMap.set(unit.id, group);
      }

      const worldPos = gridToWorld(unit.position[0], unit.position[1]);
      group.position.set(worldPos.x, worldPos.y, worldPos.z);

      // Selection Highlight Pulse
      const isSelected = unit.id === selectedUnitId;
      group.scale.setScalar(isSelected ? 1.15 : 1.0);
    });
  }

  // -----------------------------------------------------------------
  // LEGAL MOVES OVERLAYS
  // -----------------------------------------------------------------
  function setLegalMoveTiles(coords: GridCoordinate[]) {
    // Clear old
    legalMoveDisks.forEach((d) => overlaysGroup.remove(d));
    legalMoveDisks = [];

    const ringGeo = new THREE.RingGeometry(0.3, 0.5, 24);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xc5a059,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });

    coords.forEach(([r, c]) => {
      const disk = new THREE.Mesh(ringGeo, ringMat);
      const pos = gridToWorld(r, c);
      disk.rotation.x = -Math.PI / 2;
      disk.position.set(pos.x, 0.18, pos.z);
      overlaysGroup.add(disk);
      legalMoveDisks.push(disk);
    });
  }

  // -----------------------------------------------------------------
  // TELEGRAPHED SWEEP DANGER OVERLAYS
  // -----------------------------------------------------------------
  function setTargetedTiles(coords: GridCoordinate[]) {
    // Clear old
    targetedSweepMarkers.forEach((m) => overlaysGroup.remove(m));
    targetedSweepMarkers = [];

    const dangerTileGeo = new THREE.PlaneGeometry(1.3, 1.3);
    const dangerMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });

    coords.forEach(([r, c]) => {
      const p = new THREE.Mesh(dangerTileGeo, dangerMat);
      const pos = gridToWorld(r, c);
      p.rotation.x = -Math.PI / 2;
      p.position.set(pos.x, 0.17, pos.z);
      overlaysGroup.add(p);
      targetedSweepMarkers.push(p);
    });
  }

  // -----------------------------------------------------------------
  // ANIMATIONS
  // -----------------------------------------------------------------
  function animateUnitMove(
    unitId: string,
    from: GridCoordinate,
    to: GridCoordinate,
    onComplete: () => void
  ) {
    const unitGroup = unitMeshesMap.get(unitId);
    if (!unitGroup) {
      onComplete();
      return;
    }

    const startPos = gridToWorld(from[0], from[1]);
    const targetPos = gridToWorld(to[0], to[1]);

    const duration = 280;
    const startTime = performance.now();

    function step(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      unitGroup!.position.lerpVectors(startPos, targetPos, ease);
      unitGroup!.position.y = 0.1 + Math.sin(progress * Math.PI) * 0.4; // subtle hop

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        unitGroup!.position.copy(targetPos);
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function triggerSweepExecutionAnimation(
    sweeps: TelegraphedSweep[],
    onComplete: () => void
  ) {
    // Visual flash of red warning light
    redWarningLight.intensity = 3.5;

    // Create laser beams across telegraphed rows/cols
    const laserGroup = new THREE.Group();
    fxGroup.add(laserGroup);

    sweeps.forEach((sweep) => {
      sweep.targetCoordinates.forEach(([r, c]) => {
        const p = gridToWorld(r, c);
        const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 8);
        const beamMat = new THREE.MeshBasicMaterial({
          color: 0xef4444,
          transparent: true,
          opacity: 0.9,
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(p.x, 4, p.z);
        laserGroup.add(beam);
      });
    });

    setTimeout(() => {
      redWarningLight.intensity = 0;
      fxGroup.remove(laserGroup);
      onComplete();
    }, 450);
  }

  function triggerVictoryFanfare() {
    keyLight.color.setHex(0x10b981);
    fillLight.color.setHex(0xe8c56a);

    setTimeout(() => {
      keyLight.color.setHex(0xe8c56a);
      fillLight.color.setHex(0x38bdf8);
    }, 1500);
  }

  // -----------------------------------------------------------------
  // INTERACTION (CLICK & TOUCH RAYCASTING)
  // -----------------------------------------------------------------
  function handlePointerAction(clientX: number, clientY: number) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 1. Check unit hit
    const unitHitObjects = Array.from(unitMeshesMap.values()).flatMap((g) => g.children);
    const unitIntersects = raycaster.intersectObjects(unitHitObjects, true);

    if (unitIntersects.length > 0) {
      let current: THREE.Object3D | null = unitIntersects[0].object;
      while (current && current.parent && current.parent !== unitsGroup) {
        current = current.parent;
      }
      if (current && current.userData?.unitId) {
        callbacks.onUnitClick(current.userData.unitId);
        return;
      }
    }

    // 2. Check tile hit
    const tileObjects = tileMeshes.map((t) => t.mesh);
    const tileIntersects = raycaster.intersectObjects(tileObjects, false);

    if (tileIntersects.length > 0) {
      const hitTile = tileIntersects[0].object;
      if (hitTile.userData?.row !== undefined) {
        callbacks.onTileClick(hitTile.userData.row, hitTile.userData.col);
      }
    }
  }

  const onMouseDown = (e: MouseEvent) => {
    handlePointerAction(e.clientX, e.clientY);
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length > 0) {
      handlePointerAction(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  container.addEventListener("mousedown", onMouseDown);
  container.addEventListener("touchstart", onTouchStart, { passive: true });

  // -----------------------------------------------------------------
  // RENDER LOOP
  // -----------------------------------------------------------------
  let animId = 0;
  function animate(time: number) {
    if (isDisposed) return;
    animId = requestAnimationFrame(animate);

    // Rotate crowns and sentinel eyes
    unitMeshesMap.forEach((group) => {
      if (group.userData.crownMesh) {
        group.userData.crownMesh.rotation.y += 0.02;
      }
      if (group.userData.eyeMesh) {
        group.userData.eyeMesh.rotation.y += 0.03;
      }
    });

    // Pulse sweep markers
    const pulse = 0.35 + Math.sin(time * 0.008) * 0.15;
    targetedSweepMarkers.forEach((m) => {
      if (m.material instanceof THREE.MeshBasicMaterial) {
        m.material.opacity = pulse;
      }
    });

    renderer.render(scene, camera);
  }
  animId = requestAnimationFrame(animate);

  // Resize Listener
  const onResize = () => {
    if (!container || isDisposed) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // Disposal
  return {
    dispose: () => {
      isDisposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      container.removeEventListener("mousedown", onMouseDown);
      container.removeEventListener("touchstart", onTouchStart);

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    },
    setScenario: (rows, cols, specialTiles) => {
      buildBoard(rows, cols, specialTiles);
    },
    updateUnits,
    setTargetedTiles,
    setLegalMoveTiles,
    animateUnitMove,
    triggerSweepExecutionAnimation,
    triggerVictoryFanfare,
  };
}
