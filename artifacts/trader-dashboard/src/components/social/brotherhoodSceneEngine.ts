import {
  AmbientLight,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  TorusGeometry,
  WebGLRenderer,
} from "three";

export interface BrotherhoodSceneController {
  rotate: (deltaX: number, deltaY: number) => void;
  setTargetAngles: (yaw: number, pitch: number) => void;
  dispose: () => void;
}

/**
 * Procedural 3D Altar of the Order (Limen Brotherhood Monolith).
 * Crafted with pure Three.js geometries: Obsidian core, orbital gold gyro-rings, and floating embers.
 * Zero external network assets required.
 */
export function createBrotherhoodScene(
  host: HTMLDivElement,
  reducedMotion: boolean,
  onContextLost: () => void,
): BrotherhoodSceneController | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({
      canvas,
      context,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 1.1, 4.8);
  camera.lookAt(0, 0.1, 0);

  // Lighting: Sacred Gold & Cool Obsidian
  const ambientLight = new AmbientLight(0x222430, 2.2);
  scene.add(ambientLight);

  const goldKeyLight = new DirectionalLight(0xffdf88, 4.2);
  goldKeyLight.position.set(3.5, 4.5, 3.2);
  scene.add(goldKeyLight);

  const coolRimLight = new DirectionalLight(0x557799, 2.5);
  coolRimLight.position.set(-3.5, 2.5, -3.0);
  scene.add(coolRimLight);

  const coreGlowLight = new PointLight(0xd4af37, 3.5, 3.5);
  coreGlowLight.position.set(0, 0.1, 0);
  scene.add(coreGlowLight);

  const rootGroup = new Group();
  scene.add(rootGroup);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  const registerMesh = (geometry: BufferGeometry, material: Material): Mesh => {
    geometries.push(geometry);
    materials.push(material);
    const mesh = new Mesh(geometry, material);
    return mesh;
  };

  // Materials
  const goldMaterial = new MeshStandardMaterial({
    color: new Color("#C5A059"),
    roughness: 0.22,
    metalness: 0.88,
  });
  const paleGoldMaterial = new MeshStandardMaterial({
    color: new Color("#F5E4B5"),
    roughness: 0.15,
    metalness: 0.92,
  });
  const obsidianMaterial = new MeshStandardMaterial({
    color: new Color("#08090D"),
    roughness: 0.18,
    metalness: 0.75,
  });
  const goldWireMaterial = new LineBasicMaterial({
    color: new Color("#D4AF37"),
    transparent: true,
    opacity: 0.65,
  });
  materials.push(goldMaterial, paleGoldMaterial, obsidianMaterial, goldWireMaterial);

  // 1. The Pedestal Altar (Octagonal Base)
  const baseGeo = new CylinderGeometry(1.65, 1.82, 0.12, 8);
  const baseMesh = registerMesh(baseGeo, obsidianMaterial);
  baseMesh.position.y = -1.25;
  rootGroup.add(baseMesh);

  const baseRimGeo = new TorusGeometry(1.78, 0.016, 8, 80);
  const baseRimMesh = registerMesh(baseRimGeo, goldMaterial);
  baseRimMesh.position.y = -1.19;
  baseRimMesh.rotation.x = Math.PI / 2;
  rootGroup.add(baseRimMesh);

  // 2. The Central Monolith Core (Double Octahedral Sacred Crystal)
  const monolithGroup = new Group();
  rootGroup.add(monolithGroup);

  const outerCrystalGeo = new OctahedronGeometry(0.85, 0);
  outerCrystalGeo.scale(0.85, 1.6, 0.85);
  const outerCrystalMesh = registerMesh(outerCrystalGeo, obsidianMaterial);
  monolithGroup.add(outerCrystalMesh);

  // Golden Edges for the Monolith
  const edgesGeo = new EdgesGeometry(outerCrystalGeo);
  geometries.push(edgesGeo);
  const wireframeOutline = new LineSegments(edgesGeo, goldWireMaterial);
  monolithGroup.add(wireframeOutline);

  // Inner floating gold core (faceted)
  const innerCoreGeo = new OctahedronGeometry(0.35, 0);
  innerCoreGeo.scale(0.8, 1.1, 0.8);
  const innerCoreMesh = registerMesh(innerCoreGeo, paleGoldMaterial);
  monolithGroup.add(innerCoreMesh);

  // 3. Gyroscopic Orbital Celestial Rings
  const ring1Group = new Group();
  const ring1Geo = new TorusGeometry(1.35, 0.018, 16, 100);
  const ring1Mesh = registerMesh(ring1Geo, goldMaterial);
  ring1Group.add(ring1Mesh);
  ring1Group.rotation.x = Math.PI / 3;
  rootGroup.add(ring1Group);

  const ring2Group = new Group();
  const ring2Geo = new TorusGeometry(1.52, 0.014, 16, 100);
  const ring2Mesh = registerMesh(ring2Geo, paleGoldMaterial);
  ring2Group.add(ring2Mesh);
  ring2Group.rotation.y = Math.PI / 4;
  ring2Group.rotation.x = -Math.PI / 5;
  rootGroup.add(ring2Group);

  // 4. Floating Embers (Golden Particles)
  const particleCount = 75;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const radius = 0.5 + Math.random() * 1.6;
    const theta = Math.random() * Math.PI * 2;
    const y = -1.0 + Math.random() * 2.2;
    particlePositions[i * 3] = Math.cos(theta) * radius;
    particlePositions[i * 3 + 1] = y;
    particlePositions[i * 3 + 2] = Math.sin(theta) * radius;
  }
  const particlesGeo = new BufferGeometry();
  particlesGeo.setAttribute("position", new Float32BufferAttribute(particlePositions, 3));
  geometries.push(particlesGeo);

  const particlesMat = new PointsMaterial({
    color: new Color("#E8C56A"),
    size: 0.035,
    transparent: true,
    opacity: 0.75,
  });
  materials.push(particlesMat);
  const particles = new Points(particlesGeo, particlesMat);
  rootGroup.add(particles);

  // Animation & Interaction Loop
  let disposed = false;
  let targetYaw = 0;
  let targetPitch = 0;
  let currentYaw = 0;
  let currentPitch = 0;
  let frameId = 0;
  let lastTime = performance.now();

  const resize = () => {
    if (disposed || !host) return;
    const width = host.clientWidth || 300;
    const height = host.clientHeight || 300;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  };

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(host);
  resize();

  const animate = (time: number) => {
    if (disposed) return;
    const delta = Math.min((time - lastTime) / 1000, 0.1);
    lastTime = time;

    // Smooth lerp to mouse targets
    currentYaw += (targetYaw - currentYaw) * 0.08;
    currentPitch += (targetPitch - currentPitch) * 0.08;

    rootGroup.rotation.y = currentYaw;
    rootGroup.rotation.x = currentPitch;

    if (!reducedMotion) {
      // Slow constant sacred rotation
      monolithGroup.rotation.y += delta * 0.35;
      ring1Group.rotation.z += delta * 0.28;
      ring2Group.rotation.z -= delta * 0.22;

      // Gentle floating bob
      monolithGroup.position.y = Math.sin(time * 0.0016) * 0.06;

      // Particle subtle swirl
      particles.rotation.y += delta * 0.12;
    }

    renderer.render(scene, camera);
    frameId = requestAnimationFrame(animate);
  };

  frameId = requestAnimationFrame(animate);

  const onContextLostHandler = (e: Event) => {
    e.preventDefault();
    onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onContextLostHandler);

  return {
    rotate: (deltaX: number, deltaY: number) => {
      targetYaw += deltaX * 0.01;
      targetPitch += deltaY * 0.01;
      targetPitch = Math.max(-0.4, Math.min(0.4, targetPitch));
    },
    setTargetAngles: (yaw: number, pitch: number) => {
      targetYaw = Math.max(-0.6, Math.min(0.6, yaw));
      targetPitch = Math.max(-0.35, Math.min(0.35, pitch));
    },
    dispose: () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLostHandler);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    },
  };
}
