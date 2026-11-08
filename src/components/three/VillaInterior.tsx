import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { VillaRoomId, VillaScenery } from '../../types';
import { OFFICE_DESK_POSITIONS, VILLA_ROOMS } from '../../utils/villaCoords';
import {
  getAnalyticsScreenTexture,
  getDeckTimberTexture,
  getGameScreenTexture,
  getGrassTerrainTexture,
  getMarbleTileTexture,
  getPoolWaterTexture,
  getWoodFloorTexture,
} from '../../utils/proceduralTextures';

interface VillaInteriorProps {
  scenery: VillaScenery;
  deskCount: number;
  activeRoomFilter: VillaRoomId | null;
  onSelectRoom: (roomId: VillaRoomId) => void;
}

/**
 * Architectural Cutaway Wall Segment with Baseboard & Dark Top Trim (Sims-style realistic interior wall)
 */
const CutawayWall: React.FC<{
  pos: [number, number, number];
  size: [number, number, number];
  color?: string;
}> = React.memo(({ pos, size, color = '#f0ece5' }) => {
  const [w, h, d] = size;
  return (
    <group position={pos}>
      <mesh position={[0, h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color={color} roughness={0.78} metalness={0.01} />
      </mesh>
      {/* Crown Molding Trim */}
      <mesh position={[0, h + 0.03, 0]}>
        <boxGeometry args={[w + 0.04, 0.06, d + 0.04]} />
        <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.05} />
      </mesh>
      {/* Mid-wall decorative chair rail */}
      <mesh position={[0, h * 0.55, d > 0.2 ? 0 : (d / 2 + 0.008)]}>
        <boxGeometry args={[w + 0.01, 0.035, 0.015]} />
        <meshStandardMaterial color="#d4c9b8" roughness={0.5} />
      </mesh>
      {/* Rich Walnut Baseboard */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w + 0.04, 0.12, d + 0.04]} />
        <meshStandardMaterial color="#5c3d1e" roughness={0.5} metalness={0.05} />
      </mesh>
    </group>
  );
});

const TropicalPlant: React.FC<{ position: [number, number, number]; scale?: number }> = React.memo(
  ({ position, scale = 1 }) => (
    <group position={position} scale={scale}>
      {/* Ceramic pot with rim */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.16, 0.48, 12]} />
        <meshStandardMaterial color="#d4c8b8" roughness={0.45} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.49, 0]}>
        <torusGeometry args={[0.22, 0.025, 8, 16]} />
        <meshStandardMaterial color="#c4b8a8" roughness={0.4} metalness={0.03} />
      </mesh>
      {/* Soil surface */}
      <mesh position={[0, 0.47, 0]}>
        <cylinderGeometry args={[0.19, 0.19, 0.03, 12]} />
        <meshStandardMaterial color="#3e2715" roughness={0.9} />
      </mesh>
      {/* Lush leaf clusters — varied greens */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh
          key={i}
          position={[Math.cos(i * 1.05) * 0.15, 0.7 + (i % 3) * 0.1, Math.sin(i * 1.05) * 0.15]}
          rotation={[0.25 + (i % 2) * 0.15, i * 1.05, 0.2]}
        >
          <sphereGeometry args={[0.2 + (i % 2) * 0.04, 7, 6]} />
          <meshStandardMaterial
            color={['#15803d', '#16a34a', '#22863a', '#1a7a35', '#0f7530', '#1d9e40'][i]}
            roughness={0.6}
            metalness={0.02}
          />
        </mesh>
      ))}
    </group>
  )
);

const SpecialistWorkstation: React.FC<{
  position: [number, number, number];
  screenTex: THREE.CanvasTexture;
}> = React.memo(({ position, screenTex }) => (
  <group position={position}>
    {/* Rich Walnut Tabletop with beveled edge */}
    <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
      <boxGeometry args={[1.85, 0.06, 0.92]} />
      <meshStandardMaterial color="#6f4226" roughness={0.35} metalness={0.03} />
    </mesh>
    {/* Edge bevel highlight */}
    <mesh position={[0, 0.77, 0.455]}>
      <boxGeometry args={[1.85, 0.015, 0.01]} />
      <meshStandardMaterial color="#8b5a34" roughness={0.3} metalness={0.05} />
    </mesh>
    {/* Brushed Steel Frame Legs */}
    <mesh position={[-0.84, 0.36, 0]}>
      <boxGeometry args={[0.05, 0.72, 0.82]} />
      <meshStandardMaterial color="#2a2a3a" metalness={0.6} roughness={0.35} />
    </mesh>
    <mesh position={[0.84, 0.36, 0]}>
      <boxGeometry args={[0.05, 0.72, 0.82]} />
      <meshStandardMaterial color="#2a2a3a" metalness={0.6} roughness={0.35} />
    </mesh>
    {/* Modesty Front Panel */}
    <mesh position={[0, 0.54, -0.38]}>
      <boxGeometry args={[1.65, 0.34, 0.025]} />
      <meshStandardMaterial color="#2d3444" roughness={0.7} metalness={0.05} />
    </mesh>

    {/* Ultrawide Monitor with thin bezels */}
    <mesh position={[0, 0.88, -0.22]}>
      <cylinderGeometry args={[0.035, 0.06, 0.22, 8]} />
      <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.3} />
    </mesh>
    <mesh position={[0, 1.12, -0.22]}>
      <boxGeometry args={[0.96, 0.48, 0.03]} />
      <meshStandardMaterial color="#0a0a14" roughness={0.2} metalness={0.3} />
    </mesh>
    <mesh position={[0, 1.12, -0.2]}>
      <planeGeometry args={[0.9, 0.42]} />
      <meshBasicMaterial map={screenTex} />
    </mesh>

    {/* Premium Desk Mat */}
    <mesh position={[0, 0.775, 0.12]}>
      <boxGeometry args={[0.76, 0.006, 0.34]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.92} />
    </mesh>
    {/* Keyboard */}
    <mesh position={[-0.06, 0.786, 0.12]}>
      <boxGeometry args={[0.38, 0.015, 0.13]} />
      <meshStandardMaterial color="#e8e5e0" roughness={0.6} metalness={0.05} />
    </mesh>
    {/* Mouse */}
    <mesh position={[0.22, 0.786, 0.13]}>
      <capsuleGeometry args={[0.025, 0.04, 6, 8]} />
      <meshStandardMaterial color="#e8e5e0" roughness={0.5} metalness={0.05} />
    </mesh>
    {/* Brass desk lamp */}
    <mesh position={[-0.72, 0.96, -0.22]}>
      <cylinderGeometry args={[0.015, 0.015, 0.38, 6]} />
      <meshStandardMaterial color="#b8860b" metalness={0.75} roughness={0.25} />
    </mesh>
    <mesh position={[-0.72, 1.16, -0.22]} rotation={[0, 0, 0.3]}>
      <coneGeometry args={[0.08, 0.1, 8]} />
      <meshStandardMaterial color="#d4a532" metalness={0.6} roughness={0.3} />
    </mesh>
    {/* Coffee mug */}
    <mesh position={[0.68, 0.82, 0.12]}>
      <cylinderGeometry args={[0.05, 0.042, 0.1, 10]} />
      <meshStandardMaterial color="#f5f0e8" roughness={0.4} />
    </mesh>
    <mesh position={[0.73, 0.83, 0.12]} rotation={[0, 0, Math.PI / 2]}>
      <torusGeometry args={[0.032, 0.008, 6, 12]} />
      <meshStandardMaterial color="#f5f0e8" roughness={0.4} />
    </mesh>

    {/* Premium Ergonomic Office Chair */}
    <group position={[0, 0, 0.66]}>
      {/* Seat cushion — rounded */}
      <mesh position={[0, 0.44, 0]}>
        <boxGeometry args={[0.48, 0.08, 0.46]} />
        <meshStandardMaterial color="#1e2536" roughness={0.75} />
      </mesh>
      {/* Lumbar back support — contoured */}
      <mesh position={[0, 0.76, 0.21]}>
        <boxGeometry args={[0.46, 0.56, 0.05]} />
        <meshStandardMaterial color="#2a3040" roughness={0.65} />
      </mesh>
      {/* Headrest */}
      <mesh position={[0, 1.08, 0.21]}>
        <boxGeometry args={[0.3, 0.12, 0.04]} />
        <meshStandardMaterial color="#2a3040" roughness={0.65} />
      </mesh>
      {/* Chrome gas lift */}
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.38, 8]} />
        <meshStandardMaterial color="#8a8a9a" metalness={0.7} roughness={0.25} />
      </mesh>
      {/* 5-star base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.24, 0.22, 0.04, 5]} />
        <meshStandardMaterial color="#1a1a2a" metalness={0.5} roughness={0.35} />
      </mesh>
      {/* Armrests */}
      <mesh position={[-0.26, 0.58, 0.06]}>
        <boxGeometry args={[0.04, 0.04, 0.2]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.5} />
      </mesh>
      <mesh position={[0.26, 0.58, 0.06]}>
        <boxGeometry args={[0.04, 0.04, 0.2]} />
        <meshStandardMaterial color="#2a2a3a" roughness={0.5} />
      </mesh>
    </group>
  </group>
));

/**
 * Full 360-Degree Surround World so NO camera angle ever sees half-empty void!
 */
const Full360WorldEnvironment: React.FC<{
  scenery: VillaScenery;
  grassTex: THREE.CanvasTexture;
  poolTex: THREE.CanvasTexture;
}> = React.memo(({ scenery, grassTex, poolTex }) => {
  const oceanMeshRef = useRef<THREE.Mesh>(null);
  const poolMeshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (oceanMeshRef.current) {
      oceanMeshRef.current.position.y = -0.65 + Math.sin(t * 1.3) * 0.09;
    }
    if (poolMeshRef.current) {
      poolTex.offset.x = Math.sin(t * 0.35) * 0.08;
      poolTex.offset.y = Math.cos(t * 0.28) * 0.06;
    }
  });

  // Generate 360-degree mountain ring & tree placements once
  const surroundMountains = useMemo(() => {
    const peaks: Array<{ x: number; z: number; r: number; h: number; col: string; snow: boolean }> =
      [];
    const count = 22;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const isNorth = Math.sin(angle) < -0.15;
      const dist = isNorth ? 68 + (i % 3) * 14 : 82 + (i % 4) * 12;
      const h = isNorth ? 24 + (i % 4) * 7 : 15 + (i % 3) * 5;
      const r = isNorth ? 20 + (i % 3) * 5 : 18 + (i % 3) * 4;
      peaks.push({
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        r,
        h,
        col: i % 2 === 0 ? '#1e3a5f' : '#166534',
        snow: h >= 26,
      });
    }
    return peaks;
  }, []);

  const gardenTrees = useMemo(() => {
    const coords: Array<[number, number, number]> = [
      [-24, 0, -14],
      [-26, 0, -4],
      [-25, 0, 8],
      [-22, 0, 18],
      [-10, 0, 22],
      [10, 0, 22],
      [22, 0, 18],
      [25, 0, 8],
      [26, 0, -4],
      [24, 0, -14],
      [-32, 0, -24],
      [32, 0, -24],
      [-35, 0, 14],
      [35, 0, 14],
    ];
    return coords;
  }, []);

  return (
    <group>
      {scenery === 'mountain' ? (
        <>
          {/* 360° Vast Highland Lawn & Valley Ground */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 0]} receiveShadow>
            <circleGeometry args={[220, 48]} />
            <meshStandardMaterial map={grassTex} roughness={0.92} />
          </mesh>

          {/* Scenic Valley Lake in North Vista */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.26, -38]}>
            <planeGeometry args={[95, 22]} />
            <meshStandardMaterial color="#0284c7" roughness={0.18} metalness={0.45} />
          </mesh>

          {/* 360° Surrounding Mountain Range */}
          {surroundMountains.map((m, idx) => (
            <group key={idx} position={[m.x, -0.4, m.z]}>
              <mesh>
                <coneGeometry args={[m.r, m.h, 7]} />
                <meshStandardMaterial color={m.col} roughness={0.88} />
              </mesh>
              {m.snow && (
                <mesh position={[0, m.h * 0.34, 0]}>
                  <coneGeometry args={[m.r * 0.33, m.h * 0.33, 7]} />
                  <meshStandardMaterial color="#f8fafc" roughness={0.5} />
                </mesh>
              )}
            </group>
          ))}

          {/* Pine & Cypress Estate Trees All Around Villa */}
          {gardenTrees.map(([tx, ty, tz], idx) => (
            <group key={idx} position={[tx, ty - 0.3, tz]}>
              <mesh position={[0, 1.1, 0]}>
                <cylinderGeometry args={[0.2, 0.28, 2.2, 7]} />
                <meshStandardMaterial color="#5c3a21" />
              </mesh>
              <mesh position={[0, 3.0, 0]} castShadow>
                <coneGeometry args={[1.6, 3.6, 8]} />
                <meshStandardMaterial color="#166534" roughness={0.8} />
              </mesh>
              <mesh position={[0, 4.6, 0]} castShadow>
                <coneGeometry args={[1.15, 2.8, 8]} />
                <meshStandardMaterial color="#15803d" roughness={0.8} />
              </mesh>
            </group>
          ))}
        </>
      ) : (
        <>
          {/* 360° Endless Tropical Ocean to Horizon */}
          <mesh
            ref={oceanMeshRef}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.65, 0]}
          >
            <circleGeometry args={[260, 56]} />
            <meshStandardMaterial
              color="#0284c7"
              emissive="#0369a1"
              emissiveIntensity={0.22}
              roughness={0.12}
              metalness={0.45}
            />
          </mesh>

          {/* Coastal Peninsula / Private Island Sandy Shoreline + Lush Villa Estate Lawn */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.42, 4]} receiveShadow>
            <circleGeometry args={[48, 48]} />
            <meshStandardMaterial color="#fef08a" roughness={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.32, 4]} receiveShadow>
            <circleGeometry args={[37, 48]} />
            <meshStandardMaterial map={grassTex} roughness={0.88} />
          </mesh>

          {/* Distant Tropical Islands Around Horizon with Varied Lush Terrain */}
          {[
            [-55, -75, 18, 10, '#0f766e'],
            [52, -85, 22, 13, '#115e59'],
            [-90, 18, 20, 9, '#134e4a'],
            [92, 25, 21, 11, '#0f766e'],
          ].map(([ix, iz, ir, ih, icol], idx) => (
            <mesh key={idx} position={[ix as number, -0.5, iz as number]}>
              <coneGeometry args={[ir as number, ih as number, 10]} />
              <meshStandardMaterial color={icol as string} roughness={0.85} />
            </mesh>
          ))}

          {/* Tropical Palm Trees Framing All Sides with Coconuts */}
          {gardenTrees.map(([px, py, pz], idx) => (
            <group key={idx} position={[px, py - 0.3, pz]}>
              {/* Textured Curved Palm Trunk */}
              <mesh
                position={[0, 2.1, 0]}
                rotation={[0.08, idx * 0.7, idx % 2 === 0 ? 0.1 : -0.1]}
                castShadow
              >
                <cylinderGeometry args={[0.16, 0.28, 4.2, 8]} />
                <meshStandardMaterial color="#78350f" roughness={0.8} />
              </mesh>
              {/* Palm Fronds */}
              {[0, 1, 2, 3, 4, 5].map((f) => (
                <mesh
                  key={f}
                  position={[0, 4.1, 0]}
                  rotation={[0.42, (f * Math.PI * 2) / 6, 0]}
                >
                  <boxGeometry args={[0.48, 0.05, 2.3]} />
                  <meshStandardMaterial color="#16a34a" roughness={0.6} />
                </mesh>
              ))}
              {/* Coconut Cluster */}
              {[0, 1, 2].map((ci) => {
                const cang = (ci / 3) * Math.PI * 2;
                return (
                  <mesh
                    key={`coco${ci}`}
                    position={[Math.cos(cang) * 0.12, 3.92, Math.sin(cang) * 0.12]}
                  >
                    <sphereGeometry args={[0.09, 8, 8]} />
                    <meshStandardMaterial color="#451a03" roughness={0.7} />
                  </mesh>
                );
              })}
            </group>
          ))}
        </>
      )}

      {/* Stone Courtyard Entrance & Slate Flagstone Paths */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.29, 17.5]} receiveShadow>
        <planeGeometry args={[11, 8.5]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.75} metalness={0.06} />
      </mesh>
      {/* Decorative Stepping Slate Pavers */}
      {[-2.5, 0, 2.5].map((px, i) => (
        <mesh key={`paver${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[px, -0.28, 17.5]}>
          <planeGeometry args={[1.6, 7.8]} />
          <meshStandardMaterial color="#64748b" roughness={0.7} metalness={0.08} />
        </mesh>
      ))}

      {/* Infinity Pool Integrated into North Timber Deck */}
      <group position={[0, 0, -15.3]}>
        {/* White Stone Pool Basin Border with Smooth Coping */}
        <mesh position={[0, -0.04, 0]} receiveShadow>
          <boxGeometry args={[21.4, 0.28, 3.9]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.04} />
        </mesh>
        {/* Deep Turquoise Mosaic Pool Interior Bed */}
        <mesh position={[0, -0.08, 0]}>
          <boxGeometry args={[20.4, 0.18, 3.2]} />
          <meshStandardMaterial color="#0284c7" roughness={0.2} metalness={0.1} />
        </mesh>
        {/* Shimmering Caustic Pool Water with Subtle Aqua Glow */}
        <mesh ref={poolMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <planeGeometry args={[20.4, 3.2]} />
          <meshStandardMaterial
            map={poolTex}
            roughness={0.08}
            metalness={0.35}
            emissive="#38bdf8"
            emissiveIntensity={0.15}
          />
        </mesh>
        {/* Underwater LED Glow Strip */}
        <mesh position={[0, 0.04, -1.55]}>
          <boxGeometry args={[20.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
        </mesh>
      </group>
    </group>
  );
});

export const VillaInterior: React.FC<VillaInteriorProps> = React.memo(
  ({ scenery, deskCount, activeRoomFilter, onSelectRoom }) => {
    const woodTex = useMemo(() => getWoodFloorTexture(9, 7), []);
    const deckTex = useMemo(() => getDeckTimberTexture(12, 3), []);
    const marbleTex = useMemo(() => getMarbleTileTexture(4, 4), []);
    const grassTex = useMemo(() => getGrassTerrainTexture(32, 32), []);
    const poolTex = useMemo(() => getPoolWaterTexture(5, 2), []);
    const analyticsTex = useMemo(() => getAnalyticsScreenTexture(), []);
    const gameTex = useMemo(() => getGameScreenTexture(), []);

    const desksToRender = Math.max(11, Math.min(OFFICE_DESK_POSITIONS.length, deskCount));

    return (
      <group>
        {/* 1. FULL 360° SURROUND TERRAIN, MOUNTAINS / OCEAN & GARDENS */}
        <Full360WorldEnvironment scenery={scenery} grassTex={grassTex} poolTex={poolTex} />

        {/* 2. VILLA FOUNDATION, PARQUET FLOORS, MARBLE WINGS & TIMBER POOL DECK */}
        {/* Raised Architectural Stone Plinth — Warm Concrete with Subtle Sheen */}
        <mesh position={[0, -0.18, 0.5]} receiveShadow>
          <boxGeometry args={[36.8, 0.34, 26.8]} />
          <meshStandardMaterial color="#c4cdd6" roughness={0.6} metalness={0.03} />
        </mesh>

        {/* Main Center Hall & Office Oak Parquet Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.5]} receiveShadow>
          <planeGeometry args={[17.6, 25.6]} />
          <meshStandardMaterial map={woodTex} roughness={0.32} metalness={0.02} />
        </mesh>

        {/* Left Wing (Chill Room + Rest Room) Luxury Cream Marble Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-13.3, 0.006, 0.5]} receiveShadow>
          <planeGeometry args={[9.0, 25.6]} />
          <meshStandardMaterial map={marbleTex} roughness={0.22} metalness={0.05} />
        </mesh>

        {/* Right Wing (Game Hub + Game Room + Fun Room) Warm Wood & Carpet Floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[13.3, 0.006, 0.5]} receiveShadow>
          <planeGeometry args={[9.0, 25.6]} />
          <meshStandardMaterial map={woodTex} roughness={0.35} metalness={0.02} />
        </mesh>

        {/* North Infinity Pool Timber Deck */}
        <mesh position={[0, -0.1, -15.2]} receiveShadow>
          <boxGeometry args={[36.8, 0.22, 6.2]} />
          <meshStandardMaterial map={deckTex} roughness={0.52} metalness={0.02} />
        </mesh>

        {/* Frameless Tempered Glass Pool Deck Railing — more visible */}
        <mesh position={[0, 0.48, -18.15]}>
          <boxGeometry args={[36.2, 0.9, 0.05]} />
          <meshStandardMaterial color="#d4eaf5" transparent opacity={0.18} roughness={0.05} metalness={0.15} />
        </mesh>
        {/* Glass railing chrome posts */}
        {Array.from({ length: 12 }).map((_, i) => (
          <mesh key={`rpost-${i}`} position={[-16.5 + i * 3, 0.48, -18.15]}>
            <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
            <meshStandardMaterial color="#a0a0b0" metalness={0.7} roughness={0.25} />
          </mesh>
        ))}

        {/* Sun Loungers & Resort Umbrellas on Pool Deck */}
        {[-14.2, -12.2, 12.2, 14.2].map((lx, idx) => (
          <group key={idx} position={[lx, 0.02, -15.1]}>
            {/* Teak lounger frame */}
            <mesh position={[0, 0.18, 0]} castShadow>
              <boxGeometry args={[0.95, 0.14, 2.1]} />
              <meshStandardMaterial color="#6b4226" roughness={0.4} metalness={0.03} />
            </mesh>
            {/* Plush white cushion */}
            <mesh position={[0, 0.29, 0.1]}>
              <boxGeometry args={[0.84, 0.1, 1.85]} />
              <meshStandardMaterial color="#f5f0e8" roughness={0.8} />
            </mesh>
            {/* Adjustable backrest */}
            <mesh position={[0, 0.52, 0.85]} rotation={[-0.55, 0, 0]}>
              <boxGeometry args={[0.82, 0.09, 0.65]} />
              <meshStandardMaterial color="#f5f0e8" roughness={0.8} />
            </mesh>
          </group>
        ))}
        {[-13.2, 13.2].map((ux, idx) => (
          <group key={idx} position={[ux, 0, -15.2]}>
            {/* Parasol pole — brushed wood */}
            <mesh position={[0, 1.35, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 2.7, 8]} />
              <meshStandardMaterial color="#6b4226" roughness={0.4} metalness={0.05} />
            </mesh>
            {/* Canvas umbrella canopy */}
            <mesh position={[0, 2.65, 0]} castShadow>
              <coneGeometry args={[1.85, 0.55, 12]} />
              <meshStandardMaterial color="#fef3c7" roughness={0.75} />
            </mesh>
          </group>
        ))}

        {/* 3. REALISTIC SIMS-STYLE CUTAWAY WALLS & FRAMED DOORWAYS */}
        {/* Outer West, East & South Perimeter Cutaway Walls */}
        <CutawayWall pos={[-17.9, 0, 0.5]} size={[0.28, 2.4, 25.8]} />
        <CutawayWall pos={[17.9, 0, 0.5]} size={[0.28, 2.4, 25.8]} />
        <CutawayWall pos={[-9.5, 0, 13.3]} size={[17.0, 1.35, 0.28]} />
        <CutawayWall pos={[9.5, 0, 13.3]} size={[17.0, 1.35, 0.28]} />

        {/* North Panoramic Sliding Glass Wall + Open Double-Doorways at x=-5.8 & x=+5.8 */}
        {[-13.4, 0, 13.4].map((gx, i) => (
          <group key={i} position={[gx, 0, -12.3]}>
            {/* Black Anodized Mullion Frame */}
            <mesh position={[0, 1.25, 0]}>
              <boxGeometry args={[i === 1 ? 8.2 : 8.8, 2.5, 0.1]} />
              <meshStandardMaterial color="#bae6fd" transparent opacity={0.22} roughness={0.08} />
            </mesh>
            <mesh position={[0, 2.48, 0]}>
              <boxGeometry args={[i === 1 ? 8.3 : 8.9, 0.1, 0.16]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </group>
        ))}

        {/* Wooden Terrace Pergola Beams Along North Panoramic Facade */}
        <mesh position={[0, 2.62, -13.1]}>
          <boxGeometry args={[36.2, 0.14, 0.18]} />
          <meshStandardMaterial color="#5c3a21" />
        </mesh>
        {Array.from({ length: 15 }).map((_, i) => (
          <mesh key={i} position={[-16.8 + i * 2.4, 2.72, -13.1]}>
            <boxGeometry args={[0.12, 0.1, 2.2]} />
            <meshStandardMaterial color="#6b4423" />
          </mesh>
        ))}

        {/* Left Wing Interior Partition Wall (x = -8.8) with Open Doorways at z = -6.5 & z = +6.5 */}
        <CutawayWall pos={[-8.8, 0, -10.3]} size={[0.2, 2.2, 4.0]} />
        <CutawayWall pos={[-8.8, 0, 0.0]} size={[0.2, 2.2, 9.2]} />
        <CutawayWall pos={[-8.8, 0, 10.6]} size={[0.2, 2.2, 5.2]} />
        {/* Chill Room / Rest Room Dividing Wall */}
        <CutawayWall pos={[-13.3, 0, 0.8]} size={[8.9, 2.2, 0.2]} />

        {/* Right Wing Interior Partition Wall (x = +8.8) with Open Doorways at z = -7.2, +0.5, +8.0 */}
        <CutawayWall pos={[8.8, 0, -10.5]} size={[0.2, 2.2, 3.6]} />
        <CutawayWall pos={[8.8, 0, -3.3]} size={[0.2, 2.2, 4.6]} />
        <CutawayWall pos={[8.8, 0, 4.2]} size={[0.2, 2.2, 4.4]} />
        <CutawayWall pos={[8.8, 0, 11.4]} size={[0.2, 2.2, 3.8]} />
        {/* Game Hub / Game Room / Fun Room Dividing Walls */}
        <CutawayWall pos={[13.3, 0, -3.8]} size={[8.9, 2.2, 0.2]} />
        <CutawayWall pos={[13.3, 0, 4.3]} size={[8.9, 2.2, 0.2]} />

        {/* === ZONE 1: HEAD OF DIGITAL MARKETING SUITE (0, 0, -8.5) === */}
        <group position={[0, 0, -8.5]}>
          {/* Plush Woven Indigo Executive Carpet — layered with border */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0.2]} receiveShadow>
            <planeGeometry args={[7.2, 4.6]} />
            <meshStandardMaterial color="#1e293b" roughness={0.92} metalness={0.02} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.2]}>
            <planeGeometry args={[6.8, 4.2]} />
            <meshStandardMaterial color="#312e81" roughness={0.88} metalness={0.03} />
          </mesh>

          {/* Executive Walnut & Matte-Slate Desk — premium wood with edge bevel */}
          <mesh position={[0, 0.76, -0.5]} castShadow receiveShadow>
            <boxGeometry args={[3.1, 0.08, 1.1]} />
            <meshStandardMaterial color="#5c3a21" roughness={0.32} metalness={0.08} />
          </mesh>
          {/* Desk edge bevel accent */}
          <mesh position={[0, 0.725, -0.5]}>
            <boxGeometry args={[3.14, 0.015, 1.14]} />
            <meshStandardMaterial color="#78350f" roughness={0.3} metalness={0.15} />
          </mesh>
          <mesh position={[0, 0.38, -0.5]} castShadow>
            <boxGeometry args={[2.9, 0.74, 0.96]} />
            <meshStandardMaterial color="#0f172a" roughness={0.45} metalness={0.12} />
          </mesh>
          {/* Desk drawer handles */}
          {[-0.7, 0, 0.7].map((hx, i) => (
            <mesh key={`dh${i}`} position={[hx, 0.45, -0.02]}>
              <boxGeometry args={[0.18, 0.025, 0.035]} />
              <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
            </mesh>
          ))}

          {/* Dual Executive Curved Monitors — thin bezel */}
          <mesh position={[-0.52, 1.12, -0.35]} rotation={[0, 0.14, 0]} castShadow>
            <boxGeometry args={[0.95, 0.48, 0.03]} />
            <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.25} />
          </mesh>
          <mesh position={[-0.52, 1.12, -0.325]} rotation={[0, 0.14, 0]}>
            <planeGeometry args={[0.89, 0.42]} />
            <meshBasicMaterial map={analyticsTex} />
          </mesh>
          {/* Monitor stand L */}
          <mesh position={[-0.52, 0.86, -0.36]}>
            <cylinderGeometry args={[0.035, 0.06, 0.08, 8]} />
            <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[0.52, 1.12, -0.35]} rotation={[0, -0.14, 0]} castShadow>
            <boxGeometry args={[0.95, 0.48, 0.03]} />
            <meshStandardMaterial color="#0f172a" metalness={0.3} roughness={0.25} />
          </mesh>
          <mesh position={[0.52, 1.12, -0.325]} rotation={[0, -0.14, 0]}>
            <planeGeometry args={[0.89, 0.42]} />
            <meshBasicMaterial map={analyticsTex} />
          </mesh>
          {/* Monitor stand R */}
          <mesh position={[0.52, 0.86, -0.36]}>
            <cylinderGeometry args={[0.035, 0.06, 0.08, 8]} />
            <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
          </mesh>

          {/* Executive Leather Chair — premium with headrest, armrests, gas lift */}
          <mesh position={[0, 0.48, -1.35]} castShadow>
            <boxGeometry args={[0.68, 0.08, 0.62]} />
            <meshStandardMaterial color="#312e81" roughness={0.55} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.82, -1.6]} castShadow>
            <boxGeometry args={[0.66, 0.72, 0.08]} />
            <meshStandardMaterial color="#4338ca" roughness={0.42} metalness={0.06} />
          </mesh>
          {/* Headrest */}
          <mesh position={[0, 1.28, -1.6]}>
            <boxGeometry args={[0.36, 0.18, 0.08]} />
            <meshStandardMaterial color="#4338ca" roughness={0.42} metalness={0.06} />
          </mesh>
          {/* Armrests */}
          {[-0.38, 0.38].map((ax, i) => (
            <mesh key={`arm${i}`} position={[ax, 0.62, -1.35]}>
              <boxGeometry args={[0.06, 0.28, 0.36]} />
              <meshStandardMaterial color="#1e1b4b" roughness={0.5} metalness={0.08} />
            </mesh>
          ))}
          {/* Gas lift + 5-star base */}
          <mesh position={[0, 0.28, -1.35]}>
            <cylinderGeometry args={[0.035, 0.035, 0.38, 8]} />
            <meshStandardMaterial color="#a3a3a3" metalness={0.85} roughness={0.15} />
          </mesh>
          {[0, 1, 2, 3, 4].map((si) => (
            <mesh key={`star${si}`} position={[
              Math.cos((si / 5) * Math.PI * 2) * 0.22,
              0.06,
              -1.35 + Math.sin((si / 5) * Math.PI * 2) * 0.22
            ]}>
              <boxGeometry args={[0.04, 0.04, 0.22]} />
              <meshStandardMaterial color="#a3a3a3" metalness={0.85} roughness={0.15} />
            </mesh>
          ))}

          {/* 2 Executive Visitor Chairs — leather with armrests & chrome base */}
          {[-0.85, 0.85].map((vx, i) => (
            <group key={i} position={[vx, 0, 1.05]}>
              <mesh position={[0, 0.44, 0]} castShadow>
                <boxGeometry args={[0.52, 0.07, 0.48]} />
                <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.06} />
              </mesh>
              <mesh position={[0, 0.72, 0.21]} castShadow>
                <boxGeometry args={[0.5, 0.5, 0.07]} />
                <meshStandardMaterial color="#475569" roughness={0.55} metalness={0.06} />
              </mesh>
              {/* Armrests */}
              {[-0.28, 0.28].map((ax, j) => (
                <mesh key={`va${j}`} position={[ax, 0.56, 0.08]}>
                  <boxGeometry args={[0.04, 0.18, 0.28]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.1} />
                </mesh>
              ))}
              <mesh position={[0, 0.22, 0]}>
                <cylinderGeometry args={[0.04, 0.2, 0.42, 8]} />
                <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
              </mesh>
            </group>
          ))}

          {/* Credenza Sideboard — rich walnut with brass handles */}
          <mesh position={[-2.7, 0.45, -1.5]} castShadow>
            <boxGeometry args={[1.4, 0.9, 0.5]} />
            <meshStandardMaterial color="#6b4423" roughness={0.4} metalness={0.06} />
          </mesh>
          {/* Credenza top surface */}
          <mesh position={[-2.7, 0.905, -1.5]}>
            <boxGeometry args={[1.44, 0.015, 0.54]} />
            <meshStandardMaterial color="#78350f" roughness={0.3} metalness={0.1} />
          </mesh>
          {/* Brass handles */}
          {[-0.35, 0.35].map((hx, i) => (
            <mesh key={`ch${i}`} position={[-2.7 + hx, 0.45, -1.24]}>
              <boxGeometry args={[0.12, 0.02, 0.025]} />
              <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
            </mesh>
          ))}
          {/* Brass desk lamp on credenza */}
          <mesh position={[-2.4, 1.05, -1.5]}>
            <cylinderGeometry args={[0.06, 0.1, 0.2, 8]} />
            <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[-2.4, 1.2, -1.5]}>
            <cylinderGeometry args={[0.015, 0.015, 0.28, 6]} />
            <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
          </mesh>
          <mesh position={[-2.4, 1.36, -1.5]} rotation={[0.3, 0, 0]}>
            <coneGeometry args={[0.1, 0.12, 8, 1, true]} />
            <meshStandardMaterial color="#fef3c7" emissive="#fbbf24" emissiveIntensity={0.4} side={2} />
          </mesh>
          <TropicalPlant position={[2.9, 0, -1.3]} scale={1.15} />
          <TropicalPlant position={[-3.2, 0, 1.6]} scale={1.0} />
        </group>

        {/* === ZONE 2: CENTRAL BRIEFING HUB & GLASS STRATEGY WHITEBOARD === */}
        <group position={[0, 0, -2.2]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, 0]} receiveShadow>
            <circleGeometry args={[3.2, 32]} />
            <meshStandardMaterial color="#334155" roughness={0.88} metalness={0.04} />
          </mesh>
          {/* Premium Walnut Briefing Table — edge bevel + metal pedestal */}
          <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[1.65, 1.65, 0.08, 28]} />
            <meshStandardMaterial color="#855836" roughness={0.35} metalness={0.08} />
          </mesh>
          {/* Table edge bevel */}
          <mesh position={[0, 0.695, 0]}>
            <cylinderGeometry args={[1.67, 1.67, 0.015, 28]} />
            <meshStandardMaterial color="#78350f" roughness={0.28} metalness={0.15} />
          </mesh>
          {/* Brushed steel pedestal */}
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.38, 0.55, 0.72, 16]} />
            <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.3} />
          </mesh>
          {/* 6 Ergonomic Meeting Chairs — premium leather with armrests */}
          {[0, 1, 2, 3, 4, 5].map((ci) => {
            const ang = (ci / 6) * Math.PI * 2 + 0.35;
            const cx = Math.cos(ang) * 2.08;
            const cz = Math.sin(ang) * 2.08;
            const faceCenterYaw = Math.atan2(-cx, -cz);
            return (
              <group key={ci} position={[cx, 0, cz]} rotation={[0, faceCenterYaw, 0]}>
                <mesh position={[0, 0.44, 0]} castShadow>
                  <boxGeometry args={[0.48, 0.07, 0.46]} />
                  <meshStandardMaterial color="#1e293b" roughness={0.58} metalness={0.06} />
                </mesh>
                <mesh position={[0, 0.74, -0.21]} castShadow>
                  <boxGeometry args={[0.46, 0.52, 0.06]} />
                  <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.06} />
                </mesh>
                {/* Armrests */}
                {[-0.26, 0.26].map((ax, j) => (
                  <mesh key={`ma${j}`} position={[ax, 0.55, -0.06]}>
                    <boxGeometry args={[0.04, 0.16, 0.24]} />
                    <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.1} />
                  </mesh>
                ))}
                <mesh position={[0, 0.22, 0]}>
                  <cylinderGeometry args={[0.04, 0.19, 0.42, 8]} />
                  <meshStandardMaterial color="#a3a3a3" metalness={0.8} roughness={0.2} />
                </mesh>
              </group>
            );
          })}
          {/* Laptop — brushed aluminium */}
          <mesh position={[-0.5, 0.8, 0.2]} rotation={[0, 0.5, 0]}>
            <boxGeometry args={[0.38, 0.03, 0.26]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.18} />
          </mesh>
          {/* Holographic Strategy Crystal */}
          <mesh position={[0, 0.96, 0]}>
            <octahedronGeometry args={[0.2, 1]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.75}
              metalness={0.3}
              roughness={0.15}
            />
          </mesh>
        </group>

        {/* Studio Glass Strategy Whiteboard on Left Center Wall */}
        <group position={[-8.65, 1.35, 0.2]}>
          <mesh>
            <boxGeometry args={[0.06, 1.15, 2.2]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.15} />
          </mesh>
          {[-0.6, -0.1, 0.4].map((sz, i) => (
            <mesh key={i} position={[0.04, 0.15 - (i % 2) * 0.25, sz]}>
              <boxGeometry args={[0.01, 0.22, 0.22]} />
              <meshStandardMaterial
                color={['#fef08a', '#f472b6', '#38bdf8'][i]}
              />
            </mesh>
          ))}
        </group>

        {/* === ZONE 3: MAIN MARKETING OFFICE STUDIO === */}
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 6.2]} receiveShadow>
            <planeGeometry args={[15.8, 11.8]} />
            <meshStandardMaterial color="#292524" roughness={0.94} />
          </mesh>
          {OFFICE_DESK_POSITIONS.slice(0, desksToRender).map((pos, idx) => (
            <SpecialistWorkstation key={idx} position={pos} screenTex={analyticsTex} />
          ))}
          <TropicalPlant position={[-7.9, 0, 11.8]} scale={1.2} />
          <TropicalPlant position={[7.9, 0, 11.8]} scale={1.2} />
        </group>

        {/* === ZONE 4: CHILL ROOM & MARBLE ESPRESSO BAR (Left North Wing) === */}
        <group position={[-13.3, 0, -6.2]}>
          {/* Cozy Sage Woven Area Rug — layered with border */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, 0.015, 1.4]} receiveShadow>
            <planeGeometry args={[6.6, 5.4]} />
            <meshStandardMaterial color="#0f766e" roughness={0.9} metalness={0.02} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-0.2, 0.018, 1.4]}>
            <planeGeometry args={[6.2, 5.0]} />
            <meshStandardMaterial color="#134e4a" roughness={0.88} />
          </mesh>

          {/* Marble-Top Kitchen & Espresso Bar Counter */}
          <group position={[0.2, 0, -3.6]}>
            {/* Walnut Cabinet Base */}
            <mesh position={[0, 0.48, 0]} castShadow>
              <boxGeometry args={[4.4, 0.96, 0.9]} />
              <meshStandardMaterial color="#451a03" roughness={0.38} metalness={0.08} />
            </mesh>
            {/* Stainless Steel Toe-kick */}
            <mesh position={[0, 0.05, 0.42]}>
              <boxGeometry args={[4.38, 0.1, 0.04]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
            </mesh>
            {/* Polished Calacatta Marble Countertop with Overhang */}
            <mesh position={[0, 0.99, 0]} castShadow>
              <boxGeometry args={[4.55, 0.06, 1.0]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.14} metalness={0.05} />
            </mesh>
            {/* Chrome Professional Espresso Machine */}
            <mesh position={[-1.1, 1.24, -0.1]} castShadow>
              <boxGeometry args={[0.68, 0.44, 0.48]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.1} />
            </mesh>
            {/* Machine Drip Tray & Groupheads */}
            <mesh position={[-1.1, 1.05, 0.12]}>
              <boxGeometry args={[0.55, 0.04, 0.18]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.15} />
            </mesh>
            {[-1.22, -0.98].map((gx, i) => (
              <mesh key={`gh${i}`} position={[gx, 1.2, 0.16]}>
                <cylinderGeometry args={[0.035, 0.035, 0.08, 8]} />
                <meshStandardMaterial color="#0f172a" roughness={0.4} />
              </mesh>
            ))}
            {/* Coffee Grinder */}
            <mesh position={[-0.45, 1.2, -0.1]} castShadow>
              <cylinderGeometry args={[0.1, 0.12, 0.36, 12]} />
              <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.5} />
            </mesh>
            {/* Ceramic Coffee Cups */}
            {[-0.05, 0.12, 0.28].map((cx, i) => (
              <mesh key={`cup${i}`} position={[cx, 1.06, -0.15]}>
                <cylinderGeometry args={[0.04, 0.03, 0.08, 10]} />
                <meshStandardMaterial color={['#fef3c7', '#fed7aa', '#bae6fd'][i]} roughness={0.2} />
              </mesh>
            ))}

            {/* Cognac Leather Barstools with Brass Footrests */}
            {[-1.2, 0, 1.2].map((bx, i) => (
              <group key={i} position={[bx, 0, 0.82]}>
                {/* Cognac Leather Cushion */}
                <mesh position={[0, 0.66, 0]} castShadow>
                  <cylinderGeometry args={[0.22, 0.22, 0.08, 16]} />
                  <meshStandardMaterial color="#9a3412" roughness={0.45} metalness={0.06} />
                </mesh>
                {/* Swivel Gas Lift & Stem */}
                <mesh position={[0, 0.34, 0]}>
                  <cylinderGeometry args={[0.03, 0.03, 0.58, 8]} />
                  <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Circular Brass Footrest Ring */}
                <mesh position={[0, 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.16, 0.015, 8, 16]} />
                  <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
                </mesh>
                {/* Round Base Plinth */}
                <mesh position={[0, 0.03, 0]}>
                  <cylinderGeometry args={[0.22, 0.24, 0.05, 16]} />
                  <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
                </mesh>
              </group>
            ))}
          </group>

          {/* Tufted Linen L-Shaped Lounge Sofa + Pillows */}
          <group position={[-0.3, 0, 1.8]}>
            {/* Sofa Timber Base Frame */}
            <mesh position={[0, 0.05, 1.2]}>
              <boxGeometry args={[3.84, 0.08, 1.14]} />
              <meshStandardMaterial color="#451a03" roughness={0.4} metalness={0.08} />
            </mesh>
            <mesh position={[-1.55, 0.05, -0.1]}>
              <boxGeometry args={[1.14, 0.08, 2.64]} />
              <meshStandardMaterial color="#451a03" roughness={0.4} metalness={0.08} />
            </mesh>
            {/* Soft Cream Seat Cushions */}
            <mesh position={[0, 0.32, 1.2]} castShadow receiveShadow>
              <boxGeometry args={[3.8, 0.44, 1.1]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.85} />
            </mesh>
            <mesh position={[0, 0.66, 1.65]} castShadow>
              <boxGeometry args={[3.8, 0.46, 0.24]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
            </mesh>
            <mesh position={[-1.55, 0.32, -0.1]} castShadow receiveShadow>
              <boxGeometry args={[1.1, 0.44, 2.6]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.85} />
            </mesh>
            <mesh position={[-1.98, 0.66, -0.1]} castShadow>
              <boxGeometry args={[0.24, 0.46, 2.6]} />
              <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
            </mesh>
            {/* Cozy Throw Pillows */}
            {[
              { pos: [-1.1, 0.62, 1.35], rot: [0.15, 0.1, 0], col: '#ea580c' },
              { pos: [0.2, 0.62, 1.35], rot: [0.2, -0.15, 0], col: '#0d9488' },
              { pos: [1.2, 0.62, 1.35], rot: [0.18, 0.05, 0], col: '#d97706' },
              { pos: [-1.65, 0.62, 0.4], rot: [0.1, 0.3, 0], col: '#6366f1' },
            ].map((p, i) => (
              <mesh key={`tp${i}`} position={p.pos as [number, number, number]} rotation={p.rot as [number, number, number]}>
                <boxGeometry args={[0.38, 0.34, 0.14]} />
                <meshStandardMaterial color={p.col} roughness={0.82} />
              </mesh>
            ))}
            {/* Round Walnut Coffee Table with Brass Hairpin Legs */}
            <mesh position={[0.35, 0.38, 0.0]} castShadow>
              <cylinderGeometry args={[0.78, 0.78, 0.06, 24]} />
              <meshStandardMaterial color="#5c3a21" roughness={0.32} metalness={0.08} />
            </mesh>
            {/* Coffee Table Edge Bevel */}
            <mesh position={[0.35, 0.345, 0.0]}>
              <cylinderGeometry args={[0.79, 0.79, 0.015, 24]} />
              <meshStandardMaterial color="#78350f" roughness={0.28} metalness={0.15} />
            </mesh>
            {/* Hairpin Metal Legs */}
            {[0, 1, 2].map((li) => {
              const lang = (li / 3) * Math.PI * 2;
              return (
                <mesh key={`cfl${li}`} position={[
                  0.35 + Math.cos(lang) * 0.52,
                  0.17,
                  Math.sin(lang) * 0.52
                ]}>
                  <cylinderGeometry args={[0.02, 0.02, 0.34, 6]} />
                  <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
                </mesh>
              );
            })}
            {/* Ceramic Mugs & Magazines on Coffee Table */}
            <mesh position={[0.22, 0.43, -0.1]}>
              <cylinderGeometry args={[0.04, 0.035, 0.07, 8]} />
              <meshStandardMaterial color="#ffffff" roughness={0.2} />
            </mesh>
            <mesh position={[0.48, 0.42, 0.1]} rotation={[0, 0.4, 0]}>
              <boxGeometry args={[0.24, 0.02, 0.32]} />
              <meshStandardMaterial color="#38bdf8" roughness={0.5} />
            </mesh>
          </group>

          <TropicalPlant position={[-3.6, 0, -3.6]} scale={1.25} />
          <TropicalPlant position={[-3.6, 0, 3.6]} scale={1.1} />
        </group>

        {/* === ZONE 5: REST ROOM, NAP PODS & WASHROOM SUITE (Left South Wing) === */}
        <group position={[-13.3, 0, 7.0]}>
          {/* 2 Cushioned Nap Daybeds with Solid Oak Frames & Quilted Throws */}
          {[-1.5, 1.5].map((nx, idx) => (
            <group key={idx} position={[nx, 0, -1.8]}>
              {/* Solid Wood Bed Platform */}
              <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
                <boxGeometry args={[1.52, 0.22, 2.36]} />
                <meshStandardMaterial color="#451a03" roughness={0.38} metalness={0.06} />
              </mesh>
              {/* Headboard */}
              <mesh position={[0, 0.5, -1.14]} castShadow>
                <boxGeometry args={[1.52, 0.6, 0.1]} />
                <meshStandardMaterial color="#3b2010" roughness={0.4} metalness={0.06} />
              </mesh>
              {/* Mattress */}
              <mesh position={[0, 0.32, 0]}>
                <boxGeometry args={[1.4, 0.2, 2.2]} />
                <meshStandardMaterial color="#f8fafc" roughness={0.85} />
              </mesh>
              {/* Quilted Blanket */}
              <mesh position={[0, 0.44, 0.45]}>
                <boxGeometry args={[1.42, 0.1, 1.2]} />
                <meshStandardMaterial color={idx === 0 ? '#4f46e5' : '#0d9488'} roughness={0.82} />
              </mesh>
              {/* Ergonomic Head Pillow */}
              <mesh position={[0, 0.48, -0.78]} rotation={[0.22, 0, 0]}>
                <boxGeometry args={[0.95, 0.14, 0.46]} />
                <meshStandardMaterial color="#f1f5f9" roughness={0.9} />
              </mesh>
            </group>
          ))}

          {/* Emerald Yoga / Stretching Mat with Woven Texture */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0.6]}>
            <planeGeometry args={[1.9, 0.85]} />
            <meshStandardMaterial color="#059669" roughness={0.82} metalness={0.02} />
          </mesh>

          {/* Washroom Partition & Backlit Vanity Sinks */}
          <CutawayWall pos={[-1.3, 0, 2.1]} size={[5.6, 1.9, 0.16]} />
          <group position={[-1.4, 0, 2.65]}>
            {/* Floating Walnut Vanity Cabinet */}
            <mesh position={[0, 0.44, 0]} castShadow>
              <boxGeometry args={[2.8, 0.86, 0.62]} />
              <meshStandardMaterial color="#451a03" roughness={0.35} metalness={0.08} />
            </mesh>
            {/* Polished Carrara Marble Vanity Top */}
            <mesh position={[0, 0.9, 0]}>
              <boxGeometry args={[2.86, 0.05, 0.66]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.12} metalness={0.05} />
            </mesh>
            {/* Twin Ceramic Vessel Basins + Sleek Chrome Faucets */}
            {[-0.7, 0.7].map((sx, i) => (
              <group key={i} position={[sx, 0, 0]}>
                <mesh position={[0, 0.98, 0]}>
                  <cylinderGeometry args={[0.24, 0.18, 0.14, 16]} />
                  <meshStandardMaterial color="#ffffff" roughness={0.08} />
                </mesh>
                {/* Chrome Gooseneck Faucet */}
                <mesh position={[0, 1.12, -0.22]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.22, 8]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.08} />
                </mesh>
                <mesh position={[0, 1.22, -0.14]} rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.15, 8]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.08} />
                </mesh>
              </group>
            ))}
            {/* Backlit LED Vanity Mirror with Soft Cyan Ambient Glow */}
            <mesh position={[0, 1.45, -0.28]}>
              <boxGeometry args={[2.4, 0.75, 0.04]} />
              <meshStandardMaterial
                color="#bae6fd"
                emissive="#38bdf8"
                emissiveIntensity={0.5}
                metalness={0.88}
                roughness={0.05}
              />
            </mesh>
          </group>
        </group>

        {/* === ZONE 6: GAME HUB — ARCADE & RACING SIMULATOR (Right North Wing) === */}
        <group position={[13.3, 0, -8.0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
            <planeGeometry args={[7.8, 7.2]} />
            <meshStandardMaterial color="#1e1b4b" roughness={0.88} metalness={0.03} />
          </mesh>

          {/* 3 Detailed Retro-Modern Arcade Cabinets with Neon Accents */}
          {[
            { x: -1.9, col: '#ec4899', btnCol: '#f43f5e' },
            { x: -0.1, col: '#06b6d4', btnCol: '#0ea5e9' },
            { x: 1.7, col: '#a855f7', btnCol: '#c084fc' },
          ].map((arc, idx) => (
            <group key={idx} position={[arc.x, 0, -2.0]}>
              {/* Cabinet Body */}
              <mesh position={[0, 1.05, 0]} castShadow>
                <boxGeometry args={[1.08, 2.1, 0.92]} />
                <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.15} />
              </mesh>
              {/* Glowing Top Marquee */}
              <mesh position={[0, 1.96, 0.36]}>
                <boxGeometry args={[1.0, 0.22, 0.24]} />
                <meshStandardMaterial
                  color={arc.col}
                  emissive={arc.col}
                  emissiveIntensity={1.1}
                />
              </mesh>
              {/* Angled CRT/LCD Arcade Screen with Bezel */}
              <mesh position={[0, 1.38, 0.44]} rotation={[-0.18, 0, 0]}>
                <boxGeometry args={[0.94, 0.7, 0.04]} />
                <meshStandardMaterial color="#020617" roughness={0.2} metalness={0.4} />
              </mesh>
              <mesh position={[0, 1.38, 0.47]} rotation={[-0.18, 0, 0]}>
                <planeGeometry args={[0.88, 0.64]} />
                <meshBasicMaterial map={gameTex} />
              </mesh>
              {/* Control Deck with Joysticks & Buttons */}
              <mesh position={[0, 0.95, 0.56]}>
                <boxGeometry args={[1.04, 0.1, 0.38]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.2} />
              </mesh>
              {/* Joystick */}
              <mesh position={[-0.22, 1.05, 0.56]}>
                <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[-0.22, 1.12, 0.56]}>
                <sphereGeometry args={[0.035, 10, 10]} />
                <meshStandardMaterial color={arc.btnCol} roughness={0.2} emissive={arc.btnCol} emissiveIntensity={0.4} />
              </mesh>
              {/* Arcade Push Buttons */}
              {[0.08, 0.2, 0.32].map((bx, bi) => (
                <mesh key={`btn${bi}`} position={[bx, 1.01, 0.54 + (bi % 2) * 0.04]}>
                  <cylinderGeometry args={[0.025, 0.025, 0.03, 8]} />
                  <meshStandardMaterial color={['#ef4444', '#3b82f6', '#eab308'][bi]} roughness={0.3} />
                </mesh>
              ))}
              {/* Coin Slot Panel */}
              <mesh position={[0, 0.55, 0.47]}>
                <boxGeometry args={[0.34, 0.28, 0.02]} />
                <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
              </mesh>
            </group>
          ))}

          {/* Pro Racing Simulator Cockpit */}
          <group position={[1.4, 0, 2.3]}>
            {/* Tubular Steel Rig Base */}
            <mesh position={[0.4, 0.12, 0]}>
              <boxGeometry args={[2.1, 0.12, 1.0]} />
              <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Sparco Red Racing Bucket Seat */}
            <mesh position={[0.72, 0.42, 0]} castShadow>
              <boxGeometry args={[0.58, 0.16, 0.62]} />
              <meshStandardMaterial color="#b91c1c" roughness={0.52} metalness={0.06} />
            </mesh>
            <mesh position={[1.02, 0.72, 0]} rotation={[0, 0, -0.25]} castShadow>
              <boxGeometry args={[0.18, 0.78, 0.62]} />
              <meshStandardMaterial color="#dc2626" roughness={0.5} metalness={0.06} />
            </mesh>
            {/* Steering Wheel Column & Wheel with Paddle Shifters */}
            <mesh position={[0.18, 0.52, 0]} rotation={[0, 0, -0.35]}>
              <cylinderGeometry args={[0.04, 0.05, 0.62, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0.26, 0.78, 0]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.15, 0.025, 10, 20]} />
              <meshStandardMaterial color="#0f172a" roughness={0.35} metalness={0.2} />
            </mesh>
            {/* Center Horn Badge */}
            <mesh position={[0.26, 0.78, 0]} rotation={[0, Math.PI / 2, 0]}>
              <circleGeometry args={[0.05, 12]} />
              <meshStandardMaterial color="#ef4444" roughness={0.2} />
            </mesh>
            {/* Ultrawide Curved Sim Display */}
            <mesh position={[-0.35, 0.95, 0]} rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[1.35, 0.56]} />
              <meshBasicMaterial map={gameTex} />
            </mesh>
          </group>
        </group>

        {/* === ZONE 7: GAME ROOM — 85" TV CONSOLE & RGB PC (Right Middle Wing) === */}
        <group position={[13.3, 0, 0.3]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
            <planeGeometry args={[7.8, 7.2]} />
            <meshStandardMaterial color="#172554" roughness={0.88} metalness={0.04} />
          </mesh>

          {/* Floating Walnut Media Console with Soundbar */}
          <mesh position={[0, 0.32, -3.2]} castShadow>
            <boxGeometry args={[3.4, 0.55, 0.55]} />
            <meshStandardMaterial color="#5c3a21" roughness={0.35} metalness={0.08} />
          </mesh>
          {/* Soundbar */}
          <mesh position={[0, 0.63, -3.15]}>
            <boxGeometry args={[2.0, 0.08, 0.12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
          </mesh>

          {/* Giant 85" OLED TV with Ambilight Wall Wash Effect */}
          <mesh position={[0, 1.48, -3.48]}>
            <boxGeometry args={[3.5, 1.75, 0.02]} />
            <meshStandardMaterial color="#4f46e5" emissive="#6366f1" emissiveIntensity={0.4} />
          </mesh>
          <mesh position={[0, 1.48, -3.45]} castShadow>
            <boxGeometry args={[3.4, 1.65, 0.06]} />
            <meshStandardMaterial color="#020617" metalness={0.6} roughness={0.2} />
          </mesh>
          <mesh position={[0, 1.48, -3.4]}>
            <planeGeometry args={[3.26, 1.52]} />
            <meshBasicMaterial map={gameTex} />
          </mesh>

          {/* Plush Indigo Gaming Sofa */}
          <mesh position={[0, 0.3, 1.3]} castShadow receiveShadow>
            <boxGeometry args={[3.1, 0.5, 1.05]} />
            <meshStandardMaterial color="#312e81" roughness={0.78} metalness={0.04} />
          </mesh>
          <mesh position={[0, 0.65, 1.72]} castShadow>
            <boxGeometry args={[3.1, 0.5, 0.24]} />
            <meshStandardMaterial color="#3730a3" roughness={0.78} metalness={0.04} />
          </mesh>
          {/* Sofa Cushions */}
          {[-0.8, 0.8].map((sx, i) => (
            <mesh key={`sc${i}`} position={[sx, 0.62, 1.45]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.42, 0.36, 0.14]} />
              <meshStandardMaterial color={i === 0 ? '#ec4899' : '#06b6d4'} roughness={0.8} />
            </mesh>
          ))}

          {/* RGB Dual-Monitor Gaming PC Battlestation on East Wall */}
          <group position={[3.3, 0, -0.7]}>
            {/* Matte Black / Carbon Fiber Desk */}
            <mesh position={[0, 0.74, 0]} castShadow>
              <boxGeometry args={[0.9, 0.06, 2.0]} />
              <meshStandardMaterial color="#1e293b" roughness={0.3} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.36, -0.85]}>
              <boxGeometry args={[0.8, 0.72, 0.08]} />
              <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.36, 0.85]}>
              <boxGeometry args={[0.8, 0.72, 0.08]} />
              <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
            </mesh>
            {/* Glowing RGB PC Tower with Tempered Glass */}
            <mesh position={[0.1, 1.02, -0.72]}>
              <boxGeometry args={[0.45, 0.5, 0.24]} />
              <meshStandardMaterial
                color="#0f172a"
                emissive="#ec4899"
                emissiveIntensity={0.65}
                metalness={0.5}
                roughness={0.2}
              />
            </mesh>
            <mesh position={[0.15, 1.12, 0.15]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[1.05, 0.48]} />
              <meshBasicMaterial map={gameTex} />
            </mesh>
            {/* RGB Mechanical Keyboard & Mouse */}
            <mesh position={[-0.22, 0.78, 0.15]}>
              <boxGeometry args={[0.14, 0.018, 0.38]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.45} />
            </mesh>
            {/* Pro Racing Gaming Chair Facing RGB Monitor */}
            <group position={[-0.64, 0, 0.15]}>
              <mesh position={[0, 0.445, 0]} castShadow>
                <boxGeometry args={[0.5, 0.07, 0.5]} />
                <meshStandardMaterial color="#1e1b4b" roughness={0.55} metalness={0.08} />
              </mesh>
              <mesh position={[-0.22, 0.78, 0]} castShadow>
                <boxGeometry args={[0.07, 0.62, 0.48]} />
                <meshStandardMaterial color="#ec4899" roughness={0.5} metalness={0.06} />
              </mesh>
              {/* Head Pillow */}
              <mesh position={[-0.2, 1.1, 0]}>
                <boxGeometry args={[0.08, 0.14, 0.28]} />
                <meshStandardMaterial color="#1e1b4b" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.22, 0]}>
                <cylinderGeometry args={[0.04, 0.2, 0.42, 8]} />
                <meshStandardMaterial color="#a3a3a3" metalness={0.85} roughness={0.15} />
              </mesh>
            </group>
          </group>

          {/* Cozy Lounger Beanbag Poufs */}
          <mesh position={[-2.4, 0.23, 0.0]} scale={[1.08, 0.62, 1.08]} castShadow>
            <sphereGeometry args={[0.52, 16, 12]} />
            <meshStandardMaterial color="#e11d48" roughness={0.75} />
          </mesh>
          <mesh position={[-2.4, 0.22, -1.5]} scale={[1.04, 0.62, 1.04]} castShadow>
            <sphereGeometry args={[0.5, 16, 12]} />
            <meshStandardMaterial color="#10b981" roughness={0.75} />
          </mesh>
        </group>

        {/* === ZONE 8: FUN ROOM — BILLIARDS, PING-PONG & KARAOKE (Right South Wing) === */}
        <group position={[13.3, 0, 8.6]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
            <planeGeometry args={[7.8, 7.6]} />
            <meshStandardMaterial color="#3b0764" roughness={0.88} metalness={0.04} />
          </mesh>

          {/* Mahogany & Emerald Baize Billiard Table + Polished Brass Corner Castings */}
          <group position={[-0.8, 0, -0.9]}>
            <mesh position={[0, 0.78, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.9, 0.16, 1.65]} />
              <meshStandardMaterial color="#451a03" roughness={0.35} metalness={0.08} />
            </mesh>
            {/* Green Tournament Felt */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.865, 0]}>
              <planeGeometry args={[2.6, 1.36]} />
              <meshStandardMaterial color="#047857" roughness={0.8} />
            </mesh>
            {/* Brass Corner Plates */}
            {[
              [-1.44, 0.86, -0.81],
              [1.44, 0.86, -0.81],
              [-1.44, 0.86, 0.81],
              [1.44, 0.86, 0.81],
            ].map(([cx, cy, cz], i) => (
              <mesh key={`bc${i}`} position={[cx, cy, cz]}>
                <boxGeometry args={[0.1, 0.02, 0.1]} />
                <meshStandardMaterial color="#c0a060" metalness={0.85} roughness={0.2} />
              </mesh>
            ))}
            {/* Billiard Balls */}
            {[
              [-0.4, 0.9, 0.1, '#facc15'],
              [0.2, 0.9, -0.15, '#ef4444'],
              [0.35, 0.9, 0.18, '#3b82f6'],
              [-0.1, 0.9, -0.05, '#ffffff'],
              [0.5, 0.9, 0.0, '#0f172a'],
            ].map(([bx, by, bz, bcol], i) => (
              <mesh key={i} position={[bx as number, by as number, bz as number]}>
                <sphereGeometry args={[0.045, 10, 10]} />
                <meshStandardMaterial color={bcol as string} roughness={0.15} metalness={0.1} />
              </mesh>
            ))}
            {/* Carved Wood Table Legs */}
            {[
              [-1.1, 0.38, -0.6],
              [1.1, 0.38, -0.6],
              [-1.1, 0.38, 0.6],
              [1.1, 0.38, 0.6],
            ].map(([lx, ly, lz], i) => (
              <mesh key={i} position={[lx, ly, lz]}>
                <cylinderGeometry args={[0.1, 0.08, 0.76, 12]} />
                <meshStandardMaterial color="#3b2010" roughness={0.35} metalness={0.06} />
              </mesh>
            ))}
          </group>

          {/* Table Tennis (Ping-Pong) Table with Crisp Court Lines */}
          <group position={[-1.4, 0, 2.0]}>
            <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
              <boxGeometry args={[2.3, 0.06, 1.3]} />
              <meshStandardMaterial color="#1d4ed8" roughness={0.35} metalness={0.05} />
            </mesh>
            {/* Sturdy Steel Legs */}
            {[
              [-0.95, 0.36, -0.5],
              [0.95, 0.36, -0.5],
              [-0.95, 0.36, 0.5],
              [0.95, 0.36, 0.5],
            ].map(([plx, ply, plz], i) => (
              <mesh key={i} position={[plx, ply, plz]}>
                <boxGeometry args={[0.06, 0.72, 0.06]} />
                <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
              </mesh>
            ))}
            {/* Tension Net */}
            <mesh position={[0, 0.84, 0]}>
              <boxGeometry args={[0.03, 0.16, 1.34]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.6} />
            </mesh>
          </group>

          {/* Elevated Karaoke Stage with Glowing Neon Trim + Pro Sound Stack */}
          <group position={[2.0, 0, 1.4]}>
            {/* Elevated Platform with LED Rim */}
            <mesh position={[0, 0.1, 0]} receiveShadow>
              <cylinderGeometry args={[1.45, 1.55, 0.2, 24]} />
              <meshStandardMaterial color="#701a75" roughness={0.38} metalness={0.08} />
            </mesh>
            {/* Glowing Neon Edge Ring */}
            <mesh position={[0, 0.02, 0]}>
              <torusGeometry args={[1.52, 0.025, 8, 28]} />
              <meshStandardMaterial color="#c026d3" emissive="#a21caf" emissiveIntensity={0.8} />
            </mesh>
            {/* Chrome Vintage Microphone Stand */}
            <mesh position={[-0.3, 0.85, -0.3]}>
              <cylinderGeometry args={[0.018, 0.018, 1.3, 8]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.1} />
            </mesh>
            <mesh position={[-0.3, 1.52, -0.3]}>
              <sphereGeometry args={[0.045, 10, 10]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
            </mesh>
            {/* Pro Dual Speaker Tower with Woofer Rings */}
            <mesh position={[0.9, 0.7, -0.6]} castShadow>
              <boxGeometry args={[0.48, 1.1, 0.45]} />
              <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.2} />
            </mesh>
            {/* Woofer cones */}
            {[0.48, 0.85].map((wy, i) => (
              <mesh key={`woof${i}`} position={[0.67, wy, -0.6]} rotation={[0, -Math.PI / 2, 0]}>
                <torusGeometry args={[0.12, 0.02, 8, 16]} />
                <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.4} />
              </mesh>
            ))}
          </group>
        </group>

        {/* === LIGHTWEIGHT ROOM SIGNPOST PILLS === */}
        {Object.values(VILLA_ROOMS).map((room) => {
          const isFocused = activeRoomFilter === room.id;
          return (
            <Html
              key={room.id}
              position={[room.center[0], 2.75, room.center[2] - 1.4]}
              center
              distanceFactor={24}
              zIndexRange={[4, 0]}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRoom(room.id);
                }}
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold border shadow transition whitespace-nowrap ${
                  isFocused
                    ? 'bg-indigo-600 border-indigo-300 text-white'
                    : 'bg-slate-950/85 border-slate-700 text-slate-200 hover:bg-slate-900 hover:text-white'
                }`}
              >
                {room.emoji} {room.label}
              </button>
            </Html>
          );
        })}
      </group>
    );
  }
);
