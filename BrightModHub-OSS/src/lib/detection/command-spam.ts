// ==========================================
// CommandSpamDetector — Behavioral Slot/Battle Command Spam Detection
// ==========================================
// Keyword-free detection for casino/gambling streams. Viewers on rain.gg,
// rainbet, luxdrop, etc. can create arbitrary slot/battle names ("pizza",
// "supersized", "xyz123"), so we detect the *behavior* instead:
//   - high ratio of short, repetitive, bypass-laden messages
//   - mechanical timing when fused with Metronome data
//   - crowd dampening during legitimate drop/battle hype events

import {
  computeCommandLikeness,
  hasTrailingNumbersOrPunctuation,
  hasRepeatedWords,
  hasInvisibleOrHomoglyphBypass,
} from './normalizer';
import type { ChannelConfig } from '../../types';

export interface CommandSpamResult {
  username: string;
  commandLikeness: number;    // 0..1 score of the last message
  commandRatio: number;       // ratio of command-like messages in window
  bypassDetected: boolean;    // last message used bypass trick
  botScoreDelta: number;
  karmaScoreDelta: number;
  noLiferHint: boolean;
  commandSpammerFlag: boolean;
  isSuspicious: boolean;
  details: string;
}

interface MessageEntry {
  raw: string;
  likeness: number;
  timestamp: number;
}

interface UserCommands {
  messages: MessageEntry[];
  commandCount: number; // messages with likeness >= threshold
}

export class CommandSpamDetector {
  private users: Map<string, UserCommands> = new Map();
  private windowSize: number;
  private commandLikenessThreshold: number;
  private maxCommandRatio: number;
  private lowCommandRatio: number;
  private commandHighPenalty: number;
  private commandMediumPenalty: number;
  private commandBypassPenalty: number;
  private commandLowRatioKarmaBonus: number;
  private timingFusionFactor: number;
  private timingSigmaThreshold: number;
  private crowdDampeningThreshold: number;

  constructor(config: ChannelConfig['commandSpam']) {
    this.windowSize = config.windowSize;
    this.commandLikenessThreshold = config.commandLikenessThreshold;
    this.maxCommandRatio = config.maxCommandRatio;
    this.lowCommandRatio = config.lowCommandRatio;
    this.commandHighPenalty = config.commandHighPenalty;
    this.commandMediumPenalty = config.commandMediumPenalty;
    this.commandBypassPenalty = config.commandBypassPenalty;
    this.commandLowRatioKarmaBonus = config.commandLowRatioKarmaBonus;
    this.timingFusionFactor = config.timingFusionFactor;
    this.timingSigmaThreshold = config.timingSigmaThreshold ?? 50;
    this.crowdDampeningThreshold = config.crowdDampeningThreshold;
  }

  recordMessage(
    username: string,
    message: string,
    timestamp: number = Date.now(),
    metronomeSigma?: number,
    crowdCommandRatio?: number
  ): CommandSpamResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = { messages: [], commandCount: 0 };
      this.users.set(username, user);
    }

    const previousRaw = user.messages.map((m) => m.raw);
    const likeness = computeCommandLikeness(message, previousRaw);
    const isCommandLike = likeness >= this.commandLikenessThreshold;
    const bypassDetected =
      hasTrailingNumbersOrPunctuation(message) ||
      hasRepeatedWords(message) ||
      hasInvisibleOrHomoglyphBypass(message);

    user.messages.push({ raw: message, likeness, timestamp });
    if (isCommandLike) user.commandCount++;

    if (user.messages.length > this.windowSize) {
      const removed = user.messages.shift()!;
      if (removed.likeness >= this.commandLikenessThreshold) {
        user.commandCount = Math.max(0, user.commandCount - 1);
      }
    }

    if (user.messages.length < 3) {
      return null;
    }

    const commandRatio = user.messages.length > 0 ? user.commandCount / user.messages.length : 0;

    let botScoreDelta = 0;
    let karmaScoreDelta = 0;
    let noLiferHint = false;

    if (commandRatio >= this.maxCommandRatio) {
      botScoreDelta += this.commandHighPenalty;
      noLiferHint = true;
    } else if (commandRatio >= this.lowCommandRatio) {
      botScoreDelta += this.commandMediumPenalty;
      noLiferHint = true;
    }

    if (bypassDetected && isCommandLike) {
      botScoreDelta += this.commandBypassPenalty;
    }

    // Timing fusion: mechanical timing + command spam = much stronger bot signal
    if (
      typeof metronomeSigma === 'number' &&
      metronomeSigma < this.timingSigmaThreshold &&
      commandRatio >= this.lowCommandRatio
    ) {
      botScoreDelta = Math.round(botScoreDelta * this.timingFusionFactor);
    }

    // Crowd dampening: during a legitimate command hype event (drop/battle)
    // reduce individual penalties so real humans don't all get flagged.
    if (
      typeof crowdCommandRatio === 'number' &&
      crowdCommandRatio >= this.crowdDampeningThreshold &&
      botScoreDelta > 0
    ) {
      botScoreDelta = Math.round(botScoreDelta * 0.7);
    }

    if (commandRatio < this.lowCommandRatio && !isCommandLike) {
      // User is chatting normally without spamming commands -> trust bonus
      karmaScoreDelta += this.commandLowRatioKarmaBonus;
    }

    const commandSpammerFlag = commandRatio >= this.maxCommandRatio;
    const isSuspicious = botScoreDelta > 0;

    return {
      username,
      commandLikeness: Math.round(likeness * 1000) / 1000,
      commandRatio: Math.round(commandRatio * 1000) / 1000,
      bypassDetected,
      botScoreDelta,
      karmaScoreDelta,
      noLiferHint,
      commandSpammerFlag,
      isSuspicious,
      details: `likeness=${(likeness * 100).toFixed(1)}%, ratio=${(commandRatio * 100).toFixed(1)}%, bypass=${bypassDetected}, sigma=${metronomeSigma ?? 'none'}, crowd=${crowdCommandRatio ?? 'none'}`,
    };
  }

  getCommandRatio(username: string): number {
    const user = this.users.get(username);
    if (!user || user.messages.length === 0) return 0;
    return user.commandCount / user.messages.length;
  }

  reset(): void {
    this.users.clear();
  }
}
