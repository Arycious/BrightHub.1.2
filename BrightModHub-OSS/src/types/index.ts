// ==========================================
// BrightModHub — Core Type Definitions
// ==========================================

export interface TrackedUser {
  username: string;
  displayName: string;
  score: number;            // LEGACY: kept for compatibility, maps to bot_score
  botScore: number;         // 0…∞ — probability of automation
  karmaScore: number;       // KARMA_SCORE_MIN…KARMA_SCORE_MAX — social trust value
  isSubscriber: boolean;
  isMod: boolean;
  isVip: boolean;
  subMonths: number;
  firstSeen: string;
  lastSeen: string;
  totalMessages: number;
  totalFlags: number;
  noLiferFlag: boolean;
  commandSpammerFlag: boolean;
  commandRatio: number;
  communicativeRank: CommunicativeRank;
  avgMessageLength: number;
  replyRatio: number;
  uniqueRecipients: number;
  messagesPerMinute: number;
}

export type DetectorType =
  | 'metronome'
  | 'flash'
  | 'pattern'
  | 'karma'
  | 'gap'
  | 'social'
  | 'context'
  | 'no_lifer'
  | 'entropy'
  | 'copy_paste'
  | 'typing_dynamics'
  | 'command_spam';

export type ThreatLevel = 'clean' | 'suspicious' | 'likely_bot' | 'confirmed_bot';

export type CommunicativeRank = 'neutral' | 'talkative' | 'socialite' | 'regular';

export type UserCategory = 'bot' | 'no_lifer' | 'command_spammer' | 'communicative' | 'normal';

export interface DetectionEvent {
  id?: number;
  username: string;
  detectorType: DetectorType;
  scoreDelta: number;
  details: string;          // JSON string
  createdAt?: string;
}

export interface ScoreUpdate {
  username: string;
  newScore: number;
  delta: number;
  detector: DetectorType;
  threatLevel: ThreatLevel;
  details?: Record<string, unknown>;
}

export interface DimensionUpdate {
  username: string;
  botScore: number;
  karmaScore: number;
  botDelta: number;
  karmaDelta: number;
  detector: DetectorType;
  botThreatLevel: ThreatLevel;
  karmaLevel: KarmaLevel;
  noLiferFlag: boolean;
  commandSpammerFlag: boolean;
  commandRatio: number;
  communicativeRank: CommunicativeRank;
  details?: Record<string, unknown>;
}

export interface SessionInfo {
  id?: number;
  channel: string;
  startedAt: string;
  endedAt?: string;
  spamMode: boolean;
  totalUsers: number;
  totalFlags: number;
}

export interface AppConfig {
  channel: string;
  metronomeThreshold: number;     // σ threshold in ms
  metronomeWindowSize: number;    // number of messages to analyze
  flashThreshold: number;         // reaction time threshold in ms
  patternSimilarityThreshold: number;  // 0-1, above = suspicious
  scoreDecayRate: number;         // points per hour of inactivity
  batchIntervalMs: number;        // WS batch interval
  spamModeMultiplier: number;     // score multiplier in spam mode
  gracePeriodMs: number;          // grace period after phase toggle
}

export const DEFAULT_CONFIG: AppConfig = {
  channel: '',
  metronomeThreshold: 50,
  metronomeWindowSize: 10,
  flashThreshold: 300,
  patternSimilarityThreshold: 0.8,
  scoreDecayRate: 1,
  batchIntervalMs: 250,
  spamModeMultiplier: 0.3,
  gracePeriodMs: 30000,
};

export const NORMAL_THRESHOLDS = {
  metronome: 50,
  flash: 300,
  patternSimilarity: 0.8,
};

export const SPAM_THRESHOLDS = {
  metronome: 15,
  flash: 150,
  patternSimilarity: 0.95,
};

export const BOT_SCORE_THRESHOLDS = {
  clean: 100,
  suspicious: 300,
  likely_bot: 700,
};

// Connection state machine
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
}

// WebSocket message types
export interface WSMessage {
  type:
    | 'batch_update'
    | 'user_flagged'
    | 'chat_message'
    | 'phase_changed'
    | 'connection_status'
    | 'gap_event'
    | 'dimension_update'
    | 'communicative_rank_changed'
    | 'no_lifer_flagged';
  data: unknown;
}

export interface ChatMessage {
  username: string;
  displayName: string;
  message: string;
  timestamp: number;
  isSub: boolean;
  isMod: boolean;
  isVip: boolean;
  subMonths: number;
}

export type KarmaLevel = 'trusted' | 'neutral' | 'flagged';

export const KARMA_SCORE_MIN = -100000;
export const KARMA_SCORE_MAX = 100000;

/**
 * Legacy threat level based on the old single score.
 * Kept for backward compatibility with existing components.
 */
export function getThreatLevel(score: number): ThreatLevel {
  if (score > 1500) return 'confirmed_bot';
  if (score > 1000) return 'likely_bot';
  if (score > 500) return 'suspicious';
  return 'clean';
}

/**
 * Threat level based on the new bot_score dimension.
 */
export function getBotThreatLevel(botScore: number): ThreatLevel {
  if (botScore > BOT_SCORE_THRESHOLDS.likely_bot) return 'confirmed_bot';
  if (botScore > BOT_SCORE_THRESHOLDS.suspicious) return 'likely_bot';
  if (botScore > BOT_SCORE_THRESHOLDS.clean) return 'suspicious';
  return 'clean';
}

/**
 * Karma level based on the karma_score dimension.
 */
export function getKarmaLevel(karmaScore: number): KarmaLevel {
  if (karmaScore <= -50) return 'trusted';
  if (karmaScore >= 50) return 'flagged';
  return 'neutral';
}

// Per-channel detector configuration
export interface ChannelConfig {
  metronome: {
    windowSize: number;
    sigmaThresholdLow: number;
    sigmaThresholdMedium: number;
    sigmaThresholdHigh: number;
    burstWindowMs: number;
    burstMinMessages: number;
    precisionLowSigma: number;
    precisionMediumSigma: number;
    precisionHighSigma: number;
    madThresholdLow: number;
    madThresholdMedium: number;
    madThresholdHigh: number;
    entropyThreshold: number;
    periodicityThreshold: number;
    runsTestThreshold: number;
    lengthIntervalCorrelationPenalty: number;
    lengthIntervalCorrelationMin: number;
  };
  pattern: {
    windowSize: number;
    fuzzyClusterThreshold: number;
    similarityThreshold: number;
    templateThreshold: number;
    entropyThreshold: number;
    mashThreshold: number;
    ngramRepetitionThreshold: number;
    lowEntropyPenalty: number;
    mediumEntropyPenalty: number;
    mashPenalty: number;
    ngramRepetitionPenalty: number;
  };
  noLifer: {
    messagesPerMinuteThreshold: number;
    minMessages: number;
    hintThreshold: number;
  };
  social: {
    windowSize: number;
    chainThresholdMs: number;
  };
  context: {
    waveWindowMs: number;
    waveMinUsers: number;
    waveMinMessages: number;
    maxRecentMessages: number;
    fastReactionMs: number;
    mediumReactionMs: number;
    fuzzyWaveSimilarity: number;
  };
  scoring: {
    spamMultiplier: number;
    gracePeriodMs: number;
  };
  copyPaste: {
    windowMs: number;
    minUniqueUsers: number;
    similarityThreshold: number;
    basePenalty: number;
    penaltyPerUser: number;
  };
  entropy: {
    windowSize: number;
    lowEntropyThreshold: number;
    mediumEntropyThreshold: number;
    lowPenalty: number;
    mediumPenalty: number;
  };
  typingDynamics: {
    windowSize: number;
    minCorrelation: number;
    maxMeanCharsPerSecond: number;
    penalty: number;
  };
  commandSpam: {
    windowSize: number;
    commandLikenessThreshold: number;
    maxCommandRatio: number;
    lowCommandRatio: number;
    commandHighPenalty: number;
    commandMediumPenalty: number;
    commandBypassPenalty: number;
    commandLowRatioKarmaBonus: number;
    timingFusionFactor: number;
    timingSigmaThreshold: number;
    crowdDampeningThreshold: number;
  };
}

/**
 * Classify a user into one of the three main categories.
 */
export function getUserCategory(
  botScore: number,
  noLiferFlag: boolean,
  commandSpammerFlag: boolean,
  communicativeRank: CommunicativeRank
): UserCategory {
  if (getBotThreatLevel(botScore) === 'likely_bot' || getBotThreatLevel(botScore) === 'confirmed_bot') {
    return 'bot';
  }
  if (commandSpammerFlag) return 'command_spammer';
  if (noLiferFlag) return 'no_lifer';
  if (communicativeRank === 'socialite' || communicativeRank === 'regular') return 'communicative';
  return 'normal';
}
