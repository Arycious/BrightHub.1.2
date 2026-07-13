// ==========================================
// BrightModHub — Detection Engine — Orchestrator
// ==========================================
// Central coordinator that routes chat messages through all detectors
// and manages the adaptive threshold system.

import { MetronomeDetector } from './metronome';
import { PatternDetector } from './pattern';
import { SocialDetector } from './social';
import { ContextDetector } from './context';
import { NoLiferDetector } from './no-lifer';
import { EntropyDetector } from './entropy';
import { TypingDynamicsDetector } from './typing-dynamics';
import { GlobalCopyPasteDetector } from './copy-paste';
import { CommandSpamDetector } from './command-spam';
import { ScoreManager } from './scoring';
import {
  upsertUser,
  insertMessageHistory,
  upsertRelationship,
  updateUserSocialMetrics,
} from '../db';
import {
  ChatMessage,
  DimensionUpdate,
  ConnectionState,
  type CommunicativeRank,
  type ChannelConfig,
} from '../../types';
import {
  isReply,
  extractMentions,
  countWords,
  normalizeForComparison,
  computeCommandLikeness,
} from './normalizer';

interface RecentMessage {
  username: string;
  message: string;
  timestamp: number;
}

export class DetectionEngine {
  private metronome: MetronomeDetector;
  private pattern: PatternDetector;
  private social: SocialDetector;
  private context: ContextDetector;
  private noLifer: NoLiferDetector;
  private entropy: EntropyDetector;
  private typingDynamics: TypingDynamicsDetector;
  private copyPaste: GlobalCopyPasteDetector;
  private commandSpam: CommandSpamDetector;
  private scoring: ScoreManager;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private onDimensionUpdate: ((update: DimensionUpdate) => void) | null = null;
  private messageCount: number = 0;
  private flagCount: number = 0;
  private trackedUsernames: Set<string> = new Set();
  private recentMessages: RecentMessage[] = [];
  private readonly maxRecentMessages = 200;
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
    this.metronome = new MetronomeDetector(config.metronome);
    this.pattern = new PatternDetector(config.pattern);
    this.social = new SocialDetector(config.social);
    this.context = new ContextDetector(config.context);
    this.noLifer = new NoLiferDetector(config.noLifer);
    this.entropy = new EntropyDetector(config.entropy);
    this.typingDynamics = new TypingDynamicsDetector(config.typingDynamics);
    this.copyPaste = new GlobalCopyPasteDetector(config.copyPaste);
    this.commandSpam = new CommandSpamDetector(config.commandSpam);
    this.scoring = new ScoreManager(config.scoring);
  }

  setOnDimensionUpdate(callback: (update: DimensionUpdate) => void): void {
    this.onDimensionUpdate = callback;
  }

  /**
   * Process an incoming chat message through all detectors.
   */
  processMessage(msg: ChatMessage): DimensionUpdate[] {
    if (this.connectionState !== ConnectionState.CONNECTED) {
      return [];
    }

    this.messageCount++;
    this.trackedUsernames.add(msg.username);
    const updates: DimensionUpdate[] = [];

    upsertUser(
      msg.username,
      msg.displayName,
      msg.isSub,
      msg.isMod,
      msg.isVip,
      msg.subMonths
    );

    this.recentMessages.push({ username: msg.username, message: msg.message, timestamp: msg.timestamp });
    if (this.recentMessages.length > this.maxRecentMessages) {
      this.recentMessages.shift();
    }

    const normalized = normalizeForComparison(msg.message);
    const wordCount = countWords(msg.message);
    const mentions = extractMentions(msg.message);
    const reply = isReply(msg.message);
    const replyTarget = mentions.length > 0 ? mentions[0] : null;

    insertMessageHistory(
      msg.username,
      msg.message,
      normalized,
      msg.timestamp,
      reply,
      replyTarget,
      wordCount
    );

    if (replyTarget) {
      upsertRelationship(msg.username, replyTarget);
    }

    const karmaUpdates = this.scoring.applyKarmaBonuses(
      msg.username,
      msg.isSub,
      msg.isMod,
      msg.isVip,
      msg.subMonths
    );
    updates.push(...karmaUpdates);

    const metroResult = this.metronome.recordMessage(msg.username, msg.timestamp, msg.message.length);
    if (metroResult) {
      let shouldApplyBot = metroResult.botScoreDelta > 0;

      if (this.scoring.isSpamMode) {
        const crowdMedian = this.metronome.getCrowdMedianSigma();
        shouldApplyBot = this.metronome.isRelativelySuspicious(metroResult.sigma, crowdMedian, 0.3);
      }

      if (shouldApplyBot || metroResult.karmaScoreDelta !== 0) {
        const update = this.scoring.applyDetection(msg.username, 'metronome', {
          botDelta: shouldApplyBot ? metroResult.botScoreDelta : 0,
          karmaDelta: metroResult.karmaScoreDelta,
        }, {
          sigma: metroResult.sigma,
          cv: metroResult.cv,
          mean: metroResult.mean,
          mad: metroResult.mad,
          intervalEntropy: metroResult.intervalEntropy,
          periodicity: metroResult.periodicity,
          runsRatio: metroResult.runsRatio,
          lengthCorrelation: metroResult.lengthCorrelation,
          intervals: metroResult.intervals,
          isBurst: metroResult.isBurst,
          suspiciousSignals: metroResult.suspiciousSignals,
          crowdMedian: this.scoring.isSpamMode ? this.metronome.getCrowdMedianSigma() : undefined,
        });
        if (update) {
          updates.push(update);
          if (update.botDelta > 0) this.flagCount++;
        }
      }
    }

    const patternResult = this.pattern.recordMessage(msg.username, msg.message);
    if (patternResult) {
      if (patternResult.botScoreDelta > 0 || patternResult.karmaScoreDelta !== 0) {
        const update = this.scoring.applyDetection(msg.username, 'pattern', {
          botDelta: patternResult.botScoreDelta,
          karmaDelta: patternResult.karmaScoreDelta,
        }, {
          similarity: patternResult.similarity,
          clusterRatio: patternResult.clusterRatio,
          templateRatio: patternResult.templateRatio,
          entropy: patternResult.entropy,
          avgEntropy: patternResult.avgEntropy,
          mashScore: patternResult.mashScore,
          ngramRepetition: patternResult.ngramRepetition,
          zeroWidthCount: patternResult.zeroWidthCount,
          uniqueMessages: patternResult.uniqueMessages,
        });
        if (update) {
          updates.push(update);
          if (update.botDelta > 0) this.flagCount++;
        }
      }
    }

    const socialResult = this.social.recordMessage(
      msg.username,
      msg.message,
      msg.timestamp,
      this.recentMessages
    );
    if (socialResult) {
      updateUserSocialMetrics(
        msg.username,
        socialResult.avgMessageLength,
        socialResult.replyRatio,
        socialResult.uniqueRecipients,
        0,
        0
      );

      if (socialResult.botScoreDelta > 0 || socialResult.karmaScoreDelta !== 0) {
        const update = this.scoring.applyDetection(msg.username, 'social', {
          botDelta: socialResult.botScoreDelta,
          karmaDelta: socialResult.karmaScoreDelta,
          communicativeRank: socialResult.communicativeRank as CommunicativeRank,
        }, {
          avgMessageLength: socialResult.avgMessageLength,
          lexicalDiversity: socialResult.lexicalDiversity,
          replyRatio: socialResult.replyRatio,
          uniqueRecipients: socialResult.uniqueRecipients,
          conversationChains: socialResult.conversationChains,
        });
        if (update) {
          updates.push(update);
          if (update.botDelta > 0) this.flagCount++;
        }
      }
    }

    const contextResult = this.context.recordMessage(msg.username, msg.message, msg.timestamp);
    if (contextResult && contextResult.botScoreDelta > 0) {
      const update = this.scoring.applyDetection(msg.username, 'context', {
        botDelta: contextResult.botScoreDelta,
        karmaDelta: 0,
      }, {
        waveDetected: contextResult.waveDetected,
        reactionTimeMs: contextResult.reactionTimeMs,
      });
      if (update) {
        updates.push(update);
        if (update.botDelta > 0) this.flagCount++;
      }
    }

    const entropyResult = this.entropy.recordMessage(msg.username, msg.message);
    if (entropyResult && entropyResult.botScoreDelta > 0) {
      const update = this.scoring.applyDetection(msg.username, 'entropy', {
        botDelta: entropyResult.botScoreDelta,
        karmaDelta: entropyResult.karmaScoreDelta,
      }, {
        windowEntropy: entropyResult.windowEntropy,
        avgMessageEntropy: entropyResult.avgMessageEntropy,
        minMessageEntropy: entropyResult.minMessageEntropy,
      });
      if (update) {
        updates.push(update);
        if (update.botDelta > 0) this.flagCount++;
      }
    }

    const typingResult = this.typingDynamics.recordMessage(msg.username, msg.message, msg.timestamp);
    if (typingResult) {
      if (typingResult.botScoreDelta > 0 || typingResult.karmaScoreDelta !== 0) {
        const update = this.scoring.applyDetection(msg.username, 'typing_dynamics', {
          botDelta: typingResult.botScoreDelta,
          karmaDelta: typingResult.karmaScoreDelta,
        }, {
          correlation: typingResult.correlation,
          meanCharsPerSecond: typingResult.meanCharsPerSecond,
        });
        if (update) {
          updates.push(update);
          if (update.botDelta > 0) this.flagCount++;
        }
      }
    }

    const copyPasteResult = this.copyPaste.recordMessage(msg.username, msg.message, msg.timestamp);
    if (copyPasteResult && copyPasteResult.botScoreDelta > 0) {
      const update = this.scoring.applyDetection(msg.username, 'copy_paste', {
        botDelta: copyPasteResult.botScoreDelta,
        karmaDelta: 0,
      }, {
        matchedMessage: copyPasteResult.matchedMessage,
        matchingUserCount: copyPasteResult.matchingUserCount,
      });
      if (update) {
        updates.push(update);
        if (update.botDelta > 0) this.flagCount++;
      }
    }

    const crowdCommandRatio = this.computeCrowdCommandRatio();
    const commandSpamResult = this.commandSpam.recordMessage(
      msg.username,
      msg.message,
      msg.timestamp,
      metroResult?.sigma,
      crowdCommandRatio
    );
    if (commandSpamResult) {
      updateUserSocialMetrics(
        msg.username,
        socialResult?.avgMessageLength ?? 0,
        socialResult?.replyRatio ?? 0,
        socialResult?.uniqueRecipients ?? 0,
        0,
        commandSpamResult.commandRatio
      );

      if (commandSpamResult.botScoreDelta > 0 || commandSpamResult.karmaScoreDelta !== 0 || commandSpamResult.commandSpammerFlag) {
        const update = this.scoring.applyDetection(msg.username, 'command_spam', {
          botDelta: commandSpamResult.botScoreDelta,
          karmaDelta: commandSpamResult.karmaScoreDelta,
          commandSpammerFlag: commandSpamResult.commandSpammerFlag,
          commandRatio: commandSpamResult.commandRatio,
        }, {
          commandLikeness: commandSpamResult.commandLikeness,
          commandRatio: commandSpamResult.commandRatio,
          bypassDetected: commandSpamResult.bypassDetected,
          crowdCommandRatio,
        });
        if (update) {
          updates.push(update);
          if (update.botDelta > 0) this.flagCount++;
        }
      }
    }

    const noLiferResult = this.noLifer.recordMessage(
      msg.username,
      msg.timestamp,
      metroResult?.isBurst ?? false,
      patternResult?.noLiferHint ?? false,
      socialResult?.noLiferHint ?? false,
      commandSpamResult?.noLiferHint ?? false
    );
    if (noLiferResult && noLiferResult.noLiferFlag) {
      const update = this.scoring.applyDetection(msg.username, 'no_lifer', {
        botDelta: noLiferResult.botScoreDelta,
        karmaDelta: noLiferResult.karmaScoreDelta,
        noLiferFlag: true,
      }, {
        reasons: noLiferResult.reasons,
      });
      if (update) {
        updates.push(update);
        if (update.botDelta > 0) this.flagCount++;
      }
    }

    for (const update of updates) {
      this.onDimensionUpdate?.(update);
    }

    return updates;
  }

  /**
   * Compute the global ratio of command-like messages in the recent chat window.
   * Used to dampen individual penalties during legitimate drop/battle hype events.
   */
  private computeCrowdCommandRatio(): number {
    if (this.recentMessages.length === 0) return 0;
    // Look at the most recent messages, capped at a reasonable sample size
    const sample = this.recentMessages.slice(-100);
    let commandLike = 0;
    for (const msg of sample) {
      if (computeCommandLikeness(msg.message) >= 0.55) {
        commandLike++;
      }
    }
    return commandLike / sample.length;
  }

  setConnectionState(state: ConnectionState): void {
    this.connectionState = state;
  }

  toggleSpamMode(): boolean {
    return this.scoring.setSpamMode(!this.scoring.isSpamMode);
  }

  getStats(): { trackedUsers: number; flagsRaised: number; messagesProcessed: number } {
    return {
      trackedUsers: this.trackedUsernames.size,
      flagsRaised: this.flagCount,
      messagesProcessed: this.messageCount,
    };
  }

  reset(): void {
    this.messageCount = 0;
    this.flagCount = 0;
    this.trackedUsernames.clear();
    this.recentMessages = [];
    this.metronome.reset();
    this.pattern.reset();
    this.social.reset();
    this.context.reset();
    this.noLifer.reset();
    this.entropy.reset();
    this.typingDynamics.reset();
    this.copyPaste.reset();
    this.commandSpam.reset();
    this.scoring.reset();
  }
}

let engineInstance: DetectionEngine | null = null;

export function getDetectionEngine(config?: ChannelConfig): DetectionEngine {
  if (!engineInstance) {
    if (!config) {
      throw new Error('DetectionEngine requires a ChannelConfig on first initialization');
    }
    engineInstance = new DetectionEngine(config);
  } else if (config) {
    // Re-initialize with new config when channel changes
    engineInstance = new DetectionEngine(config);
  }
  return engineInstance;
}
