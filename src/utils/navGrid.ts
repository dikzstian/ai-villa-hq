import { OFFICE_DESK_POSITIONS } from './villaCoords';

const X_MIN = -17.4;
const X_MAX = 17.4;
const Z_MIN = -17.9;
const Z_MAX = 12.9;
const CELL = 0.35;

const COLS = Math.ceil((X_MAX - X_MIN) / CELL);
const ROWS = Math.ceil((Z_MAX - Z_MIN) / CELL);

interface Box2D {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

interface Circle2D {
  cx: number;
  cz: number;
  r: number;
}

const SOLID_BOXES: Box2D[] = [
  // --- North Panoramic Glass Wall Segments (open doorways at x=-9..-4.1 & x=+4.1..+9) ---
  { minX: -18.0, maxX: -9.0, minZ: -12.52, maxZ: -12.08 },
  { minX: -4.1, maxX: 4.1, minZ: -12.52, maxZ: -12.08 },
  { minX: 9.0, maxX: 18.0, minZ: -12.52, maxZ: -12.08 },

  // --- Left Wing Partition Wall x=-8.8 (open doorways at z=-8.25..-4.65 & z=+4.65..+8.0) ---
  { minX: -9.2, maxX: -8.4, minZ: -12.5, maxZ: -8.25 },
  { minX: -9.2, maxX: -8.4, minZ: -4.65, maxZ: 4.65 },
  { minX: -9.2, maxX: -8.4, minZ: 8.0, maxZ: 13.5 },
  // Chill / Rest Dividing Wall z=+0.8
  { minX: -18.0, maxX: -8.6, minZ: 0.42, maxZ: 1.18 },

  // --- Right Wing Partition Wall x=+8.8 (open doorways at z=-8.65..-5.65, -0.95..2.0, 6.4..9.5) ---
  { minX: 8.4, maxX: 9.2, minZ: -12.5, maxZ: -8.65 },
  { minX: 8.4, maxX: 9.2, minZ: -5.65, maxZ: -0.95 },
  { minX: 8.4, maxX: 9.2, minZ: 2.0, maxZ: 6.4 },
  { minX: 8.4, maxX: 9.2, minZ: 9.5, maxZ: 13.5 },
  // Game Hub / Game Room / Fun Room Dividing Walls
  { minX: 8.6, maxX: 18.0, minZ: -4.18, maxZ: -3.42 },
  { minX: 8.6, maxX: 18.0, minZ: 3.92, maxZ: 4.68 },

  // --- Infinity Pool Basin & 4 Sun Loungers ---
  { minX: -11.05, maxX: 11.05, minZ: -17.55, maxZ: -13.38 },
  { minX: -14.95, maxX: -13.45, minZ: -16.45, maxZ: -13.85 },
  { minX: -12.95, maxX: -11.45, minZ: -16.45, maxZ: -13.85 },
  { minX: 11.45, maxX: 12.95, minZ: -16.45, maxZ: -13.85 },
  { minX: 13.45, maxX: 14.95, minZ: -16.45, maxZ: -13.85 },

  // --- Head DM Suite Furniture ---
  { minX: -1.9, maxX: 1.9, minZ: -10.55, maxZ: -8.15 },
  { minX: -3.75, maxX: -1.8, minZ: -10.55, maxZ: -9.45 },

  // --- Chill Room Furniture (Espresso Bar & L-Sofa) ---
  { minX: -15.75, maxX: -10.45, minZ: -10.65, maxZ: -8.68 },
  { minX: -15.85, maxX: -11.45, minZ: -4.0, maxZ: -2.35 },
  { minX: -15.95, maxX: -14.3, minZ: -6.05, maxZ: -2.85 },

  // --- Rest Room Furniture (2 Nap Daybeds, Washroom Partition & Vanity) ---
  { minX: -15.85, maxX: -13.75, minZ: 3.8, maxZ: 6.6 },
  { minX: -12.85, maxX: -10.75, minZ: 3.8, maxZ: 6.6 },
  { minX: -17.6, maxX: -11.65, minZ: 8.8, maxZ: 9.4 },
  { minX: -16.4, maxX: -13.0, minZ: 9.15, maxZ: 10.2 },

  // --- Game Hub Furniture (3 Arcade Cabinets & Racing Simulator) ---
  { minX: 10.5, maxX: 15.9, minZ: -10.8, maxZ: -9.22 },
  { minX: 13.9, maxX: 16.3, minZ: -6.35, maxZ: -5.05 },

  // --- Game Room Furniture (TV Console, Gaming Sofa, RGB PC Desk + Chair) ---
  { minX: 11.25, maxX: 15.35, minZ: -3.55, maxZ: -2.3 },
  { minX: 11.45, maxX: 15.15, minZ: 0.92, maxZ: 2.4 },
  { minX: 15.62, maxX: 17.5, minZ: -1.65, maxZ: 0.85 },

  // --- Fun Room Furniture (Billiard Table, Ping-Pong Table, Karaoke Speaker) ---
  { minX: 10.78, maxX: 14.22, minZ: 6.62, maxZ: 8.78 },
  { minX: 10.65, maxX: 13.15, minZ: 9.8, maxZ: 11.4 },
  { minX: 15.65, maxX: 16.85, minZ: 8.85, maxZ: 10.0 },
];

// Add all 16 Office Workstations (desk + chair footprint)
for (const [dx, , dz] of OFFICE_DESK_POSITIONS) {
  SOLID_BOXES.push({
    minX: dx - 1.18,
    maxX: dx + 1.18,
    minZ: dz - 0.72,
    maxZ: dz + 0.88,
  });
}

const SOLID_CIRCLES: Circle2D[] = [
  // Briefing Hub Round Oak Table + 6 Meeting Chairs
  { cx: 0, cz: -2.2, r: 2.38 },
  // Head DM Visitor Chairs
  { cx: -0.85, cz: -7.45, r: 0.36 },
  { cx: 0.85, cz: -7.45, r: 0.36 },
  // Chill Room Round Coffee Table
  { cx: -13.25, cz: -4.4, r: 1.02 },
  // Game Room Beanbag Poufs
  { cx: 10.9, cz: 0.3, r: 0.68 },
  { cx: 10.9, cz: -1.2, r: 0.64 },
  // Decorative Large Plants
  { cx: 2.9, cz: -9.8, r: 0.55 },
  { cx: -3.2, cz: -6.9, r: 0.5 },
  { cx: -16.9, cz: -9.8, r: 0.55 },
  { cx: -16.9, cz: -2.6, r: 0.55 },
  { cx: -7.9, cz: 11.8, r: 0.55 },
  { cx: 7.9, cz: 11.8, r: 0.55 },
];

// Prebake 2D Walkability Grid once on startup
const WALKABLE_GRID = new Uint8Array(COLS * ROWS);

export function isPointBlocked(x: number, z: number): boolean {
  if (x < X_MIN || x > X_MAX || z < Z_MIN || z > Z_MAX) return true;
  for (let i = 0; i < SOLID_BOXES.length; i++) {
    const b = SOLID_BOXES[i];
    if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return true;
  }
  for (let i = 0; i < SOLID_CIRCLES.length; i++) {
    const c = SOLID_CIRCLES[i];
    const dx = x - c.cx;
    const dz = z - c.cz;
    if (dx * dx + dz * dz <= c.r * c.r) return true;
  }
  return false;
}

for (let r = 0; r < ROWS; r++) {
  const wz = Z_MIN + (r + 0.5) * CELL;
  for (let c = 0; c < COLS; c++) {
    const wx = X_MIN + (c + 0.5) * CELL;
    WALKABLE_GRID[r * COLS + c] = isPointBlocked(wx, wz) ? 0 : 1;
  }
}

function worldToGrid(x: number, z: number): [number, number] {
  const c = Math.max(0, Math.min(COLS - 1, Math.floor((x - X_MIN) / CELL)));
  const r = Math.max(0, Math.min(ROWS - 1, Math.floor((z - Z_MIN) / CELL)));
  return [c, r];
}

function gridToWorld(c: number, r: number): [number, number] {
  return [X_MIN + (c + 0.5) * CELL, Z_MIN + (r + 0.5) * CELL];
}

function findNearestWalkableCell(startC: number, startR: number): [number, number] {
  if (WALKABLE_GRID[startR * COLS + startC] === 1) return [startC, startR];
  for (let rad = 1; rad <= 12; rad++) {
    for (let dr = -rad; dr <= rad; dr++) {
      for (let dc = -rad; dc <= rad; dc++) {
        if (Math.abs(dc) !== rad && Math.abs(dr) !== rad) continue;
        const nc = startC + dc;
        const nr = startR + dr;
        if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS) {
          if (WALKABLE_GRID[nr * COLS + nc] === 1) return [nc, nr];
        }
      }
    }
  }
  return [startC, startR];
}

function hasClearLineOfSight(x1: number, z1: number, x2: number, z2: number): boolean {
  const dist = Math.hypot(x2 - x1, z2 - z1);
  const steps = Math.max(2, Math.ceil(dist / 0.16));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = x1 + (x2 - x1) * t;
    const pz = z1 + (z2 - z1) * t;
    if (isPointBlocked(px, pz)) return false;
  }
  return true;
}

/**
 * Computes a guaranteed prop-free, wall-free smoothed path across the Villa floorplan.
 */
export function findSmoothObstacleFreePath(
  from: [number, number, number],
  to: [number, number, number]
): Array<[number, number, number]> {
  if (hasClearLineOfSight(from[0], from[2], to[0], to[2]) && !isPointBlocked(to[0], to[2])) {
    return [to];
  }

  const [rawSc, rawSr] = worldToGrid(from[0], from[2]);
  const [rawEc, rawEr] = worldToGrid(to[0], to[2]);
  const [sc, sr] = findNearestWalkableCell(rawSc, rawSr);
  const [ec, er] = findNearestWalkableCell(rawEc, rawEr);

  if (sc === ec && sr === er) {
    const [wx, wz] = gridToWorld(ec, er);
    return [[wx, 0, wz]];
  }

  const total = COLS * ROWS;
  const gScore = new Float32Array(total).fill(1e9);
  const closed = new Uint8Array(total);
  const cameFrom = new Int32Array(total).fill(-1);

  const startIdx = sr * COLS + sc;
  const goalIdx = er * COLS + ec;
  gScore[startIdx] = 0;

  // Compact binary-heap / sorted open set
  const openNodes: number[] = [startIdx];
  const fScore = new Float32Array(total).fill(1e9);
  fScore[startIdx] = Math.hypot(ec - sc, er - sr);

  const dirs = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];

  let found = false;
  while (openNodes.length > 0) {
    // Pop lowest fScore
    let bestPos = 0;
    let bestF = fScore[openNodes[0]];
    for (let i = 1; i < openNodes.length; i++) {
      const f = fScore[openNodes[i]];
      if (f < bestF) {
        bestF = f;
        bestPos = i;
      }
    }
    const current = openNodes[bestPos];
    openNodes[bestPos] = openNodes[openNodes.length - 1];
    openNodes.pop();

    if (current === goalIdx) {
      found = true;
      break;
    }
    if (closed[current]) continue;
    closed[current] = 1;

    const cr = Math.floor(current / COLS);
    const cc = current - cr * COLS;

    for (let d = 0; d < 8; d++) {
      const dc = dirs[d][0];
      const dr = dirs[d][1];
      const cost = dirs[d][2];
      const nc = cc + dc;
      const nr = cr + dr;
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;

      const nIdx = nr * COLS + nc;
      if (closed[nIdx] || WALKABLE_GRID[nIdx] === 0) continue;

      // Prevent diagonal corner cutting across solid furniture corners!
      if (dc !== 0 && dr !== 0) {
        if (
          WALKABLE_GRID[cr * COLS + (cc + dc)] === 0 ||
          WALKABLE_GRID[(cr + dr) * COLS + cc] === 0
        ) {
          continue;
        }
      }

      const tentativeG = gScore[current] + cost;
      if (tentativeG < gScore[nIdx]) {
        cameFrom[nIdx] = current;
        gScore[nIdx] = tentativeG;
        fScore[nIdx] = tentativeG + Math.hypot(ec - nc, er - nr) * 1.05;
        openNodes.push(nIdx);
      }
    }
  }

  if (!found) {
    const [wx, wz] = gridToWorld(ec, er);
    return [[wx, 0, wz]];
  }

  // Reconstruct raw grid path
  const rawPts: Array<[number, number]> = [];
  let curr = goalIdx;
  while (curr !== -1 && curr !== startIdx) {
    const r = Math.floor(curr / COLS);
    const c = curr - r * COLS;
    rawPts.push(gridToWorld(c, r));
    curr = cameFrom[curr];
  }
  rawPts.reverse();

  if (rawPts.length === 0) {
    return [to];
  }
  // Snap final point cleanly if target itself is walkable
  if (!isPointBlocked(to[0], to[2])) {
    rawPts[rawPts.length - 1] = [to[0], to[2]];
  }

  // String-pulling Line-of-Sight smoothing so paths look natural & fluid
  const smoothed: Array<[number, number, number]> = [];
  let anchor: [number, number] = [from[0], from[2]];
  let idx = 0;

  while (idx < rawPts.length) {
    let furthest = idx;
    for (let test = rawPts.length - 1; test > idx; test--) {
      if (hasClearLineOfSight(anchor[0], anchor[1], rawPts[test][0], rawPts[test][1])) {
        furthest = test;
        break;
      }
    }
    const chosen = rawPts[furthest];
    smoothed.push([chosen[0], 0, chosen[1]]);
    anchor = chosen;
    idx = furthest + 1;
  }

  return smoothed;
}
