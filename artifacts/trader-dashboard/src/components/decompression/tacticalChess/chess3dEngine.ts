/**
 * LIMEN PROTOCOL — Gli Scacchi dell'Ordine (Trans-Limen Tactical Chess 3D)
 * Native Three.js 3D Engine: Sculpted Staunton Pieces (Noble Knight, Sovereign King,
 * Fluted Queen, Miter Bishop, Crenellated Rook, Classic Pawn), Obsidian & Ivory Board,
 * Dynamic PCF Soft Shadow Mapping, Parabolic Move Arc, Wheel Zoom, Orbit Controls,
 * High-Precision Algebraic Markers & Broadcast Framing.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  Raycaster,
  RingGeometry,
  Scene,
  Shape,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { ChessPiece, PieceColor, PieceType, Square } from "./chessTypes";
import { gameAudio } from "../gameAudioSynthesizer";

export type CameraMode = "dynamic" | "tactical" | "hero" | "topdown";

export interface Chess3dCallbacks {
  onSquareClick: (row: number, col: number) => void;
  onSquareHover?: (row: number | null, col: number | null) => void;
}

export interface Chess3dController {
  setBoardState: (board: (ChessPiece | null)[][]) => void;
  setSelectedSquare: (
    square: Square | null,
    legalDestinations?: Square[],
    board?: (ChessPiece | null)[][]
  ) => void;
  setCursorSquare: (square: Square | null) => void;
  setCameraMode: (mode: CameraMode) => void;
  setTheme: (theme: "obsidian_gold" | "carrara_temple" | "cyber_void") => void;
  setLastMoveHighlight: (from: Square | null, to: Square | null) => void;
  resetCamera: () => void;
  animateMove: (from: Square, to: Square, onComplete: () => void) => void;
  animateRevert: (from: Square, to: Square, onComplete: () => void) => void;
  showSolutionBeacon: (from: Square, to: Square) => void;
  clearSolutionBeacon: () => void;
  triggerCheckHighlight: (kingSquare: Square) => void;
  triggerVictory: () => void;
  dispose: () => void;
}

interface Piece3DObject {
  group: Group;
  piece: ChessPiece;
  row: number;
  col: number;
  baseY: number;
  targetPos: Vector3;
}

export function initChess3dEngine(
  container: HTMLDivElement,
  callbacks: Chess3dCallbacks
): Chess3dController {
  const width = container.clientWidth || 800;
  const height = container.clientHeight || 550;

  const scene = new Scene();
  // Deep noble obsidian with warm temple slate tint
  scene.background = new Color(0x07090f);
  scene.fog = new FogExp2(0x07090f, 0.010);

  const camera = new PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 9.6, 8.2);
  camera.lookAt(0, 0, 0.2);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.32;
  // Enable cinematic soft shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;

  container.appendChild(renderer.domElement);

  // -----------------------------------------------------------
  // ILLUMINAZIONE CINEMATOGRAFICA A 5 PUNTI CON OMBRE MORBIDE
  // -----------------------------------------------------------
  // 1. Hemisphere Light: warm golden sky and slate floor bounce
  const hemiLight = new HemisphereLight(0xfff5e4, 0x141824, 1.35);
  hemiLight.position.set(0, 16, 0);
  scene.add(hemiLight);

  // 2. Key Directional Light: primary golden sunlight from top-right with soft shadow
  const keyLight = new DirectionalLight(0xffeed6, 2.6);
  keyLight.position.set(6.5, 14, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.width = 2048;
  keyLight.shadow.mapSize.height = 2048;
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 30;
  keyLight.shadow.camera.left = -6.5;
  keyLight.shadow.camera.right = 6.5;
  keyLight.shadow.camera.top = 6.5;
  keyLight.shadow.camera.bottom = -6.5;
  keyLight.shadow.bias = -0.0004;
  keyLight.shadow.normalBias = 0.02;
  scene.add(keyLight);

  // 3. Fill Directional Light: soft cool balancing fill from opposite flank
  const fillLight = new DirectionalLight(0x9cb2de, 1.3);
  fillLight.position.set(-6.5, 11, -6);
  scene.add(fillLight);

  // 4. Hero Overhead Spotlight: radiant illumination centered on the board
  const overheadSpot = new SpotLight(0xfff8eb, 2.8, 30, Math.PI / 3.4, 0.45, 1.1);
  overheadSpot.position.set(0, 14, 0.4);
  overheadSpot.target.position.set(0, 0, 0);
  scene.add(overheadSpot);
  scene.add(overheadSpot.target);

  // 5. Silhouette Rim Light: illuminates Black rank from behind so dark pieces pop
  const silhouetteRim = new PointLight(0xe8c56a, 2.5, 20);
  silhouetteRim.position.set(0, 4.2, -6.8);
  scene.add(silhouetteRim);

  // Flank Rims for metallic specular luster
  const leftRim = new PointLight(0xd4af37, 1.5, 16);
  leftRim.position.set(-6.8, 3.8, 2.0);
  scene.add(leftRim);

  const rightRim = new PointLight(0xd4af37, 1.5, 16);
  rightRim.position.set(6.8, 3.8, 2.0);
  scene.add(rightRim);

  const obsidianCheckRim = new PointLight(0xef4444, 0.0, 18);
  obsidianCheckRim.position.set(0, 5.0, 0);
  scene.add(obsidianCheckRim);

  // -----------------------------------------------------------
  // FLOATING GOLDEN STARDUST (ATMOSPHERIC DEPTH PARTICLES)
  // -----------------------------------------------------------
  const particleCount = 140;
  const particleGeo = new BufferGeometry();
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    particlePositions[i] = (Math.random() - 0.5) * 18;
    particlePositions[i + 1] = Math.random() * 8 + 0.2;
    particlePositions[i + 2] = (Math.random() - 0.5) * 18;
  }
  particleGeo.setAttribute("position", new Float32BufferAttribute(particlePositions, 3));
  const particleMat = new PointsMaterial({
    color: 0xe8c56a,
    size: 0.045,
    transparent: true,
    opacity: 0.45,
  });
  const particles = new Points(particleGeo, particleMat);
  scene.add(particles);

  // -----------------------------------------------------------
  // 3D CHESSBOARD & PEDESTAL
  // -----------------------------------------------------------
  const boardGroup = new Group();
  const squareSize = 1.0;
  const boardOrigin = -(8 * squareSize) / 2 + squareSize / 2; // -3.5

  function squareToWorld(row: number, col: number): Vector3 {
    return new Vector3(boardOrigin + col * squareSize, 0.1, boardOrigin + row * squareSize);
  }

  // Base Board Pedestal
  const boardFrameGeo = new BoxGeometry(9.3, 0.38, 9.3);
  const boardFrameMat = new MeshStandardMaterial({
    color: 0x0f121a,
    metalness: 0.70,
    roughness: 0.30,
  });
  const boardFrame = new Mesh(boardFrameGeo, boardFrameMat);
  boardFrame.position.y = -0.13;
  boardFrame.receiveShadow = true;
  boardGroup.add(boardFrame);

  // Outer Gold Inlay Bevel
  const frameRimGeo = new TorusGeometry(6.48, 0.10, 8, 4);
  const frameRimMat = new MeshStandardMaterial({
    color: 0xd8b260,
    metalness: 0.88,
    roughness: 0.22,
  });
  const frameRim = new Mesh(frameRimGeo, frameRimMat);
  frameRim.rotation.x = Math.PI / 2;
  frameRim.rotation.z = Math.PI / 4;
  frameRim.position.y = 0.055;
  boardGroup.add(frameRim);

  // 64 Tiles with fine chamfer bevels and shadow reception
  const tileGeo = new BoxGeometry(squareSize * 0.975, 0.08, squareSize * 0.975);
  const lightTileMat = new MeshStandardMaterial({
    color: 0xf6ede0, // Carrara Ivory & Gilded Alabaster
    metalness: 0.08,
    roughness: 0.28,
  });
  const darkTileMat = new MeshStandardMaterial({
    color: 0x161a26, // Imperial Obsidian Slate
    metalness: 0.32,
    roughness: 0.34,
  });

  const tileMeshes: Mesh[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const tile = new Mesh(tileGeo, isLight ? lightTileMat : darkTileMat);
      const pos = squareToWorld(r, c);
      tile.position.set(pos.x, 0.04, pos.z);
      tile.receiveShadow = true;
      tile.userData = { row: r, col: c, isTile: true };
      boardGroup.add(tile);
      tileMeshes.push(tile);
    }
  }

  // -----------------------------------------------------------
  // ALGEBRAIC COORDINATES (A-H & 1-8 ON BOARD BEVELS)
  // -----------------------------------------------------------
  function createTextStripTexture(labels: string[], horizontal: boolean): CanvasTexture {
    const cvs = document.createElement("canvas");
    if (horizontal) {
      cvs.width = 1024;
      cvs.height = 128;
    } else {
      cvs.width = 128;
      cvs.height = 1024;
    }
    const ctx = cvs.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = "#F3D88C"; // Bright Aureus
      ctx.font = "bold 58px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const count = labels.length;
      for (let i = 0; i < count; i++) {
        if (horizontal) {
          const x = (i + 0.5) * (cvs.width / count);
          const y = cvs.height * 0.5;
          ctx.fillText(labels[i], x, y);
        } else {
          const x = cvs.width * 0.5;
          const y = (i + 0.5) * (cvs.height / count);
          ctx.fillText(labels[i], x, y);
        }
      }
    }
    return new CanvasTexture(cvs);
  }

  const fileLabels = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rankLabels = ["8", "7", "6", "5", "4", "3", "2", "1"];

  const fileTexBottom = createTextStripTexture(fileLabels, true);
  const fileTexTop = createTextStripTexture(fileLabels, true);
  const rankTexLeft = createTextStripTexture(rankLabels, false);
  const rankTexRight = createTextStripTexture(rankLabels, false);

  const coordMatBottom = new MeshBasicMaterial({ map: fileTexBottom, transparent: true, opacity: 0.90 });
  const coordMatTop = new MeshBasicMaterial({ map: fileTexTop, transparent: true, opacity: 0.90 });
  const coordMatLeft = new MeshBasicMaterial({ map: rankTexLeft, transparent: true, opacity: 0.90 });
  const coordMatRight = new MeshBasicMaterial({ map: rankTexRight, transparent: true, opacity: 0.90 });

  const horizStripGeo = new PlaneGeometry(8.0, 0.45);
  const vertStripGeo = new PlaneGeometry(0.45, 8.0);

  // Bottom strip (White side, z = 4.30)
  const bottomCoords = new Mesh(horizStripGeo, coordMatBottom);
  bottomCoords.rotation.x = -Math.PI / 2;
  bottomCoords.position.set(0, 0.056, 4.30);
  boardGroup.add(bottomCoords);

  // Top strip (Black side, z = -4.30)
  const topCoords = new Mesh(horizStripGeo, coordMatTop);
  topCoords.rotation.x = -Math.PI / 2;
  topCoords.rotation.z = Math.PI;
  topCoords.position.set(0, 0.056, -4.30);
  boardGroup.add(topCoords);

  // Left strip (col a, x = -4.30)
  const leftCoords = new Mesh(vertStripGeo, coordMatLeft);
  leftCoords.rotation.x = -Math.PI / 2;
  leftCoords.position.set(-4.30, 0.056, 0);
  boardGroup.add(leftCoords);

  // Right strip (col h, x = 4.30)
  const rightCoords = new Mesh(vertStripGeo, coordMatRight);
  rightCoords.rotation.x = -Math.PI / 2;
  rightCoords.position.set(4.30, 0.056, 0);
  boardGroup.add(rightCoords);

  scene.add(boardGroup);

  // -----------------------------------------------------------
  // LAST MOVE HIGHLIGHT DECALS
  // -----------------------------------------------------------
  const lastMoveGroup = new Group();
  scene.add(lastMoveGroup);

  const lastMoveTileGeo = new PlaneGeometry(0.96, 0.96);
  const lastMoveTileMat = new MeshBasicMaterial({
    color: 0xc5a059,
    side: DoubleSide,
    transparent: true,
    opacity: 0.30,
  });

  const lastMoveFromMesh = new Mesh(lastMoveTileGeo, lastMoveTileMat);
  lastMoveFromMesh.rotation.x = -Math.PI / 2;
  lastMoveFromMesh.position.y = 0.082;
  lastMoveFromMesh.visible = false;
  lastMoveGroup.add(lastMoveFromMesh);

  const lastMoveToMesh = new Mesh(lastMoveTileGeo, lastMoveTileMat);
  lastMoveToMesh.rotation.x = -Math.PI / 2;
  lastMoveToMesh.position.y = 0.082;
  lastMoveToMesh.visible = false;
  lastMoveGroup.add(lastMoveToMesh);

  function setLastMoveHighlight(from: Square | null, to: Square | null) {
    if (from) {
      const pos = squareToWorld(from[0], from[1]);
      lastMoveFromMesh.position.set(pos.x, 0.082, pos.z);
      lastMoveFromMesh.visible = true;
    } else {
      lastMoveFromMesh.visible = false;
    }

    if (to) {
      const pos = squareToWorld(to[0], to[1]);
      lastMoveToMesh.position.set(pos.x, 0.082, pos.z);
      lastMoveToMesh.visible = true;
    } else {
      lastMoveToMesh.visible = false;
    }
  }

  // -----------------------------------------------------------
  // SELECTION & DESTINATION HIGHLIGHT INDICATORS
  // -----------------------------------------------------------
  const destMarkerGroup = new Group();
  scene.add(destMarkerGroup);

  const destMarkerEmptyGeo = new RingGeometry(0.18, 0.28, 32);
  const destMarkerEmptyMat = new MeshBasicMaterial({
    color: 0x10b981, // Emerald valid move ring
    side: DoubleSide,
    transparent: true,
    opacity: 0.88,
  });

  const destMarkerCaptureGeo = new RingGeometry(0.34, 0.45, 32);
  const destMarkerCaptureMat = new MeshBasicMaterial({
    color: 0xef4444, // Ruby valid capture ring
    side: DoubleSide,
    transparent: true,
    opacity: 0.90,
  });

  const selectedMarkerGeo = new RingGeometry(0.32, 0.45, 32);
  const selectedMarkerMat = new MeshBasicMaterial({
    color: 0xe8c56a, // Gold selection halo
    side: DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const selectedMarker = new Mesh(selectedMarkerGeo, selectedMarkerMat);
  selectedMarker.rotation.x = -Math.PI / 2;
  selectedMarker.position.y = 0.086;
  selectedMarker.visible = false;
  scene.add(selectedMarker);

  // -----------------------------------------------------------
  // TACTICAL SOLUTION TARGET BEACON (GOLD/EMERALD HOLO-RETICLE)
  // -----------------------------------------------------------
  const solutionBeaconGroup = new Group();

  const beaconRingGeo = new RingGeometry(0.28, 0.46, 32);
  const beaconRingMat = new MeshBasicMaterial({
    color: 0x10b981,
    side: DoubleSide,
    transparent: true,
    opacity: 0.95,
  });
  const beaconRing = new Mesh(beaconRingGeo, beaconRingMat);
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.095;
  solutionBeaconGroup.add(beaconRing);

  const beaconBeamGeo = new CylinderGeometry(0.04, 0.32, 2.8, 16, 1, true);
  const beaconBeamMat = new MeshBasicMaterial({
    color: 0x10b981,
    side: DoubleSide,
    transparent: true,
    opacity: 0.35,
  });
  const beaconBeam = new Mesh(beaconBeamGeo, beaconBeamMat);
  beaconBeam.position.y = 1.45;
  solutionBeaconGroup.add(beaconBeam);

  solutionBeaconGroup.visible = false;
  scene.add(solutionBeaconGroup);

  // -----------------------------------------------------------
  // KEYBOARD / HOVER 3D TARGET CURSOR (LIMEN RETICLE)
  // -----------------------------------------------------------
  const cursorGroup = new Group();
  const cursorRingGeo = new RingGeometry(0.40, 0.46, 32);
  const cursorRingMat = new MeshBasicMaterial({
    color: 0xf3d88c,
    side: DoubleSide,
    transparent: true,
    opacity: 0.92,
  });
  const cursorRing = new Mesh(cursorRingGeo, cursorRingMat);
  cursorRing.rotation.x = -Math.PI / 2;
  cursorGroup.add(cursorRing);
  cursorGroup.position.y = 0.089;
  cursorGroup.visible = false;
  scene.add(cursorGroup);

  function showLegalDestinations(
    destinations: Square[],
    boardState?: (ChessPiece | null)[][]
  ) {
    while (destMarkerGroup.children.length > 0) {
      destMarkerGroup.remove(destMarkerGroup.children[0]);
    }

    destinations.forEach(([r, c]) => {
      const isCapture = Boolean(boardState && boardState[r]?.[c]);
      const marker = new Mesh(
        isCapture ? destMarkerCaptureGeo : destMarkerEmptyGeo,
        isCapture ? destMarkerCaptureMat : destMarkerEmptyMat
      );
      const pos = squareToWorld(r, c);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(pos.x, 0.09, pos.z);
      marker.userData = { row: r, col: c, isDest: true };
      destMarkerGroup.add(marker);
    });
  }

  // -----------------------------------------------------------
  // 3D CHESS PIECES: SCULPTED STAUNTON ARCHITECTURE & LUXURY PBR
  // -----------------------------------------------------------
  // White: Imperial 24K Brushed Gold with warm highlights
  const whiteMat = new MeshStandardMaterial({
    color: 0xe6b85c,
    metalness: 0.74,
    roughness: 0.20,
    emissive: 0x241804,
  });
  const whiteTrimMat = new MeshStandardMaterial({
    color: 0xffdf80,
    metalness: 0.88,
    roughness: 0.12,
  });
  const whiteFeltMat = new MeshStandardMaterial({
    color: 0x064e3b, // Deep emerald felt under base
    roughness: 0.96,
  });

  // Black: Volcanic Obsidian & Polished Titanium
  const blackMat = new MeshStandardMaterial({
    color: 0x1a1e2b,
    metalness: 0.58,
    roughness: 0.24,
    emissive: 0x070912,
  });
  const blackTrimMat = new MeshStandardMaterial({
    color: 0x4a5568,
    metalness: 0.84,
    roughness: 0.16,
  });
  const blackFeltMat = new MeshStandardMaterial({
    color: 0x7f1d1d, // Deep crimson felt under base
    roughness: 0.96,
  });

  // Reusable tiered Staunton pedestal builder
  function buildPedestal(
    rBase: number,
    hBase: number,
    mat: MeshStandardMaterial,
    trimMat: MeshStandardMaterial,
    feltMat: MeshStandardMaterial
  ): Group {
    const ped = new Group();

    // 1. Dark felt pad
    const felt = new Mesh(new CylinderGeometry(rBase * 0.98, rBase * 0.98, 0.02, 32), feltMat);
    felt.position.y = 0.01;
    ped.add(felt);

    // 2. Base tier disc
    const lower = new Mesh(new CylinderGeometry(rBase * 0.92, rBase, hBase * 0.45, 32), mat);
    lower.position.y = 0.02 + (hBase * 0.45) / 2;
    lower.castShadow = true;
    lower.receiveShadow = true;
    ped.add(lower);

    // 3. Molded torus bead ring
    const bead = new Mesh(new TorusGeometry(rBase * 0.91, 0.032, 14, 32), trimMat);
    bead.rotation.x = Math.PI / 2;
    bead.position.y = 0.02 + hBase * 0.45;
    bead.castShadow = true;
    ped.add(bead);

    // 4. Inset taper collar
    const upper = new Mesh(
      new CylinderGeometry(rBase * 0.76, rBase * 0.88, hBase * 0.55, 32),
      mat
    );
    upper.position.y = 0.02 + hBase * 0.45 + (hBase * 0.55) / 2;
    upper.castShadow = true;
    upper.receiveShadow = true;
    ped.add(upper);

    // 5. Platform trim fillet
    const fillet = new Mesh(new CylinderGeometry(rBase * 0.80, rBase * 0.74, 0.035, 32), trimMat);
    fillet.position.y = 0.02 + hBase;
    fillet.castShadow = true;
    ped.add(fillet);

    return ped;
  }

  // 1. PAWN (Il Pedone / L'Iniziato)
  function createPawnMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // Base pedestal
    group.add(buildPedestal(0.28, 0.12, mat, trim, felt));

    // Slender concave waist body
    const body = new Mesh(new CylinderGeometry(0.14, 0.22, 0.30, 24), mat);
    body.position.y = 0.28;
    body.castShadow = true;
    body.receiveShadow = true;

    // Neck collar ring
    const collar = new Mesh(new TorusGeometry(0.16, 0.026, 12, 24), trim);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.44;
    collar.castShadow = true;

    // Smooth spherical head
    const head = new Mesh(new SphereGeometry(0.165, 24, 24), mat);
    head.position.y = 0.58;
    head.castShadow = true;

    group.add(body, collar, head);
    return group;
  }

  // 2. ROOK (La Torre / Il Custode)
  function createRookMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // Base pedestal
    group.add(buildPedestal(0.32, 0.14, mat, trim, felt));

    // Tapered stone tower column shaft
    const body = new Mesh(new CylinderGeometry(0.23, 0.28, 0.44, 32), mat);
    body.position.y = 0.36;
    body.castShadow = true;
    body.receiveShadow = true;

    // Column collar ring
    const midRing = new Mesh(new TorusGeometry(0.24, 0.025, 12, 32), trim);
    midRing.rotation.x = Math.PI / 2;
    midRing.position.y = 0.58;

    // Parapet machicolation cornice
    const cornice = new Mesh(new CylinderGeometry(0.31, 0.24, 0.09, 32), mat);
    cornice.position.y = 0.63;
    cornice.castShadow = true;

    // Sunken interior tower roof deck
    const deck = new Mesh(new CylinderGeometry(0.23, 0.23, 0.02, 24), trim);
    deck.position.y = 0.68;

    group.add(body, midRing, cornice, deck);

    // 4 Sculpted Crenellations (Battlements with 4 distinct open embrasures)
    const crenelAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
    crenelAngles.forEach((angle) => {
      const crenel = new Mesh(new BoxGeometry(0.12, 0.12, 0.08), mat);
      const rad = 0.25;
      crenel.position.set(Math.cos(angle) * rad, 0.74, Math.sin(angle) * rad);
      crenel.rotation.y = -angle;
      crenel.castShadow = true;
      group.add(crenel);
    });

    return group;
  }

  // 3. KNIGHT (Il Cavallo / Il Cacciatore) — Hand-Sculpted Staunton Equine Geometry
  function createKnightMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // Base pedestal
    group.add(buildPedestal(0.32, 0.13, mat, trim, felt));

    // Classical Staunton Equine Profile via 2D Shape & Beveled Extrusion
    const s = new Shape();
    // Spine of neck base
    s.moveTo(-0.16, 0.0);
    // Convex arched muscular spine curving upward to the nape
    s.bezierCurveTo(-0.25, 0.18, -0.22, 0.42, -0.13, 0.60);
    // Nape crest
    s.lineTo(-0.10, 0.67);
    // Head crown (between alert ears)
    s.lineTo(-0.05, 0.71);
    // Forehead slope down to bridge
    s.bezierCurveTo(-0.01, 0.72, 0.08, 0.66, 0.15, 0.53);
    // Upper muzzle contour
    s.bezierCurveTo(0.19, 0.47, 0.22, 0.42, 0.22, 0.36);
    // Rounded snout tip
    s.bezierCurveTo(0.22, 0.30, 0.18, 0.28, 0.14, 0.28);
    // Chin indent
    s.bezierCurveTo(0.10, 0.28, 0.07, 0.23, 0.04, 0.21);
    // Throat & muscular arched chest
    s.bezierCurveTo(0.08, 0.17, 0.13, 0.11, 0.12, 0.05);
    // Base front
    s.lineTo(0.08, 0.0);
    s.closePath();

    const extrudeSettings = {
      depth: 0.14,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 2,
      bevelSize: 0.038,
      bevelThickness: 0.038,
    };

    const horseGeo = new ExtrudeGeometry(s, extrudeSettings);
    horseGeo.center();

    const horseMesh = new Mesh(horseGeo, mat);
    horseMesh.position.set(0, 0.50, 0.03);
    horseMesh.castShadow = true;
    horseMesh.receiveShadow = true;
    group.add(horseMesh);

    // Left and Right Alert Ears (Forward-angled conical wedges)
    const earGeo = new ConeGeometry(0.042, 0.14, 16);
    const earLeft = new Mesh(earGeo, mat);
    earLeft.position.set(-0.065, 0.88, -0.06);
    earLeft.rotation.x = -0.22;
    earLeft.rotation.z = 0.24;
    earLeft.castShadow = true;

    const earRight = new Mesh(earGeo, mat);
    earRight.position.set(0.065, 0.88, -0.06);
    earRight.rotation.x = -0.22;
    earRight.rotation.z = -0.24;
    earRight.castShadow = true;
    group.add(earLeft, earRight);

    // Inset Polished Temple Eyes
    const eyeGeo = new SphereGeometry(0.032, 12, 12);
    const eyeLeft = new Mesh(eyeGeo, trim);
    eyeLeft.position.set(-0.115, 0.77, 0.05);
    const eyeRight = new Mesh(eyeGeo, trim);
    eyeRight.position.set(0.115, 0.77, 0.05);
    group.add(eyeLeft, eyeRight);

    // Sculpted Jawline Roundings
    const jawGeo = new CylinderGeometry(0.075, 0.075, 0.03, 16);
    const jawLeft = new Mesh(jawGeo, mat);
    jawLeft.rotation.z = Math.PI / 2;
    jawLeft.position.set(-0.11, 0.65, 0.01);
    const jawRight = new Mesh(jawGeo, mat);
    jawRight.rotation.z = Math.PI / 2;
    jawRight.position.set(0.11, 0.65, 0.01);
    group.add(jawLeft, jawRight);

    // Mane Fluting: 4 segmented crest ridges along the arched neck
    for (let i = 0; i < 4; i++) {
      const ridge = new Mesh(new BoxGeometry(0.05, 0.08, 0.06), trim);
      const t = i / 3;
      ridge.position.set(
        0,
        0.44 + t * 0.36,
        -0.12 - (1 - Math.abs(t - 0.5) * 2) * 0.06
      );
      ridge.rotation.x = -0.4 + t * 0.35;
      ridge.castShadow = true;
      group.add(ridge);
    }

    return group;
  }

  // 4. BISHOP (L'Alfiere / L'Oracolo)
  function createBishopMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // Base pedestal
    group.add(buildPedestal(0.30, 0.13, mat, trim, felt));

    // Slender tapered torso column
    const body = new Mesh(new CylinderGeometry(0.16, 0.24, 0.46, 32), mat);
    body.position.y = 0.36;
    body.castShadow = true;
    body.receiveShadow = true;

    // Collar ring
    const collar = new Mesh(new TorusGeometry(0.18, 0.03, 12, 32), trim);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.59;

    // Staunton Miter (Pointed oval teardrop head)
    const miter = new Mesh(new SphereGeometry(0.19, 24, 24), mat);
    miter.position.y = 0.76;
    miter.scale.set(0.85, 1.45, 0.85);
    miter.castShadow = true;

    // Distinct Miter Cleft / Diagonal Slit
    const slit = new Mesh(new BoxGeometry(0.035, 0.22, 0.26), trim);
    slit.position.set(0.08, 0.80, 0.02);
    slit.rotation.z = Math.PI / 4.5;

    // Finial pearl orb on crest
    const finial = new Mesh(new SphereGeometry(0.055, 16, 16), trim);
    finial.position.y = 1.02;
    finial.castShadow = true;

    group.add(body, collar, miter, slit, finial);
    return group;
  }

  // 5. QUEEN (La Regina / La Sovrana)
  function createQueenMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // Base pedestal
    group.add(buildPedestal(0.33, 0.14, mat, trim, felt));

    // Elegant waisted torso
    const body = new Mesh(new CylinderGeometry(0.17, 0.26, 0.52, 32), mat);
    body.position.y = 0.40;
    body.castShadow = true;
    body.receiveShadow = true;

    // Mid collar ring
    const collar = new Mesh(new TorusGeometry(0.20, 0.032, 12, 32), trim);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.66;

    // Royal coronet bowl
    const crown = new Mesh(new CylinderGeometry(0.31, 0.18, 0.26, 32), mat);
    crown.position.y = 0.79;
    crown.castShadow = true;

    // Coronet rim: 8 radiating spherical jewels
    const jewelCount = 8;
    for (let i = 0; i < jewelCount; i++) {
      const angle = (i / jewelCount) * Math.PI * 2;
      const jewel = new Mesh(new SphereGeometry(0.035, 12, 12), trim);
      jewel.position.set(Math.cos(angle) * 0.29, 0.92, Math.sin(angle) * 0.29);
      jewel.castShadow = true;
      group.add(jewel);
    }

    // Elevated central pearl finial
    const finialOrb = new Mesh(new SphereGeometry(0.088, 20, 20), trim);
    finialOrb.position.y = 1.02;
    finialOrb.castShadow = true;

    group.add(body, collar, crown, finialOrb);
    return group;
  }

  // 6. KING (Il Re / L'Architetto)
  function createKingMesh(isWhite: boolean): Group {
    const mat = isWhite ? whiteMat : blackMat;
    const trim = isWhite ? whiteTrimMat : blackTrimMat;
    const felt = isWhite ? whiteFeltMat : blackFeltMat;
    const group = new Group();

    // 3-Tier Stepped Pedestal
    group.add(buildPedestal(0.36, 0.16, mat, trim, felt));

    // Stately flared torso
    const body = new Mesh(new CylinderGeometry(0.20, 0.28, 0.58, 32), mat);
    body.position.y = 0.45;
    body.castShadow = true;
    body.receiveShadow = true;

    // Royal capital collar
    const collar = new Mesh(new TorusGeometry(0.24, 0.035, 14, 32), trim);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.74;

    // Flared imperial crown bowl
    const crown = new Mesh(new CylinderGeometry(0.33, 0.21, 0.32, 32), mat);
    crown.position.y = 0.90;
    crown.castShadow = true;

    // Velvet interior cap dome
    const dome = new Mesh(
      new SphereGeometry(0.22, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      trim
    );
    dome.position.y = 0.92;
    dome.castShadow = true;

    // Crown finial pedestal orb
    const finialOrb = new Mesh(new SphereGeometry(0.075, 16, 16), trim);
    finialOrb.position.y = 1.15;
    finialOrb.castShadow = true;

    // Architectural Maltese / Pattée Cross
    const crossVert = new Mesh(new BoxGeometry(0.065, 0.22, 0.065), trim);
    crossVert.position.y = 1.28;
    crossVert.castShadow = true;

    const crossHoriz = new Mesh(new BoxGeometry(0.18, 0.065, 0.065), trim);
    crossHoriz.position.y = 1.30;
    crossHoriz.castShadow = true;

    group.add(body, collar, crown, dome, finialOrb, crossVert, crossHoriz);
    return group;
  }

  function buildPieceMesh(piece: ChessPiece): Group {
    const isWhite = piece.color === "w";
    let group: Group;

    switch (piece.type) {
      case "p":
        group = createPawnMesh(isWhite);
        break;
      case "r":
        group = createRookMesh(isWhite);
        break;
      case "n":
        group = createKnightMesh(isWhite);
        break;
      case "b":
        group = createBishopMesh(isWhite);
        break;
      case "q":
        group = createQueenMesh(isWhite);
        break;
      case "k":
        group = createKingMesh(isWhite);
        break;
    }

    if (piece.color === "b") {
      group.rotation.y = Math.PI;
    }

    return group;
  }

  let pieceObjects: Piece3DObject[] = [];

  // -----------------------------------------------------------
  // BOARD STATE SYNC
  // -----------------------------------------------------------
  function setBoardState(board: (ChessPiece | null)[][]) {
    for (const obj of pieceObjects) {
      scene.remove(obj.group);
    }
    pieceObjects = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (!piece) continue;

        const meshGroup = buildPieceMesh(piece);
        const worldPos = squareToWorld(r, c);
        meshGroup.position.set(worldPos.x, worldPos.y, worldPos.z);

        meshGroup.userData = { row: r, col: c, isPiece: true };
        meshGroup.traverse((child) => {
          if (child instanceof Mesh) {
            child.userData = { row: r, col: c, isPiece: true };
          }
        });

        scene.add(meshGroup);

        pieceObjects.push({
          group: meshGroup,
          piece,
          row: r,
          col: c,
          baseY: worldPos.y,
          targetPos: worldPos.clone(),
        });
      }
    }
  }

  // -----------------------------------------------------------
  // REGIA DINAMICA CINEMATOGRAFICA & WHEEL ZOOM RIG
  // -----------------------------------------------------------
  const clock = new Clock();
  let cameraMode: CameraMode = "dynamic";
  let zoomFactor = 1.0; // 0.65 (close) to 1.65 (far)

  const currentCamPos = new Vector3(0, 9.6, 8.2);
  const targetCamPos = new Vector3(0, 9.6, 8.2);
  const currentLookAt = new Vector3(0, 0, 0.2);
  const targetLookAt = new Vector3(0, 0, 0.2);

  let isDraggingOrbit = false;
  let prevPointerPos = { x: 0, y: 0 };
  let orbitAzimuth = 0;
  let orbitElevation = 0;

  let isMoveAnimating = false;
  let selectedSquareState: Square | null = null;

  function updateCameraFraming() {
    if (cameraMode === "tactical") {
      targetCamPos.set(0, 11.2 * zoomFactor, 7.2 * zoomFactor);
      targetLookAt.set(0, 0, 0);
      return;
    }

    if (cameraMode === "topdown") {
      targetCamPos.set(0, 12.8 * zoomFactor, 0.01);
      targetLookAt.set(0, 0, 0);
      return;
    }

    if (cameraMode === "hero") {
      targetCamPos.set(0, 4.2 * zoomFactor, 6.0 * zoomFactor);
      targetLookAt.set(0, 0.4, 0);
      return;
    }

    // Dynamic Broadcast Mode
    if (isMoveAnimating) return;

    if (selectedSquareState) {
      const [sr, sc] = selectedSquareState;
      const pPos = squareToWorld(sr, sc);

      targetCamPos.set(
        pPos.x * 0.46,
        7.2 * zoomFactor,
        Math.max(5.8, (pPos.z + 4.2) * zoomFactor)
      );
      targetLookAt.set(
        pPos.x * 0.32,
        0.3,
        pPos.z * 0.35 - 0.9
      );
    } else {
      targetCamPos.set(0, 9.5 * zoomFactor, 7.9 * zoomFactor);
      targetLookAt.set(0, 0, 0.2);
    }
  }

  function setCameraMode(mode: CameraMode) {
    cameraMode = mode;
    orbitAzimuth = 0;
    orbitElevation = 0;
    updateCameraFraming();
  }

  function resetCamera() {
    zoomFactor = 1.0;
    orbitAzimuth = 0;
    orbitElevation = 0;
    updateCameraFraming();
  }

  function setTheme(theme: "obsidian_gold" | "carrara_temple" | "cyber_void") {
    if (theme === "carrara_temple") {
      lightTileMat.color.setHex(0xffffff);
      darkTileMat.color.setHex(0x222a36);
      whiteMat.color.setHex(0xf2ebd9);
      whiteMat.emissive.setHex(0x1a1608);
      whiteTrimMat.color.setHex(0xe8d09b);
      blackMat.color.setHex(0x32231c);
      blackMat.emissive.setHex(0x0c0604);
      blackTrimMat.color.setHex(0x7c5d48);
    } else if (theme === "cyber_void") {
      lightTileMat.color.setHex(0x0f2420);
      darkTileMat.color.setHex(0x06080e);
      whiteMat.color.setHex(0x10b981);
      whiteMat.emissive.setHex(0x042418);
      whiteTrimMat.color.setHex(0x34d399);
      blackMat.color.setHex(0x7f1d1d);
      blackMat.emissive.setHex(0x280404);
      blackTrimMat.color.setHex(0xf87171);
    } else {
      // "obsidian_gold" (Standard Aureus)
      lightTileMat.color.setHex(0xf6ede0);
      darkTileMat.color.setHex(0x161a26);
      whiteMat.color.setHex(0xe6b85c);
      whiteMat.emissive.setHex(0x241804);
      whiteTrimMat.color.setHex(0xffdf80);
      blackMat.color.setHex(0x1a1e2b);
      blackMat.emissive.setHex(0x070912);
      blackTrimMat.color.setHex(0x4a5568);
    }
  }

  function setSelectedSquare(
    square: Square | null,
    legalDestinations: Square[] = [],
    boardState?: (ChessPiece | null)[][]
  ) {
    selectedSquareState = square;

    pieceObjects.forEach((obj) => {
      if (square && obj.row === square[0] && obj.col === square[1]) {
        obj.targetPos.y = obj.baseY + 0.35;
      } else {
        obj.targetPos.y = obj.baseY;
      }
    });

    if (square) {
      const pos = squareToWorld(square[0], square[1]);
      selectedMarker.position.set(pos.x, 0.086, pos.z);
      selectedMarker.visible = true;
    } else {
      selectedMarker.visible = false;
    }

    showLegalDestinations(legalDestinations, boardState);
    updateCameraFraming();
  }

  function setCursorSquare(square: Square | null) {
    if (!square) {
      cursorGroup.visible = false;
      return;
    }
    const pos = squareToWorld(square[0], square[1]);
    cursorGroup.position.set(pos.x, 0.089, pos.z);
    cursorGroup.visible = true;
  }

  function showSolutionBeacon(from: Square, to: Square) {
    const toPos = squareToWorld(to[0], to[1]);
    solutionBeaconGroup.position.set(toPos.x, 0, toPos.z);
    solutionBeaconGroup.visible = true;

    setSelectedSquare(from, [to]);

    if (cameraMode === "dynamic") {
      const fromPos = squareToWorld(from[0], from[1]);
      const midPos = fromPos.clone().lerp(toPos, 0.5);
      targetCamPos.set(midPos.x * 0.45, 7.4 * zoomFactor, Math.max(5.8, midPos.z + 4.3));
      targetLookAt.set(midPos.x * 0.3, 0.3, midPos.z * 0.35 - 0.6);
    }
  }

  function clearSolutionBeacon() {
    solutionBeaconGroup.visible = false;
  }

  // -----------------------------------------------------------
  // PARABOLIC MOVE & REVERT ANIMATIONS
  // -----------------------------------------------------------
  function animateMove(from: Square, to: Square, onComplete: () => void) {
    const movedObj = pieceObjects.find((p) => p.row === from[0] && p.col === from[1]);
    const capturedObj = pieceObjects.find((p) => p.row === to[0] && p.col === to[1]);

    if (!movedObj) {
      onComplete();
      return;
    }

    isMoveAnimating = true;

    // Use specialised chess audio
    if (capturedObj) {
      gameAudio.playChessCapture();
      setTimeout(() => {
        scene.remove(capturedObj.group);
        pieceObjects = pieceObjects.filter((p) => p !== capturedObj);
      }, 240);
    } else {
      gameAudio.playChessMove();
    }

    const fromPos = squareToWorld(from[0], from[1]);
    const destPos = squareToWorld(to[0], to[1]);
    const midPos = fromPos.clone().lerp(destPos, 0.5);

    if (cameraMode === "dynamic") {
      targetLookAt.set(midPos.x, 0.4, midPos.z);
      targetCamPos.set(
        midPos.x * 0.5,
        7.0 * zoomFactor,
        Math.max(5.6, (midPos.z + 4.5) * zoomFactor)
      );
    }

    movedObj.row = to[0];
    movedObj.col = to[1];
    movedObj.group.userData = { row: to[0], col: to[1], isPiece: true };
    movedObj.group.traverse((c) => {
      if (c instanceof Mesh) c.userData = { row: to[0], col: to[1], isPiece: true };
    });

    // Knight lifts higher in its parabolic leap
    const isKnight = movedObj.piece.type === "n";
    const leapHeight = isKnight ? 0.90 : 0.65;

    movedObj.targetPos.set(destPos.x, movedObj.baseY + leapHeight, destPos.z);

    setTimeout(() => {
      movedObj.targetPos.set(destPos.x, movedObj.baseY, destPos.z);

      if (cameraMode === "dynamic") {
        targetLookAt.set(destPos.x, 0.25, destPos.z);
      }

      setLastMoveHighlight(from, to);

      setTimeout(() => {
        isMoveAnimating = false;
        updateCameraFraming();
        onComplete();
      }, 160);
    }, 230);
  }

  function animateRevert(from: Square, to: Square, onComplete: () => void) {
    const movedObj = pieceObjects.find((p) => p.row === to[0] && p.col === to[1]);
    if (!movedObj) {
      onComplete();
      return;
    }

    isMoveAnimating = true;
    gameAudio.playSlide();

    obsidianCheckRim.intensity = 3.6;
    setTimeout(() => {
      obsidianCheckRim.intensity = 0.0;
    }, 450);

    const fromPos = squareToWorld(from[0], from[1]);
    movedObj.row = from[0];
    movedObj.col = from[1];
    movedObj.group.userData = { row: from[0], col: from[1], isPiece: true };
    movedObj.group.traverse((c) => {
      if (c instanceof Mesh) c.userData = { row: from[0], col: from[1], isPiece: true };
    });

    movedObj.targetPos.set(fromPos.x, movedObj.baseY + 0.65, fromPos.z);

    setTimeout(() => {
      movedObj.targetPos.set(fromPos.x, movedObj.baseY, fromPos.z);
      setTimeout(() => {
        isMoveAnimating = false;
        updateCameraFraming();
        onComplete();
      }, 160);
    }, 220);
  }

  function triggerCheckHighlight(kingSquare: Square) {
    gameAudio.playChessCheck();
    obsidianCheckRim.intensity = 4.2;

    if (cameraMode === "dynamic") {
      const kPos = squareToWorld(kingSquare[0], kingSquare[1]);
      targetCamPos.set(kPos.x * 0.6, 5.4 * zoomFactor, kPos.z + 3.8);
      targetLookAt.set(kPos.x, 0.35, kPos.z);
    }

    setTimeout(() => {
      obsidianCheckRim.intensity = 0.0;
      updateCameraFraming();
    }, 850);
  }

  function triggerVictory() {
    gameAudio.playVictory();
    overheadSpot.intensity = 4.8;

    if (cameraMode === "dynamic") {
      targetCamPos.set(0, 6.2 * zoomFactor, 5.0 * zoomFactor);
      targetLookAt.set(0, 0.3, 0);
    }

    setTimeout(() => {
      overheadSpot.intensity = 2.8;
    }, 1000);
  }

  // -----------------------------------------------------------
  // RAYCASTING & INTERACTIVE MOUSE / TOUCH EVENTS
  // -----------------------------------------------------------
  const raycaster = new Raycaster();
  const mouse = new Vector2(-999, -999);

  function resolveSquareFromCoords(clientX: number, clientY: number): Square | null {
    const rect = renderer.domElement.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null;
    }

    const normX = ((clientX - rect.left) / rect.width) * 2 - 1;
    const normY = -((clientY - rect.top) / rect.height) * 2 + 1;
    mouse.set(normX, normY);

    raycaster.setFromCamera(mouse, camera);

    const clickables: Mesh[] = [
      ...tileMeshes,
      ...(destMarkerGroup.children as Mesh[]),
    ];

    for (const obj of pieceObjects) {
      obj.group.traverse((c) => {
        if (c instanceof Mesh) clickables.push(c);
      });
    }

    const intersects = raycaster.intersectObjects(clickables, false);
    if (intersects.length > 0) {
      for (const hit of intersects) {
        let cur: any = hit.object;
        while (cur && cur.userData?.row === undefined && cur.parent && cur !== scene) {
          cur = cur.parent;
        }
        if (cur && cur.userData?.row !== undefined) {
          return [cur.userData.row, cur.userData.col];
        }
      }
    }

    return null;
  }

  function onPointerMove(e: MouseEvent) {
    if (isDraggingOrbit) {
      const deltaX = e.clientX - prevPointerPos.x;
      const deltaY = e.clientY - prevPointerPos.y;
      prevPointerPos = { x: e.clientX, y: e.clientY };

      orbitAzimuth -= deltaX * 0.006;
      orbitElevation = Math.max(-0.25, Math.min(0.35, orbitElevation - deltaY * 0.005));
      return;
    }

    const sq = resolveSquareFromCoords(e.clientX, e.clientY);
    callbacks.onSquareHover?.(sq ? sq[0] : null, sq ? sq[1] : null);
  }

  function onPointerDown(e: MouseEvent) {
    if (e.button === 2 || (e.button === 0 && e.altKey)) {
      isDraggingOrbit = true;
      prevPointerPos = { x: e.clientX, y: e.clientY };
      return;
    }

    if (e.button !== 0) return;

    const sq = resolveSquareFromCoords(e.clientX, e.clientY);
    if (sq) {
      callbacks.onSquareClick(sq[0], sq[1]);
    } else {
      isDraggingOrbit = true;
      prevPointerPos = { x: e.clientX, y: e.clientY };
    }
  }

  function onPointerUp(_e: MouseEvent) {
    if (isDraggingOrbit) {
      isDraggingOrbit = false;
    }
  }

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
  }

  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];
    const sq = resolveSquareFromCoords(touch.clientX, touch.clientY);
    if (sq) {
      callbacks.onSquareClick(sq[0], sq[1]);
    }
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomDelta = e.deltaY * 0.0015;
    zoomFactor = Math.max(0.65, Math.min(1.65, zoomFactor + zoomDelta));
    updateCameraFraming();
  }

  const canvas = renderer.domElement;
  canvas.addEventListener("mousemove", onPointerMove);
  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  canvas.addEventListener("wheel", onWheel, { passive: false });

  // -----------------------------------------------------------
  // ANIMATION LOOP (FLUID CAMERA SMOOTHING & PARTICLES DRIFT)
  // -----------------------------------------------------------
  let isRunning = true;
  let animId: number;

  function animate() {
    if (!isRunning) return;
    animId = requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);
    const elapsedTime = clock.getElapsedTime();

    for (const obj of pieceObjects) {
      obj.group.position.lerp(obj.targetPos, 0.22);
    }

    // Floating Stardust Drift
    particles.rotation.y = elapsedTime * 0.015;

    if (cursorGroup.visible) {
      cursorRingMat.opacity = 0.72 + Math.sin(elapsedTime * 6.0) * 0.24;
    }

    if (solutionBeaconGroup.visible) {
      beaconRingMat.opacity = 0.72 + Math.sin(elapsedTime * 6.5) * 0.26;
      beaconBeamMat.opacity = 0.22 + Math.sin(elapsedTime * 4.0) * 0.14;
      beaconBeam.rotation.y += dt * 1.5;
    }

    const actualTargetPos = targetCamPos.clone();
    if (cameraMode === "dynamic" && !isMoveAnimating && !isDraggingOrbit) {
      const swayX = Math.sin(elapsedTime * 0.7) * 0.10;
      const swayY = Math.cos(elapsedTime * 0.5) * 0.06;
      actualTargetPos.x += swayX;
      actualTargetPos.y += swayY;
    }

    if (orbitAzimuth !== 0 || orbitElevation !== 0) {
      const radius = actualTargetPos.distanceTo(targetLookAt);
      actualTargetPos.x = targetLookAt.x + Math.sin(orbitAzimuth) * radius;
      actualTargetPos.z = targetLookAt.z + Math.cos(orbitAzimuth) * radius;
      actualTargetPos.y = Math.max(2.8, actualTargetPos.y + orbitElevation * 4.0);
    }

    const lerpSpeed = isMoveAnimating ? 7.5 : 4.8;
    const lerpFactor = 1.0 - Math.exp(-lerpSpeed * dt);

    currentCamPos.lerp(actualTargetPos, lerpFactor);
    currentLookAt.lerp(targetLookAt, lerpFactor);

    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    renderer.render(scene, camera);
  }

  animate();

  // -----------------------------------------------------------
  // RESIZE HANDLING VIA RESIZEOBSERVER & WINDOW RESIZE
  // -----------------------------------------------------------
  function handleResize() {
    if (!container || !renderer) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 550;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);
  window.addEventListener("resize", handleResize);

  // -----------------------------------------------------------
  // DISPOSE & RESOURCE CLEANUP
  // -----------------------------------------------------------
  function dispose() {
    isRunning = false;
    cancelAnimationFrame(animId);

    resizeObserver.disconnect();
    window.removeEventListener("resize", handleResize);
    canvas.removeEventListener("mousemove", onPointerMove);
    canvas.removeEventListener("mousedown", onPointerDown);
    window.removeEventListener("mouseup", onPointerUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("touchstart", onTouchStart);
    canvas.removeEventListener("wheel", onWheel);

    boardFrameGeo.dispose();
    boardFrameMat.dispose();
    frameRimGeo.dispose();
    frameRimMat.dispose();
    tileGeo.dispose();
    lightTileMat.dispose();
    darkTileMat.dispose();
    horizStripGeo.dispose();
    vertStripGeo.dispose();
    fileTexBottom.dispose();
    fileTexTop.dispose();
    rankTexLeft.dispose();
    rankTexRight.dispose();
    coordMatBottom.dispose();
    coordMatTop.dispose();
    coordMatLeft.dispose();
    coordMatRight.dispose();
    lastMoveTileGeo.dispose();
    lastMoveTileMat.dispose();
    destMarkerEmptyGeo.dispose();
    destMarkerEmptyMat.dispose();
    destMarkerCaptureGeo.dispose();
    destMarkerCaptureMat.dispose();
    selectedMarkerGeo.dispose();
    selectedMarkerMat.dispose();
    beaconRingGeo.dispose();
    beaconRingMat.dispose();
    beaconBeamGeo.dispose();
    beaconBeamMat.dispose();
    cursorRingGeo.dispose();
    cursorRingMat.dispose();
    whiteMat.dispose();
    whiteTrimMat.dispose();
    whiteFeltMat.dispose();
    blackMat.dispose();
    blackTrimMat.dispose();
    blackFeltMat.dispose();
    particleGeo.dispose();
    particleMat.dispose();

    for (const obj of pieceObjects) {
      scene.remove(obj.group);
    }
    pieceObjects = [];

    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  return {
    setBoardState,
    setSelectedSquare,
    setCursorSquare,
    setCameraMode,
    setTheme,
    setLastMoveHighlight,
    resetCamera,
    animateMove,
    animateRevert,
    showSolutionBeacon,
    clearSolutionBeacon,
    triggerCheckHighlight,
    triggerVictory,
    dispose,
  };
}
