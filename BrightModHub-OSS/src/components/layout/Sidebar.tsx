'use client';

import { useStore, AppTab } from '@/lib/store';
import { ConnectionState } from '@/types';
import { t } from '@/lib/i18n';
import { BrightLogo } from './BrightLogo';

export function Sidebar() {
  const activeTab = useStore((s) => s.activeTab);
  const setActiveTab = useStore((s) => s.setActiveTab);
  const locale = useStore((s) => s.locale);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <aside className="w-16 bg-bright-surface border-r border-bright-border flex flex-col items-center py-5 gap-1.5 shrink-0">
      {/* Logo */}
      <div className="mb-6">
        <BrightLogo size={32} />
      </div>

      {/* Nav */}
      <NavItem
        icon={<DashboardIcon />}
        label={T('sidebar.dashboard')}
        active={activeTab === 'dashboard'}
        onClick={() => setActiveTab('dashboard')}
      />
      <NavItem
        icon={<HistoryIcon />}
        label={T('sidebar.history')}
        active={activeTab === 'history'}
        onClick={() => setActiveTab('history')}
      />
      <NavItem
        icon={<SettingsIcon />}
        label={T('sidebar.settings')}
        active={activeTab === 'settings'}
        onClick={() => setActiveTab('settings')}
      />

      <div className="flex-1" />
      <ConnectionDot />
    </aside>
  );
}

function NavItem({ icon, label, active, onClick }: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150
        group relative
        ${active
          ? 'bg-bright-accent/15 text-bright-accent'
          : 'text-bright-dim hover:text-bright-muted hover:bg-bright-elevated'
        }
      `}
      title={label}
    >
      {icon}
      <span className="absolute left-full ml-2.5 px-2 py-1 bg-bright-elevated text-bright-text text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-bright-border shadow-panel">
        {label}
      </span>
    </button>
  );
}

function ConnectionDot() {
  const wsConnected = useStore((s) => s.wsConnected);
  const connectionState = useStore((s) => s.connectionState);
  const locale = useStore((s) => s.locale);
  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const isConnected = wsConnected && connectionState === ConnectionState.CONNECTED;
  const isReconnecting = connectionState === ConnectionState.RECONNECTING;

  return (
    <div className="relative group mb-1">
      <div className={`w-2 h-2 rounded-full transition-colors ${
        isConnected ? 'bg-bright-success animate-pulse-dot'
        : isReconnecting ? 'bg-bright-warning animate-pulse-dot'
        : 'bg-bright-dim'
      }`} />
      <span className="absolute left-full ml-2.5 px-2 py-1 bg-bright-elevated text-bright-text text-[11px] font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-bright-border shadow-panel">
        {isConnected ? T('sidebar.connected') : isReconnecting ? T('sidebar.connecting') : T('sidebar.disconnected')}
      </span>
    </div>
  );
}

// Compact SVG icons
function DashboardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
