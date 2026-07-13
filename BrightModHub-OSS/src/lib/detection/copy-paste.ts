// ==========================================
// GlobalCopyPasteDetector — Cross-User Copy-Paste Detection
// ==========================================
// Many botnets spam the same or nearly-identical message through multiple
// accounts. This detector keeps a channel-wide sliding window and flags
// every user that posts a message similar to one already seen recently.

import { normalizeForComparison, jaccardSimilarity } from './normalizer';
import type { ChannelConfig } from '../../types';

export interface CopyPasteResult {
  username: string;
  matchedMessage: string;
  matchingUserCount: number;
  botScoreDelta: number;
  isSuspicious: boolean;
  details: string;
}

interface RecentMessage {
  username: string;
  normalized: string;
  original: string;
  timestamp: number;
}

export class GlobalCopyPasteDetector {
  private recentMessages: RecentMessage[] = [];
  private windowMs: number;
  private minUniqueUsers: number;
  private similarityThreshold: number;
  private basePenalty: number;
  private penaltyPerUser: number;

  constructor(config: ChannelConfig['copyPaste']) {
    this.windowMs = config.windowMs;
    this.minUniqueUsers = config.minUniqueUsers;
    this.similarityThreshold = config.similarityThreshold;
    this.basePenalty = config.basePenalty;
    this.penaltyPerUser = config.penaltyPerUser;
  }

  recordMessage(username: string, message: string, timestamp: number): CopyPasteResult | null {
    const normalized = normalizeForComparison(message);
    if (normalized.length < 3) return null;

    this.cleanupOldMessages(timestamp);

    // Find recent similar messages from OTHER users
    const matches: RecentMessage[] = [];
    for (const recent of this.recentMessages) {
      if (recent.username === username) continue;
      const similarity = jaccardSimilarity(normalized, recent.normalized, 3);
      if (similarity >= this.similarityThreshold) {
        matches.push(recent);
      }
    }

    // Store this message for future detection
    this.recentMessages.push({ username, normalized, original: message, timestamp });

    if (matches.length === 0) return null;

    const uniqueUsers = new Set(matches.map((m) => m.username));
    if (uniqueUsers.size < this.minUniqueUsers - 1) return null;

    const matchingUserCount = uniqueUsers.size;
    const botScoreDelta = this.basePenalty + matchingUserCount * this.penaltyPerUser;

    // Use the most similar matched message for diagnostics
    const bestMatch = matches[0];

    return {
      username,
      matchedMessage: bestMatch.original,
      matchingUserCount,
      botScoreDelta,
      isSuspicious: true,
      details: `copyPaste: ${matchingUserCount} other users posted similar message`,
    };
  }

  private cleanupOldMessages(timestamp: number): void {
    const cutoff = timestamp - this.windowMs;
    this.recentMessages = this.recentMessages.filter((m) => m.timestamp >= cutoff);
  }

  reset(): void {
    this.recentMessages = [];
  }

  get messageCount(): number {
    return this.recentMessages.length;
  }
}
