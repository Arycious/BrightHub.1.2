'use client';

import { useStore } from '@/lib/store';
import { useMemo, useState, useCallback } from 'react';
import { t } from '@/lib/i18n';

export function TopSuspects() {
  const users = useStore((s) => s.users);
  const locale = useStore((s) => s.locale);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const suspects = useMemo(() => {
    return Array.from(users.values())
      .filter((u) => u.botScore > 100)
      .sort((a, b) => b.botScore - a.botScore)
      .slice(0, 10);
  }, [users]);

  return (
    <div className="glass-card rounded-card flex flex-col h-[380px]">
      <div className="px-4 py-2.5 border-b border-bright-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs">🎯</span>
          <h2 className="text-xs font-semibold text-bright-text uppercase tracking-wider">{T('suspects.title')}</h2>
        </div>
        <span className="text-[10px] text-bright-dim font-mono">{suspects.length}</span>
      </div>

      <div className="flex-1 overflow-auto p-2 space-y-1">
        {suspects.length === 0 ? (
          <div className="flex items-center justify-center h-full text-bright-dim text-xs">
            <div className="text-center">
              <p className="text-2xl mb-1.5 opacity-40">✅</p>
              <p>{T('suspects.empty')}</p>
            </div>
          </div>
        ) : (
          suspects.map((suspect, index) => (
            <SuspectRow key={suspect.username} suspect={suspect} rank={index + 1} />
          ))
        )}
      </div>
    </div>
  );
}

function SuspectRow({ suspect, rank }: {
  suspect: { username: string; displayName: string; botScore: number; karmaScore: number; totalFlags: number; botThreatLevel: string; noLiferFlag: boolean };
  rank: number;
}) {
  const locale = useStore((s) => s.locale);
  const T = (key: Parameters<typeof t>[1]) => t(locale, key);
  const setSelectedUser = useStore((s) => s.setSelectedUser);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`/timeout ${suspect.username} 600`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [suspect.username]);

  const config = {
    confirmed_bot: { border: 'border-bright-danger/20', label: T('suspects.bot'), labelColor: 'bg-bright-danger text-white', scoreColor: 'text-bright-danger' },
    likely_bot: { border: 'border-orange-500/15', label: locale === 'de' ? 'WAHRSCH.' : 'LIKELY', labelColor: 'bg-orange-500 text-white', scoreColor: 'text-orange-400' },
    suspicious: { border: 'border-bright-warning/15', label: T('suspects.suspicious'), labelColor: 'bg-bright-warning text-black', scoreColor: 'text-bright-warning' },
    clean: { border: 'border-bright-border', label: '', labelColor: '', scoreColor: 'text-bright-muted' },
  }[suspect.botThreatLevel] || { border: 'border-bright-border', label: '', labelColor: '', scoreColor: 'text-bright-muted' };

  const barWidth = Math.max(0, Math.min(100, (suspect.botScore / 700) * 100));

  return (
    <div
      className={`border ${config.border} rounded-xl p-2.5 transition-all hover:bg-bright-elevated/30 cursor-pointer group`}
      onClick={() => setSelectedUser(suspect.username)}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-mono text-bright-dim w-4 text-right shrink-0">
          {rank}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-bright-text truncate">
              {suspect.displayName}
            </span>
            {config.label && (
              <span className={`${config.labelColor} text-[8px] font-bold px-1 py-px rounded uppercase tracking-wider leading-none`}>
                {config.label}
              </span>
            )}
            {suspect.noLiferFlag && (
              <span className="text-[8px] font-bold px-1 py-px rounded uppercase tracking-wider leading-none bg-orange-300/20 text-orange-300">
                NL
              </span>
            )}
          </div>
          <div className="mt-1 h-1 bg-bright-bg rounded-full overflow-hidden">
            <div
              className="h-full score-bar-gradient rounded-full transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>

        {/* Copy Timeout */}
        <button
          onClick={handleCopy}
          className={`shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[10px] transition-all opacity-0 group-hover:opacity-100 ${
            copied ? 'bg-bright-success/15 text-bright-success' : 'text-bright-dim hover:text-bright-muted hover:bg-bright-elevated'
          }`}
          title={copied ? T('suspects.copied') : T('suspects.copyTimeout')}
        >
          {copied ? '✓' : '📋'}
        </button>

        <span className={`${config.scoreColor} text-xs font-mono font-bold min-w-[36px] text-right shrink-0 tabular-nums`}>
          {suspect.botScore}
        </span>
      </div>
    </div>
  );
}
