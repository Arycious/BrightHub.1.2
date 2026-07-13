// ==========================================
// PatternDetector — High-Accuracy Message Content Analysis
// ==========================================
// Detects repetitive/templated messages, copy-paste variations, anti-duplicate
// bypass, low-entropy content, keyboard mashing, and n-gram repetition.

import {
  normalizeForComparison,
  normalizeForTemplate,
  extractTemplate,
  countZeroWidthChars,
  shannonEntropy,
  keyboardMashScore,
  ngramRepetitionScore,
  jaccardSimilarity,
} from './normalizer';
import type { ChannelConfig } from '../../types';

export interface PatternResult {
  username: string;
  similarity: number;
  zeroWidthCount: number;
  uniqueMessages: number;
  totalMessages: number;
  clusterRatio: number;
  templateRatio: number;
  entropy: number;
  avgEntropy: number;
  mashScore: number;
  ngramRepetition: number;
  botScoreDelta: number;
  karmaScoreDelta: number;
  noLiferHint: boolean;
  isSuspicious: boolean;
  details: string;
}

interface UserPatterns {
  rawMessages: string[];
  normalizedMessages: string[];
  totalMessages: number;
}

export class PatternDetector {
  private users: Map<string, UserPatterns> = new Map();
  private windowSize: number;
  private fuzzyClusterThreshold: number;
  private similarityThreshold: number;
  private templateThreshold: number;
  private entropyThreshold: number;
  private mashThreshold: number;
  private ngramRepetitionThreshold: number;
  private lowEntropyPenalty: number;
  private mediumEntropyPenalty: number;
  private mashPenalty: number;
  private ngramRepetitionPenalty: number;

  constructor(config: ChannelConfig['pattern']) {
    this.windowSize = config.windowSize;
    this.fuzzyClusterThreshold = config.fuzzyClusterThreshold;
    this.similarityThreshold = config.similarityThreshold;
    this.templateThreshold = config.templateThreshold;
    this.entropyThreshold = config.entropyThreshold;
    this.mashThreshold = config.mashThreshold;
    this.ngramRepetitionThreshold = config.ngramRepetitionThreshold;
    this.lowEntropyPenalty = config.lowEntropyPenalty;
    this.mediumEntropyPenalty = config.mediumEntropyPenalty;
    this.mashPenalty = config.mashPenalty;
    this.ngramRepetitionPenalty = config.ngramRepetitionPenalty;
  }

  recordMessage(username: string, rawMessage: string): PatternResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = { rawMessages: [], normalizedMessages: [], totalMessages: 0 };
      this.users.set(username, user);
    }

    user.rawMessages.push(rawMessage);
    user.normalizedMessages.push(normalizeForComparison(rawMessage));
    user.totalMessages++;

    if (user.rawMessages.length > this.windowSize) {
      user.rawMessages.shift();
      user.normalizedMessages.shift();
    }

    if (user.rawMessages.length < this.windowSize) {
      return null;
    }

    return this.analyze(username, user);
  }

  private analyze(username: string, user: UserPatterns): PatternResult {
    const rawMessages = user.rawMessages;
    const normalized = user.normalizedMessages;

    const zeroWidthCount = rawMessages.reduce(
      (sum, msg) => sum + countZeroWidthChars(msg),
      0
    );

    const similarity = this.calculateSimilarityScore(normalized);
    const uniqueMessages = new Set(normalized).size;
    const clusterRatio = this.calculateClusterRatio(normalized);
    const templateRatio = this.calculateTemplateRatio(rawMessages);

    const entropy = this.windowEntropy(normalized);
    const avgEntropy = normalized.reduce((sum, m) => sum + shannonEntropy(m), 0) / normalized.length;
    const mashScore = Math.max(...rawMessages.map((m) => keyboardMashScore(m)));
    const ngramRepetition = Math.max(...rawMessages.map((m) => ngramRepetitionScore(m, 3)));

    const { botScoreDelta, karmaScoreDelta, noLiferHint } = this.calculateScoreDeltas(
      similarity,
      clusterRatio,
      templateRatio,
      zeroWidthCount,
      uniqueMessages,
      normalized,
      entropy,
      avgEntropy,
      mashScore,
      ngramRepetition
    );

    const isSuspicious = botScoreDelta > 0 || zeroWidthCount > 3;

    return {
      username,
      similarity: Math.round(similarity * 1000) / 1000,
      zeroWidthCount,
      uniqueMessages,
      totalMessages: rawMessages.length,
      clusterRatio: Math.round(clusterRatio * 1000) / 1000,
      templateRatio: Math.round(templateRatio * 1000) / 1000,
      entropy: Math.round(entropy * 1000) / 1000,
      avgEntropy: Math.round(avgEntropy * 1000) / 1000,
      mashScore: Math.round(mashScore * 1000) / 1000,
      ngramRepetition: Math.round(ngramRepetition * 1000) / 1000,
      botScoreDelta,
      karmaScoreDelta,
      noLiferHint,
      isSuspicious,
      details: `sim=${(similarity * 100).toFixed(1)}%, cluster=${(clusterRatio * 100).toFixed(1)}%, template=${(templateRatio * 100).toFixed(1)}%, entropy=${entropy.toFixed(2)}bits, mash=${mashScore.toFixed(2)}, ngram=${ngramRepetition.toFixed(2)}, zwc=${zeroWidthCount}, unique=${uniqueMessages}/${rawMessages.length}`,
    };
  }

  private windowEntropy(messages: string[]): number {
    const concat = messages.join('');
    return shannonEntropy(concat);
  }

  private calculateSimilarityScore(normalizedMessages: string[]): number {
    if (normalizedMessages.length < 2) return 0;

    const mode = this.findMode(normalizedMessages);
    if (!mode) return 0;

    let identicalPairs = 0;
    for (const msg of normalizedMessages) {
      const similarity = jaccardSimilarity(msg, mode, 3);
      if (similarity > this.similarityThreshold) {
        identicalPairs++;
      }
    }

    return identicalPairs / normalizedMessages.length;
  }

  private calculateClusterRatio(normalizedMessages: string[]): number {
    if (normalizedMessages.length < 2) return 0;

    let bestClusterSize = 0;
    for (let i = 0; i < normalizedMessages.length; i++) {
      const seed = normalizedMessages[i];
      let clusterSize = 0;
      for (const msg of normalizedMessages) {
        const similarity = jaccardSimilarity(msg, seed, 3);
        if (similarity >= this.fuzzyClusterThreshold) {
          clusterSize++;
        }
      }
      if (clusterSize > bestClusterSize) {
        bestClusterSize = clusterSize;
      }
    }

    return bestClusterSize / normalizedMessages.length;
  }

  private calculateTemplateRatio(rawMessages: string[]): number {
    if (rawMessages.length < 2) return 0;

    const templates = rawMessages.map((msg) => extractTemplate(msg));
    const mode = this.findMode(templates);
    if (!mode) return 0;

    let matches = 0;
    for (const tpl of templates) {
      if (tpl === mode) matches++;
    }

    return matches / templates.length;
  }

  private findMode(messages: string[]): string | null {
    if (messages.length === 0) return null;

    const frequency = new Map<string, number>();
    for (const msg of messages) {
      frequency.set(msg, (frequency.get(msg) || 0) + 1);
    }

    let modeMsg = messages[0];
    let modeCount = 0;
    for (const [msg, count] of frequency) {
      if (count > modeCount) {
        modeCount = count;
        modeMsg = msg;
      }
    }

    return modeMsg;
  }

  private calculateScoreDeltas(
    similarity: number,
    clusterRatio: number,
    templateRatio: number,
    zeroWidthCount: number,
    uniqueMessages: number,
    normalizedMessages: string[],
    entropy: number,
    avgEntropy: number,
    mashScore: number,
    ngramRepetition: number
  ): { botScoreDelta: number; karmaScoreDelta: number; noLiferHint: boolean } {
    let botScoreDelta = 0;
    let karmaScoreDelta = 0;
    let noLiferHint = false;

    if (similarity > this.similarityThreshold && zeroWidthCount > 3) {
      botScoreDelta += 30;
    } else if (similarity > this.similarityThreshold) {
      botScoreDelta += 20;
    } else if (similarity > 0.8) {
      botScoreDelta += 10;
    } else if (similarity < 0.5) {
      karmaScoreDelta -= 3;
    }

    if (clusterRatio > 0.85) {
      botScoreDelta += 15;
    } else if (clusterRatio > 0.7) {
      botScoreDelta += 5;
      noLiferHint = true;
    }

    if (templateRatio > this.templateThreshold) {
      botScoreDelta += 10;
    } else if (templateRatio > 0.6) {
      botScoreDelta += 3;
      noLiferHint = true;
    }

    if (zeroWidthCount > 5) {
      botScoreDelta += 10;
    } else if (zeroWidthCount > 3) {
      botScoreDelta += 5;
    }

    // Entropy signals
    if (entropy < this.entropyThreshold * 0.6) {
      botScoreDelta += this.lowEntropyPenalty;
      noLiferHint = true;
    } else if (entropy < this.entropyThreshold) {
      botScoreDelta += this.mediumEntropyPenalty;
    } else if (entropy > this.entropyThreshold * 1.6) {
      karmaScoreDelta -= 2;
    }

    if (avgEntropy < this.entropyThreshold * 0.7) {
      botScoreDelta += Math.floor(this.mediumEntropyPenalty / 2);
    }

    // Mash / repetition signals
    if (mashScore >= this.mashThreshold) {
      botScoreDelta += this.mashPenalty;
    }
    if (ngramRepetition > this.ngramRepetitionThreshold) {
      botScoreDelta += this.ngramRepetitionPenalty;
      noLiferHint = true;
    }

    if (uniqueMessages >= normalizedMessages.length * 0.8) {
      karmaScoreDelta -= 2;
    }

    return { botScoreDelta, karmaScoreDelta, noLiferHint };
  }

  levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  reset(): void {
    this.users.clear();
  }
}
