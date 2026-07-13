'use client';

import { useStore } from '@/lib/store';
import { t } from '@/lib/i18n';

interface GapBannerProps {
  gap: {
    startTime: number;
    endTime: number;
    durationMs: number;
  };
}

export function GapBanner({ gap }: GapBannerProps) {
  const locale = useStore((s) => s.locale);
  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const duration = Math.round(gap.durationMs / 1000);
  const minutes = Math.floor(duration / 60);
  const seconds = duration % 60;
  const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

  return (
    <div className="mx-5 mt-2 flex items-center gap-2 px-3 py-1.5 bg-bright-warning/8 border border-bright-warning/15 rounded-button text-[11px]">
      <span className="text-bright-warning text-xs">⚠️</span>
      <span className="text-bright-warning font-medium">{T('gap.detected')}</span>
      <span className="text-bright-dim font-mono">{durationStr}</span>
      <span className="text-bright-dim">—</span>
      <span className="text-bright-dim">{T('gap.paused')}</span>
    </div>
  );
}
