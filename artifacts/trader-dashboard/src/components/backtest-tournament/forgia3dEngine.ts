import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  OctahedronGeometry,
  OrthographicCamera,
  Scene,
  SphereGeometry,
  TorusGeometry,
  WebGLRenderer,
  type Material,
} from "three";

export interface Participant3DData {
  displayName: string;
  profitPct: number;
  isDisqualified?: boolean;
  isCurrentUser?: boolean;
}

export interface Forgia3DController {
  setParticipants: (participants: Participant3DData[]) => void;
  triggerTradePulse: (index?: number) => void;
  rotate: (dx: number, dy: number) => void;
  dispose: () => void;
}

/**
 * Procedural 3D Arena for Limen Battle Rooms (Three.js)
 * High-performance, zero external assets, strictly optimized with automatic pause.
 */
export function createForgia3DScene(
  host: HTMLDivElement,
  initialParticipants: Participant3DData[] = [],
  reducedMotion = false,
): Forgia3DController | null {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) return null;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch {
    return null;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  canvas.setAttribute("aria-hidden", "true");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  host.appendChild(canvas);

  const scene = new Scene();
  const camera = new OrthographicCamera(-2.2, 2.2, 1.8, -1.8, 0.1, 40);
  camera.position.set(5, 4, 6);
  camera.lookAt(0, 0, 0);

  // Solemn lighting: Warm Trajan gold key + obsidian ambient
  scene.add(new AmbientLight(0xffffff, 1.4));
  const keyLight = new DirectionalLight(0xd4af37, 3.5);
  keyLight.position.set(4, 6, 3);
  scene.add(keyLight);

  const rimLight = new DirectionalLight(0x71717a, 2.0);
  rimLight.position.set(-4, -2, -4);
  scene.add(rimLight);

  // Group containing the central monument
  const rootGroup = new Group();
  scene.add(rootGroup);

  const nodesGroup = new Group();
  rootGroup.add(nodesGroup);

  const pulseGroup = new Group();
  rootGroup.add(pulseGroup);

  const geometries: BufferGeometry[] = [];
  const materials: Material[] = [];

  // Limen Palette materials
  const goldMaterial = new MeshStandardMaterial({
    color: new Color("#D4AF37"),
    roughness: 0.28,
    metalness: 0.85,
  });
  const darkObsidianMaterial = new MeshStandardMaterial({
    color: new Color("#101116"),
    roughness: 0.35,
    metalness: 0.7,
  });
  const titaniumMaterial = new MeshStandardMaterial({
    color: new Color("#3A3C4A"),
    roughness: 0.4,
    metalness: 0.8,
  });
  const wireGoldMaterial = new LineBasicMaterial({
    color: new Color("#C5A059"),
    transparent: true,
    opacity: 0.65,
  });
  const disqualifiedMaterial = new MeshStandardMaterial({
    color: new Color("#4A1A1A"),
    roughness: 0.7,
    metalness: 0.1,
  });

  materials.push(goldMaterial, darkObsidianMaterial, titaniumMaterial, wireGoldMaterial, disqualifiedMaterial);

  // Central Core: Obsidian Crystal inside a Trajan Gold Wireframe
  const coreGeom = new OctahedronGeometry(0.75);
  geometries.push(coreGeom);
  const coreMesh = new Mesh(coreGeom, darkObsidianMaterial);
  coreMesh.scale.set(0.9, 1.4, 0.9);
  rootGroup.add(coreMesh);

  const wireGeom = new EdgesGeometry(new OctahedronGeometry(0.95));
  geometries.push(wireGeom);
  const wireMesh = new LineSegments(wireGeom, wireGoldMaterial);
  wireMesh.scale.set(0.92, 1.45, 0.92);
  rootGroup.add(wireMesh);

  // Outer Orbital Ring (Titanium Torus)
  const ringGeom = new TorusGeometry(1.65, 0.025, 12, 64);
  geometries.push(ringGeom);
  const ringMesh = new Mesh(ringGeom, titaniumMaterial);
  ringMesh.rotation.x = Math.PI / 2.2;
  rootGroup.add(ringMesh);

  // Second inclined orbital ring
  const ringGeom2 = new TorusGeometry(1.4, 0.018, 10, 64);
  geometries.push(ringGeom2);
  const ringMesh2 = new Mesh(ringGeom2, wireGoldMaterial);
  ringMesh2.rotation.set(Math.PI / 3, 0.4, 0);
  rootGroup.add(ringMesh2);

  // Build orbital participant nodes
  const buildNodes = (participants: Participant3DData[]) => {
    while (nodesGroup.children.length > 0) {
      nodesGroup.remove(nodesGroup.children[0]);
    }

    const count = Math.max(participants.length, 4);
    for (let i = 0; i < count; i++) {
      const p = participants[i];
      const angle = (i * Math.PI * 2) / count;
      const radius = 1.65;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(angle * 2) * 0.25;

      const isLeader = i === 0 && (p?.profitPct ?? 0) > 0;
      const isDq = p?.isDisqualified;

      const nodeGeom = new SphereGeometry(isLeader ? 0.14 : 0.09, 16, 12);
      geometries.push(nodeGeom);

      const mat = isDq
        ? disqualifiedMaterial
        : isLeader || p?.isCurrentUser
          ? goldMaterial
          : titaniumMaterial;

      const nodeMesh = new Mesh(nodeGeom, mat);
      nodeMesh.position.set(x, y, z);
      nodesGroup.add(nodeMesh);
    }
  };

  buildNodes(initialParticipants);

  let disposed = false;
  let visible = true;
  let frame = 0;
  let yaw = 0.3;
  let pitch = 0.2;
  let pulseStartTime = 0;

  const render = () => {
    frame = 0;
    if (disposed || !visible || document.hidden) return;

    if (!reducedMotion) {
      yaw += 0.005;
      coreMesh.rotation.y += 0.007;
      wireMesh.rotation.y -= 0.004;
    }

    rootGroup.rotation.y = yaw;
    rootGroup.rotation.x = pitch;

    // Pulse animation on trade execution
    if (pulseStartTime > 0) {
      const elapsed = performance.now() - pulseStartTime;
      const progress = Math.min(elapsed / 800, 1);
      if (progress < 1) {
        pulseGroup.scale.setScalar(1 + progress * 0.8);
        const firstChild = pulseGroup.children[0] as LineSegments | undefined;
        if (firstChild?.material) {
          (firstChild.material as LineBasicMaterial).opacity = (1 - progress) * 0.8;
        }
      } else {
        pulseStartTime = 0;
        while (pulseGroup.children.length > 0) {
          pulseGroup.remove(pulseGroup.children[0]);
        }
      }
    }

    renderer.render(scene, camera);
    frame = requestAnimationFrame(render);
  };

  frame = requestAnimationFrame(render);

  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    camera.left = -1.8 * aspect;
    camera.right = 1.8 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  });
  resize.observe(host);

  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !frame) {
      frame = requestAnimationFrame(render);
    } else if (!visible && frame) {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(host);

  const onVisibilityChange = () => {
    if (!document.hidden && visible && !frame) {
      frame = requestAnimationFrame(render);
    }
  };
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    setParticipants(newParticipants) {
      buildNodes(newParticipants);
    },
    triggerTradePulse() {
      pulseStartTime = performance.now();
      while (pulseGroup.children.length > 0) {
        pulseGroup.remove(pulseGroup.children[0]);
      }
      const pGeom = new EdgesGeometry(new OctahedronGeometry(1.2));
      const pMat = new LineBasicMaterial({
        color: new Color("#D4AF37"),
        transparent: true,
        opacity: 0.9,
      });
      const pMesh = new LineSegments(pGeom, pMat);
      pulseGroup.add(pMesh);
    },
    rotate(dx, dy) {
      yaw += dx;
      pitch = Math.max(-0.4, Math.min(0.4, pitch + dy));
    },
    dispose() {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (canvas.parentElement) {
        canvas.parentElement.removeChild(canvas);
      }
    },
  };
}
