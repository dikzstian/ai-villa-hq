import { AgentProfile, VillaRoomId } from '../types';

export interface RoomMeta {
  id: VillaRoomId;
  label: string;
  emoji: string;
  center: [number, number, number];
  cameraPos: [number, number, number];
  cameraTarget: [number, number, number];
}

export const VILLA_ROOMS: Record<VillaRoomId, RoomMeta> = {
  office: {
    id: 'office',
    label: 'Marketing Office',
    emoji: '💼',
    center: [0, 0, 5.2],
    cameraPos: [0, 14.5, 19],
    cameraTarget: [0, 0.8, 3.5],
  },
  head_suite: {
    id: 'head_suite',
    label: 'Head DM Suite',
    emoji: '👑',
    center: [0, 0, -8.2],
    cameraPos: [0, 8.5, 0.5],
    cameraTarget: [0, 1.0, -8.5],
  },
  meeting_hub: {
    id: 'meeting_hub',
    label: 'Briefing & Sync Hub',
    emoji: '🤝',
    center: [0, 0, -2.2],
    cameraPos: [6, 9, 5],
    cameraTarget: [0, 0.8, -2.2],
  },
  chill_room: {
    id: 'chill_room',
    label: 'Chill Room & View Deck',
    emoji: '☕',
    center: [-12.5, 0, -6.5],
    cameraPos: [-6, 8.5, 2],
    cameraTarget: [-12.5, 1, -7.5],
  },
  game_hub: {
    id: 'game_hub',
    label: 'Game Hub (Arcade)',
    emoji: '🎮',
    center: [12.5, 0, -7.5],
    cameraPos: [6, 8.5, 0],
    cameraTarget: [12.5, 1, -7.5],
  },
  game_room: {
    id: 'game_room',
    label: 'Game Room (Console/PC)',
    emoji: '🕹️',
    center: [12.5, 0, 0.5],
    cameraPos: [5.5, 8.5, 6.5],
    cameraTarget: [12.5, 1, 0.5],
  },
  fun_room: {
    id: 'fun_room',
    label: 'Fun Room (Pool & Karaoke)',
    emoji: '🎱',
    center: [12.5, 0, 8.0],
    cameraPos: [5.5, 8.5, 14.5],
    cameraTarget: [12.5, 1, 8.0],
  },
  rest_room: {
    id: 'rest_room',
    label: 'Rest Room & Nap Pods',
    emoji: '🛋️',
    center: [-12.5, 0, 6.5],
    cameraPos: [-5.5, 8.5, 13.5],
    cameraTarget: [-12.5, 1, 6.5],
  },
};

// 16 workstation coordinates in the Open Villa Marketing Studio
export const OFFICE_DESK_POSITIONS: Array<[number, number, number]> = [
  [-6.2, 0, 2.2],
  [-2.2, 0, 2.2],
  [2.2, 0, 2.2],
  [6.2, 0, 2.2],
  [-6.2, 0, 5.4],
  [-2.2, 0, 5.4],
  [2.2, 0, 5.4],
  [6.2, 0, 5.4],
  [-6.2, 0, 8.6],
  [-2.2, 0, 8.6],
  [2.2, 0, 8.6],
  [6.2, 0, 8.6],
  [-6.2, 0, 11.2],
  [-2.2, 0, 11.2],
  [2.2, 0, 11.2],
  [6.2, 0, 11.2],
];

export function getAgentTargetPosition(
  agent: AgentProfile,
  allAgents: AgentProfile[],
  indexInList: number
): [number, number, number] {
  if (agent.currentRoom === 'office') {
    const desk = OFFICE_DESK_POSITIONS[agent.deskIndex % OFFICE_DESK_POSITIONS.length];
    // Stand/sit slightly behind desk chair (+0.65 z) facing monitor (-z)
    return [desk[0], 0, desk[2] + 0.68];
  }

  if (agent.currentRoom === 'head_suite') {
    // Line up politely in front of Head DM Suite desk
    const waitingPeers = allAgents.filter((a) => a.currentRoom === 'head_suite');
    const slot = Math.max(0, waitingPeers.findIndex((a) => a.id === agent.id));
    const offsetX = (slot - (waitingPeers.length - 1) / 2) * 1.45;
    return [offsetX, 0, -6.5];
  }

  if (agent.currentRoom === 'meeting_hub') {
    // Circle around the Central Briefing Table (0, 0, -2.2)
    const meetingPeers = allAgents.filter((a) => a.currentRoom === 'meeting_hub');
    const slot = Math.max(0, meetingPeers.findIndex((a) => a.id === agent.id));
    const angle = (slot / Math.max(1, meetingPeers.length)) * Math.PI * 2 + 0.4;
    return [Math.cos(angle) * 2.35, 0, -2.2 + Math.sin(angle) * 1.65];
  }

  // Leisure / specialized rooms: spread characters naturally around room center so they never overlap!
  const roomMeta = VILLA_ROOMS[agent.currentRoom] || VILLA_ROOMS.chill_room;
  const peersInRoom = allAgents.filter((a) => a.currentRoom === agent.currentRoom);
  const slot = Math.max(0, peersInRoom.findIndex((a) => a.id === agent.id));
  const angle = slot * 1.35 + (indexInList % 3) * 0.4;
  const radius = peersInRoom.length <= 1 ? 0.6 : 1.55;

  return [
    roomMeta.center[0] + Math.cos(angle) * radius,
    0,
    roomMeta.center[2] + Math.sin(angle) * radius,
  ];
}
