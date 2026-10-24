/**
 * LIMEN PROTOCOL — Gli Scacchi dell'Ordine (Trans-Limen Tactical Chess 3D)
 * Native Three.js 3D Engine: Sculpted Obsidian & Aureus Board, Architectural 3D Pieces,
 * Interactive Raycast Selection, Legal Move Decals & Fluid Arc Movement.
 * Regia Dinamica Cinematografica: Inquadratura broadcast della giocata corrente.
 * Coordinate 3D incise, Tactical Target Beacon & Rig Illuminotecnico PBR Maestoso.
 */

import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Clock,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FogExp2,
  Group,
  HemisphereLight,
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
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { ChessPiece, PieceColor, PieceType, Square } from "./chessTypes";
import { gameAudio } from "../gameAudioSynthesizer";

export type CameraMode = "dynamic" | "tactical" | "hero";

export interface Chess3dCallbacks {
  onSquareClick: (row: number, col: number) => void;
  onSquareHover?: (row: number | null, col: number | null) => void;
}

export interface Chess3dController {
  setBoardState: (board: (ChessPiece | null)[][]) => void;
  setSelectedSquare: (square: Square | null, legalDestinations?: Square[]) => void;
  setCursorSquare: (square: Square | null) => void;
  setCameraMode: (mode: CameraMode) => void;
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
  scene.background = new Color(0x0c0e17);
  // Gentle atmospheric depth without suffocating the board
  scene.fog = new FogExp2(0x0c0e17, 0.012);

  const camera = new PerspectiveCamera(36, width / height, 0.1, 100);
  camera.position.set(0, 9.6, 8.2);
  camera.lookAt(0, 0, 0.2);

  const renderer = new WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  // Filmic PBR tone mapping for rich golden luster and dynamic range
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;
  container.appendChild(renderer.domElement);

  // -----------------------------------------------------------
  // ILLUMINAZIONE AMBIENTALE MAESTOSA (5-POINT CINEMATIC RIG)
  // -----------------------------------------------------------
  // 1. Hemisphere Light: warm golden sky and slate floor bounce (eliminates black voids)
  const hemiLight = new HemisphereLight(0xfff3dc, 0x181d2c, 1.25);
  hemiLight.position.set(0, 16, 0);
  scene.add(hemiLight);

  // 2. Key Directional Light: primary golden sunlight from top-right
  const keyLight = new DirectionalLight(0xffedd0, 2.4);
  keyLight.position.set(6, 13, 8);
  scene.add(keyLight);

  // 3. Fill Directional Light: soft cool balancing fill from opposite flank
  const fillLight = new DirectionalLight(0x9db2de, 1.4);
  fillLight.position.set(-6, 10, -6);
  scene.add(fillLight);

  // 4. Hero Overhead Spotlight: radiant illumination in the center of the board
  const overheadSpot = new SpotLight(0xfffaec, 3.2, 28, Math.PI / 3.6, 0.4, 1.1);
  overheadSpot.position.set(0, 13, 0.5);
  overheadSpot.target.position.set(0, 0, 0);
  scene.add(overheadSpot);
  scene.add(overheadSpot.target);

  // 5. Silhouette Rim Light: illuminates Black rank from behind so dark pieces pop
  const silhouetteRim = new PointLight(0xe8c56a, 2.8, 18);
  silhouetteRim.position.set(0, 4.2, -6.8);
  scene.add(silhouetteRim);

  // Flank Rims for metallic specular luster
  const leftRim = new PointLight(0xd4af37, 1.6, 15);
  leftRim.position.set(-6.5, 3.8, 2.0);
  scene.add(leftRim);

  const rightRim = new PointLight(0xd4af37, 1.6, 15);
  rightRim.position.set(6.5, 3.8, 2.0);
  scene.add(rightRim);

  const obsidianCheckRim = new PointLight(0xef4444, 0.0, 16);
  obsidianCheckRim.position.set(0, 5.0, 0);
  scene.add(obsidianCheckRim);

  // -----------------------------------------------------------
  // FLOATING GOLDEN STARDUST (ATMOSPHERIC DEPTH PARTICLES)
  // -----------------------------------------------------------
  const particleCount = 120;
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
  const boardFrameGeo = new BoxGeometry(9.1, 0.35, 9.1);
  const boardFrameMat = new MeshStandardMaterial({
    color: 0x10131c,
    metalness: 0.70,
    roughness: 0.30,
  });
  const boardFrame = new Mesh(boardFrameGeo, boardFrameMat);
  boardFrame.position.y = -0.12;
  boardGroup.add(boardFrame);

  // Outer Gold Inlay Bevel
  const frameRimGeo = new TorusGeometry(6.35, 0.11, 8, 4);
  const frameRimMat = new MeshStandardMaterial({
    color: 0xd8b260,
    metalness: 0.88,
    roughness: 0.22,
  });
  const frameRim = new Mesh(frameRimGeo, frameRimMat);
  frameRim.rotation.x = Math.PI / 2;
  frameRim.rotation.z = Math.PI / 4;
  frameRim.position.y = 0.05;
  boardGroup.add(frameRim);

  // 64 Tiles with balanced PBR lighting
  const tileGeo = new BoxGeometry(squareSize * 0.98, 0.08, squareSize * 0.98);
  const lightTileMat = new MeshStandardMaterial({
    color: 0xf6ede0, // Carrara Gilded Alabaster
    metalness: 0.08,
    roughness: 0.32,
  });
  const darkTileMat = new MeshStandardMaterial({
    color: 0x161a26, // Imperial Obsidian Slate (rich contrast, never pitch black)
    metalness: 0.28,
    roughness: 0.38,
  });

  const tileMeshes: Mesh[] = [];

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const isLight = (r + c) % 2 === 0;
      const tile = new Mesh(tileGeo, isLight ? lightTileMat : darkTileMat);
      const pos = squareToWorld(r, c);
      tile.position.set(pos.x, 0.04, pos.z);
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
    const tex = new CanvasTexture(cvs);
    return tex;
  }

  const fileLabels = ["a", "b", "c", "d", "e", "f", "g", "h"];
  const rankLabels = ["8", "7", "6", "5", "4", "3", "2", "1"]; // Row 0 is rank 8, row 7 is rank 1

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

  // Bottom strip (White side, z = 4.25)
  const bottomCoords = new Mesh(horizStripGeo, coordMatBottom);
  bottomCoords.rotation.x = -Math.PI / 2;
  bottomCoords.position.set(0, 0.055, 4.25);
  boardGroup.add(bottomCoords);

  // Top strip (Black side, z = -4.25)
  const topCoords = new Mesh(horizStripGeo, coordMatTop);
  topCoords.rotation.x = -Math.PI / 2;
  topCoords.rotation.z = Math.PI;
  topCoords.position.set(0, 0.055, -4.25);
  boardGroup.add(topCoords);

  // Left strip (col a, x = -4.25)
  const leftCoords = new Mesh(vertStripGeo, coordMatLeft);
  leftCoords.rotation.x = -Math.PI / 2;
  leftCoords.position.set(-4.25, 0.055, 0);
  boardGroup.add(leftCoords);

  // Right strip (col h, x = 4.25)
  const rightCoords = new Mesh(vertStripGeo, coordMatRight);
  rightCoords.rotation.x = -Math.PI / 2;
  rightCoords.position.set(4.25, 0.055, 0);
  boardGroup.add(rightCoords);

  scene.add(boardGroup);

  // -----------------------------------------------------------
  // SELECTION & DESTINATION HIGHLIGHT INDICATORS
  // -----------------------------------------------------------
  const destMarkerGroup = new Group();
  scene.add(destMarkerGroup);

  const destMarkerGeo = new RingGeometry(0.24, 0.36, 32);
  const destMarkerMat = new MeshBasicMaterial({
    color: 0x10b981, // Emerald valid move ring
    side: DoubleSide,
    transparent: true,
    opacity: 0.88,
  });

  const selectedMarkerGeo = new RingGeometry(0.32, 0.44, 32);
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

  const beaconBeamGeo = new CylinderGeometry(0.04, 0.32, 2.6, 16, 1, true);
  const beaconBeamMat = new MeshBasicMaterial({
    color: 0x10b981,
    side: DoubleSide,
    transparent: true,
    opacity: 0.35,
  });
  const beaconBeam = new Mesh(beaconBeamGeo, beaconBeamMat);
  beaconBeam.position.y = 1.35;
  solutionBeaconGroup.add(beaconBeam);

  solutionBeaconGroup.visible = false;
  scene.add(solutionBeaconGroup);

  // -----------------------------------------------------------
  // KEYBOARD / HOVER 3D TARGET CURSOR (LIMEN BRACKET)
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

  function showLegalDestinations(destinations: Square[]) {
    while (destMarkerGroup.children.length > 0) {
      destMarkerGroup.remove(destMarkerGroup.children[0]);
    }

    destinations.forEach(([r, c]) => {
      const marker = new Mesh(destMarkerGeo, destMarkerMat);
      const pos = squareToWorld(r, c);
      marker.rotation.x = -Math.PI / 2;
      marker.position.set(pos.x, 0.09, pos.z);
      marker.userData = { row: r, col: c, isDest: true };
      destMarkerGroup.add(marker);
    });
  }

  // -----------------------------------------------------------
  // 3D CHESS PIECES PROCEDURAL GEOMETRIES & LUMINOUS PBR
  // -----------------------------------------------------------
  // White: Radiant Imperial Gold (24k Aureus with gentle warm emissive)
  const whiteMat = new MeshStandardMaterial({
    color: 0xefc468,
    metalness: 0.55,
    roughness: 0.20,
    emissive: 0x221804,
  });

  // Black: Polished Obsidian & Titanium (distinct specular luster, clearly visible on all tiles)
  const blackMat = new MeshStandardMaterial({
    color: 0x2b3040,
    metalness: 0.35,
    roughness: 0.28,
    emissive: 0x090c14,
  });

  function createPawnMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.25, 0.28, 0.12, 16), mat);
    const body = new Mesh(new CylinderGeometry(0.14, 0.22, 0.45, 16), mat);
    body.position.y = 0.26;
    const head = new Mesh(new SphereGeometry(0.18, 16, 16), mat);
    head.position.y = 0.55;
    group.add(base, body, head);
    return group;
  }

  function createRookMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.28, 0.32, 0.14, 16), mat);
    const body = new Mesh(new CylinderGeometry(0.22, 0.26, 0.55, 16), mat);
    body.position.y = 0.32;
    const crown = new Mesh(new CylinderGeometry(0.28, 0.22, 0.22, 16), mat);
    crown.position.y = 0.65;
    group.add(base, body, crown);
    return group;
  }

  function createKnightMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.28, 0.32, 0.14, 16), mat);
    const body = new Mesh(new CylinderGeometry(0.16, 0.24, 0.5, 16), mat);
    body.position.y = 0.3;
    const head = new Mesh(new BoxGeometry(0.24, 0.32, 0.36), mat);
    head.position.set(0, 0.62, 0.06);
    head.rotation.x = 0.3;
    group.add(base, body, head);
    return group;
  }

  function createBishopMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.28, 0.32, 0.14, 16), mat);
    const body = new Mesh(new CylinderGeometry(0.16, 0.24, 0.65, 16), mat);
    body.position.y = 0.36;
    const mitre = new Mesh(new SphereGeometry(0.2, 16, 16), mat);
    mitre.position.y = 0.75;
    mitre.scale.set(0.85, 1.4, 0.85);
    const finial = new Mesh(new SphereGeometry(0.06, 12, 12), mat);
    finial.position.y = 0.98;
    group.add(base, body, mitre, finial);
    return group;
  }

  function createQueenMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.3, 0.34, 0.15, 20), mat);
    const body = new Mesh(new CylinderGeometry(0.18, 0.26, 0.8, 20), mat);
    body.position.y = 0.44;
    const crown = new Mesh(new CylinderGeometry(0.3, 0.18, 0.3, 20), mat);
    crown.position.y = 0.92;
    const orb = new Mesh(new SphereGeometry(0.09, 14, 14), mat);
    orb.position.y = 1.1;
    group.add(base, body, crown, orb);
    return group;
  }

  function createKingMesh(mat: MeshStandardMaterial): Group {
    const group = new Group();
    const base = new Mesh(new CylinderGeometry(0.32, 0.36, 0.16, 20), mat);
    const body = new Mesh(new CylinderGeometry(0.2, 0.28, 0.9, 20), mat);
    body.position.y = 0.5;
    const crown = new Mesh(new CylinderGeometry(0.32, 0.22, 0.35, 20), mat);
    crown.position.y = 1.02;

    const crossVert = new Mesh(new BoxGeometry(0.07, 0.24, 0.07), mat);
    crossVert.position.y = 1.25;
    const crossHoriz = new Mesh(new BoxGeometry(0.2, 0.07, 0.07), mat);
    crossHoriz.position.y = 1.26;
    group.add(base, body, crown, crossVert, crossHoriz);
    return group;
  }

  function buildPieceMesh(piece: ChessPiece): Group {
    const mat = piece.color === "w" ? whiteMat : blackMat;
    let group: Group;

    switch (piece.type) {
      case "p":
        group = createPawnMesh(mat);
        break;
      case "r":
        group = createRookMesh(mat);
        break;
      case "n":
        group = createKnightMesh(mat);
        break;
      case "b":
        group = createBishopMesh(mat);
        break;
      case "q":
        group = createQueenMesh(mat);
        break;
      case "k":
        group = createKingMesh(mat);
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
  // REGIA DINAMICA CINEMATOGRAFICA (BROADCAST CAMERA RIG)
  // -----------------------------------------------------------
  const clock = new Clock();
  let cameraMode: CameraMode = "dynamic";

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
      targetCamPos.set(0, 11.4, 7.2);
      targetLookAt.set(0, 0, 0);
      return;
    }

    if (cameraMode === "hero") {
      targetCamPos.set(0, 4.2, 6.2);
      targetLookAt.set(0, 0.4, 0);
      return;
    }

    if (isMoveAnimating) return;

    if (selectedSquareState) {
      const [sr, sc] = selectedSquareState;
      const pPos = squareToWorld(sr, sc);

      targetCamPos.set(
        pPos.x * 0.48,
        7.2,
        Math.max(5.8, pPos.z + 4.2)
      );
      targetLookAt.set(
        pPos.x * 0.32,
        0.3,
        pPos.z * 0.35 - 0.9
      );
    } else {
      targetCamPos.set(0, 9.5, 7.9);
      targetLookAt.set(0, 0, 0.2);
    }
  }

  function setCameraMode(mode: CameraMode) {
    cameraMode = mode;
    orbitAzimuth = 0;
    orbitElevation = 0;
    updateCameraFraming();
  }

  function setSelectedSquare(square: Square | null, legalDestinations: Square[] = []) {
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

    showLegalDestinations(legalDestinations);
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
      targetCamPos.set(midPos.x * 0.45, 7.4, Math.max(5.8, midPos.z + 4.3));
      targetLookAt.set(midPos.x * 0.3, 0.3, midPos.z * 0.35 - 0.6);
    }
  }

  function clearSolutionBeacon() {
    solutionBeaconGroup.visible = false;
  }

  function animateMove(from: Square, to: Square, onComplete: () => void) {
    const movedObj = pieceObjects.find((p) => p.row === from[0] && p.col === from[1]);
    const capturedObj = pieceObjects.find((p) => p.row === to[0] && p.col === to[1]);

    if (!movedObj) {
      onComplete();
      return;
    }

    isMoveAnimating = true;
    gameAudio.playSlide();

    if (capturedObj) {
      gameAudio.playChipClink();
      setTimeout(() => {
        scene.remove(capturedObj.group);
        pieceObjects = pieceObjects.filter((p) => p !== capturedObj);
      }, 250);
    }

    const fromPos = squareToWorld(from[0], from[1]);
    const destPos = squareToWorld(to[0], to[1]);
    const midPos = fromPos.clone().lerp(destPos, 0.5);

    if (cameraMode === "dynamic") {
      targetLookAt.set(midPos.x, 0.4, midPos.z);
      targetCamPos.set(
        midPos.x * 0.5,
        7.0,
        Math.max(5.6, midPos.z + 4.5)
      );
    }

    movedObj.row = to[0];
    movedObj.col = to[1];
    movedObj.group.userData = { row: to[0], col: to[1], isPiece: true };
    movedObj.group.traverse((c) => {
      if (c instanceof Mesh) c.userData = { row: to[0], col: to[1], isPiece: true };
    });

    movedObj.targetPos.set(destPos.x, movedObj.baseY + 0.65, destPos.z);

    setTimeout(() => {
      movedObj.targetPos.set(destPos.x, movedObj.baseY, destPos.z);

      if (cameraMode === "dynamic") {
        targetLookAt.set(destPos.x, 0.25, destPos.z);
      }

      setTimeout(() => {
        isMoveAnimating = false;
        updateCameraFraming();
        onComplete();
      }, 160);
    }, 220);
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
    gameAudio.playSqueeze();
    obsidianCheckRim.intensity = 4.2;

    if (cameraMode === "dynamic") {
      const kPos = squareToWorld(kingSquare[0], kingSquare[1]);
      targetCamPos.set(kPos.x * 0.6, 5.4, kPos.z + 3.8);
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
      targetCamPos.set(0, 6.2, 5.0);
      targetLookAt.set(0, 0.3, 0);
    }

    setTimeout(() => {
      overheadSpot.intensity = 3.2;
    }, 1000);
  }

  // -----------------------------------------------------------
  // RAYCASTING & CLICK SELECTION
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

  function onPointerUp(e: MouseEvent) {
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

  const canvas = renderer.domElement;
  canvas.addEventListener("mousemove", onPointerMove);
  canvas.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });

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

    // Floating Stardust Rotation
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
      const swayX = Math.sin(elapsedTime * 0.7) * 0.12;
      const swayY = Math.cos(elapsedTime * 0.5) * 0.08;
      actualTargetPos.x += swayX;
      actualTargetPos.y += swayY;
    }

    if (orbitAzimuth !== 0 || orbitElevation !== 0) {
      const radius = actualTargetPos.distanceTo(targetLookAt);
      actualTargetPos.x = targetLookAt.x + Math.sin(orbitAzimuth) * radius;
      actualTargetPos.z = targetLookAt.z + Math.cos(orbitAzimuth) * radius;
      actualTargetPos.y = Math.max(3.2, actualTargetPos.y + orbitElevation * 4.0);
    }

    const lerpSpeed = isMoveAnimating ? 7.2 : 4.6;
    const lerpFactor = 1.0 - Math.exp(-lerpSpeed * dt);

    currentCamPos.lerp(actualTargetPos, lerpFactor);
    currentLookAt.lerp(targetLookAt, lerpFactor);

    camera.position.copy(currentCamPos);
    camera.lookAt(currentLookAt);

    renderer.render(scene, camera);
  }

  animate();

  // -----------------------------------------------------------
  // RESIZE HANDLING VIA RESIZEOBSERVER
  // -----------------------------------------------------------
  function handleResize() {
    if (!container || !renderer) return;
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 550;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  const resizeObserver = new ResizeObserver(() => {
    handleResize();
  });
  resizeObserver.observe(container);

  // -----------------------------------------------------------
  // DISPOSE & CLEANUP
  // -----------------------------------------------------------
  function dispose() {
    isRunning = false;
    cancelAnimationFrame(animId);

    resizeObserver.disconnect();
    canvas.removeEventListener("mousemove", onPointerMove);
    canvas.removeEventListener("mousedown", onPointerDown);
    window.removeEventListener("mouseup", onPointerUp);
    canvas.removeEventListener("contextmenu", onContextMenu);
    canvas.removeEventListener("touchstart", onTouchStart);

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
    destMarkerGeo.dispose();
    destMarkerMat.dispose();
    selectedMarkerGeo.dispose();
    selectedMarkerMat.dispose();
    beaconRingGeo.dispose();
    beaconRingMat.dispose();
    beaconBeamGeo.dispose();
    beaconBeamMat.dispose();
    cursorRingGeo.dispose();
    cursorRingMat.dispose();
    whiteMat.dispose();
    blackMat.dispose();
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
    animateMove,
    animateRevert,
    showSolutionBeacon,
    clearSolutionBeacon,
    triggerCheckHighlight,
    triggerVictory,
    dispose,
  };
}
