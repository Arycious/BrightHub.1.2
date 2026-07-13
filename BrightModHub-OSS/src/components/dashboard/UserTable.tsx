'use client';

import { useStore } from '@/lib/store';
import { useMemo, useState, useCallback, memo } from 'react';
import { t } from '@/lib/i18n';
import type { TrackedUser, UserCategory } from '@/types';

type SortField = 'botScore' | 'karmaScore' | 'username' | 'totalMessages' | 'totalFlags';
type SortDir = 'asc' | 'desc';

const BOT_THRESHOLDS = { suspicious: 100, likely_bot: 300, confirmed_bot: 700 };

function getDistanceToFlag(botScore: number) {
  if (botScore > BOT_THRESHOLDS.confirmed_bot) return { text: '⚠ CONFIRMED', remaining: 0 };
  if (botScore > BOT_THRESHOLDS.likely_bot) return { text: `+${BOT_THRESHOLDS.confirmed_bot - botScore}`, remaining: BOT_THRESHOLDS.confirmed_bot - botScore };
  if (botScore > BOT_THRESHOLDS.suspicious) return { text: `+${BOT_THRESHOLDS.likely_bot - botScore}`, remaining: BOT_THRESHOLDS.likely_bot - botScore };
  return { text: `+${BOT_THRESHOLDS.suspicious - botScore}`, remaining: BOT_THRESHOLDS.suspicious - botScore };
}

export function UserTable() {
  const users = useStore((s) => s.users);
  const userFilter = useStore((s) => s.userFilter);
  const setUserFilter = useStore((s) => s.setUserFilter);
  const locale = useStore((s) => s.locale);
  const [sortField, setSortField] = useState<SortField>('botScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filter, setFilter] = useState('');
  const [exportStatus, setExportStatus] = useState<'idle' | 'saving' | 'done'>('idle');

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const sortedUsers = useMemo(() => {
    let arr = Array.from(users.values());

    if (userFilter !== 'all') {
      arr = arr.filter((u) => u.category === userFilter);
    }

    if (filter) {
      const f = filter.toLowerCase();
      arr = arr.filter((u) => u.username.includes(f) || u.displayName.toLowerCase().includes(f));
    }

    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'botScore': cmp = a.botScore - b.botScore; break;
        case 'karmaScore': cmp = a.karmaScore - b.karmaScore; break;
        case 'username': cmp = a.username.localeCompare(b.username); break;
        case 'totalMessages': cmp = a.totalMessages - b.totalMessages; break;
        case 'totalFlags': cmp = a.totalFlags - b.totalFlags; break;
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return arr;
  }, [users, sortField, sortDir, filter, userFilter]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  const handleExport = useCallback(async () => {
    setExportStatus('saving');
    try {
      const res = await fetch('/api/export', { method: 'POST' });
      if (res.ok) { setExportStatus('done'); setTimeout(() => setExportStatus('idle'), 2000); }
      else setExportStatus('idle');
    } catch { setExportStatus('idle'); }
  }, []);

  const filterButtons: { key: 'all' | 'bot' | 'no_lifer' | 'command_spammer' | 'communicative'; label: string }[] = [
    { key: 'all', label: T('table.filter.all') },
    { key: 'bot', label: T('table.filter.bot') },
    { key: 'no_lifer', label: T('table.filter.noLifer') },
    { key: 'command_spammer', label: T('table.filter.commandSpammer') },
    { key: 'communicative', label: T('table.filter.communicative') },
  ];

  return (
    <div className="glass-card rounded-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-bright-border flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs">📋</span>
          <h2 className="text-xs font-semibold text-bright-text uppercase tracking-wider">{T('table.title')}</h2>
          <span className="text-[10px] text-bright-dim font-mono">{sortedUsers.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setUserFilter(btn.key)}
              className={`px-2 py-0.5 rounded-button text-[10px] font-semibold transition-all border ${
                userFilter === btn.key
                  ? 'bg-bright-accent/15 text-bright-accent border-bright-accent/30'
                  : 'text-bright-dim border-bright-border hover:text-bright-muted hover:border-bright-dim'
              }`}
            >
              {btn.label}
            </button>
          ))}
          <button
            onClick={handleExport}
            disabled={exportStatus !== 'idle'}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-button text-[10px] font-semibold transition-all ${
              exportStatus === 'done'
                ? 'bg-bright-success/15 text-bright-success'
                : 'text-bright-dim hover:text-bright-muted border border-bright-border hover:border-bright-dim'
            } ${exportStatus === 'saving' ? 'opacity-50' : ''}`}
          >
            {exportStatus === 'done' ? '✓ ' + T('table.exported') : exportStatus === 'saving' ? '...' : T('table.export')}
          </button>
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-bright-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={T('table.search')}
              className="w-36 h-7 pl-7 pr-2 bg-bright-elevated border border-bright-border rounded-button text-[11px] text-bright-text placeholder-bright-dim focus:outline-none focus:border-bright-accent/30 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-auto max-h-[380px]">
        <table className="w-full text-[11px]">
          <thead className="sticky top-0 bg-bright-surface z-10">
            <tr className="border-b border-bright-border">
              <Th width="40px">{T('table.status')}</Th>
              <ThSort field="username" current={sortField} onSort={handleSort} arrow={sortArrow}>{T('table.user')}</ThSort>
              <ThSort field="botScore" current={sortField} onSort={handleSort} arrow={sortArrow}>{T('table.botScore')}</ThSort>
              <ThSort field="karmaScore" current={sortField} onSort={handleSort} arrow={sortArrow}>{T('table.karmaScore')}</ThSort>
              <Th>{T('table.distance')}</Th>
              <ThSort field="totalMessages" current={sortField} onSort={handleSort} arrow={sortArrow}>{T('table.messages')}</ThSort>
              <ThSort field="totalFlags" current={sortField} onSort={handleSort} arrow={sortArrow}>{T('table.flags')}</ThSort>
              <Th>{T('table.badges')}</Th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-bright-dim text-xs">
                  {filter || userFilter !== 'all' ? T('table.noResults') : T('table.empty')}
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => <UserRow key={user.username} user={user} />)
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children, width }: { children: React.ReactNode; width?: string }) {
  return (
    <th className="text-left px-3 py-2 text-[10px] font-semibold text-bright-dim uppercase tracking-wider" style={width ? { width } : undefined}>
      {children}
    </th>
  );
}

function ThSort({ children, field, current, onSort, arrow }: {
  children: React.ReactNode;
  field: SortField;
  current: SortField;
  onSort: (f: SortField) => void;
  arrow: (f: SortField) => string;
}) {
  return (
    <th
      className={`text-left px-3 py-2 text-[10px] font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors ${
        current === field ? 'text-bright-accent' : 'text-bright-dim hover:text-bright-muted'
      }`}
      onClick={() => onSort(field)}
    >
      {children}{arrow(field)}
    </th>
  );
}

const UserRow = memo(function UserRow({ user }: { user: TrackedUser & { botThreatLevel: string; karmaLevel: string; category: UserCategory } }) {
  const setSelectedUser = useStore((s) => s.setSelectedUser);
  const isWhitelisted = useStore((s) => s.whitelist.has(user.username));

  const dotColor = {
    confirmed_bot: 'bg-bright-danger',
    likely_bot: 'bg-orange-400',
    suspicious: 'bg-bright-warning',
    clean: 'bg-bright-success/60',
  }[user.botThreatLevel] || 'bg-bright-dim';

  const distance = getDistanceToFlag(user.botScore);

  let botScoreColor = 'text-bright-dim';
  if (user.botScore > 700) botScoreColor = 'text-bright-danger';
  else if (user.botScore > 300) botScoreColor = 'text-orange-400';
  else if (user.botScore > 100) botScoreColor = 'text-bright-warning';

  let karmaScoreColor = 'text-bright-dim';
  if (user.karmaLevel === 'trusted') karmaScoreColor = 'text-bright-success';
  else if (user.karmaLevel === 'flagged') karmaScoreColor = 'text-bright-warning';

  let distColor = 'text-bright-dim';
  if (user.botScore > 700) distColor = 'text-bright-danger';
  else if (user.botScore > 300) distColor = 'text-orange-400';
  else if (user.botScore > 100) distColor = 'text-bright-warning';
  else if (distance.remaining > 50) distColor = 'text-bright-success/50';

  return (
    <tr
      className={`border-b border-bright-border/30 hover:bg-bright-elevated/20 transition-colors cursor-pointer ${isWhitelisted ? 'opacity-40' : ''}`}
      onClick={() => setSelectedUser(user.username)}
    >
      <td className="px-3 py-2">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
      </td>
      <td className="px-3 py-2">
        <span className="font-medium text-bright-text">{user.displayName}</span>
        {user.displayName !== user.username && (
          <span className="text-bright-dim text-[10px] ml-1 font-mono">@{user.username}</span>
        )}
      </td>
      <td className="px-3 py-2">
        <span className={`font-mono font-bold tabular-nums ${botScoreColor}`}>{user.botScore}</span>
      </td>
      <td className="px-3 py-2">
        <span className={`font-mono font-bold tabular-nums ${karmaScoreColor}`}>{user.karmaScore}</span>
      </td>
      <td className="px-3 py-2">
        <span className={`font-mono tabular-nums ${distColor}`}>{distance.text}</span>
      </td>
      <td className="px-3 py-2 font-mono text-bright-dim tabular-nums">
        {user.totalMessages.toLocaleString('de-DE')}
      </td>
      <td className="px-3 py-2 font-mono tabular-nums">
        {user.totalFlags > 0 ? <span className="text-bright-warning">{user.totalFlags}</span> : <span className="text-bright-dim">0</span>}
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-0.5 flex-wrap">
          {user.isMod && <MicroBadge text="M" color="text-emerald-400 bg-emerald-400/10" />}
          {user.isVip && <MicroBadge text="V" color="text-purple-400 bg-purple-400/10" />}
          {user.isSubscriber && <MicroBadge text="S" color="text-bright-accent bg-bright-accent/10" />}
          {user.noLiferFlag && <MicroBadge text="NL" color="text-orange-300 bg-orange-300/10" />}
          {user.communicativeRank !== 'neutral' && <MicroBadge text={user.communicativeRank.slice(0, 2).toUpperCase()} color="text-cyan-400 bg-cyan-400/10" />}
        </div>
      </td>
    </tr>
  );
});

function MicroBadge({ text, color }: { text: string; color: string }) {
  return (
    <span className={`${color} text-[8px] font-bold w-4 h-4 rounded flex items-center justify-center`}>
      {text}
    </span>
  );
}
