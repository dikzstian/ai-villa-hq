import React, { MutableRefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AgentProfile, CharacterAppearance } from '../../types';
import { isPointBlocked } from '../../utils/navGrid';
import { ActivityPose, AgentLivePlan } from '../../utils/villaLifeEngine';

interface CustomModelProps {
  url: string;
}

const CustomGlbModel: React.FC<CustomModelProps> = ({ url }) => {
  const [modelScene, setModelScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let active = true;
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        if (!active) return;
        const cloned = gltf.scene.clone(true);
        const box = new THREE.Box3().setFromObject(cloned);
        const size = new THREE.Vector3();
        box.getSize(size);

        const maxHeight = Math.max(size.y, 0.01);
        const normScale = 1.55 / maxHeight;
        cloned.scale.setScalar(normScale);

        const scaledBox = new THREE.Box3().setFromObject(cloned);
        const scaledCenter = new THREE.Vector3();
        scaledBox.getCenter(scaledCenter);
        cloned.position.set(-scaledCenter.x, -scaledBox.min.y, -scaledCenter.z);

        setModelScene(cloned);
      },
      undefined,
      () => {
        if (active) setModelScene(null);
      }
    );
    return () => {
      active = false;
    };
  }, [url]);

  if (!modelScene) return null;
  return <primitive object={modelScene} />;
};

interface HairAndAccessoriesProps {
  appearance: CharacterAppearance;
  headRadius: number;
}

const HairAndAccessories: React.FC<HairAndAccessoriesProps> = React.memo(
  ({ appearance, headRadius }) => {
    const { hairStyle, hairColor, accessory, primaryColor } = appearance;

    return (
      <group>
        {hairStyle === 'spiky' && (
          <group position={[0, headRadius * 0.65, 0]}>
            <mesh>
              <sphereGeometry args={[headRadius * 1.02, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
              <meshStandardMaterial color={hairColor} roughness={0.6} />
            </mesh>
            {[-0.14, 0, 0.14].map((xOff, i) => (
              <mesh
                key={i}
                position={[xOff, headRadius * 0.42, 0.06]}
                rotation={[0.25, 0, (i - 1) * -0.28]}
              >
                <coneGeometry args={[headRadius * 0.34, headRadius * 0.65, 6]} />
                <meshStandardMaterial color={hairColor} roughness={0.6} />
              </mesh>
            ))}
          </group>
        )}

        {hairStyle === 'bob' && (
          <group>
            <mesh position={[0, headRadius * 0.18, -0.02]}>
              <sphereGeometry args={[headRadius * 1.1, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.68]} />
              <meshStandardMaterial color={hairColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, headRadius * 0.36, headRadius * 0.86]}>
              <boxGeometry args={[headRadius * 1.4, headRadius * 0.36, 0.08]} />
              <meshStandardMaterial color={hairColor} roughness={0.55} />
            </mesh>
          </group>
        )}

        {hairStyle === 'twintails' && (
          <group>
            <mesh position={[0, headRadius * 0.22, -0.02]}>
              <sphereGeometry args={[headRadius * 1.06, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={hairColor} roughness={0.5} />
            </mesh>
            <mesh position={[-headRadius * 1.12, 0.02, -0.04]} rotation={[0, 0, 0.38]}>
              <capsuleGeometry args={[headRadius * 0.26, headRadius * 0.7, 5, 8]} />
              <meshStandardMaterial color={hairColor} roughness={0.5} />
            </mesh>
            <mesh position={[headRadius * 1.12, 0.02, -0.04]} rotation={[0, 0, -0.38]}>
              <capsuleGeometry args={[headRadius * 0.26, headRadius * 0.7, 5, 8]} />
              <meshStandardMaterial color={hairColor} roughness={0.5} />
            </mesh>
          </group>
        )}

        {hairStyle === 'ponytail' && (
          <group>
            <mesh position={[0, headRadius * 0.22, -0.02]}>
              <sphereGeometry args={[headRadius * 1.06, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={hairColor} roughness={0.55} />
            </mesh>
            <mesh position={[0, headRadius * 0.15, -headRadius * 1.1]} rotation={[-0.55, 0, 0]}>
              <capsuleGeometry args={[headRadius * 0.28, headRadius * 0.65, 5, 8]} />
              <meshStandardMaterial color={hairColor} roughness={0.55} />
            </mesh>
          </group>
        )}

        {hairStyle === 'curly' && (
          <group position={[0, headRadius * 0.52, 0]}>
            {[
              [0, 0.16, 0],
              [-0.16, 0.08, 0.1],
              [0.16, 0.08, 0.1],
              [-0.18, 0.05, -0.12],
              [0.18, 0.05, -0.12],
              [0, 0.1, -0.16],
            ].map(([cx, cy, cz], idx) => (
              <mesh key={idx} position={[cx, cy, cz]}>
                <sphereGeometry args={[headRadius * 0.48, 8, 8]} />
                <meshStandardMaterial color={hairColor} roughness={0.7} />
              </mesh>
            ))}
          </group>
        )}

        {hairStyle === 'bun' && (
          <group>
            <mesh position={[0, headRadius * 0.22, -0.02]}>
              <sphereGeometry args={[headRadius * 1.05, 14, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
              <meshStandardMaterial color={hairColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, headRadius * 1.15, -0.06]}>
              <sphereGeometry args={[headRadius * 0.44, 10, 10]} />
              <meshStandardMaterial color={hairColor} roughness={0.5} />
            </mesh>
          </group>
        )}

        {accessory === 'glasses' && (
          <group position={[0, 0.02, headRadius * 0.94]}>
            <mesh position={[-headRadius * 0.36, 0, 0]}>
              <torusGeometry args={[headRadius * 0.24, 0.018, 6, 14]} />
              <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[headRadius * 0.36, 0, 0]}>
              <torusGeometry args={[headRadius * 0.24, 0.018, 6, 14]} />
              <meshStandardMaterial color="#0f172a" metalness={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[headRadius * 0.26, 0.022, 0.02]} />
              <meshStandardMaterial color="#0f172a" />
            </mesh>
          </group>
        )}

        {(accessory === 'headphones' || accessory === 'headset') && (
          <group>
            <mesh position={[0, headRadius * 0.16, 0]}>
              <torusGeometry args={[headRadius * 1.08, 0.035, 6, 18, Math.PI]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.3} />
            </mesh>
            <mesh position={[-headRadius * 1.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.08, 10]} />
              <meshStandardMaterial
                color={primaryColor}
                emissive={primaryColor}
                emissiveIntensity={0.25}
              />
            </mesh>
            <mesh position={[headRadius * 1.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.1, 0.1, 0.08, 10]} />
              <meshStandardMaterial
                color={primaryColor}
                emissive={primaryColor}
                emissiveIntensity={0.25}
              />
            </mesh>
          </group>
        )}

        {accessory === 'cap' && (
          <group position={[0, headRadius * 0.58, 0]}>
            <mesh>
              <sphereGeometry args={[headRadius * 1.06, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5]} />
              <meshStandardMaterial color={primaryColor} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.02, headRadius * 0.92]} rotation={[0.12, 0, 0]}>
              <boxGeometry args={[headRadius * 1.45, 0.04, headRadius * 0.9]} />
              <meshStandardMaterial color={primaryColor} roughness={0.5} />
            </mesh>
          </group>
        )}

        {accessory === 'cat_ears' && (
          <group position={[0, headRadius * 0.95, 0.02]}>
            <mesh position={[-headRadius * 0.55, 0.06, 0]} rotation={[0, 0, 0.25]}>
              <coneGeometry args={[0.11, 0.24, 4]} />
              <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={0.2} />
            </mesh>
            <mesh position={[headRadius * 0.55, 0.06, 0]} rotation={[0, 0, -0.25]}>
              <coneGeometry args={[0.11, 0.24, 4]} />
              <meshStandardMaterial color={primaryColor} emissive={primaryColor} emissiveIntensity={0.2} />
            </mesh>
          </group>
        )}
      </group>
    );
  }
);

export interface AvatarMeshProps {
  appearance: CharacterAppearance;
  poseRef?: MutableRefObject<ActivityPose>;
  walkStrideRef?: MutableRefObject<number>;
  nearbyWaveRef?: MutableRefObject<boolean>;
  phaseOffset?: number;
  roleIndex?: number;
}

export const AvatarMesh: React.FC<AvatarMeshProps> = React.memo(
  ({
    appearance,
    poseRef,
    walkStrideRef,
    nearbyWaveRef,
    phaseOffset = 0,
    roleIndex = 0,
  }) => {
    const leftLegRef = useRef<THREE.Group>(null);
    const rightLegRef = useRef<THREE.Group>(null);
    const leftKneeRef = useRef<THREE.Group>(null);
    const rightKneeRef = useRef<THREE.Group>(null);
    const leftArmRef = useRef<THREE.Group>(null);
    const rightArmRef = useRef<THREE.Group>(null);
    const headGroupRef = useRef<THREE.Group>(null);
    const rootAnimRef = useRef<THREE.Group>(null);

    // Pre-mounted lightweight 3D activity props (toggled via .visible in useFrame — zero re-renders!)
    const gamepadPropRef = useRef<THREE.Group>(null);
    const cueStickPropRef = useRef<THREE.Group>(null);
    const paddlePropRef = useRef<THREE.Group>(null);
    const micPropRef = useRef<THREE.Group>(null);
    const cupPropRef = useRef<THREE.Group>(null);
    const phonePropRef = useRef<THREE.Group>(null);

    // Per-character dynamic sub-gesture state so animations are never monotonous
    const subVariantRef = useRef<{ index: number; nextSwitchAt: number }>({
      index: 0,
      nextSwitchAt: 0,
    });

    useFrame(({ clock }, rawDelta) => {
      const rawTime = clock.getElapsedTime();
      const t = rawTime + phaseOffset;
      const pose: ActivityPose = poseRef?.current || 'admiring_view';
      const animAlpha = Math.min(1, Math.max(0.2, rawDelta * 10));

      if (!rootAnimRef.current) return;

      // Dynamically cycle micro-behavior variants every 3.2 - 6.0 seconds
      if (rawTime >= subVariantRef.current.nextSwitchAt) {
        subVariantRef.current.index =
          (subVariantRef.current.index + 1 + Math.floor(Math.random() * 2)) % 4;
        subVariantRef.current.nextSwitchAt = rawTime + 3.2 + Math.random() * 2.8;
      }
      const variant = subVariantRef.current.index;

      // Hide all props by default, enable exact contextual prop below
      if (gamepadPropRef.current) gamepadPropRef.current.visible = false;
      if (cueStickPropRef.current) cueStickPropRef.current.visible = false;
      if (paddlePropRef.current) paddlePropRef.current.visible = false;
      if (micPropRef.current) micPropRef.current.visible = false;
      if (cupPropRef.current) cupPropRef.current.visible = false;
      if (phonePropRef.current) phonePropRef.current.visible = false;

      // Feet firmly grounded at y=0 by default (no floating or sinking!)
      let targetY = 0;
      let rootRotX = 0;
      let rootRotZ = 0;
      let headYaw = Math.sin(t * 0.85) * 0.12;
      let headPitch = 0;
      let headRoll = 0;

      let lLegX = 0;
      let rLegX = 0;
      let lKneeX = 0;
      let rKneeX = 0;
      let lArmX = Math.sin(t * 1.4) * 0.03;
      let rArmX = -Math.sin(t * 1.4) * 0.03;
      let lArmZ = 0.05;
      let rArmZ = -0.05;

      if (pose === 'walk') {
        const phase = walkStrideRef ? walkStrideRef.current : t * 4.5;
        const stride = Math.sin(phase);
        const liftL = Math.max(0, -Math.cos(phase));
        const liftR = Math.max(0, Math.cos(phase));

        targetY = Math.abs(stride) * 0.022;
        lLegX = stride * 0.44 - liftL * 0.12;
        rLegX = -stride * 0.44 - liftR * 0.12;
        // Articulated knee flexion as each leg swings forward!
        lKneeX = liftL * 0.56;
        rKneeX = liftR * 0.56;

        lArmX = -stride * 0.34;
        rArmX = stride * 0.34;
        rootRotZ = stride * 0.02;
        headYaw = Math.sin(t * 1.05) * 0.22;
        headPitch = Math.sin(t * 0.8) * 0.04;

        // Friendly wave to nearby passing colleague
        if (nearbyWaveRef?.current) {
          rArmX = -2.1 + Math.sin(t * 8.5) * 0.18;
          rArmZ = -0.3 + Math.cos(t * 8.5) * 0.18;
        }
      } else if (pose === 'sleeping') {
        // LYING FLAT HORIZONTALLY ON NAP DAYBED MATTRESS (Head resting squarely on pillow!)
        targetY = Math.sin(t * 1.2) * 0.008; // gentle chest breathing
        rootRotX = -1.5;
        lLegX = -0.04;
        rLegX = -0.04;
        lKneeX = 0.08;
        rKneeX = 0.08;
        lArmX = -0.25;
        rArmX = -0.25;
        lArmZ = -0.22;
        rArmZ = 0.22;
        headYaw = Math.sin(t * 0.3) * 0.14;
        headPitch = 0.18;
        headRoll = 0.08;
      } else if (pose === 'sunbathing') {
        // Reclined ON Poolside Sun Lounger with legs stretched along cushion!
        targetY = 0;
        rootRotX = -0.88;
        lLegX = -0.66;
        rLegX = -0.66;
        lKneeX = 0.22;
        rKneeX = 0.22;
        if (variant % 2 === 0) {
          if (cupPropRef.current) cupPropRef.current.visible = true;
          rArmX = -0.95 + Math.sin(t * 1.5) * 0.12;
          rArmZ = 0.12;
          lArmX = -0.25;
          lArmZ = 0.15;
        } else {
          lArmX = -0.28;
          rArmX = -0.28;
          lArmZ = 0.16;
          rArmZ = -0.16;
        }
        headYaw = Math.sin(t * 0.65) * 0.22;
        headPitch = 0.16;
      } else if (pose === 'console_gaming') {
        // Seated ON Game Room Sofa (thighs horizontal on cushion, knees bent 90° down!) holding 3D Gamepad
        if (gamepadPropRef.current) gamepadPropRef.current.visible = true;
        targetY = 0;
        lLegX = -1.52;
        rLegX = -1.52;
        lKneeX = 1.5;
        rKneeX = 1.5;

        if (variant === 3) {
          // Seated cheer (body stays on sofa cushion, arms pump gently!)
          rootRotX = -0.06;
          lArmX = -1.65 + Math.sin(t * 8) * 0.16;
          rArmX = -1.65 + Math.cos(t * 8) * 0.16;
          headPitch = -0.1;
        } else {
          // Leaning slightly forward focused on 85" OLED TV
          rootRotX = variant === 1 ? 0.12 : 0.04;
          rootRotZ = Math.sin(t * 2.4) * 0.06;
          lArmX = -0.98 + Math.sin(t * 11) * 0.06;
          rArmX = -0.98 + Math.cos(t * 11) * 0.06;
          lArmZ = -0.18;
          rArmZ = 0.18;
          headYaw = Math.sin(t * 1.9) * 0.12;
        }
      } else if (pose === 'racing_sim') {
        // Seated inside red bucket seat gripping steering wheel & pressing pedals!
        targetY = 0;
        rootRotX = -0.18;
        lLegX = -1.28;
        rLegX = -1.25;
        lKneeX = 0.58;
        rKneeX = 0.54 + Math.sin(t * 3.8) * 0.09; // gas/brake pedal foot motion
        const steer = Math.sin(t * 2.3) * 0.26;
        lArmX = -1.16 + steer;
        rArmX = -1.16 - steer;
        lArmZ = -0.08;
        rArmZ = 0.08;
        rootRotZ = -steer * 0.16;
        headYaw = steer * 0.35;
      } else if (pose === 'arcade_play') {
        // Standing right at the Arcade Control Deck with hands on joystick & buttons
        targetY = 0;
        lLegX = -0.08;
        rLegX = 0.08;
        lKneeX = 0.1;
        rKneeX = 0.06;
        if (variant === 3) {
          rArmX = -1.75 + Math.sin(t * 7) * 0.14;
          lArmX = -0.95;
          headPitch = -0.06;
        } else {
          rootRotX = 0.08;
          lArmX = -1.02 + Math.sin(t * 6.5) * 0.1; // joystick control
          lArmZ = Math.cos(t * 5.5) * 0.09;
          rArmX = -1.0 + Math.sin(t * 14) * 0.12; // button taps
          headPitch = -0.06;
        }
      } else if (pose === 'billiard_play') {
        if (cueStickPropRef.current) cueStickPropRef.current.visible = true;
        if (variant % 2 === 0) {
          // Leaning over billiard rail with bent front knee aiming & stroking cue stick
          rootRotX = 0.42;
          lLegX = -0.22;
          lKneeX = 0.24;
          rLegX = 0.14;
          lArmX = -1.15; // bridge hand resting on rail
          const stroke = Math.sin(t * 3.0) * 0.22;
          rArmX = -0.68 + stroke;
          headPitch = -0.26;
          if (cueStickPropRef.current) {
            cueStickPropRef.current.position.set(0.06, 0.74, 0.38 - stroke * 0.28);
            cueStickPropRef.current.rotation.set(Math.PI / 2 - 0.06, 0, -0.06);
          }
        } else {
          // Standing calmly holding cue stick upright watching the table
          rootRotX = 0;
          lArmX = -0.18;
          rArmX = -0.58;
          headYaw = Math.sin(t * 1.2) * 0.26;
          headPitch = 0.12;
          if (cueStickPropRef.current) {
            cueStickPropRef.current.position.set(0.32, 0.74, 0.16);
            cueStickPropRef.current.rotation.set(0.08, 0, 0.04);
          }
        }
      } else if (pose === 'ping_pong') {
        if (paddlePropRef.current) paddlePropRef.current.visible = true;
        // Grounded athletic table-tennis stance behind table end
        lLegX = -0.22;
        rLegX = 0.16;
        lKneeX = 0.28;
        rKneeX = 0.22;
        rootRotX = 0.1;
        const swing = Math.sin(t * 5.6);
        rootRotZ = swing * 0.07;
        rArmX = -0.95 + swing * 0.36;
        rArmZ = -0.22 - swing * 0.28;
        lArmX = -0.45 - swing * 0.12;
        headYaw = swing * 0.2;
      } else if (pose === 'karaoke_sing') {
        if (micPropRef.current) micPropRef.current.visible = true;
        // Standing ON the Karaoke Stage grooving rhythmically (feet planted on stage, knees flexing!)
        const beat = Math.sin(t * 4.4);
        const kneeBounce = Math.max(0, beat) * 0.18;
        targetY = -kneeBounce * 0.08;
        lLegX = -kneeBounce * 0.5;
        rLegX = -kneeBounce * 0.5;
        lKneeX = kneeBounce;
        rKneeX = kneeBounce;
        rootRotZ = Math.sin(t * 2.2) * 0.08;
        rArmX = -1.56 + Math.sin(t * 2.6) * 0.06; // Mic right near mouth
        rArmZ = 0.24;
        if (variant % 2 === 0) {
          lArmX = -1.35 + beat * 0.22;
          lArmZ = 0.22;
        } else {
          lArmX = -0.55 + beat * 0.18;
        }
        headYaw = Math.sin(t * 2.2) * 0.18;
      } else if (pose === 'desk_typing') {
        // Seated ON Office Chair / RGB Gaming Chair with thighs on cushion & knees bent 90° under desk!
        targetY = 0;
        lLegX = -1.52;
        rLegX = -1.52;
        lKneeX = 1.5;
        rKneeX = 1.5;

        if (variant === 0 || variant === 1) {
          // Typing at desk keyboard height + scanning monitor
          rootRotX = 0.05;
          lArmX = -1.08 + Math.sin(t * 9.5) * 0.08;
          rArmX = -1.08 + Math.cos(t * 9.5) * 0.08;
          lArmZ = -0.08;
          rArmZ = 0.08;
          headYaw = Math.sin(t * 1.1) * 0.18;
          headPitch = 0.06;
        } else if (variant === 2) {
          // Sipping coffee while reading monitor
          if (cupPropRef.current) cupPropRef.current.visible = true;
          lArmX = -0.95;
          rArmX = -1.32 + Math.sin(t * 1.8) * 0.15;
          rArmZ = 0.14;
          headPitch = 0.04;
        } else {
          // Seated posture lean-back & neck roll
          rootRotX = -0.07;
          lArmX = -0.65;
          rArmX = -0.65;
          headYaw = Math.sin(t * 1.5) * 0.22;
          headRoll = Math.sin(t * 1.5) * 0.07;
        }
      } else if (pose === 'meeting_sit') {
        // Seated ON Briefing Hub Meeting Chair or Head DM Visitor Chair!
        targetY = 0;
        lLegX = -1.52;
        rLegX = -1.52;
        lKneeX = 1.5;
        rKneeX = 1.5;

        if (variant % 2 === 0) {
          // Discussing / explaining over meeting table
          rootRotX = 0.05;
          lArmX = -0.92 + Math.sin(t * 3.6) * 0.14;
          rArmX = -0.95 + Math.cos(t * 3.2) * 0.16;
          lArmZ = -0.06;
          rArmZ = 0.06;
          headYaw = Math.sin(t * 1.3) * 0.22;
        } else {
          // Attentively listening & nodding at table
          rootRotX = -0.04;
          lArmX = -0.75;
          rArmX = -0.75;
          headPitch = Math.sin(t * 3.6) * 0.09;
          headYaw = Math.sin(t * 0.9) * 0.16;
        }
      } else if (pose === 'sofa_chill' || pose === 'barstool_drink') {
        // Seated ON Chill Room Sofa, Beanbag Pouf, or Marble Espresso Barstool!
        targetY = 0;
        lLegX = -1.52;
        rLegX = -1.52;
        // Subtle natural foot/calf sway while seated on stool/sofa
        lKneeX = 1.48 + Math.sin(t * 1.6) * 0.07;
        rKneeX = 1.48 - Math.sin(t * 1.6) * 0.07;

        if (pose === 'barstool_drink' || variant === 1) {
          if (cupPropRef.current) cupPropRef.current.visible = true;
          rootRotX = 0.03;
          rArmX = -1.22 + Math.sin(t * 1.7) * 0.2;
          rArmZ = 0.14;
          lArmX = -0.65;
          headYaw = Math.sin(t * 0.8) * 0.2;
        } else if (variant === 0 || variant === 2) {
          // Relaxed seated Smartphone scrolling!
          if (phonePropRef.current) phonePropRef.current.visible = true;
          rootRotX = -0.06;
          rArmX = -1.04;
          rArmZ = 0.18;
          lArmX = -0.9 + Math.sin(t * 4.8) * 0.06;
          lArmZ = -0.14;
          headPitch = 0.2;
        } else {
          // Leaning back comfortably against sofa backrest
          rootRotX = -0.14;
          lArmX = -0.35;
          rArmX = -0.35;
          lArmZ = 0.12;
          rArmZ = -0.12;
          headYaw = Math.sin(t * 0.85) * 0.28;
        }
      } else if (pose === 'whiteboard_plan') {
        // Standing at Glass Strategy Whiteboard writing & reviewing notes
        rArmX = -1.42 + Math.sin(t * 5.5) * 0.22;
        rArmZ = Math.cos(t * 4.5) * 0.18;
        lArmX = -0.45;
        headYaw = Math.sin(t * 1.4) * 0.2;
        headPitch = -0.08;
      } else if (pose === 'yoga_stretch') {
        // Grounded stretching on Emerald Yoga Mat
        const stretch = Math.sin(t * 1.4);
        lLegX = -0.08;
        rLegX = 0.08;
        lArmX = -2.45;
        rArmX = -2.45;
        lArmZ = 0.22 + stretch * 0.15;
        rArmZ = -0.22 + stretch * 0.15;
        rootRotZ = stretch * 0.14;
        headRoll = stretch * 0.1;
      } else if (pose === 'wash_hands') {
        // Leaning slightly over ceramic washroom basin rubbing hands under faucet
        rootRotX = 0.16;
        lArmX = -0.96 + Math.sin(t * 7.5) * 0.08;
        rArmX = -0.96 - Math.sin(t * 7.5) * 0.08;
        lArmZ = -0.18;
        rArmZ = 0.18;
        headPitch = 0.16;
      } else if (pose === 'chatting') {
        // REALISTIC 2-PERSON CONVERSATION: grounded feet + alternating Speaker / Listener turns!
        const isSpeakerTurn = Math.floor(rawTime * 0.26) % 2 === roleIndex % 2;
        rootRotZ = Math.sin(t * 0.9) * 0.02;

        if (isSpeakerTurn) {
          // Natural forearm speaking gestures (hands at waist/chest level, NEVER flailing overhead)
          rArmX = -0.62 + Math.sin(t * 3.8) * 0.18;
          rArmZ = -0.08 + Math.cos(t * 3.1) * 0.08;
          lArmX = -0.36 + Math.cos(t * 3.4) * 0.12;
          lArmZ = 0.08;
          headYaw = Math.sin(t * 1.6) * 0.14;
          headRoll = Math.sin(t * 1.3) * 0.06;
        } else {
          // Calm attentive listener: relaxed arms + gentle affirmative nods
          lArmX = -0.18;
          rArmX = -0.38;
          rArmZ = 0.14;
          headPitch = Math.sin(t * 3.6) * 0.08;
          headRoll = 0.05;
        }
      } else if (pose === 'waiting_partner') {
        // Calmly standing waiting for colleague to walk over (zero talking to empty air!)
        rootRotZ = Math.sin(t * 0.8) * 0.02;
        if (variant % 2 === 0) {
          if (phonePropRef.current) phonePropRef.current.visible = true;
          rArmX = -0.92;
          rArmZ = 0.16;
          headPitch = 0.16;
        } else {
          lArmX = -0.12;
          rArmX = -0.12;
          headYaw = Math.sin(t * 0.9) * 0.25;
        }
      } else {
        // 'admiring_view' — Natural grounded standing with subtle weight shift (no awkward overhead arms!)
        rootRotZ = Math.sin(t * 0.75) * 0.022;
        if (variant === 2) {
          if (phonePropRef.current) phonePropRef.current.visible = true;
          rArmX = -1.32; // holding phone up to snap panorama photo
          rArmZ = 0.1;
          headPitch = -0.05;
        } else if (variant === 1) {
          if (cupPropRef.current) cupPropRef.current.visible = true;
          rArmX = -0.88 + Math.sin(t * 1.5) * 0.12;
          rArmZ = 0.12;
        } else {
          lArmX = -0.1;
          rArmX = -0.1;
          lArmZ = 0.06;
          rArmZ = -0.06;
        }
        headYaw = Math.sin(t * 0.7) * 0.34;
      }

      rootAnimRef.current.position.y = THREE.MathUtils.lerp(
        rootAnimRef.current.position.y,
        targetY,
        animAlpha
      );
      rootAnimRef.current.rotation.x = THREE.MathUtils.lerp(
        rootAnimRef.current.rotation.x,
        rootRotX,
        animAlpha
      );
      rootAnimRef.current.rotation.z = THREE.MathUtils.lerp(
        rootAnimRef.current.rotation.z,
        rootRotZ,
        animAlpha
      );

      if (headGroupRef.current) {
        headGroupRef.current.rotation.y = THREE.MathUtils.lerp(
          headGroupRef.current.rotation.y,
          headYaw,
          animAlpha
        );
        headGroupRef.current.rotation.x = THREE.MathUtils.lerp(
          headGroupRef.current.rotation.x,
          headPitch,
          animAlpha
        );
        headGroupRef.current.rotation.z = THREE.MathUtils.lerp(
          headGroupRef.current.rotation.z,
          headRoll,
          animAlpha
        );
      }

      if (leftLegRef.current && rightLegRef.current) {
        leftLegRef.current.rotation.x = THREE.MathUtils.lerp(
          leftLegRef.current.rotation.x,
          lLegX,
          animAlpha
        );
        rightLegRef.current.rotation.x = THREE.MathUtils.lerp(
          rightLegRef.current.rotation.x,
          rLegX,
          animAlpha
        );
      }
      if (leftKneeRef.current && rightKneeRef.current) {
        leftKneeRef.current.rotation.x = THREE.MathUtils.lerp(
          leftKneeRef.current.rotation.x,
          lKneeX,
          animAlpha
        );
        rightKneeRef.current.rotation.x = THREE.MathUtils.lerp(
          rightKneeRef.current.rotation.x,
          rKneeX,
          animAlpha
        );
      }
      if (leftArmRef.current && rightArmRef.current) {
        leftArmRef.current.rotation.x = THREE.MathUtils.lerp(
          leftArmRef.current.rotation.x,
          lArmX,
          animAlpha
        );
        rightArmRef.current.rotation.x = THREE.MathUtils.lerp(
          rightArmRef.current.rotation.x,
          rArmX,
          animAlpha
        );
        leftArmRef.current.rotation.z = THREE.MathUtils.lerp(
          leftArmRef.current.rotation.z,
          lArmZ,
          animAlpha
        );
        rightArmRef.current.rotation.z = THREE.MathUtils.lerp(
          rightArmRef.current.rotation.z,
          rArmZ,
          animAlpha
        );
      }
    });

    if (appearance.customModelUrl) {
      return (
        <group scale={appearance.scale || 1} ref={rootAnimRef}>
          <CustomGlbModel url={appearance.customModelUrl} />
        </group>
      );
    }

    const {
      style,
      skinColor,
      primaryColor,
      secondaryColor,
      outfitType,
      expression,
      scale = 1,
    } = appearance;

    const contextualPropsJSX = (
      <>
        {/* 3D Wireless Gamepad (Console Gaming) */}
        <group ref={gamepadPropRef} position={[0, 0.78, 0.34]} visible={false}>
          <mesh>
            <boxGeometry args={[0.24, 0.08, 0.13]} />
            <meshStandardMaterial color="#1e293b" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.045, 0]}>
            <boxGeometry args={[0.08, 0.01, 0.05]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>

        {/* 3D Billiard Cue Stick */}
        <group ref={cueStickPropRef} position={[0.06, 0.74, 0.38]} visible={false}>
          <mesh>
            <cylinderGeometry args={[0.012, 0.022, 1.45, 8]} />
            <meshStandardMaterial color="#b45309" roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.72, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.05, 8]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      </>
    );

    const rightHandHeldItemsJSX = (
      <group position={[0, -0.38, 0.08]}>
        {/* Ping-Pong Paddle */}
        <group ref={paddlePropRef} rotation={[Math.PI / 2, 0, 0]} visible={false}>
          <mesh position={[0, 0, -0.1]}>
            <cylinderGeometry args={[0.09, 0.09, 0.02, 12]} />
            <meshStandardMaterial color="#dc2626" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[0.03, 0.025, 0.1]} />
            <meshStandardMaterial color="#b45309" />
          </mesh>
        </group>

        {/* Karaoke Handheld Microphone */}
        <group ref={micPropRef} position={[-0.04, -0.02, 0.08]} rotation={[0.9, 0, 0]} visible={false}>
          <mesh>
            <cylinderGeometry args={[0.016, 0.012, 0.16, 8]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0.09, 0]}>
            <sphereGeometry args={[0.032, 8, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
          </mesh>
        </group>

        {/* Coffee / Matcha Cup */}
        <group ref={cupPropRef} position={[-0.04, -0.02, 0.06]} rotation={[1.2, 0, 0]} visible={false}>
          <mesh>
            <cylinderGeometry args={[0.048, 0.038, 0.11, 10]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0, 0.052, 0]}>
            <cylinderGeometry args={[0.044, 0.044, 0.01, 10]} />
            <meshBasicMaterial color="#451a03" />
          </mesh>
        </group>

        {/* Glowing Smartphone */}
        <group ref={phonePropRef} position={[-0.05, -0.02, 0.07]} rotation={[0.8, 0.2, 0]} visible={false}>
          <mesh>
            <boxGeometry args={[0.08, 0.14, 0.014]} />
            <meshStandardMaterial color="#0f172a" />
          </mesh>
          <mesh position={[0, 0, 0.009]}>
            <planeGeometry args={[0.068, 0.12]} />
            <meshBasicMaterial color="#38bdf8" />
          </mesh>
        </group>
      </group>
    );

    if (style === 'roblox') {
      return (
        <group scale={scale} ref={rootAnimRef}>
          {contextualPropsJSX}
          {/* 2-Segment Articulated Left Leg (Thigh + Knee/Shin) */}
          <group position={[-0.14, 0.44, 0]} ref={leftLegRef}>
            <RoundedBox args={[0.22, 0.23, 0.22]} radius={0.03} smoothness={1} position={[0, -0.11, 0]}>
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </RoundedBox>
            <group position={[0, -0.22, 0]} ref={leftKneeRef}>
              <RoundedBox args={[0.22, 0.23, 0.24]} radius={0.03} smoothness={1} position={[0, -0.11, 0.01]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </RoundedBox>
            </group>
          </group>
          {/* 2-Segment Articulated Right Leg (Thigh + Knee/Shin) */}
          <group position={[0.14, 0.44, 0]} ref={rightLegRef}>
            <RoundedBox args={[0.22, 0.23, 0.22]} radius={0.03} smoothness={1} position={[0, -0.11, 0]}>
              <meshStandardMaterial color="#1e293b" roughness={0.7} />
            </RoundedBox>
            <group position={[0, -0.22, 0]} ref={rightKneeRef}>
              <RoundedBox args={[0.22, 0.23, 0.24]} radius={0.03} smoothness={1} position={[0, -0.11, 0.01]}>
                <meshStandardMaterial color="#0f172a" roughness={0.7} />
              </RoundedBox>
            </group>
          </group>

          <RoundedBox args={[0.54, 0.54, 0.28]} radius={0.04} smoothness={1} position={[0, 0.71, 0]} castShadow>
            <meshStandardMaterial color={primaryColor} roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.75, 0.145]}>
            <planeGeometry args={[0.24, 0.34]} />
            <meshStandardMaterial color={secondaryColor} />
          </mesh>

          <group position={[-0.38, 0.93, 0]} ref={leftArmRef}>
            <RoundedBox args={[0.2, 0.48, 0.22]} radius={0.04} smoothness={1} position={[0, -0.2, 0]}>
              <meshStandardMaterial color={outfitType === 'casual' ? skinColor : primaryColor} />
            </RoundedBox>
            <mesh position={[0, -0.44, 0]}>
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshStandardMaterial color={skinColor} />
            </mesh>
          </group>
          <group position={[0.38, 0.93, 0]} ref={rightArmRef}>
            <RoundedBox args={[0.2, 0.48, 0.22]} radius={0.04} smoothness={1} position={[0, -0.2, 0]}>
              <meshStandardMaterial color={outfitType === 'casual' ? skinColor : primaryColor} />
            </RoundedBox>
            <mesh position={[0, -0.44, 0]}>
              <sphereGeometry args={[0.09, 6, 6]} />
              <meshStandardMaterial color={skinColor} />
            </mesh>
            {rightHandHeldItemsJSX}
          </group>

          <group position={[0, 1.23, 0]} ref={headGroupRef}>
            <RoundedBox args={[0.42, 0.42, 0.42]} radius={0.11} smoothness={1}>
              <meshStandardMaterial color={skinColor} roughness={0.45} />
            </RoundedBox>
            <group position={[0, 0, 0.215]}>
              <mesh position={[-0.085, 0.04, 0]}>
                <capsuleGeometry args={[0.024, 0.03, 4, 6]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0.085, 0.04, 0]}>
                <capsuleGeometry args={[0.024, 0.03, 4, 6]} />
                <meshBasicMaterial color="#0f172a" />
              </mesh>
              <mesh position={[0, -0.075, 0]} rotation={[0, 0, expression === 'cool' ? 0.08 : 0]}>
                <boxGeometry args={[0.12, expression === 'excited' ? 0.05 : 0.025, 0.01]} />
                <meshBasicMaterial color={expression === 'excited' ? '#ef4444' : '#0f172a'} />
              </mesh>
            </group>
            <HairAndAccessories appearance={appearance} headRadius={0.23} />
          </group>
        </group>
      );
    }

    if (style === 'anime') {
      return (
        <group scale={scale} ref={rootAnimRef}>
          {contextualPropsJSX}
          {/* 2-Segment Articulated Chibi Legs (Thigh + Knee/Calf + Shoe) */}
          <group position={[-0.11, 0.44, 0]} ref={leftLegRef}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.072, 0.1, 5, 10]} />
              <meshStandardMaterial color={skinColor} />
            </mesh>
            <group position={[0, -0.22, 0]} ref={leftKneeRef}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.068, 0.1, 5, 10]} />
                <meshStandardMaterial color={skinColor} />
              </mesh>
              <mesh position={[0, -0.18, 0.03]}>
                <boxGeometry args={[0.14, 0.08, 0.2]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>
          </group>
          <group position={[0.11, 0.44, 0]} ref={rightLegRef}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <capsuleGeometry args={[0.072, 0.1, 5, 10]} />
              <meshStandardMaterial color={skinColor} />
            </mesh>
            <group position={[0, -0.22, 0]} ref={rightKneeRef}>
              <mesh position={[0, -0.1, 0]} castShadow>
                <capsuleGeometry args={[0.068, 0.1, 5, 10]} />
                <meshStandardMaterial color={skinColor} />
              </mesh>
              <mesh position={[0, -0.18, 0.03]}>
                <boxGeometry args={[0.14, 0.08, 0.2]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
            </group>
          </group>

          <mesh position={[0, 0.67, 0]} castShadow>
            <cylinderGeometry args={[0.17, 0.27, 0.48, 14]} />
            <meshStandardMaterial color={primaryColor} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.85, 0.16]}>
            <octahedronGeometry args={[0.075]} />
            <meshStandardMaterial color={secondaryColor} />
          </mesh>

          <group position={[-0.24, 0.85, 0]} ref={leftArmRef}>
            <mesh position={[-0.03, -0.15, 0]} rotation={[0, 0, 0.2]} castShadow>
              <capsuleGeometry args={[0.065, 0.22, 5, 8]} />
              <meshStandardMaterial color={primaryColor} />
            </mesh>
          </group>
          <group position={[0.24, 0.85, 0]} ref={rightArmRef}>
            <mesh position={[0.03, -0.15, 0]} rotation={[0, 0, -0.2]} castShadow>
              <capsuleGeometry args={[0.065, 0.22, 5, 8]} />
              <meshStandardMaterial color={primaryColor} />
            </mesh>
            {rightHandHeldItemsJSX}
          </group>

          <group position={[0, 1.24, 0]} ref={headGroupRef}>
            <mesh castShadow>
              <sphereGeometry args={[0.32, 20, 16]} />
              <meshStandardMaterial color={skinColor} roughness={0.4} />
            </mesh>
            <group position={[0, -0.02, 0.29]}>
              <mesh position={[-0.105, 0.01, 0]}>
                <sphereGeometry args={[0.052, 10, 10]} />
                <meshBasicMaterial color="#1e1b4b" />
              </mesh>
              <mesh position={[-0.09, 0.03, 0.042]}>
                <sphereGeometry args={[0.018, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[0.105, 0.01, 0]}>
                <sphereGeometry args={[0.052, 10, 10]} />
                <meshBasicMaterial color="#1e1b4b" />
              </mesh>
              <mesh position={[0.12, 0.03, 0.042]}>
                <sphereGeometry args={[0.018, 6, 6]} />
                <meshBasicMaterial color="#ffffff" />
              </mesh>
              <mesh position={[-0.16, -0.055, -0.02]}>
                <circleGeometry args={[0.036, 10]} />
                <meshBasicMaterial color="#fb7185" transparent opacity={0.65} />
              </mesh>
              <mesh position={[0.16, -0.055, -0.02]}>
                <circleGeometry args={[0.036, 10]} />
                <meshBasicMaterial color="#fb7185" transparent opacity={0.65} />
              </mesh>
              <mesh position={[0, -0.075, 0.01]}>
                <torusGeometry args={[0.032, 0.008, 6, 10, Math.PI]} />
                <meshBasicMaterial color="#be123c" />
              </mesh>
            </group>
            <HairAndAccessories appearance={appearance} headRadius={0.32} />
          </group>
        </group>
      );
    }

    return (
      <group scale={scale} ref={rootAnimRef}>
        {contextualPropsJSX}
        {/* 2-Segment Articulated Human Legs (Thigh + Knee/Shin + Polished Shoe) */}
        <group position={[-0.12, 0.44, 0]} ref={leftLegRef}>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.12, 8, 12]} />
            <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.05} />
          </mesh>
          <group position={[0, -0.24, 0]} ref={leftKneeRef}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.078, 0.1, 8, 12]} />
              <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.05} />
            </mesh>
            {/* Polished leather dress shoe */}
            <mesh position={[0, -0.19, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.055, 0.12, 6, 8]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.15} />
            </mesh>
          </group>
        </group>
        <group position={[0.12, 0.44, 0]} ref={rightLegRef}>
          <mesh position={[0, -0.11, 0]} castShadow>
            <capsuleGeometry args={[0.085, 0.12, 8, 12]} />
            <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.05} />
          </mesh>
          <group position={[0, -0.24, 0]} ref={rightKneeRef}>
            <mesh position={[0, -0.1, 0]} castShadow>
              <capsuleGeometry args={[0.078, 0.1, 8, 12]} />
              <meshStandardMaterial color="#2d3748" roughness={0.7} metalness={0.05} />
            </mesh>
            <mesh position={[0, -0.19, 0.04]} rotation={[Math.PI / 2, 0, 0]}>
              <capsuleGeometry args={[0.055, 0.12, 6, 8]} />
              <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.15} />
            </mesh>
          </group>
        </group>

        {/* Torso — Tailored blazer with lapel detail and subtle fabric sheen */}
        <RoundedBox args={[0.46, 0.56, 0.28]} radius={0.11} position={[0, 0.74, 0]} castShadow smoothness={2}>
          <meshStandardMaterial color={primaryColor} roughness={0.55} metalness={0.02} />
        </RoundedBox>
        {/* Shirt front panel visible under blazer */}
        <mesh position={[0, 0.78, 0.141]}>
          <planeGeometry args={[0.14, 0.38]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.7} side={2} />
        </mesh>
        {/* Collar / V-neckline */}
        <mesh position={[-0.055, 0.92, 0.145]} rotation={[0, 0, 0.25]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color={primaryColor} roughness={0.5} side={2} />
        </mesh>
        <mesh position={[0.055, 0.92, 0.145]} rotation={[0, 0, -0.25]}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color={primaryColor} roughness={0.5} side={2} />
        </mesh>
        {/* Tie / accent stripe */}
        <mesh position={[0, 0.73, 0.143]}>
          <boxGeometry args={[0.06, 0.28, 0.008]} />
          <meshStandardMaterial color={secondaryColor} roughness={0.4} metalness={0.1} />
        </mesh>
        {/* Belt line */}
        <mesh position={[0, 0.52, 0]}>
          <torusGeometry args={[0.2, 0.018, 6, 16, Math.PI]} />
          <meshStandardMaterial color="#1a1a2e" roughness={0.3} metalness={0.25} />
        </mesh>

        {/* Arms with forearm + hand */}
        <group position={[-0.3, 0.94, 0]} ref={leftArmRef}>
          {/* Upper arm */}
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.16, 8, 10]} />
            <meshStandardMaterial color={primaryColor} roughness={0.55} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.12, 8, 10]} />
            <meshStandardMaterial color={primaryColor} roughness={0.55} />
          </mesh>
          {/* Hand */}
          <mesh position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
        </group>
        <group position={[0.3, 0.94, 0]} ref={rightArmRef}>
          <mesh position={[0, -0.12, 0]} castShadow>
            <capsuleGeometry args={[0.072, 0.16, 8, 10]} />
            <meshStandardMaterial color={primaryColor} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.28, 0]} castShadow>
            <capsuleGeometry args={[0.065, 0.12, 8, 10]} />
            <meshStandardMaterial color={primaryColor} roughness={0.55} />
          </mesh>
          <mesh position={[0, -0.38, 0]}>
            <sphereGeometry args={[0.065, 10, 10]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {rightHandHeldItemsJSX}
        </group>

        {/* Head — More Detailed Face with Neck */}
        {/* Neck */}
        <mesh position={[0, 1.08, 0]} castShadow>
          <cylinderGeometry args={[0.065, 0.08, 0.1, 10]} />
          <meshStandardMaterial color={skinColor} roughness={0.45} />
        </mesh>
        <group position={[0, 1.28, 0]} ref={headGroupRef}>
          {/* Head sphere — slightly oval */}
          <mesh castShadow>
            <sphereGeometry args={[0.25, 24, 20]} />
            <meshStandardMaterial color={skinColor} roughness={0.42} metalness={0.01} />
          </mesh>
          {/* Ears */}
          <mesh position={[-0.24, -0.01, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          <mesh position={[0.24, -0.01, 0]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial color={skinColor} roughness={0.5} />
          </mesh>
          {/* Face features */}
          <group position={[0, 0, 0.23]}>
            {/* Eyebrows */}
            <mesh position={[-0.075, 0.065, 0]} rotation={[0, 0, 0.1]}>
              <boxGeometry args={[0.065, 0.015, 0.01]} />
              <meshStandardMaterial color={appearance.hairColor} roughness={0.8} />
            </mesh>
            <mesh position={[0.075, 0.065, 0]} rotation={[0, 0, -0.1]}>
              <boxGeometry args={[0.065, 0.015, 0.01]} />
              <meshStandardMaterial color={appearance.hairColor} roughness={0.8} />
            </mesh>
            {/* Eyes — larger, with white sclera + dark iris + white highlight */}
            <mesh position={[-0.075, 0.025, 0]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} />
            </mesh>
            <mesh position={[-0.075, 0.025, 0.015]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
            <mesh position={[-0.068, 0.032, 0.032]}>
              <sphereGeometry args={[0.007, 6, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            <mesh position={[0.075, 0.025, 0]}>
              <sphereGeometry args={[0.035, 10, 10]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} />
            </mesh>
            <mesh position={[0.075, 0.025, 0.015]}>
              <sphereGeometry args={[0.022, 10, 10]} />
              <meshBasicMaterial color="#1e293b" />
            </mesh>
            <mesh position={[0.082, 0.032, 0.032]}>
              <sphereGeometry args={[0.007, 6, 6]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
            {/* Nose */}
            <mesh position={[0, -0.01, 0.02]}>
              <sphereGeometry args={[0.022, 8, 8]} />
              <meshStandardMaterial color={skinColor} roughness={0.45} />
            </mesh>
            {/* Mouth — friendly smile */}
            <mesh position={[0, -0.06, 0.005]}>
              <torusGeometry args={[0.04, 0.008, 6, 12, Math.PI]} />
              <meshStandardMaterial color="#b45555" roughness={0.5} />
            </mesh>
          </group>
          <HairAndAccessories appearance={appearance} headRadius={0.25} />
        </group>
      </group>
    );
  }
);

function shortestAngleLerp(current: number, target: number, alpha: number): number {
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * alpha;
}

interface VillaAgent3DProps {
  agent: AgentProfile;
  livePlansRef: MutableRefObject<Map<string, AgentLivePlan>>;
  livePosMapRef: MutableRefObject<Map<string, THREE.Vector3>>;
  ambientBubbleText: string | null;
  isSelected: boolean;
  indexInList: number;
  onSelect: (agentId: string) => void;
}

export const VillaAgent3D: React.FC<VillaAgent3DProps> = React.memo(
  ({
    agent,
    livePlansRef,
    livePosMapRef,
    ambientBubbleText,
    isSelected,
    indexInList,
    onSelect,
  }) => {
    const groupRef = useRef<THREE.Group>(null);
    const ringMeshRef = useRef<THREE.Mesh>(null);
    const badgeAnchorRef = useRef<THREE.Group>(null);
    const poseRef = useRef<ActivityPose>('walk');
    const walkStrideRef = useRef<number>(indexInList * 1.3);
    const nearbyWaveRef = useRef<boolean>(false);
    const currentPos = useRef<THREE.Vector3 | null>(null);

    const statusColor = useMemo(() => {
      switch (agent.status) {
        case 'late_report':
          return '#ef4444';
        case 'waiting_user':
          return '#f59e0b';
        case 'collaborating':
          return '#6366f1';
        default:
          return '#10b981';
      }
    }, [agent.status]);

    useFrame((_, rawDelta) => {
      if (!groupRef.current) return;
      const delta = Math.min(rawDelta, 0.12);
      const rotAlpha = Math.min(1, delta * 9.5);
      const plan = livePlansRef.current.get(agent.id);
      if (!plan || plan.waypoints.length === 0) return;

      if (!currentPos.current) {
        const init = plan.waypoints[0] || plan.dismountPos;
        currentPos.current = new THREE.Vector3(init[0], init[1] || 0, init[2]);
        groupRef.current.position.copy(currentPos.current);
      }

      if (ringMeshRef.current) {
        ringMeshRef.current.visible = isSelected || !plan.isMounted;
        ringMeshRef.current.position.y = Math.max(0.02, 0.025 - currentPos.current.y);
      }

      // Phase 1: Walking along A* obstacle-free waypoints to approachPos
      if (!plan.isMounted) {
        const wpIndex = Math.min(plan.waypointIndex, plan.waypoints.length - 1);
        const wp = plan.waypoints[wpIndex];
        const goal = new THREE.Vector3(wp[0], 0, wp[2]);

        // Smoothly step down to floor Y=0 when dismounting off a chair/sofa/bed
        currentPos.current.y = THREE.MathUtils.lerp(currentPos.current.y, 0, rotAlpha);

        const dx = goal.x - currentPos.current.x;
        const dz = goal.z - currentPos.current.z;
        const dist2D = Math.hypot(dx, dz);

        if (dist2D > 0.07) {
          poseRef.current = 'walk';
          const isFinalLeg = wpIndex === plan.waypoints.length - 1;
          const speedScale = isFinalLeg && dist2D < 0.85 ? Math.max(0.55, dist2D / 0.85) : 1.0;
          const actualSpeed = (plan.walkSpeed || 1.45) * speedScale;
          const stepDist = Math.min(dist2D, delta * actualSpeed);

          let moveX = (dx / dist2D) * stepDist;
          let moveZ = (dz / dist2D) * stepDist;

          // Soft social avoidance + friendly wave check with other walking agents
          let wavingNow = false;
          for (const [otherId, otherPos] of livePosMapRef.current.entries()) {
            if (otherId === agent.id) continue;
            const odx = currentPos.current.x - otherPos.x;
            const odz = currentPos.current.z - otherPos.z;
            const odist = Math.hypot(odx, odz);
            if (odist > 0.01 && odist < 0.76) {
              const push = ((0.76 - odist) / 0.76) * delta * 0.85;
              const candX = currentPos.current.x + moveX + (odx / odist) * push;
              const candZ = currentPos.current.z + moveZ + (odz / odist) * push;
              if (!isPointBlocked(candX, candZ)) {
                moveX += (odx / odist) * push;
                moveZ += (odz / odist) * push;
              }
            } else if (odist >= 0.76 && odist < 2.0 && (indexInList + otherId.length) % 4 === 0) {
              wavingNow = true;
            }
          }
          nearbyWaveRef.current = wavingNow;

          currentPos.current.x += moveX;
          currentPos.current.z += moveZ;
          walkStrideRef.current += Math.hypot(moveX, moveZ) * 4.2;

          groupRef.current.position.copy(currentPos.current);

          const moveYaw = Math.atan2(moveX, moveZ);
          groupRef.current.rotation.y = shortestAngleLerp(
            groupRef.current.rotation.y,
            moveYaw,
            rotAlpha
          );
        } else if (plan.waypointIndex < plan.waypoints.length - 1) {
          plan.waypointIndex += 1;
        } else {
          // Arrived at approachPos -> now mount onto exact seat / bed / station!
          plan.isMounted = true;
          nearbyWaveRef.current = false;
        }
      } else {
        // Phase 2: Settle onto exact calibrated mountPos (chair cushion, sofa, barstool, bed, stage)
        const mountGoal = new THREE.Vector3(
          plan.mountPos[0],
          plan.mountPos[1],
          plan.mountPos[2]
        );
        currentPos.current.lerp(mountGoal, Math.min(1, delta * 6.5));
        groupRef.current.position.copy(currentPos.current);

        let targetYaw = plan.finalYaw;
        let activePose: ActivityPose = plan.pose;

        // Realistic 2-person chatting: face live partner position & wait calmly until partner arrives!
        if (plan.pose === 'chatting' && plan.partnerId) {
          const partnerVec = livePosMapRef.current.get(plan.partnerId);
          if (partnerVec) {
            const pdx = partnerVec.x - currentPos.current.x;
            const pdz = partnerVec.z - currentPos.current.z;
            const pdist = Math.hypot(pdx, pdz);
            if (pdist > 0.05) {
              targetYaw = Math.atan2(pdx, pdz);
            }
            if (pdist > 1.75) {
              activePose = 'waiting_partner';
            }
          }
        }

        poseRef.current = activePose;
        groupRef.current.rotation.y = shortestAngleLerp(
          groupRef.current.rotation.y,
          targetYaw,
          rotAlpha
        );
      }

      // Keep floating name badge & speech bubble cleanly anchored right above head in every posture
      if (badgeAnchorRef.current) {
        let bx = 0;
        let by = 1.82;
        let bz = 0;
        if (poseRef.current === 'sleeping') {
          by = 0.72;
          bz = -0.68;
        } else if (poseRef.current === 'sunbathing') {
          by = 1.15;
          bz = -0.45;
        } else if (
          poseRef.current === 'desk_typing' ||
          poseRef.current === 'meeting_sit' ||
          poseRef.current === 'console_gaming' ||
          poseRef.current === 'sofa_chill' ||
          poseRef.current === 'barstool_drink' ||
          poseRef.current === 'racing_sim'
        ) {
          by = 1.66;
        }
        badgeAnchorRef.current.position.x = THREE.MathUtils.lerp(
          badgeAnchorRef.current.position.x,
          bx,
          rotAlpha
        );
        badgeAnchorRef.current.position.y = THREE.MathUtils.lerp(
          badgeAnchorRef.current.position.y,
          by,
          rotAlpha
        );
        badgeAnchorRef.current.position.z = THREE.MathUtils.lerp(
          badgeAnchorRef.current.position.z,
          bz,
          rotAlpha
        );
      }

      livePosMapRef.current.set(agent.id, currentPos.current);
    });

    const urgentTaskBubble =
      agent.speechBubble &&
      (agent.status === 'waiting_user' ||
        agent.status === 'late_report' ||
        (agent.speechTimestamp && Date.now() - agent.speechTimestamp < 20000))
        ? agent.speechBubble
        : null;

    const bubbleToDisplay = urgentTaskBubble || ambientBubbleText;

    return (
      <group
        ref={groupRef}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(agent.id);
        }}
      >
        <mesh ref={ringMeshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
          <ringGeometry args={[isSelected ? 0.44 : 0.28, isSelected ? 0.56 : 0.35, 22]} />
          <meshBasicMaterial
            color={isSelected ? '#818cf8' : statusColor}
            transparent
            opacity={isSelected ? 0.95 : 0.45}
          />
        </mesh>

        <AvatarMesh
          appearance={agent.appearance}
          poseRef={poseRef}
          walkStrideRef={walkStrideRef}
          nearbyWaveRef={nearbyWaveRef}
          phaseOffset={indexInList * 0.85}
          roleIndex={indexInList}
        />

        <group ref={badgeAnchorRef} position={[0, 1.82, 0]}>
          <Html
            center
            distanceFactor={16}
            zIndexRange={[8, 0]}
            style={{ pointerEvents: 'none', willChange: 'transform' }}
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onSelect(agent.id);
              }}
              style={{ pointerEvents: 'auto' }}
              className="flex flex-col items-center cursor-pointer select-none"
            >
              {bubbleToDisplay && (
                <div
                  className={`mb-1 max-w-[195px] px-2.5 py-1 rounded-xl text-[10px] leading-snug font-semibold shadow-md border ${
                    agent.status === 'late_report'
                      ? 'bg-rose-950 border-rose-400 text-rose-100'
                      : agent.status === 'waiting_user'
                      ? 'bg-amber-950 border-amber-400 text-amber-100'
                      : 'bg-slate-900/95 border-indigo-400/60 text-slate-100'
                  }`}
                >
                  {bubbleToDisplay}
                </div>
              )}

              <div
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border shadow ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-300 text-white'
                    : 'bg-slate-950/92 border-slate-700 text-slate-100 hover:border-indigo-400'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusColor }}
                />
                <span className="text-[11px]">{agent.avatarEmoji}</span>
                <span className="text-[10px] font-bold whitespace-nowrap">{agent.name}</span>
              </div>
            </div>
          </Html>
        </group>
      </group>
    );
  }
);
