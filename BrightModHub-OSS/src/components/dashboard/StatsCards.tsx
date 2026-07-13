'use client';

import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';

export function StatsCards() {
  const users = useStore((s) => s.users);
  const messagesProcessed = useStore((s) => s.messagesProcessed);
  const flagsRaised = useStore((s) => s.flagsRaised);
  const locale = useStore((s) => s.locale);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const userArray = Array.from(users.values());
  const suspicious = userArray.filter((u) => u.botThreatLevel === 'suspicious').length;
  const likelyBots = userArray.filter((u) => u.botThreatLevel === 'likely_bot').length;
  const confirmedBots = userArray.filter((u) => u.botThreatLevel === 'confirmed_bot').length;
  const noLifers = userArray.filter((u) => u.noLiferFlag).length;
  const communicative = userArray.filter((u) => u.category === 'communicative').length;

  const stats = [
    {
      label: T('stats.activeUsers'),
      value: users.size.toString(),
      icon: '👥',
      accent: 'text-bright-accent',
    },
    {
      label: T('stats.processed'),
      value: messagesProcessed > 1000
        ? `${(messagesProcessed / 1000).toFixed(1)}k`
        : messagesProcessed.toString(),
      icon: '📊',
      accent: 'text-blue-400',
    },
    {
      label: T('stats.suspicious'),
      value: (suspicious + likelyBots).toString(),
      icon: '⚠️',
      accent: 'text-bright-warning',
    },
    {
      label: T('stats.confirmedBots'),
      value: confirmedBots.toString(),
      icon: '🤖',
      accent: 'text-bright-danger',
    },
    {
      label: T('stats.noLifers'),
      value: noLifers.toString(),
      icon: '🎮',
      accent: 'text-orange-400',
    },
    {
      label: T('stats.communicative'),
      value: communicative.toString(),
      icon: '💬',
      accent: 'text-cyan-400',
    },
    {
      label: T('stats.flags'),
      value: flagsRaised.toString(),
      icon: '🚩',
      accent: 'text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="glass-card rounded-card p-3.5 flex items-center gap-3 animate-fade-in"
        >
          <span className="text-lg shrink-0">{stat.icon}</span>
          <div className="min-w-0">
            <p className="text-[10px] text-bright-dim uppercase tracking-wider font-medium truncate">
              {stat.label}
            </p>
            <p className={`text-xl font-bold font-mono ${stat.accent} leading-tight`}>
              {stat.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
