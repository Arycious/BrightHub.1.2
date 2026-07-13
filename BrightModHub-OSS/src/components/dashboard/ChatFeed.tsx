'use client';

import { useStore } from '@/lib/store';
import { memo, useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';

const MAX_DISPLAY = 100;

export function ChatFeed() {
  const chatMessages = useStore((s) => s.chatMessages);
  const locale = useStore((s) => s.locale);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAutoScrollRef = useRef(true);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  useEffect(() => {
    if (isAutoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [chatMessages]);

  const displayed = chatMessages.slice(0, MAX_DISPLAY);

  return (
    <div className="glass-card rounded-card flex flex-col h-[320px] animate-fade-in">
      <div className="px-4 py-2.5 border-b border-bright-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs">💬</span>
          <h2 className="text-xs font-semibold text-bright-text uppercase tracking-wider">{T('chat.title')}</h2>
        </div>
        <span className="text-[10px] text-bright-dim font-mono">
          {displayed.length}/{MAX_DISPLAY}
        </span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto p-1.5 space-y-px"
        onScroll={() => {
          if (scrollRef.current) {
            isAutoScrollRef.current = scrollRef.current.scrollTop <= 10;
          }
        }}
      >
        {displayed.length === 0 ? (
          <div className="flex items-center justify-center h-full text-bright-dim text-xs">
            <div className="text-center">
              <p className="text-2xl mb-1.5 opacity-40">💬</p>
              <p>{T('chat.waiting')}</p>
              <p className="text-[10px] mt-0.5">{T('chat.hint')}</p>
            </div>
          </div>
        ) : (
          displayed.map((msg) => (
            <ChatLine key={msg.id} msg={msg} />
          ))
        )}
      </div>
    </div>
  );
}

interface ChatLineProps {
  msg: {
    id: string;
    username: string;
    displayName: string;
    message: string;
    timestamp: number;
    isSub: boolean;
    isMod: boolean;
    isVip: boolean;
  };
}

const ChatLine = memo(function ChatLine({ msg }: ChatLineProps) {
  const locale = useStore((s) => s.locale);
  const timeLocale = locale === 'de' ? 'de-DE' : 'en-GB';
  const time = new Date(msg.timestamp).toLocaleTimeString(timeLocale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let nameColor = 'text-bright-muted';
  let badge = '';
  if (msg.isMod) {
    nameColor = 'text-emerald-400';
    badge = '⚔️';
  } else if (msg.isVip) {
    nameColor = 'text-purple-400';
    badge = '💎';
  } else if (msg.isSub) {
    nameColor = 'text-bright-accent';
    badge = '⭐';
  }

  return (
    <div className="chat-line flex items-start gap-1.5 px-2 py-0.5 rounded hover:bg-bright-elevated/20 transition-colors group">
      <span className="text-[9px] font-mono text-bright-dim shrink-0 mt-px opacity-0 group-hover:opacity-100 transition-opacity w-12">
        {time}
      </span>
      {badge && <span className="text-[10px] shrink-0 mt-px">{badge}</span>}
      <div className="min-w-0 flex-1">
        <span className={`text-[11px] font-semibold ${nameColor} mr-1`}>
          {msg.displayName}
        </span>
        <span className="text-[11px] text-bright-muted/80 break-words">
          {msg.message}
        </span>
      </div>
    </div>
  );
});
