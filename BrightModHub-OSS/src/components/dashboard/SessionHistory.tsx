'use client';

import { useStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { t } from '@/lib/i18n';

interface SessionRecord {
  id: number;
  channel: string;
  startedAt: string;
  endedAt: string | null;
  totalUsers: number;
  totalFlags: number;
}

export function SessionHistory() {
  const locale = useStore((s) => s.locale);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const T = (key: Parameters<typeof t>[1]) => t(locale, key);
  const timeLocale = locale === 'de' ? 'de-DE' : 'en-GB';

  useEffect(() => {
    fetch('/api/sessions')
      .then((res) => res.json())
      .then((data) => { setSessions(data.sessions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="glass-card rounded-card overflow-hidden animate-fade-in">
      <div className="px-4 py-2.5 border-b border-bright-border flex items-center gap-2">
        <span className="text-xs">📜</span>
        <h2 className="text-xs font-semibold text-bright-text uppercase tracking-wider">{T('history.title')}</h2>
      </div>

      <div className="overflow-auto max-h-[500px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-bright-surface z-10">
            <tr className="border-b border-bright-border">
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider">{T('history.channel')}</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider">{T('history.started')}</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider">{T('history.ended')}</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider">{T('history.users')}</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider">{T('history.flags')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-bright-dim text-xs">Loading...</td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-bright-dim text-xs">{T('history.empty')}</td>
              </tr>
            ) : (
              sessions.map((session) => (
                <tr key={session.id} className="border-b border-bright-border/30 hover:bg-bright-elevated/20 transition-colors">
                  <td className="px-3 py-2">
                    <span className="font-mono text-bright-accent">#{session.channel}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-bright-dim">
                    {formatDate(session.startedAt, timeLocale)}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {session.endedAt ? (
                      <span className="text-bright-dim">{formatDate(session.endedAt, timeLocale)}</span>
                    ) : (
                      <span className="text-bright-success text-[9px] font-bold px-1 py-px bg-bright-success/10 rounded uppercase">
                        {T('history.active')}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 font-mono text-bright-dim tabular-nums">{session.totalUsers}</td>
                  <td className="px-3 py-2 font-mono tabular-nums">
                    {session.totalFlags > 0 ? (
                      <span className="text-bright-warning">{session.totalFlags}</span>
                    ) : <span className="text-bright-dim">0</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDate(iso: string, locale: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
