'use client';

import { useStore } from '@/lib/store';
import { useState, useCallback, useMemo } from 'react';
import { t } from '@/lib/i18n';

export function UserDetailPanel({ username }: { username: string }) {
  const user = useStore((s) => s.users.get(username));
  const chatMessages = useStore((s) => s.chatMessages);
  const liveEvents = useStore((s) => s.liveEvents);
  const whitelist = useStore((s) => s.whitelist);
  const locale = useStore((s) => s.locale);
  const setSelectedUser = useStore((s) => s.setSelectedUser);
  const toggleWhitelist = useStore((s) => s.toggleWhitelist);
  const [copied, setCopied] = useState(false);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);
  const isWL = whitelist.has(username);
  const timeLocale = locale === 'de' ? 'de-DE' : 'en-GB';

  const userMessages = useMemo(() =>
    chatMessages.filter((m) => m.username === username).slice(0, 25),
    [chatMessages, username]
  );

  const userEvents = useMemo(() =>
    liveEvents.filter((e) => e.username === username).slice(0, 15),
    [liveEvents, username]
  );

  const handleCopyTimeout = useCallback(() => {
    navigator.clipboard.writeText(`/timeout ${username} 600`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [username]);

  if (!user) return null;

  const botScoreColor = {
    confirmed_bot: 'text-bright-danger',
    likely_bot: 'text-orange-400',
    suspicious: 'text-bright-warning',
    clean: 'text-bright-success',
  }[user.botThreatLevel] || 'text-bright-muted';

  const dotColor = {
    confirmed_bot: 'bg-bright-danger',
    likely_bot: 'bg-orange-500',
    suspicious: 'bg-bright-warning',
    clean: 'bg-bright-success',
  }[user.botThreatLevel] || 'bg-bright-dim';

  const karmaColor = user.karmaLevel === 'trusted'
    ? 'text-bright-success'
    : user.karmaLevel === 'flagged'
      ? 'text-bright-warning'
      : 'text-bright-dim';

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 animate-fade-in" onClick={() => setSelectedUser(null)} />

      <div className="fixed right-0 top-0 bottom-0 w-[420px] bg-bright-surface border-l border-bright-border z-50 flex flex-col overflow-hidden shadow-panel animate-slide-in-right">
        {/* Header */}
        <div className="px-4 py-3 border-b border-bright-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className={`w-2.5 h-2.5 rounded-full ${dotColor}`} />
            <div>
              <h2 className="text-sm font-bold text-bright-text leading-tight">{user.displayName}</h2>
              {user.displayName !== user.username && (
                <span className="text-[10px] text-bright-dim font-mono">@{user.username}</span>
              )}
            </div>
          </div>
          <button
            onClick={() => setSelectedUser(null)}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-bright-dim hover:text-bright-text hover:bg-bright-elevated transition-all text-xs"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            <StatBox label={T('detail.botScore')} value={String(user.botScore)} color={botScoreColor} />
            <StatBox label={T('detail.karmaScore')} value={String(user.karmaScore)} color={karmaColor} />
            <StatBox label={T('detail.messages')} value={String(user.totalMessages)} color="text-blue-400" />
          </div>

          {/* Classification Badges */}
          <div className="flex gap-1.5 flex-wrap">
            {user.isMod && <Badge label="MOD" color="text-emerald-400 bg-emerald-400/10" />}
            {user.isVip && <Badge label="VIP" color="text-purple-400 bg-purple-400/10" />}
            {user.isSubscriber && <Badge label="SUB" color="text-bright-accent bg-bright-accent/10" />}
            {user.noLiferFlag && <Badge label={T('detail.noLifer')} color="text-orange-300 bg-orange-300/10" />}
            {user.communicativeRank !== 'neutral' && (
              <Badge label={`${T('detail.communicativeRank')}: ${user.communicativeRank}`} color="text-cyan-400 bg-cyan-400/10" />
            )}
            {isWL && <Badge label="WHITELIST" color="text-teal-400 bg-teal-400/10" />}
          </div>

          {/* Social Metrics */}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <MetricBox label="Avg Wörter" value={user.avgMessageLength.toFixed(1)} />
            <MetricBox label="Reply-Ratio" value={`${(user.replyRatio * 100).toFixed(0)}%`} />
            <MetricBox label="Recipients" value={String(user.uniqueRecipients)} />
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => toggleWhitelist(username)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-button text-[11px] font-semibold transition-all border ${
                isWL
                  ? 'bg-teal-500/10 text-teal-400 border-teal-500/20'
                  : 'text-bright-dim border-bright-border hover:text-bright-muted hover:border-bright-dim'
              }`}
            >
              {isWL ? '✓' : '🛡️'} {isWL ? T('detail.whitelisted') : T('detail.whitelist')}
            </button>
            <button
              onClick={handleCopyTimeout}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-button text-[11px] font-semibold transition-all border ${
                copied
                  ? 'bg-bright-success/10 text-bright-success border-bright-success/20'
                  : 'text-bright-dim border-bright-border hover:text-bright-muted hover:border-bright-dim'
              }`}
            >
              {copied ? '✓' : '⏱'} {copied ? T('detail.copied') : T('detail.copyTimeout')}
            </button>
          </div>

          {/* Events */}
          <Section title={T('detail.events')}>
            {userEvents.length === 0 ? (
              <EmptyText>{T('detail.noEvents')}</EmptyText>
            ) : (
              <div className="space-y-0.5">
                {userEvents.map((event) => (
                  <div key={event.id} className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-bright-elevated/20 transition-colors text-[10px]">
                    <span className="font-mono text-bright-dim w-12 shrink-0">
                      {new Date(event.timestamp).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                    <span className="shrink-0">{detectorIcon(event.detector)}</span>
                    <span className={event.botDelta > 0 ? 'text-bright-danger font-mono font-bold tabular-nums' : 'text-bright-success font-mono font-bold tabular-nums'}>
                      B{event.botDelta > 0 ? '+' : ''}{event.botDelta}
                    </span>
                    <span className={event.karmaDelta > 0 ? 'text-bright-warning font-mono font-bold tabular-nums' : 'text-bright-success font-mono font-bold tabular-nums'}>
                      K{event.karmaDelta > 0 ? '+' : ''}{event.karmaDelta}
                    </span>
                    <span className="text-bright-dim font-mono tabular-nums">→ {event.newBotScore}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          {/* Messages */}
          <Section title={T('detail.recentMessages')}>
            {userMessages.length === 0 ? (
              <EmptyText>{T('detail.noMessages')}</EmptyText>
            ) : (
              <div className="space-y-0.5">
                {userMessages.map((msg) => (
                  <div key={msg.id} className="px-2 py-1 rounded hover:bg-bright-elevated/20 transition-colors text-[10px]">
                    <span className="font-mono text-bright-dim mr-1.5">
                      {new Date(msg.timestamp).toLocaleTimeString(timeLocale, { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-bright-muted break-words">{msg.message}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-bright-bg/50 rounded-xl p-2.5 border border-bright-border/40">
      <p className="text-[9px] text-bright-dim uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-base font-bold font-mono ${color} leading-tight mt-0.5 tabular-nums`}>{value}</p>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bright-bg/30 rounded-lg p-2 border border-bright-border/30">
      <p className="text-[9px] text-bright-dim uppercase tracking-wider">{label}</p>
      <p className="text-xs font-mono font-bold text-bright-text tabular-nums">{value}</p>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`${color} text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider`}>
      {label}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[10px] font-semibold text-bright-dim uppercase tracking-wider mb-1.5">{title}</h3>
      {children}
    </div>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-bright-dim/60 px-2 py-2">{children}</p>;
}

function detectorIcon(detector: string): string {
  return {
    metronome: '⏱',
    pattern: '🔁',
    flash: '⚡',
    karma: '✨',
    gap: '⚠️',
    social: '💬',
    context: '🌊',
    no_lifer: '🎮',
  }[detector] || '📌';
}
