// ==========================================
// TypingDynamicsDetector — Length vs. Time Analysis
// ==========================================
// Humans need more time to type longer messages. Bots and copy-paste users
// paste long messages instantly, producing a weak or negative correlation
// between message length and inter-message interval.

import type { ChannelConfig } from '../../types';

export interface TypingDynamicsResult {
  username: string;
  correlation: number;        // Pearson correlation between length and interval
  meanCharsPerSecond: number; // average typing speed implied by intervals
  botScoreDelta: number;
  karmaScoreDelta: number;
  isSuspicious: boolean;
  details: string;
}

interface MessageSample {
  length: number;
  intervalMs: number;
  timestamp: number;
}

interface UserDynamics {
  samples: MessageSample[];
}

export class TypingDynamicsDetector {
  private users: Map<string, UserDynamics> = new Map();
  private windowSize: number;
  private minCorrelation: number;
  private maxMeanCharsPerSecond: number;
  private penalty: number;

  constructor(config: ChannelConfig['typingDynamics']) {
    this.windowSize = config.windowSize;
    this.minCorrelation = config.minCorrelation;
    this.maxMeanCharsPerSecond = config.maxMeanCharsPerSecond;
    this.penalty = config.penalty;
  }

  recordMessage(username: string, message: string, timestamp: number): TypingDynamicsResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = { samples: [] };
      this.users.set(username, user);
    }

    const lastSample = user.samples[user.samples.length - 1];
    const intervalMs = lastSample ? timestamp - lastSample.timestamp : 0;

    // Ignore the first message (no interval) and implausibly long gaps (>30s)
    if (intervalMs > 0 && intervalMs <= 30000) {
      user.samples.push({
        length: message.length,
        intervalMs,
        timestamp,
      });
    } else if (intervalMs === 0) {
      // First message: store timestamp only for next interval calculation
      user.samples.push({ length: message.length, intervalMs: 0, timestamp });
    }

    if (user.samples.length > this.windowSize) {
      user.samples.shift();
    }

    // Need at least 4 real intervals to compute a meaningful correlation
    const validSamples = user.samples.filter((s) => s.intervalMs > 0);
    if (validSamples.length < 4) {
      return null;
    }

    return this.analyze(username, validSamples);
  }

  private analyze(username: string, samples: MessageSample[]): TypingDynamicsResult {
    const correlation = this.pearsonCorrelation(
      samples.map((s) => s.length),
      samples.map((s) => s.intervalMs)
    );

    const totalChars = samples.reduce((sum, s) => sum + s.length, 0);
    const totalMs = samples.reduce((sum, s) => sum + s.intervalMs, 0);
    const meanCharsPerSecond = totalMs > 0 ? (totalChars / totalMs) * 1000 : 0;

    let botScoreDelta = 0;
    let karmaScoreDelta = 0;

    // Strong positive correlation = human-like (longer messages take longer)
    if (correlation > 0.6) {
      karmaScoreDelta -= 3;
    }

    // Weak/negative correlation OR impossibly fast typing = suspicious
    if (correlation < this.minCorrelation || meanCharsPerSecond > this.maxMeanCharsPerSecond) {
      botScoreDelta += this.penalty;
    }

    const isSuspicious = botScoreDelta > 0;

    return {
      username,
      correlation: Math.round(correlation * 1000) / 1000,
      meanCharsPerSecond: Math.round(meanCharsPerSecond * 10) / 10,
      botScoreDelta,
      karmaScoreDelta,
      isSuspicious,
      details: `correlation=${correlation.toFixed(2)}, charsPerSec=${meanCharsPerSecond.toFixed(1)}`,
    };
  }

  private pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = xs.length;
    if (n === 0) return 0;

    const meanX = xs.reduce((a, b) => a + b, 0) / n;
    const meanY = ys.reduce((a, b) => a + b, 0) / n;

    let num = 0;
    let denX = 0;
    let denY = 0;

    for (let i = 0; i < n; i++) {
      const dx = xs[i] - meanX;
      const dy = ys[i] - meanY;
      num += dx * dy;
      denX += dx * dx;
      denY += dy * dy;
    }

    if (denX === 0 || denY === 0) return 0;
    return num / Math.sqrt(denX * denY);
  }

  reset(): void {
    this.users.clear();
  }
}
