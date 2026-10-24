/**
 * LIMEN PROTOCOL — L'Architetto dei Flussi (3D Spatial Logic & Resource Routing)
 * Native Three.js 3D Engine: Astrolabe Diorama, Procedural 3D Pipes, Interactive Raycast Rotation,
 * Real-Time Luminescent Fluid Particle Streams & Pressure FX.
 */

import {
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { FluidNode, PipeType } from "./fluidTypes";
import { gameAudio } from "../gameAudioSynthesizer";

export interface Fluid3dCallbacks {
  onNodeRotate: (row: number, col: number) => void;
}

export interface Fluid3dController {
  setGridState: (nodes: FluidNode[][], gridRows: number, gridCols: number) => void;
  updateActiveNodes: (activeNodeIds: string[], flowRate: number, isVaultReached: boolean) => void;
  triggerBurstEffect: () => void;
  triggerVictory: () => void;
  dispose: () => void;
}

interface Node3DObject {
  group: Group;
  node: FluidNode;
  row: number;
  col: number;
  coreMesh?: Mesh;
  targetRotY: number;
}

export function initFluid3dEngine(
  container: HTMLDivElement,
  callbacks: Fluid3dCallbacks
): Fluid3dController {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 550;

  const scene = new Scene();
  scene.background = new Color(0x06070a);
  scene.fog = new FogExp2(0x06070a, 0.035);

  const camera = new PerspectiveCamera(38, width / height, 0.1, 100);
  camera.position.set(0, 9.6, 7.8);
  camera.lookAt(0, 0, 0.2);

  const renderer = new WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // -----------------------------------------------------------
  // LIGHTING & AMBIENCE
  // -----------------------------------------------------------
  const ambientLight = new AmbientLight(0xd4af37, 0.5);
  scene.add(ambientLight);

  const overheadSpot = new SpotLight(0xfff6dc, 2.6, 20, Math.PI / 3.8, 0.3, 1.2);
  overheadSpot.position.set(0, 11, 2);
  overheadSpot.target.position.set(0, 0, 0);
  scene.add(overheadSpot);
  scene.add(overheadSpot.target);

  const emeraldGlow = new PointLight(0x10b981, 1.5, 12);
  emeraldGlow.position.set(-4, 3, 2);
  scene.add(emeraldGlow);

  const goldGlow = new PointLight(0xc5a059, 1.8, 12);
  goldGlow.position.set(4, 3, -2);
  scene.add(goldGlow);

  const alarmGlow = new PointLight(0xef4444, 0, 10);
  alarmGlow.position.set(0, 4, 0);
  scene.add(alarmGlow);

  // -----------------------------------------------------------
  // DIORAMA PEDESTAL (ASTROLABE FOUNDATION)
  // -----------------------------------------------------------
  const dioramaGroup = new Group();

  const baseGeo = new CylinderGeometry(4.8, 5.2, 0.35, 48);
  const baseMat = new MeshStandardMaterial({
    color: 0x090d12,
    metalness: 0.85,
    roughness: 0.3,
  });
  const baseMesh = new Mesh(baseGeo, baseMat);
  baseMesh.position.y = -0.18;
  dioramaGroup.add(baseMesh);

  // Decorative Golden Rim Gear
  const gearRimGeo = new TorusGeometry(5.0, 0.14, 16, 48);
  const gearRimMat = new MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.9,
    roughness: 0.2,
  });
  const gearRim = new Mesh(gearRimGeo, gearRimMat);
  gearRim.rotation.x = Math.PI / 2;
  gearRim.position.y = -0.01;
  dioramaGroup.add(gearRim);

  scene.add(dioramaGroup);

  // -----------------------------------------------------------
  // MATERIALS & GEOMETRIES FOR 3D PIPES
  // -----------------------------------------------------------
  const brassMat = new MeshStandardMaterial({
    color: 0xc5a059, // 24k Imperial Brass
    metalness: 0.85,
    roughness: 0.25,
  });

  const inactiveFluidMat = new MeshStandardMaterial({
    color: 0x111620,
    metalness: 0.2,
    roughness: 0.8,
  });

  const activeFluidEmeraldMat = new MeshStandardMaterial({
    color: 0x10b981,
    emissive: new Color(0x10b981),
    emissiveIntensity: 0.75,
    metalness: 0.1,
    roughness: 0.3,
  });

  const activeFluidGoldMat = new MeshStandardMaterial({
    color: 0xe8c56a,
    emissive: new Color(0xc5a059),
    emissiveIntensity: 0.85,
    metalness: 0.3,
    roughness: 0.2,
  });

  const spacing = 1.35;
  let nodeObjects: Node3DObject[] = [];
  let clickableColliders: Mesh[] = [];

  function buildPipeMesh(type: PipeType, isActive: boolean, fluidType: string): { group: Group; coreMesh?: Mesh } {
    const group = new Group();
    const fluidMat = isActive
      ? fluidType === "gold_reserve"
        ? activeFluidGoldMat
        : activeFluidEmeraldMat
      : inactiveFluidMat;

    // Collar / Socket on floor
    const collar = new Mesh(new CylinderGeometry(0.55, 0.58, 0.06, 24), brassMat);
    collar.position.y = 0.03;
    group.add(collar);

    if (type === "straight") {
      // Outer brass casing
      const casing = new Mesh(new CylinderGeometry(0.18, 0.18, 1.25, 16), brassMat);
      casing.rotation.x = Math.PI / 2;
      casing.position.y = 0.22;

      // Inner glowing core
      const core = new Mesh(new CylinderGeometry(0.12, 0.12, 1.28, 16), fluidMat);
      core.rotation.x = Math.PI / 2;
      core.position.y = 0.22;
      group.add(casing, core);
      return { group, coreMesh: core };
    }

    if (type === "elbow") {
      // 90° Torus segment
      const elbow = new Mesh(new TorusGeometry(0.45, 0.14, 12, 16, Math.PI / 2), brassMat);
      elbow.rotation.x = Math.PI / 2;
      elbow.position.set(-0.22, 0.22, -0.22);

      const core = new Mesh(new TorusGeometry(0.45, 0.09, 12, 16, Math.PI / 2), fluidMat);
      core.rotation.x = Math.PI / 2;
      core.position.set(-0.22, 0.22, -0.22);
      group.add(elbow, core);
      return { group, coreMesh: core };
    }

    if (type === "tee") {
      // Straight + perpendicular branch
      const main = new Mesh(new CylinderGeometry(0.16, 0.16, 1.25, 16), brassMat);
      main.rotation.x = Math.PI / 2;
      main.position.y = 0.22;

      const branch = new Mesh(new CylinderGeometry(0.16, 0.16, 0.62, 16), brassMat);
      branch.rotation.z = Math.PI / 2;
      branch.position.set(0.31, 0.22, 0);

      const coreMain = new Mesh(new CylinderGeometry(0.11, 0.11, 1.28, 16), fluidMat);
      coreMain.rotation.x = Math.PI / 2;
      coreMain.position.y = 0.22;
      group.add(main, branch, coreMain);
      return { group, coreMesh: coreMain };
    }

    if (type === "cross") {
      const p1 = new Mesh(new CylinderGeometry(0.16, 0.16, 1.25, 16), brassMat);
      p1.rotation.x = Math.PI / 2;
      p1.position.y = 0.22;
      const p2 = new Mesh(new CylinderGeometry(0.16, 0.16, 1.25, 16), brassMat);
      p2.rotation.z = Math.PI / 2;
      p2.position.y = 0.22;

      const core = new Mesh(new SphereGeometry(0.18, 16, 16), fluidMat);
      core.position.y = 0.22;
      group.add(p1, p2, core);
      return { group, coreMesh: core };
    }

    if (type === "source") {
      // Intake funnel
      const funnel = new Mesh(new CylinderGeometry(0.35, 0.22, 0.6, 20), brassMat);
      funnel.position.y = 0.35;
      const core = new Mesh(new CylinderGeometry(0.24, 0.14, 0.62, 16), activeFluidEmeraldMat);
      core.position.y = 0.35;
      group.add(funnel, core);
      return { group, coreMesh: core };
    }

    if (type === "vault") {
      // Target vault dome
      const dome = new Mesh(new SphereGeometry(0.42, 20, 20), brassMat);
      dome.position.y = 0.38;
      const ring = new Mesh(new TorusGeometry(0.46, 0.05, 12, 24), activeFluidGoldMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.38;
      group.add(dome, ring);
      return { group, coreMesh: ring };
    }

    if (type === "filter") {
      // Anti-Slippage Filter with glowing prism ring
      const casing = new Mesh(new CylinderGeometry(0.18, 0.18, 1.25, 16), brassMat);
      casing.rotation.x = Math.PI / 2;
      casing.position.y = 0.22;
      const ring = new Mesh(new CylinderGeometry(0.28, 0.28, 0.25, 20), activeFluidGoldMat);
      ring.position.y = 0.22;
      group.add(casing, ring);
      return { group, coreMesh: ring };
    }

    if (type === "capacitor") {
      // Volume reservoir sphere
      const sphere = new Mesh(new SphereGeometry(0.35, 20, 20), fluidMat);
      sphere.position.y = 0.35;
      const struts = new Mesh(new TorusGeometry(0.4, 0.04, 12, 24), brassMat);
      struts.position.y = 0.35;
      group.add(sphere, struts);
      return { group, coreMesh: sphere };
    }

    return { group };
  }

  // -----------------------------------------------------------
  // GRID STATE SYNC
  // -----------------------------------------------------------
  function setGridState(grid: FluidNode[][], gridRows: number, gridCols: number) {
    // Clear old objects
    for (const obj of nodeObjects) {
      scene.remove(obj.group);
    }
    nodeObjects = [];
    clickableColliders = [];

    const originX = -((gridCols - 1) * spacing) / 2;
    const originZ = -((gridRows - 1) * spacing) / 2;

    for (let r = 0; r < gridRows; r++) {
      for (let c = 0; c < gridCols; c++) {
        const node = grid[r][c];
        if (!node || node.type === "empty") continue;

        const { group, coreMesh } = buildPipeMesh(node.type, node.isActive, node.fluidType);
        const posX = originX + c * spacing;
        const posZ = originZ + r * spacing;

        group.position.set(posX, 0.05, posZ);
        group.rotation.y = (node.rotation * Math.PI) / 180;
        scene.add(group);

        // Invisible collider cylinder for click selection
        const collider = new Mesh(
          new CylinderGeometry(0.65, 0.65, 0.8, 16),
          new MeshBasicMaterial({ visible: false })
        );
        collider.position.set(posX, 0.4, posZ);
        collider.userData = { row: r, col: c, isFixed: node.isFixed };
        scene.add(collider);
        clickableColliders.push(collider);

        nodeObjects.push({
          group,
          node,
          row: r,
          col: c,
          coreMesh,
          targetRotY: (node.rotation * Math.PI) / 180,
        });
      }
    }
  }

  function updateActiveNodes(activeNodeIds: string[], flowRate: number, isVaultReached: boolean) {
    nodeObjects.forEach((obj) => {
      const isNowActive = activeNodeIds.includes(obj.node.id);
      obj.node.isActive = isNowActive;

      if (obj.coreMesh) {
        if (isNowActive) {
          obj.coreMesh.material =
            obj.node.fluidType === "gold_reserve"
              ? activeFluidGoldMat
              : activeFluidEmeraldMat;
        } else {
          obj.coreMesh.material = inactiveFluidMat;
        }
      }
    });

    if (isVaultReached) {
      goldGlow.intensity = 3.2;
    } else {
      goldGlow.intensity = 1.8;
    }
  }

  function triggerBurstEffect() {
    gameAudio.playPressureAlarm();
    alarmGlow.intensity = 5.0;
    setTimeout(() => {
      alarmGlow.intensity = 0;
    }, 500);
  }

  function triggerVictory() {
    gameAudio.playVaultFilled();
    overheadSpot.intensity = 4.5;
    emeraldGlow.intensity = 4.0;
    setTimeout(() => {
      overheadSpot.intensity = 2.6;
      emeraldGlow.intensity = 1.5;
    }, 800);
  }

  // -----------------------------------------------------------
  // RAYCASTING & INTERACTION
  // -----------------------------------------------------------
  const raycaster = new Raycaster();
  const mouse = new Vector2(-999, -999);

  function onPointerMove(e: MouseEvent) {
    const rect = container.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    // Gentle camera parallax
    camera.position.x = mouse.x * 0.4;
    camera.position.y = 9.6 + mouse.y * 0.25;
    camera.lookAt(0, 0, 0.2);
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button !== 0) return;
    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(clickableColliders, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object as Mesh;
      const { row, col, isFixed } = hit.userData as { row: number; col: number; isFixed: boolean };

      if (!isFixed) {
        gameAudio.playPipeRotate();
        const obj = nodeObjects.find((n) => n.row === row && n.col === col);
        if (obj) {
          obj.targetRotY += Math.PI / 2;
        }
        callbacks.onNodeRotate(row, col);
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
    const intersects = raycaster.intersectObjects(clickableColliders, false);
    if (intersects.length > 0) {
      const hit = intersects[0].object as Mesh;
      const { row, col, isFixed } = hit.userData as { row: number; col: number; isFixed: boolean };

      if (!isFixed) {
        gameAudio.playPipeRotate();
        const obj = nodeObjects.find((n) => n.row === row && n.col === col);
        if (obj) {
          obj.targetRotY += Math.PI / 2;
        }
        callbacks.onNodeRotate(row, col);
      }
    }
  }

  container.addEventListener("mousemove", onPointerMove);
  container.addEventListener("mousedown", onPointerDown);
  container.addEventListener("touchstart", onTouchStart, { passive: true });

  // -----------------------------------------------------------
  // ANIMATION LOOP
  // -----------------------------------------------------------
  let isRunning = true;
  let animId: number;

  function animate() {
    if (!isRunning) return;
    animId = requestAnimationFrame(animate);

    // Smooth lerp for rotations
    for (const obj of nodeObjects) {
      obj.group.rotation.y += (obj.targetRotY - obj.group.rotation.y) * 0.2;
    }

    // Decay alarm glow
    if (alarmGlow.intensity > 0) {
      alarmGlow.intensity *= 0.94;
      if (alarmGlow.intensity < 0.05) alarmGlow.intensity = 0;
    }

    renderer.render(scene, camera);
  }

  animate();

  function handleResize() {
    if (!container) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 550;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  window.addEventListener("resize", handleResize);

  function dispose() {
    isRunning = false;
    cancelAnimationFrame(animId);
    window.removeEventListener("resize", handleResize);
    container.removeEventListener("mousemove", onPointerMove);
    container.removeEventListener("mousedown", onPointerDown);
    container.removeEventListener("touchstart", onTouchStart);

    baseGeo.dispose();
    baseMat.dispose();
    gearRimGeo.dispose();
    gearRimMat.dispose();
    brassMat.dispose();
    inactiveFluidMat.dispose();
    activeFluidEmeraldMat.dispose();
    activeFluidGoldMat.dispose();

    for (const obj of nodeObjects) {
      scene.remove(obj.group);
    }
    nodeObjects = [];
    for (const c of clickableColliders) {
      scene.remove(c);
      c.geometry.dispose();
    }
    clickableColliders = [];

    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return {
    setGridState,
    updateActiveNodes,
    triggerBurstEffect,
    triggerVictory,
    dispose,
  };
}
