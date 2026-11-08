import { AgentProfile, CommsMessage } from '../types.ts';
import { saveAgentReportToDisk } from './fileConnector.ts';
import { generateAgentResponse } from './llmEngine.ts';
import { processNadiaNotionAutoInputInReply } from './notionEngine.ts';
import { HERMES_WORKSPACE_DIR, storage } from './storage.ts';

interface DelegatedTaskItem {
  agent: AgentProfile;
  customInstruction?: string;
}

function normalizeToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .trim();
}

function matchAgentByToken(rawToken: string, agents: AgentProfile[]): AgentProfile | null {
  const tok = normalizeToken(rawToken);
  if (!tok || tok.length < 2) return null;

  // Exact match on id or first word of name
  for (const ag of agents) {
    const firstName = normalizeToken(ag.name.split(/\s+/)[0]);
    const fullName = normalizeToken(ag.name);
    const cleanId = normalizeToken(ag.id);
    if (tok === firstName || tok === fullName || tok === cleanId) {
      return ag;
    }
  }

  // Common Indonesian role aliases
  const roleAliasMap: Record<string, string> = {
    sosmed: 'social-media',
    riset: 'research',
    analisis: 'research',
    design: 'designer',
    desainer: 'designer',
    video: 'videographer',
    editor: 'videographer',
    konten: 'content-creator',
    creator: 'content-creator',
    iklan: 'ads',
  };
  if (roleAliasMap[tok]) {
    return agents.find((a) => a.id === roleAliasMap[tok]) || null;
  }

  return null;
}

/**
 * Extracts ordered @mentions AND natural Indonesian handoff targets (e.g. "berikan ke Nadia", "oper ke Reza dan Tiara").
 */
export function parseMultiAgentPlan(params: {
  prompt: string;
  defaultLeadAgentId?: string;
}): {
  leadAgent: AgentProfile;
  downstreamTasks: DelegatedTaskItem[];
  isBroadcastAll: boolean;
} {
  const agents = storage.getAgents();
  const { prompt, defaultLeadAgentId } = params;
  const text = String(prompt || '').trim();

  // 1. Collect explicit @mentions in order of appearance
  const mentionRegex = /@([a-zA-Z0-9_-]+)/g;
  const orderedMentionedAgents: AgentProfile[] = [];
  let hasMentionAll = false;
  let firstMentionIsAll = false;
  let match: RegExpExecArray | null;

  while ((match = mentionRegex.exec(text)) !== null) {
    const rawTag = match[1].toLowerCase();
    if (rawTag === 'semua' || rawTag === 'all' || rawTag === 'tim' || rawTag === 'team') {
      if (orderedMentionedAgents.length === 0 && match.index < 18) {
        firstMentionIsAll = true;
      }
      hasMentionAll = true;
      continue;
    }
    const ag = matchAgentByToken(rawTag, agents);
    if (ag && !orderedMentionedAgents.some((x) => x.id === ag.id)) {
      orderedMentionedAgents.push(ag);
    }
  }

  // 2. Also detect natural Indonesian handoff phrases even if user didn't type '@'
  // e.g. "berikan ke nadia", "oper ke nadia dan reza", "serahkan ke semua individu"
  const handoffPhraseRegex =
    /\b(?:berikan|oper|kasih|kirim(?:kan)?|lanjut(?:kan)?|serahkan|teruskan|arahkan|delegasi(?:kan)?|koordinasi(?:kan)?|minta)\s+(?:hasil(?:nya)?\s+|ide(?:nya)?\s+|data(?:nya)?\s+)?(?:ke|kepada|sama)\s+([^.!?\n]+)/gi;

  const naturalDownstreamAgents: AgentProfile[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = handoffPhraseRegex.exec(text)) !== null) {
    const clause = hm[1].toLowerCase();
    if (/\b(semua|seluruh\s+tim|semua\s+individu|semua\s+orang|all)\b/i.test(clause)) {
      hasMentionAll = true;
    }
    const words = clause
      .split(/[\s,&/]+|(?:dan|serta|lalu|kemudian|biar|agar|untuk|supaya)/i)
      .map((w) => w.replace(/^@/, '').trim())
      .filter(Boolean);

    for (const w of words) {
      const ag = matchAgentByToken(w, agents);
      if (ag && !naturalDownstreamAgents.some((x) => x.id === ag.id)) {
        naturalDownstreamAgents.push(ag);
      }
    }
  }

  // 3. Determine Lead Agent
  let leadAgent: AgentProfile | null = null;

  if (defaultLeadAgentId) {
    // Inside 1-on-1 AgentDrawer: if prompt explicitly starts with "@otherAgent ...", let otherAgent lead; else current drawer agent leads!
    const startsWithExplicitTag = /^@([a-zA-Z0-9_-]+)/.exec(text);
    if (startsWithExplicitTag) {
      const taggedFirst = matchAgentByToken(startsWithExplicitTag[1], agents);
      if (taggedFirst) {
        leadAgent = taggedFirst;
      }
    }
    if (!leadAgent) {
      leadAgent = storage.getAgent(defaultLeadAgentId) || agents[0];
    }
  } else {
    // Inside TeamCommsFeed:
    if (!firstMentionIsAll && orderedMentionedAgents.length > 0) {
      leadAgent = orderedMentionedAgents[0];
    } else {
      // Check if user started sentence with an agent's name without '@', e.g. "Arka, tolong carikan..."
      const firstWords = text.slice(0, 40).split(/[\s,.:!]+/);
      for (const fw of firstWords.slice(0, 3)) {
        const found = matchAgentByToken(fw, agents);
        if (found) {
          leadAgent = found;
          break;
        }
      }
      if (!leadAgent) {
        // Default coordinator: Bima (Campaign)
        leadAgent = storage.getAgent('campaign') || agents[0];
      }
    }
  }

  // 4. Build Downstream Agents list (excluding leadAgent)
  const downstreamList: AgentProfile[] = [];
  if (hasMentionAll) {
    for (const ag of agents) {
      if (ag.id !== leadAgent.id) {
        downstreamList.push(ag);
      }
    }
  } else {
    for (const ag of [...orderedMentionedAgents, ...naturalDownstreamAgents]) {
      if (ag.id !== leadAgent.id && !downstreamList.some((x) => x.id === ag.id)) {
        downstreamList.push(ag);
      }
    }
  }

  return {
    leadAgent,
    downstreamTasks: downstreamList.map((agent) => ({ agent })),
    isBroadcastAll: hasMentionAll,
  };
}

/**
 * Extracts optional ```team-handoff ... ``` JSON block emitted autonomously by the Lead Agent
 * when Bos asks 1 agent to pick & direct relevant teammates without tagging them explicitly.
 */
function extractAutonomousTeamHandoff(
  rawContent: string,
  leadAgentId: string
): {
  cleanedContent: string;
  delegated: DelegatedTaskItem[];
} {
  const regex = /```team-handoff\s*([\s\S]*?)```/i;
  const match = regex.exec(rawContent);
  if (!match) {
    return { cleanedContent: rawContent, delegated: [] };
  }

  const cleanedContent = rawContent.replace(regex, '').trim();
  const agents = storage.getAgents();
  const delegated: DelegatedTaskItem[] = [];

  try {
    const parsed = JSON.parse(match[1].trim());
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    for (const item of arr) {
      const rawTarget = String(item?.agentId || item?.agent || item?.name || '').trim();
      const instruction = String(item?.instruction || item?.task || '').trim();
      if (rawTarget.toLowerCase() === 'all' || rawTarget.toLowerCase() === 'semua') {
        for (const ag of agents) {
          if (ag.id !== leadAgentId && !delegated.some((d) => d.agent.id === ag.id)) {
            delegated.push({ agent: ag, customInstruction: instruction || undefined });
          }
        }
      } else {
        const found = matchAgentByToken(rawTarget, agents);
        if (found && found.id !== leadAgentId && !delegated.some((d) => d.agent.id === found.id)) {
          delegated.push({ agent: found, customInstruction: instruction || undefined });
        }
      }
    }
  } catch {
    // ignore malformed JSON
  }

  return { cleanedContent, delegated };
}

/**
 * Executes a single-agent or multi-agent relay chain (1 -> 1, 1 -> several, or 1 -> all)
 * with live 3D walk-to-desk & collaboration states, Notion Calendar read/write integration,
 * and real-time SSE message streaming after every agent step!
 */
export async function executeMultiAgentCommand(params: {
  userPrompt: string;
  originChannel: 'direct' | 'team';
  defaultLeadAgentId?: string;
  forceEngine?: 'hybrid_api' | 'hermes_cli';
  saveAsReport?: boolean;
}): Promise<{
  leadReply: CommsMessage;
  handoffReplies: CommsMessage[];
  involvedAgentNames: string[];
}> {
  const { userPrompt, originChannel, defaultLeadAgentId, forceEngine, saveAsReport } = params;
  const plan = parseMultiAgentPlan({ prompt: userPrompt, defaultLeadAgentId });
  const leadAgent = plan.leadAgent;

  const initialParticipantIds = Array.from(
    new Set([
      ...(defaultLeadAgentId ? [defaultLeadAgentId] : []),
      leadAgent.id,
      ...plan.downstreamTasks.map((t) => t.agent.id),
    ])
  );

  // 1. Record User's Command Message
  storage.addMessage({
    id: `msg-u-${Date.now()}`,
    senderType: 'user',
    senderId: 'head-dm',
    senderName: 'Head of Digital Marketing',
    senderRole: 'Head DM',
    recipientId: originChannel === 'team' ? 'all' : defaultLeadAgentId || leadAgent.id,
    channel: originChannel,
    content:
      originChannel === 'team'
        ? `📢 **ARAHAN KOMANDO TIM:**\n${userPrompt.trim()}`
        : userPrompt.trim(),
    timestamp: new Date().toISOString(),
    relatedAgentIds: initialParticipantIds,
  });

  // 2. Move Lead Agent briskly to their desk to research & execute Stage 1
  const plannedDownstreamNames = plan.downstreamTasks.map((t) => t.agent.name);
  storage.updateAgent(leadAgent.id, (a) => {
    a.currentRoom = 'office';
    a.status = 'working';
    a.deskFocusUntil = Date.now() + 95_000;
    a.targetAgentId = plan.downstreamTasks[0]?.agent.id || null;
    a.statusText =
      plannedDownstreamNames.length > 0
        ? `🔍 Mengerjakan tahap awal & menyiapkan handoff ke ${plannedDownstreamNames.slice(0, 3).join(', ')}...`
        : '🔍 Menuju meja kerja & mencari data di PC untuk menjawab Bos...';
    a.speechBubble =
      plannedDownstreamNames.length > 0
        ? `Siap Bos! Saya ke meja kerja dulu riset datanya, habis ini langsung saya oper ke ${plannedDownstreamNames.slice(0, 2).join(' & ')}! 💻🤝`
        : 'Sebentar ya Bos, saya ke meja kerja dulu cek datanya di komputer! 💻🔍';
    a.speechTimestamp = Date.now();
  });

  const startedAt = Date.now();
  const leadPromptPrefix =
    plannedDownstreamNames.length > 0
      ? `[CATATAN ORKESTRASI TIM: Setelah kamu selesai menjawab bagianmu di bawah ini, sistem Villa HQ akan LANGSUNG mengoper hasil kerjamu secara otomatis ke rekan tim berikut: **${plannedDownstreamNames.join(', ')}** agar mereka langsung lanjut mengeksekusi bagian mereka. Jadi fokuslah menuntaskan bagianmu dengan tajam & jelas sebagai bahan handoff untuk mereka!]\n\nInstruksi Bos:\n${userPrompt}`
      : userPrompt;

  const leadGen = await generateAgentResponse({
    agent: leadAgent,
    userPrompt: leadPromptPrefix,
    forceEngine,
  });

  const elapsed = Date.now() - startedAt;
  if (elapsed < 2000 && plannedDownstreamNames.length === 0) {
    await new Promise((r) => setTimeout(r, 2000 - elapsed));
  }

  // Check if Lead Agent emitted autonomous ```team-handoff``` tasks AND Notion auto-input
  const autoHandoffExtracted = extractAutonomousTeamHandoff(leadGen.content, leadAgent.id);
  const notionProcessedLead = await processNadiaNotionAutoInputInReply(
    leadAgent.id,
    autoHandoffExtracted.cleanedContent
  );

  // Merge explicit @mention/natural downstream tasks with autonomous LLM-delegated tasks
  const finalDownstreamTasks: DelegatedTaskItem[] = [...plan.downstreamTasks];
  for (const autoItem of autoHandoffExtracted.delegated) {
    const existing = finalDownstreamTasks.find((t) => t.agent.id === autoItem.agent.id);
    if (existing) {
      if (!existing.customInstruction && autoItem.customInstruction) {
        existing.customInstruction = autoItem.customInstruction;
      }
    } else {
      finalDownstreamTasks.push(autoItem);
    }
  }

  const allInvolvedIds = Array.from(
    new Set([
      ...(defaultLeadAgentId ? [defaultLeadAgentId] : []),
      leadAgent.id,
      ...finalDownstreamTasks.map((t) => t.agent.id),
    ])
  );

  let leadSavedPath: string | undefined;
  if (saveAsReport || originChannel === 'team') {
    leadSavedPath = saveAgentReportToDisk(
      HERMES_WORKSPACE_DIR,
      leadAgent.id,
      `Output - ${leadAgent.name}`,
      notionProcessedLead.cleanedContent
    );
  }

  const downstreamNamesLabel = finalDownstreamTasks.map((t) => `@${t.agent.name}`).join(', ');
  const leadVisibleContent =
    finalDownstreamTasks.length > 0
      ? `${notionProcessedLead.cleanedContent}\n\n---\n> 🤝 **Estafet Otomatis ke Tim:** Mengoper hasil ini ke **${downstreamNamesLabel}** untuk ditindaklanjuti sekarang...`
      : notionProcessedLead.cleanedContent;

  storage.updateAgent(leadAgent.id, (a) => {
    a.currentRoom = 'office';
    a.status = finalDownstreamTasks.length > 0 ? 'collaborating' : 'working';
    a.deskFocusUntil = Date.now() + 45_000;
    a.targetAgentId = finalDownstreamTasks[0]?.agent.id || null;
    a.statusText =
      finalDownstreamTasks.length > 0
        ? `Mengoper hasil kerja ke ${finalDownstreamTasks.map((t) => t.agent.name).slice(0, 3).join(', ')} 🤝`
        : notionProcessedLead.createdPages.length > 0
        ? `Selesai menginput ${notionProcessedLead.createdPages.length} konten ke Notion Kalender ✅`
        : 'Selesai merespons arahan Head DM di meja kerja';
    a.speechBubble =
      finalDownstreamTasks.length > 0
        ? `Bagian saya sudah beres! @${finalDownstreamTasks[0].agent.name}, silakan lanjut cek & eksekusi ya! 🤝`
        : notionProcessedLead.createdPages.length > 0
        ? `Sudah masuk ${notionProcessedLead.createdPages.length} konten ke Notion Kalender Bos! 📅✅`
        : 'Sudah ketemu datanya Bos, jawabannya sudah saya kirim di chat! ✅';
    a.speechTimestamp = Date.now();
  });

  const leadReply = storage.addMessage({
    id: `msg-a-${Date.now()}-${leadAgent.id}`,
    senderType: 'agent',
    senderId: leadAgent.id,
    senderName: leadAgent.name,
    senderRole: leadAgent.role,
    recipientId: originChannel === 'team' ? 'all' : 'head-dm',
    channel: saveAsReport ? 'report' : originChannel,
    content: leadVisibleContent,
    timestamp: new Date().toISOString(),
    savedFilePath: leadSavedPath,
    engineUsed: leadGen.engineUsed,
    relatedAgentIds: allInvolvedIds,
  });

  // 3. Execute Downstream Agents (Sequential Chain for 1-3 specialists; Parallel Batches of 3 for >3 / @semua)
  const handoffReplies: CommsMessage[] = [];
  if (finalDownstreamTasks.length === 0) {
    return {
      leadReply,
      handoffReplies,
      involvedAgentNames: [leadAgent.name],
    };
  }

  const runSingleDownstream = async (
    task: DelegatedTaskItem,
    accumulatedOutputs: Array<{ agentName: string; role: string; content: string }>
  ): Promise<{ replyMsg: CommsMessage; cleanOutput: string }> => {
    const targetAg = task.agent;

    storage.updateAgent(targetAg.id, (a) => {
      a.currentRoom = 'office';
      a.status = 'working';
      a.deskFocusUntil = Date.now() + 95_000;
      a.targetAgentId = leadAgent.id;
      a.statusText = `🔍 Menindaklanjuti operan tugas dari ${leadAgent.name} di meja kerja...`;
      a.speechBubble = `Siap @${leadAgent.name} & Bos! Saya langsung ke meja kerja buat cek data & tindak lanjuti sekarang! 💻🚀`;
      a.speechTimestamp = Date.now();
    });

    const priorChainText = accumulatedOutputs
      .map(
        (o, idx) =>
          `### Hasil Tahap ${idx + 1} dari ${o.agentName} (${o.role}):\n${o.content}`
      )
      .join('\n\n---\n\n');

    const specificTaskInstruction = task.customInstruction
      ? `Instruksi Khusus dari ${leadAgent.name} untukmu (${targetAg.name}):\n"${task.customInstruction}"\n\nInstruksi Asli dari Head DM (Bos):\n"${userPrompt}"`
      : `Instruksi Asli dari Head DM (Bos):\n"${userPrompt}"\n\nTindak lanjuti hasil dari ${leadAgent.name} di atas sesuai keahlianmu sebagai **${targetAg.name} (${targetAg.role})** secara konkret, tajam, dan siap eksekusi! (Jika kamu Nadia dan diminta cek tanggal / jadwal konten, wajib cek data live 373 baris Notion Konten Kalender di memorimu agar tidak bentrok tanggal!).`;

    const subGen = await generateAgentResponse({
      agent: targetAg,
      userPrompt: specificTaskInstruction,
      priorContext: priorChainText,
      forceEngine,
    });

    // Strip any accidental nested team-handoff (prevent infinite recursion) & run Notion auto-input if Nadia!
    const strippedNested = subGen.content.replace(/```team-handoff[\s\S]*?```/gi, '').trim();
    const notionProcessedSub = await processNadiaNotionAutoInputInReply(
      targetAg.id,
      strippedNested
    );
    const finalSubContent = notionProcessedSub.cleanedContent;

    let subSavedPath: string | undefined;
    if (saveAsReport || originChannel === 'team') {
      subSavedPath = saveAgentReportToDisk(
        HERMES_WORKSPACE_DIR,
        targetAg.id,
        `Handoff Output - ${targetAg.name}`,
        finalSubContent
      );
    }

    storage.updateAgent(targetAg.id, (a) => {
      a.currentRoom = 'office';
      a.status = 'working';
      a.deskFocusUntil = Date.now() + 45_000;
      a.targetAgentId = null;
      a.statusText =
        notionProcessedSub.createdPages.length > 0
          ? `Selesai tindak lanjut & input ${notionProcessedSub.createdPages.length} konten ke Notion ✅`
          : `Selesai menindaklanjuti handoff dari ${leadAgent.name} ✅`;
      a.speechBubble =
        notionProcessedSub.createdPages.length > 0
          ? `Sudah saya cek & masukkan ke Notion Kalender Bos! 📅✅`
          : `Tindak lanjut dari @${leadAgent.name} sudah beres Bos, silakan cek di chat! ✅`;
      a.speechTimestamp = Date.now();
    });

    const replyMsg = storage.addMessage({
      id: `msg-ho-${Date.now()}-${targetAg.id}`,
      senderType: 'agent',
      senderId: targetAg.id,
      senderName: targetAg.name,
      senderRole: targetAg.role,
      recipientId: originChannel === 'team' ? 'all' : 'head-dm',
      channel: saveAsReport ? 'report' : originChannel,
      content: finalSubContent,
      timestamp: new Date().toISOString(),
      savedFilePath: subSavedPath,
      engineUsed: subGen.engineUsed,
      relatedAgentIds: allInvolvedIds,
      handoffFromName: leadAgent.name,
    });

    return { replyMsg, cleanOutput: finalSubContent };
  };

  const accumulatedChain: Array<{ agentName: string; role: string; content: string }> = [
    {
      agentName: leadAgent.name,
      role: leadAgent.role,
      content: notionProcessedLead.cleanedContent,
    },
  ];

  if (finalDownstreamTasks.length <= 3) {
    // Sequential relay (e.g. Arka -> Nadia -> Tiara) so each specialist builds upon the previous specialist's exact output!
    for (const task of finalDownstreamTasks) {
      const res = await runSingleDownstream(task, accumulatedChain);
      handoffReplies.push(res.replyMsg);
      accumulatedChain.push({
        agentName: task.agent.name,
        role: task.agent.role,
        content: res.cleanOutput,
      });
    }
  } else {
    // Parallel fan-out in batches of 3 (e.g. Lead -> @semua 10 specialists) for fast completion!
    const BATCH = 3;
    for (let i = 0; i < finalDownstreamTasks.length; i += BATCH) {
      const slice = finalDownstreamTasks.slice(i, i + BATCH);
      const batchRes = await Promise.all(
        slice.map((task) => runSingleDownstream(task, accumulatedChain))
      );
      for (const r of batchRes) {
        handoffReplies.push(r.replyMsg);
      }
    }
  }

  return {
    leadReply,
    handoffReplies,
    involvedAgentNames: [leadAgent.name, ...finalDownstreamTasks.map((t) => t.agent.name)],
  };
}
