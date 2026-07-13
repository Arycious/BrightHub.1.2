// ==========================================
// BrightModHub — Per-Channel Configuration
// ==========================================
// Each monitored Twitch channel can have its own thresholds and detector
// settings. This allows hype channels to use looser timing thresholds while
// quiet talk-show channels can be more sensitive.

import path from 'path';
import fs from 'fs';
import type { ChannelConfig } from '../types';

const CHANNELS_DIR = path.join(process.cwd(), 'data', 'channels');

export const DEFAULT_CHANNEL_CONFIG: ChannelConfig = {
  metronome: {
    windowSize: 10,
    sigmaThresholdLow: 100,
    sigmaThresholdMedium: 50,
    sigmaThresholdHigh: 20,
    burstWindowMs: 3000,
    burstMinMessages: 5,
    precisionLowSigma: 10,
    precisionMediumSigma: 20,
    precisionHighSigma: 50,
    madThresholdLow: 5,
    madThresholdMedium: 15,
    madThresholdHigh: 40,
    entropyThreshold: 2.0,
    periodicityThreshold: 0.7,
    runsTestThreshold: 0.3,
    lengthIntervalCorrelationPenalty: 15,
    lengthIntervalCorrelationMin: 0.3,
  },
  pattern: {
    windowSize: 10,
    fuzzyClusterThreshold: 0.85,
    similarityThreshold: 0.9,
    templateThreshold: 0.8,
    entropyThreshold: 2.5,
    mashThreshold: 0.7,
    ngramRepetitionThreshold: 0.6,
    lowEntropyPenalty: 12,
    mediumEntropyPenalty: 5,
    mashPenalty: 10,
    ngramRepetitionPenalty: 8,
  },
  noLifer: {
    messagesPerMinuteThreshold: 30,
    minMessages: 10,
    hintThreshold: 3,
  },
  social: {
    windowSize: 20,
    chainThresholdMs: 120000,
  },
  context: {
    waveWindowMs: 2000,
    waveMinUsers: 3,
    waveMinMessages: 5,
    maxRecentMessages: 500,
    fastReactionMs: 200,
    mediumReactionMs: 500,
    fuzzyWaveSimilarity: 0.85,
  },
  scoring: {
    spamMultiplier: 0.3,
    gracePeriodMs: 30000,
  },
  copyPaste: {
    windowMs: 30000,
    minUniqueUsers: 3,
    similarityThreshold: 0.9,
    basePenalty: 15,
    penaltyPerUser: 5,
  },
  entropy: {
    windowSize: 10,
    lowEntropyThreshold: 1.5,
    mediumEntropyThreshold: 2.5,
    lowPenalty: 20,
    mediumPenalty: 8,
  },
  typingDynamics: {
    windowSize: 10,
    minCorrelation: 0.3,
    maxMeanCharsPerSecond: 30,
    penalty: 15,
  },
  commandSpam: {
    windowSize: 20,
    commandLikenessThreshold: 0.55,
    maxCommandRatio: 0.8,
    lowCommandRatio: 0.3,
    commandHighPenalty: 25,
    commandMediumPenalty: 10,
    commandBypassPenalty: 8,
    commandLowRatioKarmaBonus: -2,
    timingFusionFactor: 1.5,
    timingSigmaThreshold: 50,
    crowdDampeningThreshold: 0.7,
  },
};

/**
 * Casino/gambling-optimized preset for high-velocity slot/battle command spam.
 */
export const CASINO_CHANNEL_CONFIG: ChannelConfig = {
  ...DEFAULT_CHANNEL_CONFIG,
  metronome: {
    ...DEFAULT_CHANNEL_CONFIG.metronome,
    precisionLowSigma: 20,
    precisionMediumSigma: 50,
    precisionHighSigma: 100,
    entropyThreshold: 1.5,
    periodicityThreshold: 0.6,
  },
  pattern: {
    ...DEFAULT_CHANNEL_CONFIG.pattern,
    entropyThreshold: 2.0,
    mashThreshold: 0.6,
    similarityThreshold: 0.85,
  },
  noLifer: {
    ...DEFAULT_CHANNEL_CONFIG.noLifer,
    messagesPerMinuteThreshold: 60,
    hintThreshold: 5,
  },
  scoring: {
    ...DEFAULT_CHANNEL_CONFIG.scoring,
    spamMultiplier: 0.2,
  },
  commandSpam: {
    ...DEFAULT_CHANNEL_CONFIG.commandSpam,
    commandLikenessThreshold: 0.5,
    commandHighPenalty: 30,
    commandMediumPenalty: 12,
    commandBypassPenalty: 10,
    timingFusionFactor: 1.8,
    crowdDampeningThreshold: 0.65,
  },
};

function sanitizeChannelName(channel: string): string {
  return channel
    .toLowerCase()
    .replace(/^#/, '')
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 64);
}

export function getChannelConfigPath(channel: string): string {
  const name = sanitizeChannelName(channel);
  return path.join(CHANNELS_DIR, `${name}.json`);
}

export function getChannelConfig(channel: string): ChannelConfig {
  const configPath = getChannelConfigPath(channel);

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<ChannelConfig>;
      return mergeWithDefaults(parsed);
    } catch (err) {
      console.warn(`[ChannelConfig] Failed to read ${configPath}, using defaults.`, err);
    }
  }

  // Create default config file on first access
  writeChannelConfig(channel, DEFAULT_CHANNEL_CONFIG);
  return DEFAULT_CHANNEL_CONFIG;
}

export function writeChannelConfig(channel: string, config: ChannelConfig): void {
  if (!fs.existsSync(CHANNELS_DIR)) {
    fs.mkdirSync(CHANNELS_DIR, { recursive: true });
  }

  const configPath = getChannelConfigPath(channel);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Partially update a channel config, merging with existing values and defaults.
 */
export function updateChannelConfig(channel: string, partial: Partial<ChannelConfig>): ChannelConfig {
  const current = getChannelConfig(channel);
  const merged: ChannelConfig = {
    metronome: { ...current.metronome, ...partial.metronome },
    pattern: { ...current.pattern, ...partial.pattern },
    noLifer: { ...current.noLifer, ...partial.noLifer },
    social: { ...current.social, ...partial.social },
    context: { ...current.context, ...partial.context },
    scoring: { ...current.scoring, ...partial.scoring },
    copyPaste: { ...current.copyPaste, ...partial.copyPaste },
    entropy: { ...current.entropy, ...partial.entropy },
    typingDynamics: { ...current.typingDynamics, ...partial.typingDynamics },
    commandSpam: { ...current.commandSpam, ...partial.commandSpam },
  };
  writeChannelConfig(channel, merged);
  return merged;
}

function mergeWithDefaults(partial: Partial<ChannelConfig>): ChannelConfig {
  return {
    metronome: { ...DEFAULT_CHANNEL_CONFIG.metronome, ...partial.metronome },
    pattern: { ...DEFAULT_CHANNEL_CONFIG.pattern, ...partial.pattern },
    noLifer: { ...DEFAULT_CHANNEL_CONFIG.noLifer, ...partial.noLifer },
    social: { ...DEFAULT_CHANNEL_CONFIG.social, ...partial.social },
    context: { ...DEFAULT_CHANNEL_CONFIG.context, ...partial.context },
    scoring: { ...DEFAULT_CHANNEL_CONFIG.scoring, ...partial.scoring },
    copyPaste: { ...DEFAULT_CHANNEL_CONFIG.copyPaste, ...partial.copyPaste },
    entropy: { ...DEFAULT_CHANNEL_CONFIG.entropy, ...partial.entropy },
    typingDynamics: { ...DEFAULT_CHANNEL_CONFIG.typingDynamics, ...partial.typingDynamics },
    commandSpam: { ...DEFAULT_CHANNEL_CONFIG.commandSpam, ...partial.commandSpam },
  };
}
