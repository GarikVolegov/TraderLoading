import {
  AmbientLight,
  BoxGeometry,
  Color,
  CylinderGeometry,
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
  type BufferGeometry,
  type Material,
} from "three";
import type { ProcessVisualStage } from "./ProcessScene";

export interface ProcessSceneController {
  setStage: (stage: ProcessVisualStage) => void;
  rotate: (x: number, y: number) => void;
  reset: () => void;
  dispose: () => void;
}

/** Small procedural sculptures. No remote assets, perpetual loop, or simulated performance. */
export function createProcessScene(
  host: HTMLDivElement,
  initialStage: ProcessVisualStage,
  reducedMotion: boolean,
  onContextLost: () => void,
): ProcessSceneController | null {
  let renderer: WebGLRenderer;
  // Test support before constructing Three's renderer (which logs an error without WebGL).
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { alpha: true, antialias: true });
  if (!context) return null;
  try {
    renderer = new WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  canvas.setAttribute("aria-hidden", "true");
  host.appendChild(canvas);
  const scene = new Scene();
  const camera = new OrthographicCamera(-2, 2, 1.65, -1.65, 0.1, 30);
  camera.position.set(4, 3.5, 6);
  camera.lookAt(0, 0, 0);
  scene.add(new AmbientLight(0xffffff, 2));
  const key = new DirectionalLight(0xeafff6, 4);
  key.position.set(3, 5, 4);
  scene.add(key);
  const rim = new DirectionalLight(0x6bf3c1, 3);
  rim.position.set(-4, 2, -3);
  scene.add(rim);
  const sculpture = new Group();
  scene.add(sculpture);
  let geometries: BufferGeometry[] = [];
  let materials: Material[] = [];
  let activeStage = initialStage;
  let disposed = false;
  let contextLost = false;
  let visible = true;
  let frame = 0;
  let deadline = 0;
  let yaw = -0.22;
  let tilt = 0;
  let dragging: { id: number; x: number; y: number } | null = null;
  let renders = 0;

  const clearModel = () => {
    sculpture.clear();
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    geometries = [];
    materials = [];
  };
  const build = (stage: ProcessVisualStage) => {
    clearModel();
    // Read the live brand color, including theme changes.
    const token = getComputedStyle(host).getPropertyValue("--primary").trim();
    const accent = new Color(token ? `hsl(${token.split(/\s+/).join(", ")})` : "#65d9ad");
    const mint = new MeshStandardMaterial({ color: accent, roughness: 0.24, metalness: 0.4 });
    const porcelain = new MeshStandardMaterial({ color: 0xd6e4df, roughness: 0.3, metalness: 0.2 });
    const graphite = new MeshStandardMaterial({
      color: 0x243b35,
      roughness: 0.32,
      metalness: 0.65,
    });
    const wire = new LineBasicMaterial({ color: accent, transparent: true, opacity: 0.42 });
    materials.push(mint, porcelain, graphite, wire);
    const mesh = (geometry: BufferGeometry, material: Material, x = 0, y = 0, z = 0) => {
      geometries.push(geometry);
      const object = new Mesh(geometry, material);
      object.position.set(x, y, z);
      sculpture.add(object);
      return object;
    };
    mesh(new CylinderGeometry(1.13, 1.2, 0.12, 64), graphite, 0, -0.85);
    const footing = mesh(new TorusGeometry(1.19, 0.012, 8, 80), mint, 0, -0.77);
    footing.rotation.x = Math.PI / 2;
    const kind =
      stage === "prepare"
        ? "define"
        : stage === "operate"
          ? "apply"
          : stage === "close"
            ? "verify"
            : stage === "complete"
              ? "consolidate"
              : stage;
    if (kind === "define") {
      for (let i = 0; i < 3; i++) {
        const block = mesh(
          new BoxGeometry(1.15 - i * 0.12, 0.22, 1.15 - i * 0.12),
          i === 2 ? mint : porcelain,
          0,
          -0.58 + i * 0.36,
        );
        block.rotation.y = i * 0.16;
      }
      const box = new BoxGeometry(0.79, 0.46, 0.79);
      const geometry = new EdgesGeometry(box);
      geometries.push(box, geometry);
      const outline = new LineSegments(geometry, wire);
      outline.position.y = 0.76;
      outline.rotation.y = 0.32;
      sculpture.add(outline);
    } else if (kind === "verify") {
      mesh(new OctahedronGeometry(0.48), mint, 0, 0.04);
      for (let i = 0; i < 2; i++) {
        const ring = mesh(
          new TorusGeometry(0.86 + i * 0.2, 0.045, 12, 80),
          i ? porcelain : mint,
          0,
          0.1,
        );
        ring.rotation.set(Math.PI / 2.4, i * 1.25, i * 0.45);
      }
      mesh(new SphereGeometry(0.095, 16, 12), porcelain, 0.74, 0.65, -0.24);
    } else if (kind === "apply") {
      const crystal = mesh(new OctahedronGeometry(0.62), mint, 0, 0.13);
      crystal.scale.y = 1.6;
      const orbit = mesh(new TorusGeometry(0.98, 0.035, 12, 80), porcelain, 0, -0.17);
      orbit.rotation.x = Math.PI / 2;
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2;
        mesh(
          new BoxGeometry(0.08, 0.08, 0.2),
          mint,
          Math.sin(angle),
          -0.17,
          Math.cos(angle),
        ).rotation.y = angle;
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const ring = mesh(
          new TorusGeometry(0.78, 0.115, 16, 64),
          i === 1 ? porcelain : mint,
          0,
          -0.44 + i * 0.4,
        );
        ring.rotation.x = Math.PI / 2;
      }
      mesh(new SphereGeometry(0.24, 24, 16), porcelain, 0, 0.53);
    }
    host.dataset.model = kind;
  };
  const render = () => {
    frame = 0;
    if (disposed || contextLost || !visible || document.hidden) return;
    const progress = reducedMotion
      ? 1
      : Math.min(1, Math.max(0, 1 - (deadline - performance.now()) / 650));
    const eased = 1 - Math.pow(1 - progress, 3);
    sculpture.rotation.set(tilt, yaw + (1 - eased) * 0.24, 0);
    sculpture.position.y = (1 - eased) * -0.15;
    sculpture.scale.setScalar(0.94 + eased * 0.06);
    renderer.render(scene, camera);
    host.dataset.renderCount = String(++renders);
    host.dataset.rotation = yaw.toFixed(2);
    if (progress < 1) frame = requestAnimationFrame(render);
  };
  const invalidate = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(render);
  };
  const rotate = (x: number, y: number) => {
    yaw += x;
    tilt = Math.max(-0.35, Math.min(0.35, tilt + y));
    deadline = 0;
    invalidate();
  };
  const resize = new ResizeObserver(() => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    const aspect = width / height;
    camera.left = -1.65 * aspect;
    camera.right = 1.65 * aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    invalidate();
  });
  resize.observe(host);
  const intersection = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) invalidate();
    else {
      cancelAnimationFrame(frame);
      frame = 0;
    }
  });
  intersection.observe(host);
  const visibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(frame);
      frame = 0;
    } else invalidate();
  };
  const down = (event: PointerEvent) => {
    if (event.pointerType === "touch" || event.button !== 0) return; // Keep mobile vertical scrolling natural.
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
    host.setPointerCapture(event.pointerId);
  };
  const move = (event: PointerEvent) => {
    if (!dragging || dragging.id !== event.pointerId) return;
    rotate((event.clientX - dragging.x) * 0.012, (event.clientY - dragging.y) * 0.007);
    dragging.x = event.clientX;
    dragging.y = event.clientY;
  };
  const up = () => {
    dragging = null;
  };
  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    canvas.style.display = "none";
    cancelAnimationFrame(frame);
    frame = 0;
    onContextLost();
  };
  document.addEventListener("visibilitychange", visibility);
  host.addEventListener("pointerdown", down);
  host.addEventListener("pointermove", move);
  host.addEventListener("pointerup", up);
  host.addEventListener("pointercancel", up);
  canvas.addEventListener("webglcontextlost", lost);
  // A theme change needs one repaint, not an animation loop.
  const theme = new MutationObserver(() => {
    build(activeStage);
    invalidate();
  });
  theme.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style"],
  });
  build(initialStage);
  deadline = reducedMotion ? 0 : performance.now() + 650;
  invalidate();
  return {
    setStage(stage) {
      if (stage === activeStage) return;
      activeStage = stage;
      build(stage);
      deadline = reducedMotion ? 0 : performance.now() + 650;
      invalidate();
    },
    rotate,
    reset() {
      yaw = -0.22;
      tilt = 0;
      deadline = 0;
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      intersection.disconnect();
      theme.disconnect();
      document.removeEventListener("visibilitychange", visibility);
      host.removeEventListener("pointerdown", down);
      host.removeEventListener("pointermove", move);
      host.removeEventListener("pointerup", up);
      host.removeEventListener("pointercancel", up);
      canvas.removeEventListener("webglcontextlost", lost);
      clearModel();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}
