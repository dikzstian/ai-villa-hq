import React, { useMemo, useRef, useState } from 'react';
import { AgentProfile } from '../../types';

interface MentionOption {
  tag: string;
  label: string;
  role: string;
  emoji: string;
}

interface MentionTextareaProps {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  agents: AgentProfile[];
  excludeCurrentAgentId?: string;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}

export const MentionTextarea: React.FC<MentionTextareaProps> = ({
  value,
  onChange,
  onSubmit,
  agents,
  excludeCurrentAgentId,
  placeholder,
  rows = 2,
  disabled = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [cursorPos, setCursorPos] = useState<number>(0);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  const allOptions: MentionOption[] = useMemo(() => {
    const items: MentionOption[] = [
      {
        tag: 'semua',
        label: '@semua (Seluruh Tim)',
        role: 'Koordinasikan ke semua 11 spesialis',
        emoji: '👥',
      },
      ...agents.map((a) => ({
        tag: a.name.split(/\s+/)[0].toLowerCase(),
        label: `@${a.name.split(/\s+/)[0].toLowerCase()} (${a.name})`,
        role: a.role,
        emoji: a.avatarEmoji || '🤖',
      })),
    ];
    return items;
  }, [agents]);

  // Detect active @query right before cursor
  const activeMentionQuery = useMemo(() => {
    const beforeCursor = value.slice(0, cursorPos);
    const m = /(?:^|\s)@([a-zA-Z0-9_-]*)$/.exec(beforeCursor);
    if (!m) return null;
    return {
      query: m[1].toLowerCase(),
      replaceStart: beforeCursor.lastIndexOf('@'),
      replaceEnd: cursorPos,
    };
  }, [value, cursorPos]);

  const filteredOptions = useMemo(() => {
    if (!activeMentionQuery) return [];
    const q = activeMentionQuery.query;
    return allOptions.filter(
      (opt) =>
        opt.tag.includes(q) ||
        opt.label.toLowerCase().includes(q) ||
        opt.role.toLowerCase().includes(q)
    );
  }, [activeMentionQuery, allOptions]);

  const insertMentionTag = (tag: string) => {
    const el = textareaRef.current;
    if (activeMentionQuery) {
      const prefix = value.slice(0, activeMentionQuery.replaceStart);
      const suffix = value.slice(activeMentionQuery.replaceEnd);
      const inserted = `@${tag} `;
      const nextVal = `${prefix}${inserted}${suffix}`;
      const nextCursor = prefix.length + inserted.length;
      onChange(nextVal);
      setCursorPos(nextCursor);
      setTimeout(() => {
        if (el) {
          el.focus();
          el.setSelectionRange(nextCursor, nextCursor);
        }
      }, 0);
      return;
    }

    // Quick-pill click when no '@' is currently being typed
    const needsSpace = value.length > 0 && !/\s$/.test(value);
    const appended = `${value}${needsSpace ? ' ' : ''}@${tag} `;
    onChange(appended);
    setCursorPos(appended.length);
    setTimeout(() => {
      if (el) {
        el.focus();
        el.setSelectionRange(appended.length, appended.length);
      }
    }, 0);
  };

  const quickTagAgents = useMemo(() => {
    return agents.filter((a) => a.id !== excludeCurrentAgentId);
  }, [agents, excludeCurrentAgentId]);

  return (
    <div className="relative flex-1 min-w-0 space-y-1.5">
      {/* Floating @mention Autocomplete Menu */}
      {activeMentionQuery && filteredOptions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-2 z-50 max-h-56 overflow-y-auto rounded-2xl bg-slate-950/98 border border-indigo-500/50 shadow-2xl p-1.5 space-y-0.5 backdrop-blur-xl">
          <div className="px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-indigo-300">
            Tag Spesialis untuk Kolaborasi / Estafet Tugas (↑↓ + Enter)
          </div>
          {filteredOptions.map((opt, idx) => {
            const active = idx === Math.min(selectedIndex, filteredOptions.length - 1);
            return (
              <button
                key={opt.tag}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMentionTag(opt.tag);
                }}
                className={`w-full px-2.5 py-1.5 rounded-xl text-left flex items-center justify-between gap-2 text-xs transition ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-200 hover:bg-slate-800/90'
                }`}
              >
                <span className="flex items-center gap-2 font-bold truncate">
                  <span>{opt.emoji}</span>
                  <span>{opt.label}</span>
                </span>
                <span
                  className={`text-[10px] truncate ${
                    active ? 'text-indigo-100' : 'text-slate-400'
                  }`}
                >
                  {opt.role}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Quick 1-Click @Tag Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar">
        <span className="text-[10px] font-bold text-slate-400 shrink-0 mr-0.5">
          Tag Oper:
        </span>
        <button
          type="button"
          onClick={() => insertMentionTag('semua')}
          className="px-2 py-0.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 text-[10.5px] font-bold shrink-0 transition"
          title="Arahkan ke seluruh 11 spesialis"
        >
          👥 @semua
        </button>
        {quickTagAgents.map((ag) => {
          const shortTag = ag.name.split(/\s+/)[0].toLowerCase();
          return (
            <button
              key={ag.id}
              type="button"
              onClick={() => insertMentionTag(shortTag)}
              className="px-2 py-0.5 rounded-lg bg-slate-800/90 hover:bg-indigo-600/35 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white text-[10.5px] font-semibold shrink-0 transition"
              title={`Tag @${shortTag} (${ag.role})`}
            >
              {ag.avatarEmoji} @{shortTag}
            </button>
          );
        })}
      </div>

      <textarea
        ref={textareaRef}
        rows={rows}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setCursorPos(e.target.selectionStart || 0);
          setSelectedIndex(0);
        }}
        onClick={(e) => setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0)}
        onKeyUp={(e) => {
          if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            setCursorPos((e.target as HTMLTextAreaElement).selectionStart || 0);
          }
        }}
        onKeyDown={(e) => {
          if (activeMentionQuery && filteredOptions.length > 0) {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelectedIndex((prev) => (prev + 1) % filteredOptions.length);
              return;
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelectedIndex(
                (prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length
              );
              return;
            }
            if (e.key === 'Enter' || e.key === 'Tab') {
              e.preventDefault();
              const chosen =
                filteredOptions[Math.min(selectedIndex, filteredOptions.length - 1)];
              if (chosen) insertMentionTag(chosen.tag);
              return;
            }
            if (e.key === 'Escape') {
              setCursorPos(0);
              return;
            }
          }

          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="w-full min-h-[48px] max-h-40 resize-y bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-[13px] text-white leading-relaxed focus:outline-none focus:border-indigo-500"
      />
    </div>
  );
};
