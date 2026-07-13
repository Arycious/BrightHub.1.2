'use client';

import { useStore } from '@/lib/store';
import { memo } from 'react';
import { t } from '@/lib/i18n';

export function LiveFeed() {
  const liveEvents = useStore((s) => s.liveEvents);
  const locale = useStore((s) => s.locale);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="glass-card rounded-card flex flex-col h-[380px]">
      <div className="px-4 py-2.5 border-b border-bright-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-bright-success animate-pulse-dot" />
          <h2 className="text-xs font-semibold text-bright-text uppercase tracking-wider">{T('livefeed.title')}</h2>
        </div>
        <span className="text-[10px] text-bright-dim font-mono">{liveEvents.length}</span>
      </div>

      <div className="flex-1 overflow-auto p-1.5 space-y-0.5">
        {liveEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-bright-dim text-xs">
            <div className="text-center">
              <p className="text-2xl mb-1.5 opacity-40">📡</p>
              <p>{T('livefeed.waiting')}</p>
              <p className="text-[10px] mt-0.5 text-bright-dim">{T('livefeed.hint')}</p>
            </div>
          </div>
        ) : (
          liveEvents.map((event) => (
            <FeedItem key={event.id} event={event} />
          ))
        )}
      </div>
    </div>
  );
}

interface FeedItemProps {
  event: {
    id: string;
    username: string;
    botDelta: number;
    karmaDelta: number;
    newBotScore: number;
    newKarmaScore: number;
    detector: string;
    botThreatLevel: string;
    timestamp: number;
  };
}

const FeedItem = memo(function FeedItem({ event }: FeedItemProps) {
  const locale = useStore((s) => s.locale);
  const timeLocale = locale === 'de' ? 'de-DE' : 'en-GB';
  const time = new Date(event.timestamp).toLocaleTimeString(timeLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const deltaColor = event.botDelta > 0 ? 'text-bright-danger' : 'text-bright-success';
  const deltaSign = event.botDelta > 0 ? '+' : '';

  const detectorIcon = {
    metronome: '⏱',
    pattern: '🔁',
    flash: '⚡',
    karma: '✨',
    gap: '⚠️',
    social: '💬',
    context: '🌊',
    no_lifer: '🎮',
  }[event.detector] || '📌';

  return (
    <div className="feed-item-enter flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-bright-elevated/40 transition-colors">
      <span className="text-[9px] font-mono text-bright-dim shrink-0 w-14">{time}</span>
      <span className="text-xs shrink-0">{detectorIcon}</span>
      <span className="text-xs font-medium text-bright-text truncate min-w-0 flex-1">{event.username}</span>
      <span className={`text-xs font-mono font-bold ${deltaColor} shrink-0 tabular-nums`}>
        {deltaSign}{event.botDelta}
      </span>
      <ScoreBadge score={event.newBotScore} />
    </div>
  );
});

function ScoreBadge({ score }: { score: number }) {
  let color = 'text-bright-dim bg-bright-elevated/50';

  if (score > 700) {
    color = 'text-bright-danger bg-bright-danger/10';
  } else if (score > 300) {
    color = 'text-orange-400 bg-orange-400/10';
  } else if (score > 100) {
    color = 'text-bright-warning bg-bright-warning/10';
  } else if (score < -20) {
    color = 'text-bright-success bg-bright-success/10';
  }

  return (
    <span className={`${color} text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 min-w-[32px] text-center tabular-nums`}>
      {score}
    </span>
  );
}
