import React, { useCallback, useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import {
  AgentProfile,
  AppStateSnapshot,
  ReminderItem,
  TimeAmbience,
  VillaRoomId,
  VillaScenery,
} from './types';
import { api } from './utils/api';
import { soundFX } from './utils/sound';
import { VILLA_ROOMS } from './utils/villaCoords';
import { VillaScene } from './components/three/VillaScene';
import { TopHudBar } from './components/panels/TopHudBar';
import { AgentDrawer } from './components/panels/AgentDrawer';
import { WorkflowStudio } from './components/panels/WorkflowStudio';
import { CharacterCreatorModal } from './components/panels/CharacterCreatorModal';
import { ReferenceGuideModal } from './components/panels/ReferenceGuideModal';
import { ReminderCenter } from './components/panels/ReminderCenter';
import { TeamCommsFeed } from './components/panels/TeamCommsFeed';
import { SettingsModal } from './components/panels/SettingsModal';
import { SocialBrowserModal } from './components/panels/SocialBrowserModal';
import { NotionCalendarModal } from './components/panels/NotionCalendarModal';
import { MusicPlayerBar } from './components/panels/MusicPlayerBar';
import { ProductFocusModal } from './components/panels/ProductFocusModal';
import { PinnedIdeasModal } from './components/panels/PinnedIdeasModal';
import { Villa2DCommandCenter } from './components/panels/Villa2DCommandCenter';

export const App: React.FC = () => {
  const [snapshot, setSnapshot] = useState<AppStateSnapshot | null>(null);
  const [loadingError, setLoadingError] = useState<string | null>(null);

  // Navigation & Active Panels
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [focusedRoom, setFocusedRoom] = useState<VillaRoomId | null>(null);
  const [freeRoamEnabled, setFreeRoamEnabled] = useState(true);
  const [ecoMode, setEcoMode] = useState<boolean>(() => {
    return localStorage.getItem('villa_eco_mode') !== 'false';
  });
  const [view2DMode, setView2DMode] = useState<boolean>(() => {
    return localStorage.getItem('villa_2d_mode') === 'true';
  });
  const [showCommsFeed, setShowCommsFeed] = useState(false);
  const [showWorkflows, setShowWorkflows] = useState(false);
  const [showProductFocus, setShowProductFocus] = useState(false);
  const [showPinnedIdeas, setShowPinnedIdeas] = useState(false);
  const [showCharacterModal, setShowCharacterModal] = useState(false);
  const [characterEditTarget, setCharacterEditTarget] = useState<AgentProfile | null>(null);
  const [showReferenceModal, setShowReferenceModal] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSocialBrowser, setShowSocialBrowser] = useState(false);
  const [socialBrowserAgentId, setSocialBrowserAgentId] = useState<string>('social-media');
  const [showNotionCalendar, setShowNotionCalendar] = useState(false);
  const [liveToast, setLiveToast] = useState<ReminderItem | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      const data = await api.getState();
      setSnapshot(data);
      setLoadingError(null);
    } catch (err) {
      setLoadingError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
    // Automatically check & sync linked social media tabs as soon as the app opens!
    void api.autoSyncSocialBrowser(true).catch(() => {});

    const handleWindowFocus = () => {
      void api.autoSyncSocialBrowser(false).catch(() => {});
    };
    window.addEventListener('focus', handleWindowFocus);

    // Real-time SSE connection to backend orchestrator
    const sse = new EventSource('/api/events');

    sse.addEventListener('state_updated', (ev) => {
      try {
        const next = JSON.parse((ev as MessageEvent).data) as AppStateSnapshot;
        setSnapshot(next);
      } catch {
        // ignore parse errors
      }
    });

    sse.addEventListener('reminder_triggered', (ev) => {
      try {
        const rem = JSON.parse((ev as MessageEvent).data) as ReminderItem;
        setLiveToast(rem);
        soundFX.playReminderChime(rem.severity === 'urgent');

        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          new Notification(rem.title, { body: rem.message });
        }
      } catch {
        // ignore
      }
    });

    sse.onerror = () => {
      // EventSource automatically reconnects
    };

    return () => {
      window.removeEventListener('focus', handleWindowFocus);
      sse.close();
    };
  }, [fetchSnapshot]);

  if (!snapshot) {
    return (
      <div className="w-screen h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center text-3xl animate-bounce shadow-xl mb-4">
          🏡
        </div>
        <h1 className="text-lg font-extrabold text-white">
          Menyiapkan Digital Marketing 3D Villa HQ...
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Memuat 11 Spesialis AI Agent & sinkronisasi folder hermes_workspace
        </p>
        {loadingError && (
          <div className="mt-4 px-4 py-2.5 rounded-xl bg-rose-950/70 border border-rose-500/50 text-xs text-rose-200">
            Pastikan backend berjalan di port 3001 ({loadingError})
          </div>
        )}
      </div>
    );
  }

  const { config, agents, workflows, workflowRuns, reminders, messages, isWorkingHoursNow } =
    snapshot;

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || null;
  const unreadReminderCount = reminders.filter((r) => !r.acknowledged).length;
  const waitingApprovalCount = workflowRuns.filter(
    (r) => r.status === 'waiting_approval'
  ).length;

  const handleChangeScenery = async (scenery: VillaScenery) => {
    soundFX.playSoftClick();
    await api.updateConfig({ villa: { ...config.villa, scenery } });
    void fetchSnapshot();
  };

  const handleChangeAmbience = async (ambience: TimeAmbience) => {
    await api.updateConfig({ villa: { ...config.villa, ambience } });
    void fetchSnapshot();
  };

  const handleToggleForceWorkHours = async () => {
    soundFX.playSoftClick();
    await api.updateConfig({
      workHours: {
        ...config.workHours,
        forceActiveOutsideHours: !config.workHours.forceActiveOutsideHours,
      },
    });
    void fetchSnapshot();
  };

  const anyModalOpen =
    showWorkflows ||
    showProductFocus ||
    showPinnedIdeas ||
    showCharacterModal ||
    showReferenceModal ||
    showReminders ||
    showSettings ||
    showSocialBrowser ||
    showNotionCalendar;

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-slate-950 select-none">
      {/* Full-Screen Interactive 3D Villa Scene OR Zero-GPU 2D Command Center */}
      {view2DMode ? (
        <Villa2DCommandCenter
          agents={agents}
          config={config}
          workflowRuns={workflowRuns}
          selectedAgentId={selectedAgentId}
          focusedRoom={focusedRoom}
          onSelectAgent={(id) => {
            soundFX.playSoftClick();
            setSelectedAgentId(id);
          }}
          onSelectRoom={(room) => {
            soundFX.playSoftClick();
            setSelectedAgentId(null);
            setFocusedRoom(room);
          }}
          onOpenWorkflows={() => setShowWorkflows(true)}
          onOpenProductFocus={() => setShowProductFocus(true)}
          onRefreshState={fetchSnapshot}
        />
      ) : (
        <VillaScene
          agents={agents}
          workflowRuns={workflowRuns}
          scenery={config.villa.scenery}
          ambience={config.villa.ambience}
          freeRoamEnabled={freeRoamEnabled}
          selectedAgentId={selectedAgentId}
          focusedRoom={focusedRoom}
          ecoMode={ecoMode}
          isPaused={anyModalOpen}
          onSelectAgent={(id) => {
            soundFX.playSoftClick();
            setSelectedAgentId(id);
          }}
          onSelectRoom={(room) => {
            soundFX.playSoftClick();
            setSelectedAgentId(null);
            setFocusedRoom(room);
          }}
        />
      )}

      {/* Top Glassmorphic Command HUD */}
      <TopHudBar
        config={config}
        isWorkingHoursNow={isWorkingHoursNow}
        unreadReminderCount={unreadReminderCount}
        waitingApprovalCount={waitingApprovalCount}
        pinnedIdeasCount={snapshot.pinnedIdeas?.length || 0}
        focusedRoom={focusedRoom}
        freeRoamEnabled={freeRoamEnabled}
        ecoMode={ecoMode}
        view2DMode={view2DMode}
        onToggleFreeRoam={() => {
          soundFX.playSoftClick();
          setFreeRoamEnabled((v) => !v);
        }}
        onToggleEcoMode={() => {
          soundFX.playSoftClick();
          setEcoMode((prev) => {
            const next = !prev;
            localStorage.setItem('villa_eco_mode', String(next));
            return next;
          });
        }}
        onToggleView2DMode={() => {
          soundFX.playSoftClick();
          setView2DMode((prev) => {
            const next = !prev;
            localStorage.setItem('villa_2d_mode', String(next));
            return next;
          });
        }}
        onFocusRoom={(room) => {
          setSelectedAgentId(null);
          setFocusedRoom(room);
        }}
        onChangeScenery={handleChangeScenery}
        onChangeAmbience={handleChangeAmbience}
        onToggleForceWorkHours={handleToggleForceWorkHours}
        onOpenWorkflows={() => setShowWorkflows(true)}
        onOpenProductFocus={() => setShowProductFocus(true)}
        onOpenPinnedIdeas={() => setShowPinnedIdeas(true)}
        onOpenSocialBrowser={() => {
          setSocialBrowserAgentId('social-media');
          setShowSocialBrowser(true);
        }}
        onOpenNotionCalendar={() => setShowNotionCalendar(true)}
        onOpenComms={() => setShowCommsFeed((v) => !v)}
        onOpenCharacterCreator={() => {
          setCharacterEditTarget(null);
          setShowCharacterModal(true);
        }}
        onOpenReferences={() => setShowReferenceModal(true)}
        onOpenReminders={() => setShowReminders(true)}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Built-In Villa Music & Ambience Radio + Local MP3 Player */}
      <MusicPlayerBar />

      {/* Live Floating Alert Banner when a Reminder Fires */}
      {liveToast && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4">
          <div className="p-3.5 rounded-2xl bg-slate-950/95 border-2 border-amber-400 shadow-2xl flex items-start justify-between gap-3">
            <div
              className="cursor-pointer"
              onClick={() => {
                setLiveToast(null);
                setShowReminders(true);
              }}
            >
              <div className="text-xs font-extrabold text-amber-300">🔔 {liveToast.title}</div>
              <div className="text-xs text-slate-200 mt-0.5">{liveToast.message}</div>
            </div>
            <button
              onClick={() => setLiveToast(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Left Slide-Over: Live Inter-Agent Comms & Daily Brief */}
      {showCommsFeed && (
        <TeamCommsFeed
          agents={agents}
          messages={messages}
          onClose={() => setShowCommsFeed(false)}
          onSelectAgent={(id) => setSelectedAgentId(id)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {/* Right Slide-Over: Selected Specialist Inspector (Chat, Jobdesk 9-5, SOUL.md, Local Files) */}
      {selectedAgent && (
        <AgentDrawer
          agent={selectedAgent}
          agents={agents}
          messages={messages}
          onClose={() => setSelectedAgentId(null)}
          onEditAppearance={(ag) => {
            setCharacterEditTarget(ag);
            setShowCharacterModal(true);
          }}
          onOpenSocialBrowser={(agId) => {
            setSocialBrowserAgentId(agId);
            setShowSocialBrowser(true);
          }}
          onOpenNotionCalendar={() => setShowNotionCalendar(true)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {/* Bottom Specialist Roster Dock */}
      <footer className="fixed bottom-3 left-3 right-3 z-30 pointer-events-none flex justify-center">
        <div className="pointer-events-auto max-w-full bg-slate-950/95 border border-slate-800/90 rounded-2xl px-3 py-2 shadow-2xl flex items-center gap-1.5 overflow-x-auto">
          {agents.map((ag) => {
            const active = selectedAgentId === ag.id;
            const dotColor =
              ag.status === 'late_report'
                ? 'bg-rose-500'
                : ag.status === 'waiting_user'
                ? 'bg-amber-400'
                : ag.status === 'collaborating'
                ? 'bg-indigo-400'
                : ag.status === 'working'
                ? 'bg-emerald-400'
                : 'bg-cyan-400';

            return (
              <button
                key={ag.id}
                onClick={() => {
                  soundFX.playSoftClick();
                  setSelectedAgentId(active ? null : ag.id);
                }}
                title={`${ag.name} — ${ag.role} (${VILLA_ROOMS[ag.currentRoom]?.label})`}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition shrink-0 ${
                  active
                    ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg scale-[1.03]'
                    : 'bg-slate-900/90 border-slate-800 text-slate-200 hover:border-slate-600'
                }`}
              >
                <span className="relative flex items-center justify-center text-base">
                  {ag.avatarEmoji}
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ${dotColor}`}
                  />
                </span>
                <div className="text-left leading-tight">
                  <div className="text-[11px] font-extrabold">{ag.name}</div>
                  <div
                    className={`text-[9px] truncate max-w-[96px] ${
                      active ? 'text-indigo-100' : 'text-slate-400'
                    }`}
                  >
                    {ag.role.replace(' Spesialist', '')}
                  </div>
                </div>
              </button>
            );
          })}

          <button
            onClick={() => {
              setCharacterEditTarget(null);
              setShowCharacterModal(true);
            }}
            title="Tambah Spesialis / 3D Character Baru"
            className="px-3 py-2 rounded-xl bg-pink-600/20 hover:bg-pink-600/35 border border-pink-500/40 text-pink-300 text-xs font-bold flex items-center gap-1 shrink-0 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Character</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      {showWorkflows && (
        <WorkflowStudio
          workflows={workflows}
          workflowRuns={workflowRuns}
          agents={agents}
          onClose={() => setShowWorkflows(false)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showProductFocus && (
        <ProductFocusModal
          config={config}
          onClose={() => setShowProductFocus(false)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showPinnedIdeas && (
        <PinnedIdeasModal
          pinnedIdeas={snapshot.pinnedIdeas || []}
          onClose={() => setShowPinnedIdeas(false)}
          onSelectAgent={(id) => setSelectedAgentId(id)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showCharacterModal && (
        <CharacterCreatorModal
          agents={agents}
          initialAgent={characterEditTarget}
          onClose={() => setShowCharacterModal(false)}
          onOpenReferenceGuide={() => {
            setShowCharacterModal(false);
            setShowReferenceModal(true);
          }}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showReferenceModal && (
        <ReferenceGuideModal onClose={() => setShowReferenceModal(false)} />
      )}

      {showReminders && (
        <ReminderCenter
          reminders={reminders}
          agents={agents}
          onClose={() => setShowReminders(false)}
          onOpenWorkflows={() => setShowWorkflows(true)}
          onOpenBriefComposer={() => setShowCommsFeed(true)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showSettings && (
        <SettingsModal
          config={config}
          onClose={() => setShowSettings(false)}
          onRefreshState={fetchSnapshot}
        />
      )}

      {showSocialBrowser && (
        <SocialBrowserModal
          agents={agents}
          defaultAgentId={socialBrowserAgentId}
          onClose={() => setShowSocialBrowser(false)}
          onRefreshState={fetchSnapshot}
          onOpenAgentChat={(agId) => setSelectedAgentId(agId)}
        />
      )}

      {showNotionCalendar && (
        <NotionCalendarModal
          onClose={() => setShowNotionCalendar(false)}
          onRefreshState={fetchSnapshot}
          onOpenNadiaChat={() => setSelectedAgentId('social-media')}
        />
      )}
    </div>
  );
};

export default App;
