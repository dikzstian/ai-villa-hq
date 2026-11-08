import { AgentProfile, VillaRoomId } from '../types';
import { findSmoothObstacleFreePath, isPointBlocked } from './navGrid';
import { OFFICE_DESK_POSITIONS } from './villaCoords';

export type ActivityPose =
  | 'walk'
  | 'waiting_partner'
  | 'desk_typing'
  | 'meeting_sit'
  | 'sleeping'
  | 'sunbathing'
  | 'console_gaming'
  | 'racing_sim'
  | 'arcade_play'
  | 'billiard_play'
  | 'ping_pong'
  | 'karaoke_sing'
  | 'sofa_chill'
  | 'barstool_drink'
  | 'whiteboard_plan'
  | 'yoga_stretch'
  | 'wash_hands'
  | 'chatting'
  | 'admiring_view';

export interface VillaHotspot {
  id: string;
  room: VillaRoomId;
  approachPos: [number, number, number]; // Guaranteed walkable floor position beside furniture
  mountPos: [number, number, number]; // Exact calibrated world position ON seat/bed/station
  yaw: number;
  pose: ActivityPose;
  label: string;
  bubbles: string[];
}

// Helper for the 6 ergonomic chairs around Central Briefing Table (0, 0, -2.2)
function makeBriefingChairHotspot(chairIndex: number, label: string, bubble: string): VillaHotspot {
  const ang = (chairIndex / 6) * Math.PI * 2 + 0.35;
  const seatR = 2.05;
  const approachR = 2.68;
  const cx = Math.cos(ang);
  const cz = Math.sin(ang);
  return {
    id: `briefing_chair_${chairIndex}`,
    room: 'meeting_hub',
    approachPos: [cx * approachR, 0, -2.2 + cz * approachR],
    mountPos: [cx * seatR, 0.11, -2.2 + cz * seatR], // Seat cushion top y=0.475 -> mountPos.y=0.11
    yaw: Math.atan2(-cx, -cz), // Face center of round table
    pose: 'meeting_sit',
    label,
    bubbles: [bubble],
  };
}

export const VILLA_HOTSPOTS: VillaHotspot[] = [
  // === REST ROOM: SLEEPING ON NAP BEDS, YOGA MAT & VANITY SINK ===
  {
    id: 'nap_bed_1',
    room: 'rest_room',
    approachPos: [-13.3, 0, 5.4],
    mountPos: [-14.8, 0.63, 5.72], // Feet at 5.72, horizontal back on mattress y=0.52, head on pillow z=4.42
    yaw: 0,
    pose: 'sleeping',
    label: 'Tidur Rebahan di Nap Pod',
    bubbles: ['Zzz... power nap bentar 😴💤', 'Kasurnya empuk banget... Zzz 💤'],
  },
  {
    id: 'nap_bed_2',
    room: 'rest_room',
    approachPos: [-10.25, 0, 5.4],
    mountPos: [-11.8, 0.63, 5.72],
    yaw: 0,
    pose: 'sleeping',
    label: 'Tidur Siang di Lounge Bed',
    bubbles: ['Istirahat mata bentar biar seger... Zzz 💤'],
  },
  {
    id: 'yoga_mat',
    room: 'rest_room',
    approachPos: [-13.3, 0, 7.6],
    mountPos: [-13.3, 0, 7.6], // Exact center of emerald yoga mat [-13.3, 0, 7.6]
    yaw: Math.PI,
    pose: 'yoga_stretch',
    label: 'Stretching & Yoga di Matras',
    bubbles: ['Stretching bahu & punggung dulu biar rileks 🧘✨'],
  },
  {
    id: 'washroom_vanity',
    room: 'rest_room',
    approachPos: [-14.0, 0, 10.38],
    mountPos: [-14.0, 0, 10.22], // Directly in front of ceramic sink basin [-14.0, 0.98, 9.65] & LED mirror
    yaw: Math.PI,
    pose: 'wash_hands',
    label: 'Cuci Tangan di Wastafel',
    bubbles: ['Cuci muka & tangan bentar biar fresh! 💧'],
  },

  // === GAME HUB: 3 ARCADE CABINETS & RACING SIMULATOR COCKPIT ===
  {
    id: 'arcade_pink',
    room: 'game_hub',
    approachPos: [11.4, 0, -8.75],
    mountPos: [11.4, 0, -9.08], // Hands land directly on joystick deck [11.4, 0.95, -9.44]
    yaw: Math.PI,
    pose: 'arcade_play',
    label: 'Main Mesin Arcade Neon',
    bubbles: ['Combo 12x masuk! 👾🔥', 'Dikit lagi tembus high score!'],
  },
  {
    id: 'arcade_cyan',
    room: 'game_hub',
    approachPos: [13.2, 0, -8.75],
    mountPos: [13.2, 0, -9.08],
    yaw: Math.PI,
    pose: 'arcade_play',
    label: 'Main Retro Arcade',
    bubbles: ['Seru banget adu skor di Game Hub! 🎮'],
  },
  {
    id: 'arcade_purple',
    room: 'game_hub',
    approachPos: [15.0, 0, -8.75],
    mountPos: [15.0, 0, -9.08],
    yaw: Math.PI,
    pose: 'arcade_play',
    label: 'Main Pac-Man Arcade',
    bubbles: ['Yes tembus stage bonus! 🙌'],
  },
  {
    id: 'racing_cockpit',
    room: 'game_hub',
    approachPos: [15.4, 0, -4.65],
    mountPos: [15.42, 0.14, -5.7], // Seated inside red bucket seat [15.42, 0.50, -5.7] gripping steering wheel [14.96, 0.78, -5.7]
    yaw: -Math.PI / 2,
    pose: 'racing_sim',
    label: 'Duduk Nyetir di Racing Simulator',
    bubbles: ['Overtake mulus di tikungan terakhir! 🏎️💨', 'Pedal gas pol!'],
  },

  // === GAME ROOM: PS5 CONSOLE SOFA, RGB PC CHAIR & BEANBAG POUFS ===
  {
    id: 'console_sofa_left',
    room: 'game_room',
    approachPos: [12.45, 0, 0.65],
    mountPos: [12.45, 0.19, 1.64], // Seated ON plush sofa cushion y=0.55 against backrest z=1.90 facing 85" TV
    yaw: Math.PI,
    pose: 'console_gaming',
    label: 'Duduk Main PS5 di Sofa',
    bubbles: ['Oper ke sayap kanan bro, kosong! ⚽🎮', 'Grafik TV 85 inch mantap parah!'],
  },
  {
    id: 'console_sofa_right',
    room: 'game_room',
    approachPos: [14.15, 0, 0.65],
    mountPos: [14.15, 0.19, 1.64],
    yaw: Math.PI,
    pose: 'console_gaming',
    label: 'Duduk Mabar Console di Sofa',
    bubbles: ['GGWP! Satu match lagi gas! 🔥🎮'],
  },
  {
    id: 'rgb_pc_station',
    room: 'game_room',
    approachPos: [15.2, 0, -0.25],
    mountPos: [15.96, 0.12, -0.25], // Seated ON Pro Gaming Chair [15.96, 0.48, -0.25] facing +X into RGB monitor [16.75, 1.12, -0.25]
    yaw: Math.PI / 2,
    pose: 'desk_typing',
    label: 'Duduk Main di Kursi RGB PC',
    bubbles: ['FPS tinggi mulus banget di PC RGB! 🖥️✨'],
  },
  {
    id: 'beanbag_red',
    room: 'game_room',
    approachPos: [11.75, 0, 0.3],
    mountPos: [10.9, 0.06, 0.3], // Seated ON red beanbag pouf [10.9, 0.42, 0.3] facing TV
    yaw: Math.PI * 0.84,
    pose: 'sofa_chill',
    label: 'Duduk Santai di Beanbag Merah',
    bubbles: ['Enak banget nyender di beanbag sambil nonton mabar 😄'],
  },
  {
    id: 'beanbag_green',
    room: 'game_room',
    approachPos: [11.75, 0, -1.2],
    mountPos: [10.9, 0.06, -1.2], // Seated ON green beanbag pouf [10.9, 0.42, -1.2]
    yaw: Math.PI * 0.76,
    pose: 'sofa_chill',
    label: 'Duduk Scroll HP di Beanbag',
    bubbles: ['Cek referensi konten viral sambil duduk santai 📱'],
  },

  // === FUN ROOM: BILLIARDS, PING-PONG & KARAOKE STAGE ===
  {
    id: 'billiard_north',
    room: 'fun_room',
    approachPos: [12.5, 0, 6.22],
    mountPos: [12.5, 0, 6.52], // Leaning right over north baize rail z=6.875
    yaw: 0,
    pose: 'billiard_play',
    label: 'Bidik Stik di Meja Biliar',
    bubbles: ['Fokus bidik bola 8 ke lubang pojok... 🎱', 'Sodokan halus masuk nih!'],
  },
  {
    id: 'billiard_east',
    room: 'fun_room',
    approachPos: [14.65, 0, 7.7],
    mountPos: [14.32, 0, 7.7], // Leaning right over east baize rail x=13.95
    yaw: -Math.PI / 2,
    pose: 'billiard_play',
    label: 'Main Biliar',
    bubbles: ['Giliran gw nih, liat efek spin-nya! 🎱✨'],
  },
  {
    id: 'pingpong_left',
    room: 'fun_room',
    approachPos: [10.15, 0, 10.6],
    mountPos: [10.42, 0, 10.6], // Standing right behind west end x=10.75 of ping-pong table
    yaw: Math.PI / 2,
    pose: 'ping_pong',
    label: 'Main Ping-Pong',
    bubbles: ['Smash silang nih terima ya! 🏓🔥'],
  },
  {
    id: 'pingpong_right',
    room: 'fun_room',
    approachPos: [13.65, 0, 10.6],
    mountPos: [13.38, 0, 10.6], // Standing right behind east end x=13.05 of ping-pong table
    yaw: -Math.PI / 2,
    pose: 'ping_pong',
    label: 'Tanding Ping-Pong',
    bubbles: ['Rally panjang seru banget! 🏓'],
  },
  {
    id: 'karaoke_singer',
    room: 'fun_room',
    approachPos: [14.1, 0, 9.15],
    mountPos: [15.25, 0.2, 10.05], // Standing ON elevated stage surface y=0.20 behind mic stand
    yaw: -Math.PI * 0.75,
    pose: 'karaoke_sing',
    label: 'Nyanyi di Panggung Karaoke',
    bubbles: ['🎤 Tarik suara dulu biar satu Villa semangat~ 🎶', 'Nyanyi lagu favorit sore-sore! 🎵'],
  },

  // === CHILL ROOM & MARBLE ESPRESSO BARSTOOLS ===
  {
    id: 'barstool_1',
    room: 'chill_room',
    approachPos: [-14.3, 0, -8.25],
    mountPos: [-14.3, 0.325, -8.98], // Exact barstool #1 center [-14.3, 0.685, -8.98] facing marble bar z=-9.8
    yaw: Math.PI,
    pose: 'barstool_drink',
    label: 'Duduk Ngopi di Barstool',
    bubbles: ['Iced Kopi Susu buatan sendiri mantap! ☕✨'],
  },
  {
    id: 'barstool_2',
    room: 'chill_room',
    approachPos: [-13.1, 0, -8.25],
    mountPos: [-13.1, 0.325, -8.98], // Exact barstool #2 center [-13.1, 0.685, -8.98]
    yaw: Math.PI,
    pose: 'barstool_drink',
    label: 'Duduk Minum Matcha di Bar',
    bubbles: ['Rehat ngopi sebentar di kursi bar marmer 🍵'],
  },
  {
    id: 'barstool_3',
    room: 'chill_room',
    approachPos: [-11.9, 0, -8.25],
    mountPos: [-11.9, 0.325, -8.98], // Exact barstool #3 center [-11.9, 0.685, -8.98]
    yaw: Math.PI,
    pose: 'barstool_drink',
    label: 'Duduk Santai di Coffee Counter',
    bubbles: ['Wangi espresso bikin langsung fokus! ☕'],
  },
  {
    id: 'chill_lsofa_1',
    room: 'chill_room',
    approachPos: [-11.15, 0, -3.2],
    mountPos: [-14.05, 0.16, -3.14], // Seated ON L-sofa cushion y=0.52 against backrest z=-2.87
    yaw: Math.PI,
    pose: 'sofa_chill',
    label: 'Duduk Santai di Sofa L',
    bubbles: ['Sofa Chill Room paling nyaman buat cari ide ✨'],
  },
  {
    id: 'chill_lsofa_2',
    room: 'chill_room',
    approachPos: [-11.15, 0, -3.2],
    mountPos: [-12.35, 0.16, -3.14],
    yaw: Math.PI,
    pose: 'sofa_chill',
    label: 'Duduk Baca Insight di Sofa',
    bubbles: ['Scroll tren market sambil duduk nyender 📱'],
  },
  {
    id: 'chill_lsofa_side',
    room: 'chill_room',
    approachPos: [-14.25, 0, -5.95],
    mountPos: [-15.16, 0.16, -4.55], // Seated ON left chaise wing against backrest x=-15.46 facing +X
    yaw: Math.PI / 2,
    pose: 'sofa_chill',
    label: 'Duduk Nyender di Sayap Sofa L',
    bubbles: ['Enaknya duduk santai di Chill Room 🌿'],
  },

  // === INFINITY POOL SUN LOUNGERS & PANORAMIC TERRACE ===
  {
    id: 'sunbed_west_1',
    room: 'chill_room',
    approachPos: [-14.2, 0, -13.2],
    mountPos: [-14.2, 0.38, -15.28], // Reclined ON sun lounger cushion [-14.2, 0.36, -15.1], back against z=-14.25 headrest
    yaw: Math.PI,
    pose: 'sunbathing',
    label: 'Rebahan di Sun Lounger Kolam',
    bubbles: ['Angin sepoi-sepoi di pinggir kolam adem banget 🌴☀️'],
  },
  {
    id: 'sunbed_west_2',
    room: 'chill_room',
    approachPos: [-12.2, 0, -13.2],
    mountPos: [-12.2, 0.38, -15.28],
    yaw: Math.PI,
    pose: 'sunbathing',
    label: 'Rebahan Santai di Poolside Deck',
    bubbles: ['Vibes resort bintang lima tiap hari! 🏖️'],
  },
  {
    id: 'sunbed_east_1',
    room: 'chill_room',
    approachPos: [12.2, 0, -13.2],
    mountPos: [12.2, 0.38, -15.28],
    yaw: Math.PI,
    pose: 'sunbathing',
    label: 'Rebahan di Sunbed Timur',
    bubbles: ['Rehat sejenak menikmati panorama luar 🌊🏔️'],
  },
  {
    id: 'sunbed_east_2',
    room: 'chill_room',
    approachPos: [14.2, 0, -13.2],
    mountPos: [14.2, 0.38, -15.28],
    yaw: Math.PI,
    pose: 'sunbathing',
    label: 'Santai di Sun Lounger Timur',
    bubbles: ['Seger banget udara teras kolam! ☀️🍹'],
  },
  {
    id: 'deck_vista_west',
    room: 'chill_room',
    approachPos: [-6.5, 0, -13.0],
    mountPos: [-6.5, 0, -12.95],
    yaw: Math.PI,
    pose: 'admiring_view',
    label: 'Menikmati Panorama dari Teras',
    bubbles: ['View depan Villa bikin pikiran langsung jernih! 😍'],
  },
  {
    id: 'deck_vista_east',
    room: 'chill_room',
    approachPos: [6.5, 0, -13.0],
    mountPos: [6.5, 0, -12.95],
    yaw: Math.PI,
    pose: 'admiring_view',
    label: 'Hirup Udara Segar di Dek Kolam',
    bubbles: ['Enaknya suasana kantor Villa hari ini ✨'],
  },

  // === CENTRAL BRIEFING CHAIRS & GLASS STRATEGY WHITEBOARD ===
  {
    id: 'whiteboard_brainstorm',
    room: 'office',
    approachPos: [-7.85, 0, 0.2],
    mountPos: [-8.18, 0, 0.2], // Right in front of glass whiteboard [-8.65, 1.35, 0.2]
    yaw: -Math.PI / 2,
    pose: 'whiteboard_plan',
    label: 'Menulis Ide di Glass Whiteboard',
    bubbles: ['Catat struktur hook & funnel baru di whiteboard ✍️'],
  },
  makeBriefingChairHotspot(
    0,
    'Duduk Review Strategi di Meja Hub',
    'Review performa lintas channel sebentar 📊'
  ),
  makeBriefingChairHotspot(
    2,
    'Duduk Evaluasi Timeline di Meja Hub',
    'Target minggu ini on-track semua! 🚀'
  ),
  makeBriefingChairHotspot(
    4,
    'Duduk Cek Kalender Konten di Hub',
    'Jadwal posting & ads udah sinkron rapi ✨'
  ),
];

export interface SocialChatSpot {
  id: string;
  p1Pos: [number, number, number];
  p1Yaw: number;
  p2Pos: [number, number, number];
  p2Yaw: number;
}

// Natural watercooler, lounge & terrace conversation spots (100% clear of furniture & doorways)
export const SOCIAL_CHAT_SPOTS: SocialChatSpot[] = [
  {
    id: 'coffee_lounge_chat',
    p1Pos: [-11.35, 0, -7.65],
    p1Yaw: Math.PI / 2,
    p2Pos: [-10.28, 0, -7.65],
    p2Yaw: -Math.PI / 2,
  },
  {
    id: 'briefing_plaza_chat',
    p1Pos: [-0.54, 0, 0.72],
    p1Yaw: Math.PI / 2,
    p2Pos: [0.54, 0, 0.72],
    p2Yaw: -Math.PI / 2,
  },
  {
    id: 'west_panorama_chat',
    p1Pos: [-6.85, 0, -11.2],
    p1Yaw: Math.PI / 2,
    p2Pos: [-5.78, 0, -11.2],
    p2Yaw: -Math.PI / 2,
  },
  {
    id: 'east_panorama_chat',
    p1Pos: [5.78, 0, -11.2],
    p1Yaw: Math.PI / 2,
    p2Pos: [6.85, 0, -11.2],
    p2Yaw: -Math.PI / 2,
  },
  {
    id: 'game_hub_lounge_chat',
    p1Pos: [10.65, 0, -6.4],
    p1Yaw: Math.PI / 2,
    p2Pos: [11.72, 0, -6.4],
    p2Yaw: -Math.PI / 2,
  },
  {
    id: 'fun_room_lounge_chat',
    p1Pos: [10.45, 0, 5.45],
    p1Yaw: Math.PI / 2,
    p2Pos: [11.52, 0, 5.45],
    p2Yaw: -Math.PI / 2,
  },
];

export const SOCIAL_BANTER_PAIRS: Array<[string, string]> = [
  ['Eh tren Reels pagi ini udah cek belum? Kenceng banget!', 'Udah! Bisa kita olah jadi edukasi soft-selling tuh 🔥'],
  ['Habis ini tanding ping-pong atau biliar di Fun Room yuk!', 'Gas! Siap-siap kalah ya lu 🏓😂'],
  ['ROAS campaign kemaren tembus target lho!', 'Mantap! Sore ini kita siapin variasi kreatif baru 🎯'],
  ['Udah nyobain kopi di Chill Room belum?', 'Barusan minum, seger banget sambil liat view luar ☕'],
  ['Nanti jam istirahat mabar PS5 di Game Room yuk!', 'Ayo! Gw duduk ambil stik duluan di sofa ya 🎮'],
];

export interface AgentLivePlan {
  hotspotId: string;
  waypoints: Array<[number, number, number]>;
  waypointIndex: number;
  mountPos: [number, number, number];
  dismountPos: [number, number, number];
  isMounted: boolean;
  walkSpeed: number;
  finalYaw: number;
  pose: ActivityPose;
  activityLabel: string;
  ambientBubble: string | null;
  bubbleExpiresAt: number;
  nextDecisionAt: number;
  partnerId: string | null;
}

export function buildPlanToTarget(params: {
  currentPos: [number, number, number];
  previousDismountPos: [number, number, number] | null;
  wasMounted: boolean;
  hotspotId: string;
  approachPos: [number, number, number];
  mountPos: [number, number, number];
  yaw: number;
  pose: ActivityPose;
  walkSpeed: number;
  activityLabel: string;
  ambientBubble: string | null;
  bubbleDurationMs: number;
  stayDurationMs: number;
  partnerId?: string | null;
}): AgentLivePlan {
  const now = Date.now();
  const safeStart: [number, number, number] =
    params.wasMounted && params.previousDismountPos
      ? params.previousDismountPos
      : isPointBlocked(params.currentPos[0], params.currentPos[2]) && params.previousDismountPos
      ? params.previousDismountPos
      : params.currentPos;

  const pathPts = findSmoothObstacleFreePath(safeStart, params.approachPos);
  const fullWaypoints: Array<[number, number, number]> =
    params.wasMounted && params.previousDismountPos
      ? [params.previousDismountPos, ...pathPts]
      : pathPts;

  let pathDist = 0;
  let prev = params.currentPos;
  for (const wp of fullWaypoints) {
    pathDist += Math.hypot(wp[0] - prev[0], wp[2] - prev[2]);
    prev = wp;
  }
  const travelTimeMs = (pathDist / Math.max(0.85, params.walkSpeed)) * 1000;

  return {
    hotspotId: params.hotspotId,
    waypoints: fullWaypoints,
    waypointIndex: 0,
    mountPos: params.mountPos,
    dismountPos: params.approachPos,
    isMounted: false,
    walkSpeed: params.walkSpeed,
    finalYaw: params.yaw,
    pose: params.pose,
    activityLabel: params.activityLabel,
    ambientBubble: params.ambientBubble,
    bubbleExpiresAt: params.ambientBubble
      ? now + travelTimeMs + params.bubbleDurationMs
      : 0,
    nextDecisionAt: now + travelTimeMs + params.stayDurationMs,
    partnerId: params.partnerId || null,
  };
}

export function isAgentExecutingRealTask(
  agent: AgentProfile,
  hasActiveWorkflowOnAgent: boolean
): boolean {
  if (hasActiveWorkflowOnAgent) return true;
  if (agent.deskFocusUntil && Date.now() < agent.deskFocusUntil) {
    return true;
  }
  if (
    agent.status === 'waiting_user' ||
    agent.status === 'late_report' ||
    agent.status === 'collaborating'
  ) {
    return true;
  }
  const txt = agent.statusText || '';
  if (
    txt.startsWith('🔍') ||
    txt.startsWith('Mengerjakan:') ||
    txt.startsWith('Merespons') ||
    txt.startsWith('Menyusun') ||
    txt.startsWith('Menganalisis') ||
    txt.includes('mencari data')
  ) {
    return true;
  }
  return false;
}

export function getTaskStationForAgent(
  agent: AgentProfile,
  allAgents: AgentProfile[]
): {
  approachPos: [number, number, number];
  mountPos: [number, number, number];
  yaw: number;
  pose: ActivityPose;
} {
  // Whenever user asks a question / triggers analysis, go straight to their personal Office Desk!
  if (agent.deskFocusUntil && Date.now() < agent.deskFocusUntil) {
    const desk = OFFICE_DESK_POSITIONS[agent.deskIndex % OFFICE_DESK_POSITIONS.length];
    return {
      approachPos: [desk[0], 0, desk[2] + 1.22],
      mountPos: [desk[0], 0.11, desk[2] + 0.64],
      yaw: Math.PI,
      pose: 'desk_typing',
    };
  }

  if (agent.status === 'waiting_user' || agent.currentRoom === 'head_suite') {
    const peers = allAgents.filter(
      (a) => a.status === 'waiting_user' || a.currentRoom === 'head_suite'
    );
    const idx = Math.max(0, peers.findIndex((a) => a.id === agent.id));
    // First 2 visitors sit on the 2 Executive Visitor Chairs [-0.85, 0, -7.45] & [+0.85, 0, -7.45]
    if (idx < 2) {
      const vx = idx === 0 ? -0.85 : 0.85;
      return {
        approachPos: [vx, 0, -6.72],
        mountPos: [vx, 0.11, -7.45],
        yaw: Math.PI,
        pose: 'meeting_sit',
      };
    }
    const extraIdx = idx - 2;
    const xOff = (extraIdx - 0.5) * 1.15;
    return {
      approachPos: [xOff, 0, -6.45],
      mountPos: [xOff, 0, -6.45],
      yaw: Math.PI,
      pose: 'admiring_view',
    };
  }

  if (agent.status === 'collaborating' || agent.currentRoom === 'meeting_hub') {
    const peers = allAgents.filter(
      (a) => a.status === 'collaborating' || a.currentRoom === 'meeting_hub'
    );
    const idx = Math.max(0, peers.findIndex((a) => a.id === agent.id));
    // First 6 peers sit ON the 6 Briefing Hub Meeting Chairs!
    const chairSlot = idx % 6;
    const ang = (chairSlot / 6) * Math.PI * 2 + 0.35;
    const cx = Math.cos(ang);
    const cz = Math.sin(ang);
    return {
      approachPos: [cx * 2.68, 0, -2.2 + cz * 2.68],
      mountPos: [cx * 2.05, 0.11, -2.2 + cz * 2.05],
      yaw: Math.atan2(-cx, -cz),
      pose: 'meeting_sit',
    };
  }

  const desk = OFFICE_DESK_POSITIONS[agent.deskIndex % OFFICE_DESK_POSITIONS.length];
  return {
    approachPos: [desk[0], 0, desk[2] + 1.22], // Walkable aisle right behind chair
    mountPos: [desk[0], 0.11, desk[2] + 0.64], // Seated ON office chair cushion (top y=0.475) facing monitor
    yaw: Math.PI,
    pose: 'desk_typing',
  };
}
