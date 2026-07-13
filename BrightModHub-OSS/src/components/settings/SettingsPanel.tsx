'use client';

import { useStore, ThemeMode } from '@/lib/store';
import { Locale, t } from '@/lib/i18n';
import { useState, useCallback } from 'react';
import { ChannelConfigPanel } from './ChannelConfigPanel';

export function SettingsPanel() {
  const locale = useStore((s) => s.locale);
  const setLocale = useStore((s) => s.setLocale);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const soundEnabled = useStore((s) => s.soundEnabled);
  const setSoundEnabled = useStore((s) => s.setSoundEnabled);
  const reset = useStore((s) => s.reset);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  return (
    <div className="max-w-lg mx-auto space-y-3 animate-fade-in">
      <h2 className="text-sm font-bold text-bright-text uppercase tracking-wider mb-4">{T('settings.title')}</h2>

      <SettingRow icon="🌐" title={T('settings.language')} description={T('settings.languageDesc')}>
        <ToggleGroup>
          <Toggle label="🇩🇪" active={locale === 'de'} onClick={() => setLocale('de')} />
          <Toggle label="🇬🇧" active={locale === 'en'} onClick={() => setLocale('en')} />
        </ToggleGroup>
      </SettingRow>

      <SettingRow icon="🎨" title={T('settings.theme')} description={T('settings.themeDesc')}>
        <ToggleGroup>
          <Toggle label="🌙" active={theme === 'dark'} onClick={() => setTheme('dark')} />
          <Toggle label="☀️" active={theme === 'light'} onClick={() => setTheme('light')} />
        </ToggleGroup>
      </SettingRow>

      <SettingRow icon="🔊" title={T('settings.sound')} description={T('settings.soundDesc')}>
        <ToggleGroup>
          <Toggle label="🔔" active={soundEnabled} onClick={() => setSoundEnabled(true)} />
          <Toggle label="🔕" active={!soundEnabled} onClick={() => setSoundEnabled(false)} />
        </ToggleGroup>
      </SettingRow>

      {/* Channel-specific detector configuration */}
      <div className="pt-4">
        <ChannelConfigPanel />
      </div>

      {/* Danger Zone — Delete All Data */}
      <div className="pt-4">
        <ClearDataButton reset={reset} />
      </div>
    </div>
  );
}

function ClearDataButton({ reset }: { reset: () => void }) {
  const locale = useStore((s) => s.locale);
  const T = (key: Parameters<typeof t>[1]) => t(locale, key);
  const [state, setState] = useState<'idle' | 'confirm' | 'deleting' | 'done'>('idle');

  const handleClick = useCallback(() => {
    if (state === 'idle') {
      setState('confirm');
      return;
    }
  }, [state]);

  const handleConfirm = useCallback(async () => {
    setState('deleting');
    try {
      const res = await fetch('/api/clear', { method: 'DELETE' });
      if (res.ok) {
        reset();
        setState('done');
        setTimeout(() => setState('idle'), 2000);
      } else {
        setState('idle');
      }
    } catch {
      setState('idle');
    }
  }, [reset]);

  const handleCancel = useCallback(() => {
    setState('idle');
  }, []);

  return (
    <div className="glass-card rounded-card p-4 border-bright-danger/10">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-base shrink-0">🗑️</span>
          <div className="min-w-0">
            <h3 className="text-xs font-semibold text-bright-danger">{T('settings.clearData')}</h3>
            <p className="text-[10px] text-bright-dim mt-0.5 truncate">{T('settings.clearDataDesc')}</p>
          </div>
        </div>

        {state === 'idle' && (
          <button
            onClick={handleClick}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-button text-[11px] font-semibold text-bright-danger border border-bright-danger/20 hover:bg-bright-danger/10 transition-all shrink-0"
          >
            🗑️ {T('settings.clearDataBtn')}
          </button>
        )}

        {state === 'confirm' && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1 px-3 py-1.5 rounded-button text-[11px] font-bold bg-bright-danger text-white hover:bg-bright-danger/80 transition-all"
            >
              ⚠️ {T('settings.clearDataBtn')}
            </button>
            <button
              onClick={handleCancel}
              className="px-2.5 py-1.5 rounded-button text-[11px] font-medium text-bright-dim border border-bright-border hover:text-bright-muted transition-all"
            >
              ✕
            </button>
          </div>
        )}

        {state === 'deleting' && (
          <span className="text-[11px] text-bright-dim font-mono animate-pulse">...</span>
        )}

        {state === 'done' && (
          <span className="text-[11px] text-bright-success font-semibold">
            ✓ {T('settings.clearDataDone')}
          </span>
        )}
      </div>

      {state === 'confirm' && (
        <p className="text-[10px] text-bright-warning mt-2 pl-8 animate-fade-in">
          ⚠️ {T('settings.clearDataConfirm')}
        </p>
      )}
    </div>
  );
}

function SettingRow({ icon, title, description, children }: {
  icon: string; title: string; description: string; children: React.ReactNode;
}) {
  return (
    <div className="glass-card rounded-card p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-base shrink-0">{icon}</span>
        <div className="min-w-0">
          <h3 className="text-xs font-semibold text-bright-text">{title}</h3>
          <p className="text-[10px] text-bright-dim mt-0.5 truncate">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function ToggleGroup({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-0.5 bg-bright-bg rounded-button p-0.5 border border-bright-border shrink-0">
      {children}
    </div>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-7 rounded-md flex items-center justify-center text-sm transition-all ${
        active ? 'bg-bright-accent text-white shadow-sm' : 'text-bright-dim hover:text-bright-muted'
      }`}
    >
      {label}
    </button>
  );
}
