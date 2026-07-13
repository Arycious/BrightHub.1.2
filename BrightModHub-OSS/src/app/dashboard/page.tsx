'use client';

import { useEffect } from 'react';
import { useRealtimeUpdates } from '@/hooks/useRealtimeUpdates';
import { useStore } from '@/lib/store';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { LiveFeed } from '@/components/dashboard/LiveFeed';
import { ChatFeed } from '@/components/dashboard/ChatFeed';
import { UserTable } from '@/components/dashboard/UserTable';
import { TopSuspects } from '@/components/dashboard/TopSuspects';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { GapBanner } from '@/components/dashboard/GapBanner';
import { UserDetailPanel } from '@/components/dashboard/UserDetailPanel';
import { SettingsPanel } from '@/components/settings/SettingsPanel';
import { SessionHistory } from '@/components/dashboard/SessionHistory';

export default function DashboardPage() {
  useRealtimeUpdates();

  const hydrateSettings = useStore((s) => s.hydrateSettings);
  const activeTab = useStore((s) => s.activeTab);
  const gapEvents = useStore((s) => s.gapEvents);
  const selectedUser = useStore((s) => s.selectedUser);

  useEffect(() => {
    hydrateSettings();
  }, [hydrateSettings]);

  return (
    <div className="flex h-screen overflow-hidden bg-bright-bg">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />

        {activeTab === 'dashboard' && gapEvents.length > 0 && (
          <GapBanner gap={gapEvents[gapEvents.length - 1]} />
        )}

        <main className="flex-1 overflow-auto p-4 space-y-4">
          {activeTab === 'dashboard' ? (
            <>
              <StatsCards />

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3">
                  <LiveFeed />
                </div>
                <div className="lg:col-span-2">
                  <TopSuspects />
                </div>
              </div>

              <ChatFeed />
              <UserTable />
            </>
          ) : activeTab === 'history' ? (
            <SessionHistory />
          ) : (
            <SettingsPanel />
          )}
        </main>
      </div>

      {selectedUser && <UserDetailPanel username={selectedUser} />}
    </div>
  );
}
