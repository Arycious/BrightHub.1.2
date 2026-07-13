// ==========================================
// ContextDetector — Coordination & Event Reaction Analysis
// ==========================================
// Detects coordinated bot waves (including fuzzy/near-identical messages)
// and rapid reactions to streamer events.

import { normalizeForComparison, jaccardSimilarity, shannonEntropy } from './normalizer';
import type { ChannelConfig } from '../../types';

export interface ContextResult {
  username: string;
  botScoreDelta: number;
  waveDetected: boolean;
  reactionTimeMs?: number;
  details: string;
}

interface RecentMessage {
  username: string;
  normalized: string;
  raw: string;
  timestamp: number;
}

export class ContextDetector {
  private recentMessages: RecentMessage[] = [];
  private waveWindowMs: number;
  private waveMinUsers: number;
  private waveMinMessages: number;
  private maxRecentMessages: number;
  private fastReactionMs: number;
  private mediumReactionMs: number;
  private fuzzyWaveSimilarity: number;

  constructor(config: ChannelConfig['context']) {
    this.waveWindowMs = config.waveWindowMs;
    this.waveMinUsers = config.waveMinUsers;
    this.waveMinMessages = config.waveMinMessages;
    this.maxRecentMessages = config.maxRecentMessages;
    this.fastReactionMs = config.fastReactionMs;
    this.mediumReactionMs = config.mediumReactionMs;
    this.fuzzyWaveSimilarity = config.fuzzyWaveSimilarity;
  }

  recordMessage(
    username: string,
    message: string,
    timestamp: number,
    eventTimestamp?: number
  ): ContextResult | null {
    const normalized = normalizeForComparison(message);

    this.recentMessages.push({ username, normalized, raw: message, timestamp });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    let botScoreDelta = 0;
    let waveDetected = false;
    let reactionTimeMs: number | undefined;

    const wave = this.detectWave(normalized, timestamp, username);
    if (wave) {
      botScoreDelta += 25;
      waveDetected = true;
    }

    if (eventTimestamp) {
      reactionTimeMs = timestamp - eventTimestamp;
      const messageEntropy = shannonEntropy(normalized);
      // Faster reactions to low-entropy messages are more suspicious
      const entropyFactor = messageEntropy < 2.5 ? 1.5 : 1.0;

      if (reactionTimeMs < this.fastReactionMs) {
        botScoreDelta += Math.round(30 * entropyFactor);
      } else if (reactionTimeMs < this.mediumReactionMs) {
        botScoreDelta += Math.round(10 * entropyFactor);
      }
    }

    if (botScoreDelta === 0) {
      return null;
    }

    return {
      username,
      botScoreDelta,
      waveDetected,
      reactionTimeMs,
      details: `wave=${waveDetected}, reaction=${reactionTimeMs ?? 'n/a'}ms`,
    };
  }

  private detectWave(normalized: string, timestamp: number, username: string): boolean {
    const windowStart = timestamp - this.waveWindowMs;
    const windowMessages = this.recentMessages.filter(
      (m) => m.timestamp >= windowStart && m.username !== username
    );

    // Exact matches first
    const exactMatches = windowMessages.filter((m) => m.normalized === normalized);
    const exactUsers = new Set(exactMatches.map((m) => m.username));
    if (exactUsers.size >= this.waveMinUsers - 1 && exactMatches.length >= this.waveMinMessages - 1) {
      return true;
    }

    // Fuzzy matches
    const fuzzyMatches = windowMessages.filter((m) => {
      if (m.normalized === normalized) return false;
      const similarity = jaccardSimilarity(normalized, m.normalized, 3);
      return similarity >= this.fuzzyWaveSimilarity;
    });

    const fuzzyUsers = new Set(fuzzyMatches.map((m) => m.username));
    const totalUsers = new Set([...exactUsers, ...fuzzyUsers]);
    const totalMessages = exactMatches.length + fuzzyMatches.length;

    return totalUsers.size >= this.waveMinUsers - 1 && totalMessages >= this.waveMinMessages - 1;
  }

  registerEvent(_eventType: string, _timestamp: number): void {
    // Stored for future use when event-triggered detection is wired into the engine.
  }

  reset(): void {
    this.recentMessages = [];
  }

  get messageCount(): number {
    return this.recentMessages.length;
  }
}
