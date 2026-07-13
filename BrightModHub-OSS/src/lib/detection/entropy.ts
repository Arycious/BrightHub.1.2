// ==========================================
// EntropyDetector — Message-Content Repetition Analysis
// ==========================================
// Low Shannon entropy over a user's recent messages is a strong signal for
// templated, copy-pasted, or otherwise mechanical chat behavior.

import { shannonEntropy } from './normalizer';
import type { ChannelConfig } from '../../types';

export interface EntropyResult {
  username: string;
  windowEntropy: number;     // entropy of the concatenated recent messages
  avgMessageEntropy: number; // average per-message entropy
  minMessageEntropy: number; // lowest single-message entropy
  botScoreDelta: number;
  karmaScoreDelta: number;
  isSuspicious: boolean;
  details: string;
}

interface UserEntropy {
  messages: string[];
}

export class EntropyDetector {
  private users: Map<string, UserEntropy> = new Map();
  private windowSize: number;
  private lowEntropyThreshold: number;
  private mediumEntropyThreshold: number;
  private lowPenalty: number;
  private mediumPenalty: number;

  constructor(config: ChannelConfig['entropy']) {
    this.windowSize = config.windowSize;
    this.lowEntropyThreshold = config.lowEntropyThreshold;
    this.mediumEntropyThreshold = config.mediumEntropyThreshold;
    this.lowPenalty = config.lowPenalty;
    this.mediumPenalty = config.mediumPenalty;
  }

  recordMessage(username: string, message: string): EntropyResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = { messages: [] };
      this.users.set(username, user);
    }

    user.messages.push(message);
    if (user.messages.length > this.windowSize) {
      user.messages.shift();
    }

    if (user.messages.length < 3) {
      return null;
    }

    return this.analyze(username, user);
  }

  private analyze(username: string, user: UserEntropy): EntropyResult {
    const messages = user.messages;
    const concatenated = messages.join('');
    const windowEntropy = shannonEntropy(concatenated);

    let entropySum = 0;
    let minEntropy = Infinity;
    for (const msg of messages) {
      const e = shannonEntropy(msg);
      entropySum += e;
      if (e < minEntropy) minEntropy = e;
    }
    const avgMessageEntropy = entropySum / messages.length;

    let botScoreDelta = 0;
    let karmaScoreDelta = 0;

    if (windowEntropy < this.lowEntropyThreshold) {
      botScoreDelta += this.lowPenalty;
    } else if (windowEntropy < this.mediumEntropyThreshold) {
      botScoreDelta += this.mediumPenalty;
    } else if (windowEntropy > this.mediumEntropyThreshold * 1.5) {
      karmaScoreDelta -= 2;
    }

    // A single extremely low-entropy message is also suspicious
    if (minEntropy < this.lowEntropyThreshold * 0.5 && messages.length >= this.windowSize) {
      botScoreDelta += Math.floor(this.mediumPenalty / 2);
    }

    const isSuspicious = botScoreDelta > 0;

    return {
      username,
      windowEntropy: Math.round(windowEntropy * 1000) / 1000,
      avgMessageEntropy: Math.round(avgMessageEntropy * 1000) / 1000,
      minMessageEntropy: Math.round(minEntropy * 1000) / 1000,
      botScoreDelta,
      karmaScoreDelta,
      isSuspicious,
      details: `windowEntropy=${windowEntropy.toFixed(2)}bits, avg=${avgMessageEntropy.toFixed(2)}bits, min=${minEntropy.toFixed(2)}bits`,
    };
  }

  reset(): void {
    this.users.clear();
  }
}
