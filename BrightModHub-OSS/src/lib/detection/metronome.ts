// ==========================================
// MetronomeDetector — High-Accuracy Auto-Typer Detection
// ==========================================
// Detects mechanical timing by combining multiple independent signals:
// sigma, coefficient of variation, MAD, interval entropy, periodicity,
// runs-test, and length-vs-interval correlation.

import type { ChannelConfig } from '../../types';

export interface MetronomeResult {
  username: string;
  sigma: number;          // Standard deviation in ms
  mean: number;           // Mean interval in ms
  cv: number;             // Coefficient of variation (sigma / mean)
  mad: number;            // Median absolute deviation of intervals
  intervalEntropy: number;// Shannon entropy of interval distribution
  periodicity: number;    // 0..1 strength of repeating interval pattern
  runsRatio: number;      // runs-test ratio (1.0 = very random)
  lengthCorrelation: number; // correlation between message length and interval
  intervals: number[];    // Raw intervals for debugging
  messageCount: number;
  botScoreDelta: number;
  karmaScoreDelta: number;
  isSuspicious: boolean;
  isBurst: boolean;       // True if recent messages arrived in a tight burst
  suspiciousSignals: number; // Count of independent suspicious signals
}

interface MessageRecord {
  timestamp: number;
  length: number;
}

interface UserTiming {
  messages: MessageRecord[];
  totalMessages: number;
}

export class MetronomeDetector {
  private users: Map<string, UserTiming> = new Map();
  private windowSize: number;
  private burstWindowMs: number;
  private burstMinMessages: number;
  private precisionLowSigma: number;
  private precisionMediumSigma: number;
  private precisionHighSigma: number;
  private madThresholdLow: number;
  private madThresholdMedium: number;
  private madThresholdHigh: number;
  private entropyThreshold: number;
  private periodicityThreshold: number;
  private runsTestThreshold: number;
  private lengthIntervalCorrelationPenalty: number;
  private lengthIntervalCorrelationMin: number;

  constructor(config: ChannelConfig['metronome']) {
    this.windowSize = config.windowSize;
    this.burstWindowMs = config.burstWindowMs;
    this.burstMinMessages = config.burstMinMessages;
    this.precisionLowSigma = config.precisionLowSigma;
    this.precisionMediumSigma = config.precisionMediumSigma;
    this.precisionHighSigma = config.precisionHighSigma;
    this.madThresholdLow = config.madThresholdLow;
    this.madThresholdMedium = config.madThresholdMedium;
    this.madThresholdHigh = config.madThresholdHigh;
    this.entropyThreshold = config.entropyThreshold;
    this.periodicityThreshold = config.periodicityThreshold;
    this.runsTestThreshold = config.runsTestThreshold;
    this.lengthIntervalCorrelationPenalty = config.lengthIntervalCorrelationPenalty;
    this.lengthIntervalCorrelationMin = config.lengthIntervalCorrelationMin;
  }

  recordMessage(username: string, timestamp: number, messageLength: number = 0): MetronomeResult | null {
    let user = this.users.get(username);
    if (!user) {
      user = { messages: [], totalMessages: 0 };
      this.users.set(username, user);
    }

    user.messages.push({ timestamp, length: messageLength });
    user.totalMessages++;

    if (user.messages.length > this.windowSize) {
      user.messages.shift();
    }

    if (user.messages.length < this.windowSize) {
      return null;
    }

    return this.analyze(username, user);
  }

  private analyze(username: string, user: UserTiming): MetronomeResult {
    const messages = user.messages;
    const timestamps = messages.map((m) => m.timestamp);
    const lengths = messages.map((m) => m.length);

    const intervals: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      intervals.push(timestamps[i] - timestamps[i - 1]);
    }

    const sigma = this.standardDeviation(intervals);
    const mean = this.mean(intervals);
    const cv = mean === 0 ? Infinity : sigma / mean;
    const mad = this.medianAbsoluteDeviation(intervals);
    const intervalEntropy = this.shannonEntropy(intervals);
    const periodicity = this.periodicityScore(intervals);
    const runsRatio = this.runsTestRatio(intervals);
    const lengthCorrelation = this.pearsonCorrelation(lengths.slice(1), intervals);
    const isBurst = this.detectBurst(timestamps);

    const lengthsVary = lengths.some((l) => l !== lengths[0]);

    const signals = this.evaluateSignals(
      sigma,
      cv,
      mad,
      intervalEntropy,
      periodicity,
      runsRatio,
      lengthCorrelation,
      lengthsVary,
      user.totalMessages
    );

    const { botScoreDelta, karmaScoreDelta } = this.calculateScoreDeltas(
      signals,
      isBurst,
      sigma
    );

    return {
      username,
      sigma: Math.round(sigma * 100) / 100,
      mean: Math.round(mean * 100) / 100,
      cv: Math.round(cv * 1000) / 1000,
      mad: Math.round(mad * 100) / 100,
      intervalEntropy: Math.round(intervalEntropy * 1000) / 1000,
      periodicity: Math.round(periodicity * 1000) / 1000,
      runsRatio: Math.round(runsRatio * 1000) / 1000,
      lengthCorrelation: Math.round(lengthCorrelation * 1000) / 1000,
      intervals,
      messageCount: user.totalMessages,
      botScoreDelta,
      karmaScoreDelta,
      isSuspicious: botScoreDelta > 0 || sigma < 100,
      isBurst,
      suspiciousSignals: signals.count,
    };
  }

  private evaluateSignals(
    sigma: number,
    cv: number,
    mad: number,
    entropy: number,
    periodicity: number,
    runsRatio: number,
    lengthCorrelation: number,
    lengthsVary: boolean,
    totalMessages: number
  ) {
    const s: { count: number; precisionLevel: 'none' | 'low' | 'medium' | 'high'; } = {
      count: 0,
      precisionLevel: 'none',
    };

    if (sigma < this.precisionLowSigma && totalMessages >= 20) {
      s.precisionLevel = 'low';
      s.count++;
    } else if (sigma < this.precisionMediumSigma && totalMessages >= 10) {
      s.precisionLevel = 'medium';
      s.count++;
    } else if (sigma < this.precisionHighSigma) {
      s.precisionLevel = 'high';
      s.count++;
    }

    if (cv < 0.1 && sigma < 200) s.count++;
    if (mad < this.madThresholdLow && totalMessages >= 20) s.count++;
    else if (mad < this.madThresholdMedium && totalMessages >= 10) s.count++;
    else if (mad < this.madThresholdHigh && sigma < 100) s.count++;

    if (entropy < this.entropyThreshold && sigma < 200) s.count++;
    // Periodicity is only a bot signal when timing is also very regular
    if (periodicity > this.periodicityThreshold && sigma < this.precisionHighSigma) s.count++;
    if (runsRatio < this.runsTestThreshold && sigma < 200) s.count++;
    if (lengthsVary && lengthCorrelation < this.lengthIntervalCorrelationMin && sigma < 300) s.count++;

    return s;
  }

  private calculateScoreDeltas(
    signals: { count: number; precisionLevel: 'none' | 'low' | 'medium' | 'high' },
    isBurst: boolean,
    sigma: number
  ): { botScoreDelta: number; karmaScoreDelta: number } {
    let botScoreDelta = 0;
    let karmaScoreDelta = 0;

    // Base precision penalty
    if (signals.precisionLevel === 'low') botScoreDelta += 35;
    else if (signals.precisionLevel === 'medium') botScoreDelta += 25;
    else if (signals.precisionLevel === 'high') botScoreDelta += 12;

    // Extra penalty for every additional independent suspicious signal
    const extraSignals = Math.max(0, signals.count - 1);
    botScoreDelta += extraSignals * 10;

    // Human-like timing rewards
    if (sigma > 200) {
      karmaScoreDelta -= 2;
    }
    if (signals.count === 0 && sigma > 150) {
      karmaScoreDelta -= 1;
    }

    if (isBurst) {
      botScoreDelta += 3;
      karmaScoreDelta += 1;
    }

    return { botScoreDelta, karmaScoreDelta };
  }

  private detectBurst(timestamps: number[]): boolean {
    const recent = timestamps.slice(-this.burstMinMessages);
    if (recent.length < this.burstMinMessages) return false;
    const span = recent[recent.length - 1] - recent[0];
    return span <= this.burstWindowMs;
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return Infinity;
    const mean = this.mean(values);
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0
      ? sorted[mid]
      : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private medianAbsoluteDeviation(values: number[]): number {
    if (values.length === 0) return Infinity;
    const med = this.median(values);
    const deviations = values.map((v) => Math.abs(v - med));
    return this.median(deviations);
  }

  private shannonEntropy(values: number[]): number {
    if (values.length === 0) return 0;
    // Bin continuous intervals into 50ms buckets for entropy calculation
    const bucketSize = 50;
    const counts = new Map<number, number>();
    for (const v of values) {
      const bucket = Math.floor(v / bucketSize);
      counts.set(bucket, (counts.get(bucket) || 0) + 1);
    }
    let entropy = 0;
    for (const count of counts.values()) {
      const p = count / values.length;
      entropy -= p * Math.log2(p);
    }
    return entropy;
  }

  private periodicityScore(intervals: number[]): number {
    if (intervals.length < 4) return 0;
    // Autocorrelation at lag 1..3, normalized by variance
    const mean = this.mean(intervals);
    const variance = this.standardDeviation(intervals) ** 2;
    if (variance === 0) return 1; // perfectly periodic

    let bestCorr = 0;
    for (let lag = 1; lag <= Math.min(3, intervals.length - 1); lag++) {
      let cov = 0;
      for (let i = 0; i < intervals.length - lag; i++) {
        cov += (intervals[i] - mean) * (intervals[i + lag] - mean);
      }
      cov /= intervals.length - lag;
      const corr = Math.abs(cov) / variance;
      if (corr > bestCorr) bestCorr = corr;
    }
    return Math.min(1, bestCorr);
  }

  private runsTestRatio(intervals: number[]): number {
    if (intervals.length < 3) return 1;
    const median = this.median(intervals);
    let runs = 1;
    let above = intervals[0] > median;
    for (let i = 1; i < intervals.length; i++) {
      const curr = intervals[i] > median;
      if (curr !== above) {
        runs++;
        above = curr;
      }
    }
    // Expected runs for random data is roughly n/2 + 1
    const expected = intervals.length / 2 + 1;
    return Math.min(1, runs / expected);
  }

  private pearsonCorrelation(xs: number[], ys: number[]): number {
    const n = Math.min(xs.length, ys.length);
    if (n < 2) return 0;
    const meanX = xs.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const meanY = ys.slice(0, n).reduce((a, b) => a + b, 0) / n;
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

  getCrowdMedianSigma(): number {
    const sigmas: number[] = [];

    this.users.forEach((user) => {
      if (user.messages.length >= this.windowSize) {
        const intervals: number[] = [];
        for (let i = 1; i < user.messages.length; i++) {
          intervals.push(user.messages[i].timestamp - user.messages[i - 1].timestamp);
        }
        sigmas.push(this.standardDeviation(intervals));
      }
    });

    if (sigmas.length === 0) return Infinity;

    sigmas.sort((a, b) => a - b);
    const mid = Math.floor(sigmas.length / 2);
    return sigmas.length % 2 !== 0
      ? sigmas[mid]
      : (sigmas[mid - 1] + sigmas[mid]) / 2;
  }

  isRelativelySuspicious(userSigma: number, crowdMedian: number, factor: number = 0.3): boolean {
    if (!isFinite(crowdMedian) || crowdMedian === 0) return userSigma < 50;
    return userSigma < crowdMedian * factor;
  }

  reset(): void {
    this.users.clear();
  }

  get trackedUserCount(): number {
    return this.users.size;
  }
}
