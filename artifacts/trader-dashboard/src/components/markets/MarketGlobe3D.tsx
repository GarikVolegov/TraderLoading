import { useEffect, useRef, useState } from "react";
import {
  AmbientLight,
  BufferGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  PointLight,
  Scene,
  SphereGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { Sun, Moon } from "lucide-react";
import { triggerHaptic } from "@/lib/hapticPulse";

export interface MarketPin {
  readonly id: string;
  readonly symbol: string;
  readonly name: string;
  readonly region: "us" | "europe" | "asia" | "global";
  readonly lat: number;
  readonly lon: number;
  readonly price: string;
  readonly changePct: number;
  readonly isKillZone: boolean; // Kill-zone attiva o fuori orario
  readonly flag: string;
}

export const MARKET_PINS: readonly MarketPin[] = [
  {
    id: "us500",
    symbol: "US500",
    name: "S&P 500",
    region: "us",
    lat: 40.71,
    lon: -74.0,
    price: "5.824,60",
    changePct: -1.39,
    isKillZone: false,
    flag: "🇺🇸",
  },
  {
    id: "us30",
    symbol: "US30",
    name: "Dow Jones",
    region: "us",
    lat: 38.9,
    lon: -77.03,
    price: "43.210,15",
    changePct: -0.53,
    isKillZone: false,
    flag: "🇺🇸",
  },
  {
    id: "us100",
    symbol: "US100",
    name: "Nasdaq 100",
    region: "us",
    lat: 42.36,
    lon: -71.05,
    price: "20.415,80",
    changePct: -3.66,
    isKillZone: false,
    flag: "🇺🇸",
  },
  {
    id: "de40",
    symbol: "DE40",
    name: "DAX 40",
    region: "europe",
    lat: 50.11,
    lon: 8.68,
    price: "19.458,20",
    changePct: 1.15,
    isKillZone: true,
    flag: "🇩🇪",
  },
  {
    id: "gb100",
    symbol: "GB100",
    name: "FTSE 100",
    region: "europe",
    lat: 51.5,
    lon: -0.12,
    price: "8.245,50",
    changePct: 0.33,
    isKillZone: true,
    flag: "🇬🇧",
  },
  {
    id: "fr40",
    symbol: "FR40",
    name: "CAC 40",
    region: "europe",
    lat: 48.85,
    lon: 2.35,
    price: "7.530,10",
    changePct: 1.05,
    isKillZone: true,
    flag: "🇫🇷",
  },
  {
    id: "nikkei",
    symbol: "NIKKEI",
    name: "Nikkei 225",
    region: "asia",
    lat: 35.67,
    lon: 139.65,
    price: "38.910,00",
    changePct: 0.82,
    isKillZone: false,
    flag: "🇯🇵",
  },
  {
    id: "hangseng",
    symbol: "HK50",
    name: "Hang Seng",
    region: "asia",
    lat: 22.31,
    lon: 114.16,
    price: "20.590,40",
    changePct: 1.2,
    isKillZone: false,
    flag: "🇭🇰",
  },
  {
    id: "xauusd",
    symbol: "XAUUSD",
    name: "Oro Spot",
    region: "global",
    lat: 47.37,
    lon: 8.54,
    price: "2.748,30",
    changePct: 0.45,
    isKillZone: true,
    flag: "✦",
  },
];

interface PinScreenPos {
  pin: MarketPin;
  x: number;
  y: number;
  visible: boolean;
}

interface MarketGlobe3DProps {
  selectedRegion: "all" | "us" | "europe" | "asia";
  onSelectPin?: (pin: MarketPin) => void;
}

export function MarketGlobe3D({ selectedRegion, onSelectPin }: MarketGlobe3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [screenPins, setScreenPins] = useState<PinScreenPos[]>([]);
  const targetRotationYRef = useRef<number | null>(null);

  // Region camera targets
  useEffect(() => {
    if (selectedRegion === "us") {
      targetRotationYRef.current = 1.35;
    } else if (selectedRegion === "europe") {
      targetRotationYRef.current = -0.15;
    } else if (selectedRegion === "asia") {
      targetRotationYRef.current = -2.35;
    } else {
      targetRotationYRef.current = null;
    }
  }, [selectedRegion]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || 360;
    const height = container.clientHeight || 360;

    const scene = new Scene();
    const camera = new PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.4);

    const renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // Root rotating globe group
    const globeGroup = new Group();
    scene.add(globeGroup);

    // 1. Base dark obsidian sphere
    const globeRadius = 1.55;
    const sphereGeo = new SphereGeometry(globeRadius, 36, 36);
    const sphereMat = new MeshStandardMaterial({
      color: 0x05070c,
      roughness: 0.85,
      metalness: 0.2,
    });
    const sphereMesh = new Mesh(sphereGeo, sphereMat);
    globeGroup.add(sphereMesh);

    // 2. Wireframe / Latitude & Longitude grid lines
    const wireframeGeo = new SphereGeometry(globeRadius * 1.002, 18, 12);
    const wireframeMat = new MeshBasicMaterial({
      color: 0x1e3a8a,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    });
    const wireframeMesh = new Mesh(wireframeGeo, wireframeMat);
    globeGroup.add(wireframeMesh);

    // 3. Equator and Prime Meridian rings in Imperial Gold
    const ringGeo = new BufferGeometry();
    const ringPoints: number[] = [];
    for (let i = 0; i <= 64; i++) {
      const theta = (i / 64) * Math.PI * 2;
      ringPoints.push(Math.cos(theta) * (globeRadius * 1.004), 0, Math.sin(theta) * (globeRadius * 1.004));
    }
    ringGeo.setAttribute("position", new Float32BufferAttribute(ringPoints, 3));
    const ringMat = new LineBasicMaterial({ color: 0xc5a059, transparent: true, opacity: 0.45 });
    const equatorLine = new LineSegments(ringGeo, ringMat);
    globeGroup.add(equatorLine);

    // 4. Continents Point Cloud (procedural earth-like clusters)
    const pointsCount = 950;
    const positions = new Float32Array(pointsCount * 3);
    const continentCenters = [
      { lat: 45, lon: -100, spread: 28 }, // North America
      { lat: -15, lon: -60, spread: 22 }, // South America
      { lat: 50, lon: 15, spread: 20 }, // Europe
      { lat: 10, lon: 20, spread: 26 }, // Africa
      { lat: 40, lon: 95, spread: 35 }, // Asia
      { lat: -25, lon: 135, spread: 20 }, // Australia
    ];

    let pIdx = 0;
    for (let i = 0; i < pointsCount; i++) {
      const center = continentCenters[i % continentCenters.length];
      const lat = center.lat + (Math.random() - 0.5) * center.spread * 1.8;
      const lon = center.lon + (Math.random() - 0.5) * center.spread * 2.2;

      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lon + 180) * (Math.PI / 180);

      const r = globeRadius * 1.008;
      positions[pIdx] = -(r * Math.sin(phi) * Math.cos(theta));
      positions[pIdx + 1] = r * Math.cos(phi);
      positions[pIdx + 2] = r * Math.sin(phi) * Math.sin(theta);
      pIdx += 3;
    }

    const pointsGeo = new BufferGeometry();
    pointsGeo.setAttribute("position", new Float32BufferAttribute(positions, 3));
    const pointsMat = new PointsMaterial({
      color: 0x3b82f6,
      size: 0.045,
      transparent: true,
      opacity: 0.7,
    });
    const pointsMesh = new Points(pointsGeo, pointsMat);
    globeGroup.add(pointsMesh);

    // 5. Atmosphere Glow outer shell
    const atmoGeo = new SphereGeometry(globeRadius * 1.08, 32, 32);
    const atmoMat = new MeshBasicMaterial({
      color: 0x1d4ed8,
      transparent: true,
      opacity: 0.08,
      wireframe: false,
    });
    const atmoMesh = new Mesh(atmoGeo, atmoMat);
    scene.add(atmoMesh);

    // 6. Lights
    const ambientLight = new AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const dirLight = new DirectionalLight(0xfff1cf, 1.2);
    dirLight.position.set(4, 3, 5);
    scene.add(dirLight);

    const goldPoint = new PointLight(0xc5a059, 1.5, 12);
    goldPoint.position.set(-3, -2, 3);
    scene.add(goldPoint);

    // Market Pin 3D Anchors
    const pinObjects: { pin: MarketPin; vec: Vector3 }[] = MARKET_PINS.map((pin) => {
      const phi = (90 - pin.lat) * (Math.PI / 180);
      const theta = (pin.lon + 180) * (Math.PI / 180);
      const r = globeRadius * 1.015;
      const x = -(r * Math.sin(phi) * Math.cos(theta));
      const y = r * Math.cos(phi);
      const z = r * Math.sin(phi) * Math.sin(theta);

      return {
        pin,
        vec: new Vector3(x, y, z),
      };
    });

    // Touch & Mouse Drag controls
    let isDragging = false;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let velX = 0;
    let velY = 0;

    const onPointerDown = (e: PointerEvent) => {
      isDragging = true;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;
      targetRotationYRef.current = null;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevPointerX;
      const dy = e.clientY - prevPointerY;
      prevPointerX = e.clientX;
      prevPointerY = e.clientY;

      velX = dx * 0.006;
      velY = dy * 0.006;

      globeGroup.rotation.y += velX;
      globeGroup.rotation.x = Math.max(-0.6, Math.min(0.6, globeGroup.rotation.x + velY));
    };

    const onPointerUp = () => {
      isDragging = false;
    };

    const domElement = renderer.domElement;
    domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);

    // Initial rotation slightly tilted towards Europe/US
    globeGroup.rotation.x = 0.18;
    globeGroup.rotation.y = -0.3;

    // Animation loop
    let animId = 0;
    const cameraDir = new Vector3();

    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Smooth programmatic target rotation (when selecting a region)
      if (targetRotationYRef.current !== null && !isDragging) {
        const diff = targetRotationYRef.current - globeGroup.rotation.y;
        if (Math.abs(diff) > 0.005) {
          globeGroup.rotation.y += diff * 0.08;
        } else {
          targetRotationYRef.current = null;
        }
      } else if (!isDragging) {
        // Subtle constant rotation
        globeGroup.rotation.y += 0.0018;
        velX *= 0.92;
        velY *= 0.92;
        globeGroup.rotation.y += velX;
        globeGroup.rotation.x = Math.max(-0.6, Math.min(0.6, globeGroup.rotation.x + velY));
      }

      renderer.render(scene, camera);

      // Project 3D Pins to 2D Screen Positions
      camera.getWorldDirection(cameraDir);
      const w = container.clientWidth || 360;
      const h = container.clientHeight || 360;

      const updatedPins: PinScreenPos[] = pinObjects.map(({ pin, vec }) => {
        const worldPos = vec.clone().applyMatrix4(globeGroup.matrixWorld);

        // Check if marker faces the camera (front hemisphere)
        const dot = worldPos.clone().normalize().dot(camera.position.clone().normalize());
        const visible = dot > 0.28;

        const proj = worldPos.clone().project(camera);
        const x = (proj.x * 0.5 + 0.5) * w;
        const y = (-proj.y * 0.5 + 0.5) * h;

        return { pin, x, y, visible };
      });

      setScreenPins(updatedPins);
    };

    animId = requestAnimationFrame(animate);

    // Handle Resize
    const handleResize = () => {
      if (!container) return;
      const newW = container.clientWidth;
      const newH = container.clientHeight;
      camera.aspect = newW / newH;
      camera.updateProjectionMatrix();
      renderer.setSize(newW, newH);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animId);
      domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", handleResize);

      if (container.contains(domElement)) {
        container.removeChild(domElement);
      }

      sphereGeo.dispose();
      sphereMat.dispose();
      wireframeGeo.dispose();
      wireframeMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      pointsGeo.dispose();
      pointsMat.dispose();
      atmoGeo.dispose();
      atmoMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[320px] sm:h-[380px] select-none touch-none overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
      aria-label="Globo 3D Interattivo dei Mercati e Kill-Zone AUREUS"
    >
      {/* Atmosphere radial ambient background gradient */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,rgba(30,58,138,0.18)_0%,rgba(7,8,11,0)_70%)]" />

      {/* Floating 2D Market Badges projected from 3D space */}
      {screenPins.map(({ pin, x, y, visible }) => {
        if (!visible) return null;
        const isSelected = selectedRegion === "all" || selectedRegion === pin.region;
        const isPositive = pin.changePct >= 0;

        return (
          <div
            key={pin.id}
            style={{
              left: `${x}px`,
              top: `${y}px`,
              transform: "translate(-50%, -50%)",
              opacity: isSelected ? 1 : 0.25,
            }}
            onClick={(e) => {
              e.stopPropagation();
              triggerHaptic("selection");
              if (onSelectPin) onSelectPin(pin);
            }}
            className={`absolute pointer-events-auto cursor-pointer transition-opacity duration-300 rounded-lg border px-2 py-1 shadow-lg backdrop-blur-md flex flex-col gap-0.5 ${
              isSelected
                ? "bg-[#0d0f14]/90 border-[#C5A059]/40 hover:border-[#E8C56A] hover:bg-[#141622] scale-100 hover:scale-105"
                : "bg-[#07080b]/75 border-white/10"
            }`}
          >
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span className="font-mono text-[10px] font-bold text-white tracking-wide">{pin.symbol}</span>
              {pin.isKillZone ? (
                <Sun className="h-2.5 w-2.5 text-[#E8C56A] animate-pulse" />
              ) : (
                <Moon className="h-2.5 w-2.5 text-[#94a3b8]" />
              )}
            </div>
            <div className="flex items-center gap-1 whitespace-nowrap font-mono text-[9px] font-bold">
              <span className={isPositive ? "text-[#10b981]" : "text-[#ef4444]"}>
                {isPositive ? `▲ +${pin.changePct.toFixed(2)}%` : `▼ ${pin.changePct.toFixed(2)}%`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
