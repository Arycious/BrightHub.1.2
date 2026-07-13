// ==========================================
// Message Normalizer — Centralized text preprocessing
// ==========================================
// Normalizes Twitch chat messages for fair comparison across detectors.
// Handles: unicode, zero-width chars, emojis, leetspeak, copy-paste suffixes.

/**
 * Map of leetspeak characters to their base letters.
 */
const LEET_MAP: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '8': 'b',
};

/**
 * Remove trailing numeric suffixes used to bypass duplicate-message filters.
 * Keeps a single trailing '0' so leetspeak words like "h3ll0" -> "hello" work.
 * Examples: "supersize1" -> "supersize", "case_02" -> "case_"
 */
function stripTrailingNumberSuffix(text: string): string {
  return text
    .replace(/(\D)\d{2,}$/g, '$1')   // trailing 02, 123, 10...
    .replace(/(\D)[1-9]$/g, '$1');   // single trailing 1-9
}

/**
 * Normalize leetspeak characters.
 */
function normalizeLeetspeak(text: string): string {
  return text
    .split('')
    .map((char) => LEET_MAP[char] ?? char)
    .join('');
}

/**
 * Remove zero-width and invisible unicode characters.
 */
function removeInvisibleChars(text: string): string {
  return text.replace(
    /[\u200B-\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061-\u2064]/g,
    ''
  );
}

/**
 * Count zero-width / invisible characters in a message.
 */
export function countZeroWidthChars(text: string): number {
  const matches = text.match(/[\u200B-\u200D\u200E\u200F\uFEFF\u00AD\u2060\u2061-\u2064]/g);
  return matches ? matches.length : 0;
}

/**
 * Replace all emoji blocks with a single placeholder for fair comparison.
 */
function normalizeEmojis(text: string): string {
  return text
    .replace(/[\u{1F600}-\u{1F64F}]/gu, '\u{1F7E8}')  // Emoticons
    .replace(/[\u{1F300}-\u{1F5FF}]/gu, '\u{1F7E8}')  // Symbols & Pictographs
    .replace(/[\u{1F680}-\u{1F6FF}]/gu, '\u{1F7E8}')  // Transport & Map
    .replace(/[\u{1F900}-\u{1F9FF}]/gu, '\u{1F7E8}')  // Supplemental
    .replace(/[\u{1FA00}-\u{1FA6F}]/gu, '\u{1F7E8}')  // Chess & Extended-A
    .replace(/[\u{1FA70}-\u{1FAFF}]/gu, '\u{1F7E8}')  // Extended-A continued
    .replace(/[\u{2600}-\u{26FF}]/gu, '\u{1F7E8}')    // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '\u{1F7E8}');   // Dingbats
}

/**
 * Normalize a message for comparison.
 */
export function normalizeForComparison(message: string): string {
  return normalizeEmojis(
    normalizeLeetspeak(
      stripTrailingNumberSuffix(
        removeInvisibleChars(
          message.normalize('NFC')
        )
      )
    )
  )
    .trim()
    .toLowerCase();
}

/**
 * Normalize but preserve a bit more structure for template detection.
 */
export function normalizeForTemplate(message: string): string {
  return normalizeEmojis(
    normalizeLeetspeak(
      removeInvisibleChars(
        message.normalize('NFC')
      )
    )
  )
    .trim()
    .toLowerCase();
}

/**
 * Extract the message "template" by replacing numbers and common variants.
 * Useful for detecting messages like "1x hunter case, 2 murro cases" as the same template.
 */
export function extractTemplate(message: string): string {
  return normalizeEmojis(
    normalizeLeetspeak(
      removeInvisibleChars(
        message.normalize('NFC')
          .replace(/\b\d+(x|mal|times)?\b/g, '#$1')
      )
    )
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Count words in a message.
 */
export function countWords(message: string): number {
  return message.trim().split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Extract @username mentions from a message.
 */
export function extractMentions(message: string): string[] {
  const matches = message.match(/@([a-zA-Z0-9_]+)/g);
  return matches ? matches.map((m) => m.slice(1).toLowerCase()) : [];
}

/**
 * Check if a message looks like a reply to someone else.
 */
export function isReply(message: string): boolean {
  return /^@\w+/.test(message.trim());
}

/**
 * Normalize common homoglyphs (look-alike characters from Cyrillic/Greek)
 * to their Latin equivalents to defeat slow-chat bypass.
 */
function normalizeHomoglyphs(text: string): string {
  const HOMOGLYPHS: Record<string, string> = {
    'а': 'a', 'А': 'A', // Cyrillic
    'е': 'e', 'Е': 'E',
    'о': 'o', 'О': 'O',
    'р': 'p', 'Р': 'P',
    'с': 'c', 'С': 'C',
    'х': 'x', 'Х': 'X',
    'і': 'i', 'І': 'I',
    'ј': 'j', 'Ј': 'J',
    'ԛ': 'q',
    'ѕ': 's',
    'υ': 'u',
    'ν': 'v',
    'ω': 'w',
    'χ': 'x',
    'у': 'y', 'У': 'Y',
    'α': 'a', 'β': 'b', 'ε': 'e', 'ι': 'i', 'ο': 'o', 'ρ': 'p',
    'σ': 'o', 'γ': 'y',
  };

  return text
    .split('')
    .map((char) => HOMOGLYPHS[char] ?? char)
    .join('');
}

/**
 * Collapse repeated words like "pizza pizza pizza" → "pizza".
 */
function collapseRepeatedWords(text: string): string {
  return text.replace(/\b(\w+)(?:\s+\1)+\b/g, '$1');
}

/**
 * Normalize a message to a "command fingerprint" for slow-chat bypass detection.
 * Strips numbers/punctuation, removes invisible chars, normalizes homoglyphs,
 * and collapses repeated words.
 */
export function normalizeCommandFingerprint(message: string): string {
  let text = message.normalize('NFC');
  text = removeInvisibleChars(text);
  text = normalizeHomoglyphs(text);
  text = text.toLowerCase();
  // Remove trailing numbers and punctuation
  text = text.replace(/[\d\p{P}\p{S}]+$/gu, '');
  text = collapseRepeatedWords(text);
  return text.trim().replace(/\s+/g, ' ');
}

/**
 * Detect trailing numbers or punctuation commonly used to bypass slow-chat
 * duplicate filters, e.g. "pizza123", "pizza!!", "pizza1".
 */
export function hasTrailingNumbersOrPunctuation(message: string): boolean {
  const trimmed = message.trim();
  const stripped = normalizeCommandFingerprint(trimmed);
  const normalizedOriginal = trimmed.toLowerCase().replace(/\s+/g, ' ').trim();
  return (
    stripped.length > 0 &&
    normalizedOriginal.length > stripped.length + 1
  );
}

/**
 * Detect repeated words like "pizza pizza pizza" used to bypass filters.
 */
export function hasRepeatedWords(message: string): boolean {
  const cleaned = removeInvisibleChars(message.normalize('NFC')).toLowerCase().trim();
  return /\b(\w+)(?:\s+\1\b)+/.test(cleaned);
}

/**
 * Detect zero-width/invisible characters or homoglyph substitutions.
 */
export function hasInvisibleOrHomoglyphBypass(message: string): boolean {
  const normalized = message.normalize('NFC');
  const cleaned = removeInvisibleChars(normalizeHomoglyphs(normalized));
  return normalized !== cleaned;
}

/**
 * Compute how likely a message is to be a repeated slot/battle command.
 * Returns a value between 0 and 1. Uses only structural/chat signals, no
 * keyword matching, so it works for arbitrary command names.
 */
export function computeCommandLikeness(message: string, previousMessages: string[] = []): number {
  const trimmed = message.trim();
  if (trimmed.length === 0) return 0;

  const normalized = normalizeCommandFingerprint(trimmed);
  const wordCount = countWords(normalized);
  const charCount = trimmed.length;
  const hasMention = extractMentions(trimmed).length > 0;
  const hasDigits = /\d/.test(trimmed);
  const isAllLower = /^[a-z0-9\s\p{P}\p{S}]*$/u.test(trimmed) && /[a-z]/.test(trimmed);
  const hasPunctuation = /[.!?;,:'"-]/.test(trimmed);

  let score = 0;

  // Short messages look more like commands, but a single short word alone
  // is not enough to cross the default threshold.
  if (charCount < 8) score += 0.15;
  else if (charCount < 15) score += 0.10;
  else if (charCount < 25) score += 0.05;

  // Single-token messages are very command-like
  if (wordCount === 1) score += 0.10;

  // Digits suggest bypass variants like "pizza123"
  if (hasDigits) score += 0.15;

  // Bypass tricks strongly indicate command spam
  if (hasTrailingNumbersOrPunctuation(trimmed)) score += 0.25;
  if (hasRepeatedWords(trimmed)) score += 0.20;
  if (hasInvisibleOrHomoglyphBypass(trimmed)) score += 0.20;

  // Commands rarely use sentence punctuation and are usually lowercase
  if (!hasPunctuation) score += 0.05;
  if (isAllLower) score += 0.05;

  // Commands rarely mention other users
  if (!hasMention) score += 0.05;

  // Similarity to recent own messages strongly indicates repetition
  if (previousMessages.length > 0) {
    const recent = previousMessages.slice(-10);
    const similarities = recent.map((m) => jaccardSimilarity(normalized, normalizeCommandFingerprint(m), 3));
    const maxSim = Math.max(0, ...similarities);
    if (maxSim > 0.85) score += 0.25;
    else if (maxSim > 0.65) score += 0.10;

    // Low lexical diversity in recent window is another signal
    const unique = new Set(recent.map((m) => normalizeCommandFingerprint(m))).size;
    const diversity = unique / recent.length;
    if (diversity < 0.3) score += 0.15;
    else if (diversity < 0.5) score += 0.05;
  }

  return Math.min(1, score);
}

/**
 * Calculate Shannon entropy of a string in bits.
 * Low entropy = repetitive/predictable (bots, templates, copy-paste).
 * High entropy = random/varied (natural human chat).
 */
export function shannonEntropy(text: string): number {
  if (text.length === 0) return 0;
  const counts = new Map<string, number>();
  for (const char of text) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / text.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Keyboard-mash score: 0..1
 * High score means the text looks like random key presses:
 * repeated chars, no vowels, many adjacent-key sequences.
 */
export function keyboardMashScore(text: string): number {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  if (normalized.length < 3) return 0;

  const vowels = /[aeiouäöü]/g;
  const vowelCount = (normalized.match(vowels) || []).length;
  const vowelRatio = vowelCount / normalized.length;

  // Repeated characters (e.g. "aaaa", "lollll")
  let repeatedChars = 0;
  for (let i = 1; i < normalized.length; i++) {
    if (normalized[i] === normalized[i - 1]) repeatedChars++;
  }
  const repetitionRatio = repeatedChars / (normalized.length - 1);

  // Single character dominance
  const freq = new Map<string, number>();
  for (const c of normalized) {
    freq.set(c, (freq.get(c) || 0) + 1);
  }
  const maxCharRatio = Math.max(...freq.values()) / normalized.length;

  // No vowels is a strong mash signal
  const noVowelPenalty = vowelRatio === 0 ? 0.5 : 0;

  // Adjacent keyboard keys heuristic: sequences of letters that are close on QWERTY
  const adjacent = countAdjacentKeySequences(normalized);
  const adjacentRatio = adjacent / Math.max(1, normalized.length - 1);

  const score = Math.min(
    1,
    noVowelPenalty
      + repetitionRatio * 0.5
      + (maxCharRatio > 0.5 ? 0.4 : 0)
      + adjacentRatio * 0.7
  );
  return Math.round(score * 1000) / 1000;
}

const ADJACENT_KEYS: Record<string, Set<string>> = {
  q: new Set(['w', 'a', 's']),
  w: new Set(['q', 'e', 'a', 's', 'd']),
  e: new Set(['w', 'r', 's', 'd', 'f']),
  r: new Set(['e', 't', 'd', 'f', 'g']),
  t: new Set(['r', 'y', 'f', 'g', 'h']),
  y: new Set(['t', 'u', 'g', 'h', 'j']),
  u: new Set(['y', 'i', 'h', 'j', 'k']),
  i: new Set(['u', 'o', 'j', 'k', 'l']),
  o: new Set(['i', 'p', 'k', 'l']),
  p: new Set(['o', 'l']),
  a: new Set(['q', 'w', 's', 'z', 'x']),
  s: new Set(['q', 'w', 'e', 'a', 'd', 'z', 'x', 'c']),
  d: new Set(['w', 'e', 'r', 's', 'f', 'x', 'c', 'v']),
  f: new Set(['e', 'r', 't', 'd', 'g', 'c', 'v', 'b']),
  g: new Set(['r', 't', 'y', 'f', 'h', 'v', 'b', 'n']),
  h: new Set(['t', 'y', 'u', 'g', 'j', 'b', 'n', 'm']),
  j: new Set(['y', 'u', 'i', 'h', 'k', 'n', 'm']),
  k: new Set(['u', 'i', 'o', 'j', 'l', 'm']),
  l: new Set(['i', 'o', 'p', 'k']),
  z: new Set(['a', 's', 'x']),
  x: new Set(['a', 's', 'd', 'z', 'c']),
  c: new Set(['s', 'd', 'f', 'x', 'v']),
  v: new Set(['d', 'f', 'g', 'c', 'b']),
  b: new Set(['f', 'g', 'h', 'v', 'n']),
  n: new Set(['g', 'h', 'j', 'b', 'm']),
  m: new Set(['h', 'j', 'k', 'n']),
};

function countAdjacentKeySequences(text: string): number {
  let count = 0;
  for (let i = 1; i < text.length; i++) {
    const prev = text[i - 1];
    const curr = text[i];
    if (ADJACENT_KEYS[prev]?.has(curr)) count++;
  }
  return count;
}

/**
 * N-gram repetition score: 0..1
 * Detects repeated substrings like "abcabcabc" or "lol lol lol".
 */
export function ngramRepetitionScore(text: string, n: number = 3): number {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  if (normalized.length < n * 2) return 0;

  const ngrams: string[] = [];
  for (let i = 0; i <= normalized.length - n; i++) {
    ngrams.push(normalized.slice(i, i + n));
  }

  const freq = new Map<string, number>();
  for (const g of ngrams) {
    freq.set(g, (freq.get(g) || 0) + 1);
  }

  const maxFreq = Math.max(1, ...freq.values());
  // Score how dominant the most repeated n-gram is
  const score = maxFreq / ngrams.length;
  return Math.min(1, score);
}

/**
 * Jaccard similarity between two strings using character n-grams (shingles).
 */
export function jaccardSimilarity(a: string, b: string, n: number = 3): number {
  const shinglesA = getShingles(a, n);
  const shinglesB = getShingles(b, n);
  if (shinglesA.size === 0 && shinglesB.size === 0) return 1;
  if (shinglesA.size === 0 || shinglesB.size === 0) return 0;

  let intersection = 0;
  for (const s of shinglesA) {
    if (shinglesB.has(s)) intersection++;
  }
  const union = shinglesA.size + shinglesB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function getShingles(text: string, n: number): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i <= text.length - n; i++) {
    set.add(text.slice(i, i + n));
  }
  return set;
}
