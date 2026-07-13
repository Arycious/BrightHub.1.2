// ==========================================
// ScoreManager — Bot Score, Karma Score & User Classification
// ==========================================
// Manages persistent bot_score, karma_score, no_lifer_flag and communicative_rank.

import {
  DetectorType,
  getBotThreatLevel,
  getKarmaLevel,
  type KarmaLevel,
  type ThreatLevel,
  type CommunicativeRank,
  DimensionUpdate,
  type ChannelConfig,
} from '../../types';
import {
  updateDimensions,
  upsertUser,
  insertEvent,
} from '../db';

export interface KarmaBonus {
  type: string;
  delta: number; // karma delta (negative = trust bonus)
  reason: string;
}

export interface ScoreDeltas {
  botDelta: number;
  karmaDelta: number;
  noLiferFlag?: boolean;
  communicativeRank?: CommunicativeRank;
  commandSpammerFlag?: boolean;
  commandRatio?: number;
}

export class ScoreManager {
  private appliedKarmaBonuses: Set<string> = new Set(); // "username:bonusType"
  private spamMode: boolean = false;
  private spamMultiplier: number;
  private gracePeriodMs: number;
  private gracePeriodActive: boolean = false;

  constructor(config: ChannelConfig['scoring']) {
    this.spamMultiplier = config.spamMultiplier;
    this.gracePeriodMs = config.gracePeriodMs;
  }

  /**
   * Apply a score delta from a detector.
   */
  applyDetection(
    username: string,
    detectorType: DetectorType,
    deltas: ScoreDeltas,
    details: Record<string, unknown> = {}
  ): DimensionUpdate | null {
    if (this.gracePeriodActive) {
      return null;
    }

    let { botDelta, karmaDelta } = deltas;
    const { noLiferFlag, communicativeRank, commandSpammerFlag, commandRatio } = deltas;

    // Spam mode only dampens positive bot penalties
    if (this.spamMode && botDelta > 0) {
      botDelta = Math.round(botDelta * this.spamMultiplier);
    }

    if (
      botDelta === 0 &&
      karmaDelta === 0 &&
      noLiferFlag === undefined &&
      communicativeRank === undefined &&
      commandSpammerFlag === undefined &&
      commandRatio === undefined
    ) {
      return null;
    }

    // Atomic update in SQLite
    const result = updateDimensions(
      username,
      botDelta,
      karmaDelta,
      noLiferFlag ?? null,
      communicativeRank ?? null,
      commandSpammerFlag ?? null,
      commandRatio ?? null
    );

    // Log detection event(s)
    if (botDelta !== 0) {
      insertEvent({
        username,
        detectorType,
        scoreDelta: botDelta,
        details: JSON.stringify({
          ...details,
          dimension: 'bot',
          originalDelta: deltas.botDelta,
          spamMode: this.spamMode,
          multiplier: this.spamMode ? this.spamMultiplier : 1.0,
        }),
      });
    }

    if (karmaDelta !== 0) {
      insertEvent({
        username,
        detectorType,
        scoreDelta: karmaDelta,
        details: JSON.stringify({
          ...details,
          dimension: 'karma',
          originalDelta: deltas.karmaDelta,
        }),
      });
    }

    return {
      username,
      botScore: result.botScore,
      karmaScore: result.karmaScore,
      botDelta,
      karmaDelta,
      detector: detectorType,
      botThreatLevel: getBotThreatLevel(result.botScore),
      karmaLevel: getKarmaLevel(result.karmaScore),
      noLiferFlag: result.noLiferFlag,
      commandSpammerFlag: result.commandSpammerFlag,
      commandRatio: commandRatio ?? 0,
      communicativeRank: result.communicativeRank,
      details,
    };
  }

  /**
   * Apply initial karma bonuses for a user based on their Twitch status.
   */
  applyKarmaBonuses(
    username: string,
    isSub: boolean,
    isMod: boolean,
    isVip: boolean,
    subMonths: number
  ): DimensionUpdate[] {
    const updates: DimensionUpdate[] = [];
    const bonuses = this.calculateKarmaBonuses(username, isSub, isMod, isVip, subMonths);

    for (const bonus of bonuses) {
      const key = `${username}:${bonus.type}`;
      if (this.appliedKarmaBonuses.has(key)) continue;

      this.appliedKarmaBonuses.add(key);
      const result = this.applyDetection(username, 'karma', {
        botDelta: 0,
        karmaDelta: bonus.delta,
      }, {
        bonusType: bonus.type,
        reason: bonus.reason,
      });

      if (result) updates.push(result);
    }

    return updates;
  }

  private calculateKarmaBonuses(
    _username: string,
    isSub: boolean,
    isMod: boolean,
    isVip: boolean,
    subMonths: number
  ): KarmaBonus[] {
    const bonuses: KarmaBonus[] = [];

    if (isMod) {
      bonuses.push({ type: 'mod', delta: -30, reason: 'Moderator status' });
    }

    if (isVip) {
      bonuses.push({ type: 'vip', delta: -20, reason: 'VIP status' });
    }

    if (isSub && subMonths >= 3) {
      bonuses.push({ type: 'sub_veteran', delta: -15, reason: `Subscriber for ${subMonths} months` });
    } else if (isSub) {
      bonuses.push({ type: 'sub', delta: -5, reason: 'Subscriber' });
    }

    return bonuses;
  }

  setSpamMode(enabled: boolean): boolean {
    if (this.spamMode === enabled) return this.spamMode;
    this.spamMode = enabled;
    this.gracePeriodActive = true;
    setTimeout(() => {
      this.gracePeriodActive = false;
    }, this.gracePeriodMs);
    return this.spamMode;
  }

  get isSpamMode(): boolean {
    return this.spamMode;
  }

  get isGracePeriod(): boolean {
    return this.gracePeriodActive;
  }

  setSpamMultiplier(multiplier: number): void {
    this.spamMultiplier = Math.max(0.1, Math.min(1.0, multiplier));
  }

  reset(): void {
    this.appliedKarmaBonuses.clear();
    this.spamMode = false;
    this.gracePeriodActive = false;
  }
}
