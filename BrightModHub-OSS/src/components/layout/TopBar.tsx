'use client';

import { useState, useCallback, useEffect } from 'react';
import { useStore } from '@/lib/store';
import { ConnectionState } from '@/types';
import { t } from '@/lib/i18n';

export function TopBar() {
  const [channelInput, setChannelInput] = useState('');
  const [loading, setLoading] = useState(false);

  const isMonitoring = useStore((s) => s.isMonitoring);
  const channel = useStore((s) => s.channel);
  const spamMode = useStore((s) => s.spamMode);
  const connectionState = useStore((s) => s.connectionState);
  const locale = useStore((s) => s.locale);
  const setMonitoring = useStore((s) => s.setMonitoring);
  const setChannel = useStore((s) => s.setChannel);
  const setSpamMode = useStore((s) => s.setSpamMode);
  const setInitialUsers = useStore((s) => s.setInitialUsers);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?limit=2000');
      const data = await res.json();
      if (data.users) {
        setInitialUsers(data.users);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
    }
  }, [setInitialUsers]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleStartStop = useCallback(async () => {
    setLoading(true);
    try {
      if (isMonitoring) {
        await fetch('/api/session?action=stop', { method: 'POST' });
        setMonitoring(false);
        setChannel('');
      } else {
        const target = channelInput.trim().toLowerCase().replace('#', '');
        if (!target) return;
        await fetch('/api/session?action=start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channel: target }),
        });
        setChannel(target);
        setMonitoring(true);
        await fetchUsers();
      }
    } catch (error) {
      console.error('Session error:', error);
    } finally {
      setLoading(false);
    }
  }, [isMonitoring, channelInput, setMonitoring, setChannel, fetchUsers]);

  const handleToggleSpam = useCallback(async () => {
    try {
      const res = await fetch('/api/phase', { method: 'POST' });
      const data = await res.json();
      setSpamMode(data.spamMode);
    } catch (error) {
      console.error('Phase toggle error:', error);
    }
  }, [setSpamMode]);

  const isConnected = connectionState === ConnectionState.CONNECTED;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;
  const isConnecting = connectionState === ConnectionState.CONNECTING;

  return (
    <header className="h-14 bg-bright-surface/80 backdrop-blur-md border-b border-bright-border flex items-center px-5 gap-3 shrink-0">
      {/* Brand */}
      <h1 className="text-sm font-bold tracking-tight mr-1">
        <span className="bg-gradient-to-r from-bright-accent to-purple-400 bg-clip-text text-transparent">
          BrightModHub
        </span>
      </h1>
      <span className="text-[9px] font-mono text-bright-dim bg-bright-elevated px-1.5 py-0.5 rounded-full">
        v1.0
      </span>

      {/* Divider */}
      <div className="w-px h-5 bg-bright-border mx-1" />

      {/* Channel Controls */}
      {!isMonitoring ? (
        <div className="flex items-center gap-2">
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-bright-dim text-xs font-mono">#</span>
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartStop()}
              placeholder={T('topbar.placeholder')}
              className="w-40 h-8 pl-6 pr-3 bg-bright-elevated border border-bright-border rounded-button text-xs text-bright-text placeholder-bright-dim focus:outline-none focus:border-bright-accent/40 focus:ring-1 focus:ring-bright-accent/20 transition-all"
            />
          </div>
          <button
            onClick={handleStartStop}
            disabled={loading || !channelInput.trim()}
            className="h-8 px-3.5 bg-bright-accent hover:bg-bright-accent-hover text-white text-xs font-semibold rounded-button transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-glow-accent"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                {T('topbar.starting')}
              </span>
            ) : (
              T('topbar.start')
            )}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-bright-elevated/60 px-2.5 py-1.5 rounded-button border border-bright-border">
            <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-bright-success' : isReconnecting ? 'bg-bright-warning' : 'bg-bright-dim'} animate-pulse-dot`} />
            <span className="text-xs font-mono text-bright-text">#{channel}</span>
          </div>
          <button
            onClick={handleStartStop}
            disabled={loading}
            className="h-8 px-3.5 bg-bright-danger/10 text-bright-danger border border-bright-danger/20 hover:bg-bright-danger/20 text-xs font-semibold rounded-button transition-all"
          >
            {T('topbar.stop')}
          </button>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right Side */}
      <div className="flex items-center gap-2">
        {/* Connection Status */}
        <span className={`text-[10px] font-mono ${isConnected ? 'text-bright-success' : isReconnecting || isConnecting ? 'text-bright-warning' : 'text-bright-dim'}`}>
          {isConnected ? T('topbar.connected') : isReconnecting || isConnecting ? T('topbar.connecting') : T('topbar.disconnected')}
        </span>

        {/* Spam Mode Toggle */}
        {isMonitoring && (
          <button
            onClick={handleToggleSpam}
            className={`
              flex items-center gap-1.5 h-8 px-3 rounded-button text-xs font-semibold transition-all border
              ${spamMode
                ? 'bg-bright-warning/15 text-bright-warning border-bright-warning/20'
                : 'bg-bright-elevated text-bright-dim border-bright-border hover:text-bright-muted hover:border-bright-dim'
              }
            `}
          >
            ⚡ {spamMode ? T('topbar.spamOn') : T('topbar.spamOff')}
          </button>
        )}
      </div>
    </header>
  );
}
