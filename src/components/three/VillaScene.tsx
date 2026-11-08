import React, { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls, Sky, Stars } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  AgentProfile,
  TimeAmbience,
  VillaRoomId,
  VillaScenery,
  WorkflowRun,
} from '../../types';
import { VILLA_ROOMS } from '../../utils/villaCoords';
import {
  AgentLivePlan,
  buildPlanToTarget,
  getTaskStationForAgent,
  isAgentExecutingRealTask,
  SOCIAL_BANTER_PAIRS,
  SOCIAL_CHAT_SPOTS,
  VILLA_HOTSPOTS,
} from '../../utils/villaLifeEngine';
import { VillaAgent3D } from './Character3D';
import { VillaInterior } from './VillaInterior';

/**
 * Smart Frame Limiter:
 * Prevents WebGL from running at 60-144 FPS nonstop (the #1 cause of laptop heat/fan noise).
 * Pauses 3D rendering completely (0% GPU) when tab is in background or a modal is open,
 * and locks ambient rendering to a cool, smooth 22 FPS (Eco) or 32 FPS (Standard).
 */
const AdaptiveFrameLimiter: React.FC<{
  paused: boolean;
  ecoMode: boolean;
}> = ({ paused, ecoMode }) => {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (paused) return;

    let rafId = 0;
    let lastRenderTime = 0;
    const targetFps = ecoMode ? 22 : 32;
    const interval = 1000 / targetFps;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      if (document.hidden) return;
      if (now - lastRenderTime >= interval) {
        lastRenderTime = now - ((now - lastRenderTime) % interval);
        invalidate();
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [paused, ecoMode, invalidate]);

  return null;
};

interface CameraRigProps {
  agents: AgentProfile[];
  focusedRoom: VillaRoomId | null;
  selectedAgentId: string | null;
  livePosMapRef: MutableRefObject<Map<string, THREE.Vector3>>;
}

const CameraRig: React.FC<CameraRigProps> = ({
  agents,
  focusedRoom,
  selectedAgentId,
  livePosMapRef,
}) => {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();
  const desiredCamPos = useRef<THREE.Vector3 | null>(null);
  const desiredTarget = useRef<THREE.Vector3 | null>(null);
  const followResearchUntilRef = useRef<number>(0);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedAgentId) || null,
    [agents, selectedAgentId]
  );

  // Trigger camera tracking whenever user selects an agent OR asks them a question (deskFocusUntil updates)
  useEffect(() => {
    if (selectedAgentId) {
      if (selectedAgent?.deskFocusUntil && selectedAgent.deskFocusUntil > Date.now()) {
        // Track agent smoothly for up to 14s as they walk from any room to their Office Desk!
        followResearchUntilRef.current = Date.now() + 14_000;
      }
      const liveVec = livePosMapRef.current.get(selectedAgentId);
      if (liveVec) {
        // Offset target +1.7m on X so the character sits cleanly in the LEFT-CENTER viewport beside the right Chat Drawer!
        desiredCamPos.current = new THREE.Vector3(
          liveVec.x + 3.4,
          4.5,
          liveVec.z + 5.9
        );
        desiredTarget.current = new THREE.Vector3(liveVec.x + 1.6, 1.05, liveVec.z);
      }
      return;
    }
    followResearchUntilRef.current = 0;
    if (focusedRoom) {
      const meta = VILLA_ROOMS[focusedRoom];
      desiredCamPos.current = new THREE.Vector3(...meta.cameraPos);
      desiredTarget.current = new THREE.Vector3(...meta.cameraTarget);
    } else {
      // Full Panoramic Villa Overview
      desiredCamPos.current = new THREE.Vector3(0, 14.2, 20.5);
      desiredTarget.current = new THREE.Vector3(0, 1.0, -3.5);
    }
  }, [focusedRoom, selectedAgentId, selectedAgent?.deskFocusUntil]);

  useFrame((_, delta) => {
    if (!controlsRef.current) return;

    // Continuously update camera goal while watching the agent walk to their desk to research!
    if (selectedAgentId && Date.now() < followResearchUntilRef.current) {
      const liveVec = livePosMapRef.current.get(selectedAgentId);
      if (liveVec) {
        desiredCamPos.current = new THREE.Vector3(
          liveVec.x + 3.4,
          4.35,
          liveVec.z + 5.8
        );
        desiredTarget.current = new THREE.Vector3(liveVec.x + 1.6, 1.05, liveVec.z);
      }
    }

    if (!desiredCamPos.current || !desiredTarget.current) return;

    camera.position.lerp(desiredCamPos.current, Math.min(1, delta * 3.8));
    controlsRef.current.target.lerp(desiredTarget.current, Math.min(1, delta * 4.5));
    controlsRef.current.update();

    if (
      Date.now() >= followResearchUntilRef.current &&
      camera.position.distanceTo(desiredCamPos.current) < 0.2
    ) {
      desiredCamPos.current = null;
      desiredTarget.current = null;
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.065}
      minDistance={3.8}
      maxDistance={34}
      minPolarAngle={0.22}
      maxPolarAngle={Math.PI / 2 - 0.09}
      target={[0, 1.0, -3.5]}
      onStart={() => {
        // Immediately yield to manual user mouse drag/zoom!
        followResearchUntilRef.current = 0;
        desiredCamPos.current = null;
        desiredTarget.current = null;
      }}
    />
  );
};

interface VillaSceneProps {
  agents: AgentProfile[];
  workflowRuns: WorkflowRun[];
  scenery: VillaScenery;
  ambience: TimeAmbience;
  freeRoamEnabled: boolean;
  selectedAgentId: string | null;
  focusedRoom: VillaRoomId | null;
  ecoMode?: boolean;
  isPaused?: boolean;
  onSelectAgent: (agentId: string | null) => void;
  onSelectRoom: (roomId: VillaRoomId) => void;
}

export const VillaScene: React.FC<VillaSceneProps> = ({
  agents,
  workflowRuns,
  scenery,
  ambience,
  freeRoamEnabled,
  selectedAgentId,
  focusedRoom,
  ecoMode = true,
  isPaused = false,
  onSelectAgent,
  onSelectRoom,
}) => {
  const livePlansRef = useRef<Map<string, AgentLivePlan>>(new Map());
  const livePosMapRef = useRef<Map<string, THREE.Vector3>>(new Map());
  const occupiedHotspotByAgent = useRef<Map<string, string>>(new Map());
  const recentHotspotsRef = useRef<Map<string, string[]>>(new Map());

  // Lightweight ambient bubble map updated only ~every 2.4s when activities change (zero 60fps overhead!)
  const [ambientBubbles, setAmbientBubbles] = useState<Record<string, string | null>>({});

  // Compute set of agents currently busy inside an active running workflow step
  const busyWorkflowAgentIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of workflowRuns) {
      if (r.status === 'running' || r.status === 'waiting_approval') {
        for (const sr of r.stepResults) {
          if (sr.status === 'running' || sr.status === 'waiting_approval') {
            sr.outputs.forEach((o) => set.add(o.agentId));
          }
        }
      }
    }
    return set;
  }, [workflowRuns]);

  // Autonomous Sims-Style Life Coordinator (A* Obstacle-Free + Contextual Furniture Mounting)
  useEffect(() => {
    const pushRecentHotspot = (agentId: string, hotspotId: string) => {
      const history = recentHotspotsRef.current.get(agentId) || [];
      const updated = [...history.filter((h) => h !== hotspotId), hotspotId].slice(-5);
      recentHotspotsRef.current.set(agentId, updated);
    };

    const assignPlansTick = () => {
      if (document.hidden || isPaused) return;
      const now = Date.now();
      const nextBubbleMap: Record<string, string | null> = {};
      const freeCandidates: AgentProfile[] = [];

      for (let i = 0; i < agents.length; i++) {
        const ag = agents[i];
        const currentVec = livePosMapRef.current.get(ag.id);
        const fallbackSpawn = VILLA_HOTSPOTS[(i * 2) % VILLA_HOTSPOTS.length].approachPos;
        const fromPt: [number, number, number] = currentVec
          ? [currentVec.x, 0, currentVec.z]
          : fallbackSpawn;

        const mustDoRealTask =
          !freeRoamEnabled ||
          isAgentExecutingRealTask(ag, busyWorkflowAgentIds.has(ag.id));

        if (mustDoRealTask) {
          occupiedHotspotByAgent.current.delete(ag.id);
          const station = getTaskStationForAgent(ag, agents);
          const existing = livePlansRef.current.get(ag.id);

          // If leaving a conversation partner to answer Head DM at desk, release the partner cleanly
          if (existing?.partnerId) {
            const partnerPlan = livePlansRef.current.get(existing.partnerId);
            if (partnerPlan) {
              partnerPlan.partnerId = null;
              partnerPlan.nextDecisionAt = Math.min(partnerPlan.nextDecisionAt, now + 1200);
            }
          }

          const isAnsweringQuestion = Boolean(ag.deskFocusUntil && now < ag.deskFocusUntil);
          const movedGoal =
            !existing ||
            existing.hotspotId !== 'task' ||
            Math.hypot(
              existing.mountPos[0] - station.mountPos[0],
              existing.mountPos[2] - station.mountPos[2]
            ) > 0.25;

          if (movedGoal) {
            livePlansRef.current.set(
              ag.id,
              buildPlanToTarget({
                currentPos: fromPt,
                previousDismountPos: existing?.dismountPos || null,
                wasMounted: Boolean(existing?.isMounted),
                hotspotId: 'task',
                approachPos: station.approachPos,
                mountPos: station.mountPos,
                yaw: station.yaw,
                pose: station.pose,
                walkSpeed: isAnsweringQuestion ? 2.38 : 1.88,
                activityLabel: ag.statusText,
                ambientBubble: isAnsweringQuestion
                  ? '🔍 Mengecek data & riset di PC untuk Bos...'
                  : null,
                bubbleDurationMs: isAnsweringQuestion ? 18000 : 0,
                stayDurationMs: 12000,
              })
            );
          }

          const currentTaskPlan = livePlansRef.current.get(ag.id);
          nextBubbleMap[ag.id] =
            isAnsweringQuestion && currentTaskPlan?.isMounted && ag.statusText.startsWith('🔍')
              ? '🔍 Sedang mencari data di PC...'
              : null;
          continue;
        }

        const existing = livePlansRef.current.get(ag.id);
        if (!existing || now >= existing.nextDecisionAt) {
          occupiedHotspotByAgent.current.delete(ag.id);
          freeCandidates.push(ag);
        } else {
          // Keep current hotspot or chat spot reserved while agent walks to & enjoys it
          if (existing.hotspotId && existing.hotspotId !== 'desk_check') {
            occupiedHotspotByAgent.current.set(ag.id, existing.hotspotId);
          }
          const partnerPlan = existing.partnerId
            ? livePlansRef.current.get(existing.partnerId)
            : null;
          const bothReadyForBubble = existing.partnerId
            ? Boolean(existing.isMounted && partnerPlan?.isMounted)
            : Boolean(existing.isMounted);

          nextBubbleMap[ag.id] =
            bothReadyForBubble && existing.ambientBubble && now < existing.bubbleExpiresAt
              ? existing.ambientBubble
              : null;
        }
      }

      // Shuffle freeCandidates slightly so pairings & room picks are organic and varied
      for (let k = freeCandidates.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [freeCandidates[k], freeCandidates[j]] = [freeCandidates[j], freeCandidates[k]];
      }

      // 1. Pair 2 nearby free agents to meet & chat at unoccupied Lounge / Watercooler Spots!
      const reservedSpotIds = new Set<string>(occupiedHotspotByAgent.current.values());
      while (freeCandidates.length >= 2 && Math.random() < 0.32) {
        const availSpots = SOCIAL_CHAT_SPOTS.filter(
          (s) => !reservedSpotIds.has(`chat:${s.id}`)
        );
        if (availSpots.length === 0) break;

        const a1 = freeCandidates.shift()!;
        const v1 = livePosMapRef.current.get(a1.id);

        // Pick closest free colleague so both arrive around the same time naturally
        let bestPartnerIdx = 0;
        if (v1) {
          let bestDist = Infinity;
          for (let ci = 0; ci < freeCandidates.length; ci++) {
            const vc = livePosMapRef.current.get(freeCandidates[ci].id);
            if (!vc) continue;
            const d = Math.hypot(vc.x - v1.x, vc.z - v1.z);
            if (d < bestDist) {
              bestDist = d;
              bestPartnerIdx = ci;
            }
          }
        }
        const [a2] = freeCandidates.splice(bestPartnerIdx, 1);
        const v2 = livePosMapRef.current.get(a2.id);

        // Pick closest unoccupied lounge chat spot to their midpoint
        const midX = v1 && v2 ? (v1.x + v2.x) * 0.5 : 0;
        const midZ = v1 && v2 ? (v1.z + v2.z) * 0.5 : -2;
        let spot = availSpots[0];
        let bestSpotDist = Infinity;
        for (const cand of availSpots) {
          const d = Math.hypot(cand.p1Pos[0] - midX, cand.p1Pos[2] - midZ);
          if (d < bestSpotDist) {
            bestSpotDist = d;
            spot = cand;
          }
        }

        const chatKey = `chat:${spot.id}`;
        reservedSpotIds.add(chatKey);
        occupiedHotspotByAgent.current.set(a1.id, chatKey);
        occupiedHotspotByAgent.current.set(a2.id, chatKey);

        const banter =
          SOCIAL_BANTER_PAIRS[Math.floor(Math.random() * SOCIAL_BANTER_PAIRS.length)];

        const ex1 = livePlansRef.current.get(a1.id);
        const ex2 = livePlansRef.current.get(a2.id);
        const from1: [number, number, number] = v1 ? [v1.x, 0, v1.z] : spot.p1Pos;
        const from2: [number, number, number] = v2 ? [v2.x, 0, v2.z] : spot.p2Pos;

        const stayDuration = 14000 + Math.random() * 7000;
        const walkSpd = 1.38 + Math.random() * 0.16;

        const plan1 = buildPlanToTarget({
          currentPos: from1,
          previousDismountPos: ex1?.dismountPos || null,
          wasMounted: Boolean(ex1?.isMounted),
          hotspotId: chatKey,
          approachPos: spot.p1Pos,
          mountPos: spot.p1Pos,
          yaw: spot.p1Yaw,
          pose: 'chatting',
          walkSpeed: walkSpd,
          activityLabel: `Ngobrol bareng ${a2.name}`,
          ambientBubble: banter[0],
          bubbleDurationMs: 9000,
          stayDurationMs: stayDuration,
          partnerId: a2.id,
        });

        const plan2 = buildPlanToTarget({
          currentPos: from2,
          previousDismountPos: ex2?.dismountPos || null,
          wasMounted: Boolean(ex2?.isMounted),
          hotspotId: chatKey,
          approachPos: spot.p2Pos,
          mountPos: spot.p2Pos,
          yaw: spot.p2Yaw,
          pose: 'chatting',
          walkSpeed: walkSpd,
          activityLabel: `Ngobrol bareng ${a1.name}`,
          ambientBubble: banter[1],
          bubbleDurationMs: 10000,
          stayDurationMs: stayDuration,
          partnerId: a1.id,
        });

        // Synchronize departure & bubble timing to whichever partner arrives second!
        const syncedEnd = Math.max(plan1.nextDecisionAt, plan2.nextDecisionAt);
        const syncedBubbleEnd = Math.max(plan1.bubbleExpiresAt, plan2.bubbleExpiresAt);
        plan1.nextDecisionAt = syncedEnd;
        plan2.nextDecisionAt = syncedEnd;
        plan1.bubbleExpiresAt = syncedBubbleEnd;
        plan2.bubbleExpiresAt = syncedBubbleEnd;

        livePlansRef.current.set(a1.id, plan1);
        livePlansRef.current.set(a2.id, plan2);

        nextBubbleMap[a1.id] = null;
        nextBubbleMap[a2.id] = null;
      }

      // 2. Assign remaining free agents to unoccupied, non-repetitive Villa Hotspots
      // (Nap Beds, PS5 Sofa, Arcade, Racing Sim, Billiards, Ping-Pong, Karaoke, Espresso Bar, Pool Sunbeds, Yoga, etc.)
      const takenIds = new Set<string>(occupiedHotspotByAgent.current.values());

      for (let idx = 0; idx < freeCandidates.length; idx++) {
        const ag = freeCandidates[idx];
        const existing = livePlansRef.current.get(ag.id);
        const v = livePosMapRef.current.get(ag.id);
        const recentHistory = recentHotspotsRef.current.get(ag.id) || [];

        // ~12% chance (if not just at desk) to briefly sit at their own office chair & check metrics
        if (Math.random() < 0.12 && !recentHistory.includes('desk_check')) {
          const deskStation = getTaskStationForAgent(
            { ...ag, status: 'working', currentRoom: 'office' },
            agents
          );
          const fromPt: [number, number, number] = v
            ? [v.x, 0, v.z]
            : deskStation.approachPos;

          pushRecentHotspot(ag.id, 'desk_check');
          livePlansRef.current.set(
            ag.id,
            buildPlanToTarget({
              currentPos: fromPt,
              previousDismountPos: existing?.dismountPos || null,
              wasMounted: Boolean(existing?.isMounted),
              hotspotId: 'desk_check',
              approachPos: deskStation.approachPos,
              mountPos: deskStation.mountPos,
              yaw: deskStation.yaw,
              pose: 'desk_typing',
              walkSpeed: 1.42,
              activityLabel: 'Duduk cek metrik sebentar',
              ambientBubble: null,
              bubbleDurationMs: 0,
              stayDurationMs: 12000 + Math.random() * 6000,
            })
          );
          nextBubbleMap[ag.id] = null;
          continue;
        }

        // Filter out currently occupied hotspots AND this agent's recent 5 hotspots so behavior is rich & varied
        const freshAvailable = VILLA_HOTSPOTS.filter(
          (h) => !takenIds.has(h.id) && !recentHistory.includes(h.id)
        );
        const anyAvailable =
          freshAvailable.length > 0
            ? freshAvailable
            : VILLA_HOTSPOTS.filter((h) => !takenIds.has(h.id));
        const pool = anyAvailable.length > 0 ? anyAvailable : VILLA_HOTSPOTS;

        const chosen = pool[Math.floor(Math.random() * pool.length)];
        takenIds.add(chosen.id);
        occupiedHotspotByAgent.current.set(ag.id, chosen.id);
        pushRecentHotspot(ag.id, chosen.id);

        // On very first boot (!v), spawn near a nearby walkable spot so agents immediately showcase activities & gentle strolls
        const initialBootPos =
          VILLA_HOTSPOTS[(idx * 3 + 1) % VILLA_HOTSPOTS.length].approachPos;
        const fromPt: [number, number, number] = v ? [v.x, 0, v.z] : initialBootPos;

        const showCheerBubble = Math.random() < 0.55;
        const bubbleText = showCheerBubble
          ? chosen.bubbles[Math.floor(Math.random() * chosen.bubbles.length)]
          : null;

        livePlansRef.current.set(
          ag.id,
          buildPlanToTarget({
            currentPos: fromPt,
            previousDismountPos: existing?.dismountPos || null,
            wasMounted: Boolean(existing?.isMounted),
            hotspotId: chosen.id,
            approachPos: chosen.approachPos,
            mountPos: chosen.mountPos,
            yaw: chosen.yaw,
            pose: chosen.pose,
            walkSpeed: 1.32 + Math.random() * 0.24, // Natural relaxed human stroll speed
            activityLabel: chosen.label,
            ambientBubble: bubbleText,
            bubbleDurationMs: 8500,
            stayDurationMs: 14500 + Math.random() * 10500,
          })
        );
        nextBubbleMap[ag.id] = null;
      }

      setAmbientBubbles((prev) => {
        let changed = false;
        const keys = Object.keys(nextBubbleMap);
        if (keys.length !== Object.keys(prev).length) {
          changed = true;
        } else {
          for (const k of keys) {
            if (prev[k] !== nextBubbleMap[k]) {
              changed = true;
              break;
            }
          }
        }
        return changed ? nextBubbleMap : prev;
      });
    };

    assignPlansTick();
    const timer = window.setInterval(assignPlansTick, 2800);
    return () => window.clearInterval(timer);
  }, [agents, busyWorkflowAgentIds, freeRoamEnabled, isPaused]);

  const effectiveAmbience: Exclude<TimeAmbience, 'auto'> = (() => {
    if (ambience !== 'auto') return ambience;
    const hr = new Date().getHours();
    if (hr >= 6 && hr < 11) return 'morning';
    if (hr >= 11 && hr < 15) return 'day';
    if (hr >= 15 && hr < 18) return 'sunset';
    return 'night';
  })();

  const lightingPreset = {
    morning: {
      bg: '#c8e6f8',
      ambient: 0.72,
      hemiSky: '#e0f2fe',
      hemiGround: '#4a7c3f',
      sunColor: '#fff8e1',
      sunIntensity: 1.8,
      sunPos: [25, 26, -38] as [number, number, number],
      warmFill: '#fde68a',
      warmFillIntensity: 0.6,
      envPreset: 'dawn' as const,
      exposure: 1.15,
      fogNear: 65,
      fogFar: 200,
    },
    day: {
      bg: '#87ceeb',
      ambient: 0.8,
      hemiSky: '#f0f9ff',
      hemiGround: '#365314',
      sunColor: '#fffdf5',
      sunIntensity: 2.0,
      sunPos: [10, 34, -30] as [number, number, number],
      warmFill: '#fef3c7',
      warmFillIntensity: 0.45,
      envPreset: 'city' as const,
      exposure: 1.1,
      fogNear: 80,
      fogFar: 260,
    },
    sunset: {
      bg: '#f4a261',
      ambient: 0.6,
      hemiSky: '#fed7aa',
      hemiGround: '#5c2a0a',
      sunColor: '#ff8c42',
      sunIntensity: 2.2,
      sunPos: [-32, 11, -45] as [number, number, number],
      warmFill: '#ff6b35',
      warmFillIntensity: 0.75,
      envPreset: 'sunset' as const,
      exposure: 1.25,
      fogNear: 50,
      fogFar: 180,
    },
    night: {
      bg: '#080e1e',
      ambient: 0.35,
      hemiSky: '#1e1b4b',
      hemiGround: '#0a0e1a',
      sunColor: '#6366f1',
      sunIntensity: 0.55,
      sunPos: [-15, 22, -30] as [number, number, number],
      warmFill: '#c4b5fd',
      warmFillIntensity: 0.35,
      envPreset: 'night' as const,
      exposure: 0.95,
      fogNear: 40,
      fogFar: 160,
    },
  }[effectiveAmbience];

  return (
    <div className="w-full h-full relative">
      <Canvas
        frameloop="demand"
        dpr={ecoMode ? [0.85, 1] : [1, 1.25]}
        gl={{
          antialias: !ecoMode,
          powerPreference: 'low-power',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: lightingPreset.exposure,
        }}
        shadows={!ecoMode}
        camera={{ position: [0, 14.2, 20.5], fov: 42, near: 0.2, far: 320 }}
        onPointerMissed={() => onSelectAgent(null)}
      >
        <AdaptiveFrameLimiter paused={isPaused} ecoMode={ecoMode} />

        <color attach="background" args={[lightingPreset.bg]} />
        <fog attach="fog" args={[lightingPreset.bg, lightingPreset.fogNear, lightingPreset.fogFar]} />

        {effectiveAmbience !== 'night' ? (
          <Sky
            distance={450000}
            sunPosition={lightingPreset.sunPos}
            turbidity={effectiveAmbience === 'sunset' ? 10 : 4}
            rayleigh={effectiveAmbience === 'sunset' ? 3 : 1.5}
            mieCoefficient={effectiveAmbience === 'sunset' ? 0.02 : 0.005}
            mieDirectionalG={effectiveAmbience === 'sunset' ? 0.95 : 0.8}
          />
        ) : (
          <Stars radius={160} depth={50} count={ecoMode ? 600 : 1200} factor={4.5} fade speed={0.3} />
        )}

        <ambientLight intensity={lightingPreset.ambient * 1.15} color="#f5f0e8" />
        <hemisphereLight
          args={[lightingPreset.hemiSky, lightingPreset.hemiGround, 0.85]}
        />
        <directionalLight
          position={lightingPreset.sunPos}
          intensity={lightingPreset.sunIntensity}
          color={lightingPreset.sunColor}
          castShadow={!ecoMode}
          shadow-bias={-0.0004}
          shadow-normalBias={0.02}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-camera-left={-24}
          shadow-camera-right={24}
          shadow-camera-top={24}
          shadow-camera-bottom={-24}
          shadow-camera-near={1}
          shadow-camera-far={85}
        />

        {/* Warm Fill Light (bounced sun simulation — replaces 8 heavy per-room pointLights) */}
        <directionalLight
          position={[-lightingPreset.sunPos[0] * 0.5, 10, lightingPreset.sunPos[2] * 0.3]}
          intensity={lightingPreset.sunIntensity * 0.28}
          color={lightingPreset.warmFill}
        />

        {!ecoMode && (
          <>
            <pointLight position={[0, 5.5, -2]} intensity={1.1} color="#fde68a" distance={28} decay={2} />
            {/* Baked once (frames={1}) instead of re-rendering scene every frame */}
            <ContactShadows
              frames={1}
              resolution={256}
              position={[0, 0.01, 0]}
              opacity={0.32}
              scale={50}
              blur={2.0}
              far={10}
              color="#1a1a2e"
            />
          </>
        )}

        <VillaInterior
          scenery={scenery}
          deskCount={agents.length}
          activeRoomFilter={focusedRoom}
          onSelectRoom={onSelectRoom}
        />

        {agents.map((agent, idx) => (
          <VillaAgent3D
            key={agent.id}
            agent={agent}
            livePlansRef={livePlansRef}
            livePosMapRef={livePosMapRef}
            ambientBubbleText={ambientBubbles[agent.id] || null}
            indexInList={idx}
            isSelected={selectedAgentId === agent.id}
            onSelect={(id) => onSelectAgent(id)}
          />
        ))}

        <CameraRig
          agents={agents}
          focusedRoom={focusedRoom}
          selectedAgentId={selectedAgentId}
          livePosMapRef={livePosMapRef}
        />
      </Canvas>
    </div>
  );
};
