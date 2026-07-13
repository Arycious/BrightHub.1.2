// ==========================================
// NoLiferDetector — Separate high-frequency repetitive humans from bots
// ==========================================
// No-Lifers are humans who spam a lot (copy-paste, high frequency) but do NOT
// show the machine-precision timing of bots. They get their own flag so the UI
// can separate them from confirmed bots.

import type { ChannelConfig } from '../../types';

export interface NoLiferResult {
  username: string;
  noLiferFlag: boolean;
  botScoreDelta: number;
  karmaScoreDelta: number;
  reasons: string[];
  details: string;
}

interface UserActivity {
  messageCount: number;
  firstMessageAt: number;
  lastMessageAt: number;
  noLiferHints: number;
  burstCount: number;
}

export class NoLiferDetector {
  private users: Map<string, UserActivity> = new Map();
  private messagesPerMinuteThreshold: number;
  private minMessages: number;
  private hintThreshold: number;

  constructor(config: ChannelConfig['noLifer']) {
    this.messagesPerMinuteThreshold = config.messagesPerMinuteThreshold;
    this.minMessages = config.minMessages;
    this.hintThreshold = config.hintThreshold;
  }

  recordMessage(
    username: string,
    timestamp: number,
    metronomeNoLiferHint: boolean,
    patternNoLiferHint: boolean,
    socialNoLiferHint: boolean,
    commandSpammerHint: boolean = false
  ): NoLiferResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = {
        messageCount: 0,
        firstMessageAt: timestamp,
        lastMessageAt: timestamp,
        noLiferHints: 0,
        burstCount: 0,
      };
      this.users.set(username, user);
    }

    user.messageCount++;
    user.lastMessageAt = timestamp;

    if (metronomeNoLiferHint) user.noLiferHints++;
    if (patternNoLiferHint) user.noLiferHints++;
    if (socialNoLiferHint) user.noLiferHints++;
    if (commandSpammerHint) user.noLiferHints++;

    if (user.messageCount < this.minMessages) {
      return null;
    }

    const durationMinutes = Math.max(
      (user.lastMessageAt - user.firstMessageAt) / 60000,
      1
    );
    const messagesPerMinute = user.messageCount / durationMinutes;

    const isHighFrequency = messagesPerMinute >= this.messagesPerMinuteThreshold;
    const hasHints = user.noLiferHints >= this.hintThreshold;

    const noLiferFlag = isHighFrequency || hasHints;

    if (!noLiferFlag) {
      return null;
    }

    const reasons: string[] = [];
    if (isHighFrequency) reasons.push(`high frequency: ${messagesPerMinute.toFixed(1)} msg/min`);
    if (hasHints) {
      const hintReasons: string[] = [];
      if (metronomeNoLiferHint) hintReasons.push('metronome');
      if (patternNoLiferHint) hintReasons.push('pattern');
      if (socialNoLiferHint) hintReasons.push('social');
      if (commandSpammerHint) hintReasons.push('command_spam');
      reasons.push(`repetitive behavior hints: ${hintReasons.join('+')}`);
    }

    const botScoreDelta = 2;
    const karmaScoreDelta = 3;

    return {
      username,
      noLiferFlag,
      botScoreDelta,
      karmaScoreDelta,
      reasons,
      details: reasons.join(', '),
    };
  }

  clearUser(username: string): void {
    this.users.delete(username);
  }

  reset(): void {
    this.users.clear();
  }
}
