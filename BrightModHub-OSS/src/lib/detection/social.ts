// ==========================================
// SocialDetector — Communication Analysis
// ==========================================
// Rewards genuine interaction: replies, conversations, full sentences, lexical variety.

import {
  countWords,
  extractMentions,
  isReply,
  normalizeForComparison,
} from './normalizer';
import type { ChannelConfig } from '../../types';

export interface SocialResult {
  username: string;
  avgMessageLength: number;
  lexicalDiversity: number;
  replyRatio: number;
  uniqueRecipients: number;
  conversationChains: number;
  communicativeRank: CommunicativeRank;
  karmaScoreDelta: number;
  botScoreDelta: number;
  noLiferHint: boolean;
  details: string;
}

type CommunicativeRank = 'neutral' | 'talkative' | 'socialite' | 'regular';

interface MessageRecord {
  message: string;
  normalized: string;
  timestamp: number;
  wordCount: number;
  mentions: string[];
  isReply: boolean;
}

interface UserSocial {
  messages: MessageRecord[];
  repliesTo: Map<string, number>;
  totalWords: number;
  uniqueWords: Set<string>;
  conversationChainCount: number;
}

export class SocialDetector {
  private users: Map<string, UserSocial> = new Map();
  private windowSize: number;
  private chainThresholdMs: number;

  constructor(config: ChannelConfig['social']) {
    this.windowSize = config.windowSize;
    this.chainThresholdMs = config.chainThresholdMs;
  }

  recordMessage(
    username: string,
    message: string,
    timestamp: number,
    allRecentMessages: { username: string; message: string; timestamp: number }[]
  ): SocialResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = {
        messages: [],
        repliesTo: new Map(),
        totalWords: 0,
        uniqueWords: new Set(),
        conversationChainCount: 0,
      };
      this.users.set(username, user);
    }

    const normalized = normalizeForComparison(message);
    const wordCount = countWords(message);
    const mentions = extractMentions(message);
    const reply = isReply(message);

    let replyTarget: string | null = null;
    if (reply && mentions.length > 0) {
      replyTarget = mentions[0];
    } else if (!reply && mentions.length > 0) {
      replyTarget = mentions[0];
    }

    if (replyTarget) {
      user.repliesTo.set(replyTarget, (user.repliesTo.get(replyTarget) || 0) + 1);
    }

    if (replyTarget) {
      const recentPartnerMessages = allRecentMessages.filter(
        (m) =>
          m.username === replyTarget &&
          m.timestamp >= timestamp - this.chainThresholdMs &&
          extractMentions(m.message).includes(username)
      );
      if (recentPartnerMessages.length > 0) {
        user.conversationChainCount++;
      }
    }

    const words = normalized.split(/\s+/).filter((w) => w.length > 0);
    for (const word of words) {
      user.uniqueWords.add(word);
    }
    user.totalWords += wordCount;

    user.messages.push({
      message,
      normalized,
      timestamp,
      wordCount,
      mentions,
      isReply: reply,
    });

    if (user.messages.length > this.windowSize) {
      const removed = user.messages.shift()!;
      user.totalWords -= removed.wordCount;
    }

    user.uniqueWords = new Set();
    for (const msg of user.messages) {
      for (const word of msg.normalized.split(/\s+/).filter((w) => w.length > 0)) {
        user.uniqueWords.add(word);
      }
    }

    if (user.messages.length < 3) {
      return null;
    }

    return this.analyze(username, user);
  }

  private analyze(username: string, user: UserSocial): SocialResult {
    const messages = user.messages;
    const total = messages.length;

    const avgMessageLength = messages.reduce((sum, m) => sum + m.wordCount, 0) / total;
    const lexicalDiversity = user.totalWords > 0 ? user.uniqueWords.size / user.totalWords : 0;
    const replyCount = messages.filter((m) => m.isReply || m.mentions.length > 0).length;
    const replyRatio = replyCount / total;
    const uniqueRecipients = user.repliesTo.size;
    const conversationChains = user.conversationChainCount;

    const communicativeRank = this.calculateRank(
      avgMessageLength,
      replyRatio,
      uniqueRecipients,
      conversationChains,
      lexicalDiversity
    );

    const { karmaScoreDelta, botScoreDelta, noLiferHint } = this.calculateScoreDeltas(
      avgMessageLength,
      replyRatio,
      uniqueRecipients,
      conversationChains,
      lexicalDiversity
    );

    return {
      username,
      avgMessageLength: Math.round(avgMessageLength * 10) / 10,
      lexicalDiversity: Math.round(lexicalDiversity * 1000) / 1000,
      replyRatio: Math.round(replyRatio * 1000) / 1000,
      uniqueRecipients,
      conversationChains,
      communicativeRank,
      karmaScoreDelta,
      botScoreDelta,
      noLiferHint,
      details: `avg=${avgMessageLength.toFixed(1)} words, diversity=${(lexicalDiversity * 100).toFixed(1)}%, replies=${(replyRatio * 100).toFixed(1)}%, recipients=${uniqueRecipients}, chains=${conversationChains}, rank=${communicativeRank}`,
    };
  }

  private calculateRank(
    avgLength: number,
    replyRatio: number,
    uniqueRecipients: number,
    conversationChains: number,
    lexicalDiversity: number
  ): CommunicativeRank {
    if (
      avgLength >= 6 &&
      replyRatio >= 0.25 &&
      uniqueRecipients >= 3 &&
      conversationChains >= 2 &&
      lexicalDiversity >= 0.5
    ) {
      return 'regular';
    }

    if (
      avgLength >= 4 &&
      replyRatio >= 0.2 &&
      uniqueRecipients >= 2 &&
      conversationChains >= 1
    ) {
      return 'socialite';
    }

    if (replyRatio >= 0.15 || uniqueRecipients >= 2 || conversationChains >= 1) {
      return 'talkative';
    }

    return 'neutral';
  }

  private calculateScoreDeltas(
    avgLength: number,
    replyRatio: number,
    uniqueRecipients: number,
    conversationChains: number,
    lexicalDiversity: number
  ): { karmaScoreDelta: number; botScoreDelta: number; noLiferHint: boolean } {
    let karmaScoreDelta = 0;
    let botScoreDelta = 0;
    let noLiferHint = false;

    if (replyRatio >= 0.3) {
      karmaScoreDelta -= 5;
    } else if (replyRatio >= 0.15) {
      karmaScoreDelta -= 3;
    }

    if (conversationChains >= 2) {
      karmaScoreDelta -= 4;
    } else if (conversationChains >= 1) {
      karmaScoreDelta -= 2;
    }

    if (avgLength >= 6 && lexicalDiversity >= 0.5) {
      karmaScoreDelta -= 3;
    } else if (avgLength >= 4) {
      karmaScoreDelta -= 1;
    }

    if (uniqueRecipients >= 3) {
      karmaScoreDelta -= 2;
    }

    if (avgLength <= 2 && replyRatio < 0.05) {
      botScoreDelta += 2;
      karmaScoreDelta += 1;
      noLiferHint = true;
    }

    return { karmaScoreDelta, botScoreDelta, noLiferHint };
  }

  reset(): void {
    this.users.clear();
  }
}
