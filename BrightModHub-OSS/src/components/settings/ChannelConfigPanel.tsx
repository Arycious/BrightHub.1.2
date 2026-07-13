'use client';

import { useEffect, useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import { t, TranslationKey } from '@/lib/i18n';
import { ChannelConfig } from '@/types';

type ConfigSection = keyof ChannelConfig;

const SECTIONS: ConfigSection[] = ['metronome', 'pattern', 'noLifer', 'social', 'context', 'scoring', 'copyPaste', 'entropy', 'typingDynamics', 'commandSpam'];

const FIELDS = {
  metronome: ['windowSize', 'precisionLowSigma', 'precisionMediumSigma', 'precisionHighSigma', 'burstWindowMs', 'burstMinMessages', 'madThresholdLow', 'madThresholdMedium', 'madThresholdHigh', 'entropyThreshold', 'periodicityThreshold', 'runsTestThreshold', 'lengthIntervalCorrelationPenalty', 'lengthIntervalCorrelationMin'],
  pattern: ['windowSize', 'fuzzyClusterThreshold', 'similarityThreshold', 'templateThreshold', 'entropyThreshold', 'mashThreshold', 'ngramRepetitionThreshold', 'lowEntropyPenalty', 'mediumEntropyPenalty', 'mashPenalty', 'ngramRepetitionPenalty'],
  noLifer: ['messagesPerMinuteThreshold', 'minMessages', 'hintThreshold'],
  social: ['windowSize', 'chainThresholdMs'],
  context: ['waveWindowMs', 'waveMinUsers', 'waveMinMessages', 'maxRecentMessages', 'fastReactionMs', 'mediumReactionMs', 'fuzzyWaveSimilarity'],
  scoring: ['spamMultiplier', 'gracePeriodMs'],
  copyPaste: ['windowMs', 'minUniqueUsers', 'similarityThreshold', 'basePenalty', 'penaltyPerUser'],
  entropy: ['windowSize', 'lowEntropyThreshold', 'mediumEntropyThreshold', 'lowPenalty', 'mediumPenalty'],
  typingDynamics: ['windowSize', 'minCorrelation', 'maxMeanCharsPerSecond', 'penalty'],
  commandSpam: ['windowSize', 'commandLikenessThreshold', 'maxCommandRatio', 'lowCommandRatio', 'commandHighPenalty', 'commandMediumPenalty', 'commandBypassPenalty', 'commandLowRatioKarmaBonus', 'timingFusionFactor', 'timingSigmaThreshold', 'crowdDampeningThreshold'],
} as const;

type FieldKey<S extends ConfigSection> = (typeof FIELDS)[S][number];

function getFieldValue(config: ChannelConfig, section: ConfigSection, field: string): number {
  return (config[section] as Record<string, number>)[field] ?? 0;
}

function isDecimalField(field: string): boolean {
  return [
    'spamMultiplier',
    'fuzzyClusterThreshold', 'similarityThreshold', 'templateThreshold',
    'entropyThreshold', 'mashThreshold', 'ngramRepetitionThreshold',
    'fuzzyWaveSimilarity',
    'copyPaste.similarityThreshold',
    'lowEntropyThreshold', 'mediumEntropyThreshold',
    'minCorrelation', 'maxMeanCharsPerSecond',
    'lengthIntervalCorrelationMin',
  ].includes(field) || field.endsWith('Threshold') || field.endsWith('Ratio') || field.endsWith('Min') || field.endsWith('Sigma') || field.endsWith('Factor');
}

export function ChannelConfigPanel() {
  const locale = useStore((s) => s.locale);
  const channel = useStore((s) => s.channel);
  const config = useStore((s) => s.channelConfig);
  const setConfig = useStore((s) => s.setChannelConfig);
  const loading = useStore((s) => s.channelConfigLoading);
  const setLoading = useStore((s) => s.setChannelConfigLoading);
  const updateField = useStore((s) => s.updateChannelConfigField);

  const T = (key: Parameters<typeof t>[1]) => t(locale, key);

  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/config?channel=${encodeURIComponent(channel || 'brightmodhub')}`);
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) setConfig(data.config);
      } catch {
        if (!cancelled) setConfig(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [channel, setConfig, setLoading]);

  const handleChange = useCallback((
    section: ConfigSection,
    field: string,
    value: string
  ) => {
    const num = parseFloat(value);
    if (Number.isNaN(num)) return;
    updateField(section, field, num);
    setSaveState('idle');
  }, [updateField]);

  const handleSave = useCallback(async () => {
    if (!config) return;
    setSaveState('saving');
    try {
      const res = await fetch(`/api/config?channel=${encodeURIComponent(channel || 'brightmodhub')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch {
      setSaveState('error');
    }
  }, [config, channel]);

  const handleReset = useCallback(async () => {
    if (!config) return;
    // Reload from server (discards local edits)
    setLoading(true);
    try {
      const res = await fetch(`/api/config?channel=${encodeURIComponent(channel || 'brightmodhub')}`);
      if (!res.ok) throw new Error('Failed to load');
      const data = await res.json();
      setConfig(data.config);
      setSaveState('idle');
    } catch {
      setSaveState('error');
    } finally {
      setLoading(false);
    }
  }, [channel, config, setConfig, setLoading]);

  if (loading || !config) {
    return (
      <div className="glass-card rounded-card p-6 animate-fade-in">
        <h2 className="text-sm font-bold text-bright-text uppercase tracking-wider mb-4">{T('config.title')}</h2>
        <div className="text-[11px] text-bright-dim animate-pulse">{loading ? '...' : T('config.loadError')}</div>
      </div>
    );
  }

  return (
    <div className="glass-card rounded-card p-4 animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-bold text-bright-text uppercase tracking-wider">{T('config.title')}</h2>
          <p className="text-[10px] text-bright-dim mt-0.5">
            {T('config.currentChannel')}: <span className="font-mono text-bright-accent">#{channel || 'brightmodhub'}</span>
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleReset}
            disabled={saveState === 'saving'}
            className="px-3 py-1.5 rounded-button text-[11px] font-medium text-bright-dim border border-bright-border hover:text-bright-muted hover:bg-bright-elevated transition-all disabled:opacity-50"
          >
            {T('config.reset')}
          </button>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving'}
            className="px-3 py-1.5 rounded-button text-[11px] font-semibold bg-bright-accent text-white hover:bg-bright-accent-hover transition-all disabled:opacity-50"
          >
            {saveState === 'saved' ? `✓ ${T('config.saved')}` : saveState === 'saving' ? '...' : T('config.save')}
          </button>
        </div>
      </div>

      {saveState === 'error' && (
        <div className="mb-3 text-[11px] text-bright-danger">{T('config.saveError')}</div>
      )}

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {SECTIONS.map((section) => (
          <div key={section} className="border border-bright-border rounded-lg p-3 bg-bright-bg/30">
            <h3 className="text-[11px] font-semibold text-bright-text mb-2.5">
              {T(`config.section.${section}` as TranslationKey)}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS[section].map((field) => (
                <label key={`${section}.${String(field)}`} className="block">
                  <span className="text-[10px] text-bright-dim block mb-1">
                    {T(`config.field.${field}` as TranslationKey)}
                  </span>
                  <input
                    type="number"
                    step={isDecimalField(field) ? '0.01' : '1'}
                    value={getFieldValue(config, section, field)}
                    onChange={(e) => handleChange(section, field, e.target.value)}
                    className="w-full bg-bright-bg border border-bright-border rounded-md px-2.5 py-1.5 text-[11px] text-bright-text focus:outline-none focus:border-bright-accent transition-colors"
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
