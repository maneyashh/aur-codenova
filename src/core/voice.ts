/**
 * AURA-GOV / Voice DNA Preservation
 * ---------------------------------
 * Compliance repair is a lexical operation, not a creative rewrite.
 * We patch the minimum token set required to clear policy, then measure how
 * much of the author's cadence, sentence geometry and punctuation survived.
 */

export type PatchRule =
  | 'ABS-01'
  | 'UNV-04'
  | 'TON-02'
  | 'QNT-01'
  | 'ABS-03'
  | 'ABS-04';

export type TokenPatch = {
  id: string;
  source: string;
  replacement: string;
  rule: PatchRule;
  ruleLabel: string;
  rationale: string;
  confidence: number;
};

export const VOICE_ORIGINAL =
  "Helios doesn't chase the horizon. It redraws it. The world's only limitless energy platform is here — obliterating every constraint your mission has ever known. Book a mission brief and watch the impossible become inevitable.";

export const VOICE_SURGICAL =
  'Helios doesn\'t chase the horizon. It redraws it. The next-generation high-density energy platform is here — clearing the constraints your mission has ever known. Book a mission brief and watch the possible become operational.';

export const VOICE_LLM =
  'Helios revolutionizes orbital energy with a transformative, future-ready platform designed to unlock unparalleled mission performance. Our innovative solution empowers teams to push beyond traditional constraints and achieve exceptional results at every stage. Schedule a consultation today to discover how Helios can elevate your operations to the next level.';

export const tokenPatches: TokenPatch[] = [
  {
    id: 'P-01',
    source: "world's only",
    replacement: 'next-generation',
    rule: 'ABS-01',
    ruleLabel: 'Absolute superlative',
    rationale: 'Unsubstantiated market supremacy. Replaced without paraphrasing the sentence.',
    confidence: 0.998,
  },
  {
    id: 'P-02',
    source: 'limitless',
    replacement: 'high-density',
    rule: 'UNV-04',
    ruleLabel: 'Unverifiable scale claim',
    rationale: 'Infinite capacity is not physically substantiable. Swapped for a measurable property.',
    confidence: 0.994,
  },
  {
    id: 'P-03',
    source: 'obliterating',
    replacement: 'clearing',
    rule: 'TON-02',
    ruleLabel: 'Aggressive metaphor',
    rationale: 'Violent verb outside the Helios tone contract. Cadence and stress pattern retained.',
    confidence: 0.991,
  },
  {
    id: 'P-04',
    source: 'every',
    replacement: 'the',
    rule: 'QNT-01',
    ruleLabel: 'Universal quantifier',
    rationale: 'Absolute scope cannot be proven across all mission classes. Article substitution.',
    confidence: 0.987,
  },
  {
    id: 'P-05',
    source: 'impossible',
    replacement: 'possible',
    rule: 'ABS-03',
    ruleLabel: 'Absolute binary claim',
    rationale: 'Absolute impossibility framing. Minimal antonym swap preserves the rhetorical turn.',
    confidence: 0.996,
  },
  {
    id: 'P-06',
    source: 'inevitable',
    replacement: 'operational',
    rule: 'ABS-04',
    ruleLabel: 'Future certainty claim',
    rationale: 'Guarantees an outcome. Replaced with a verifiable operational state.',
    confidence: 0.981,
  },
];

export const llmBuzzwords = [
  'revolutionizes',
  'transformative',
  'unlock',
  'unparalleled',
  'innovative',
  'exceptional',
  'elevate',
];

export type VoiceMetrics = {
  characters: number;
  words: number;
  sentences: number;
  avgSentenceLength: number;
  avgSyllablesPerWord: number;
  burstiness: number;
  lexicalDiversity: number;
  punctuationDensity: number;
  longWordRatio: number;
  cadence: number[];
  sentenceLengths: number[];
};

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

export function tokenizeWords(text: string): string[] {
  return text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
}

export function syllableCount(word: string): number {
  const normalized = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!normalized) return 0;
  const groups = normalized.match(/[aeiouy]+/g);
  let count = groups?.length ?? 1;
  if (normalized.endsWith('e') && count > 1) count -= 1;
  return Math.max(1, count);
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function computeVoiceMetrics(text: string): VoiceMetrics {
  const sentences = splitSentences(text);
  const words = tokenizeWords(text);
  const sentenceLengths = sentences.map((sentence) => tokenizeWords(sentence).length);
  const meanSentenceLength =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((sum, value) => sum + value, 0) / sentenceLengths.length
      : 0;
  const lowerWords = words.map((word) => word.toLowerCase());
  const syllables = lowerWords.map(syllableCount);
  const punctuation = (text.match(/[,.;:!?—–]/g) ?? []).length;

  return {
    characters: text.length,
    words: words.length,
    sentences: sentences.length,
    avgSentenceLength: Math.round(meanSentenceLength * 10) / 10,
    avgSyllablesPerWord:
      Math.round((syllables.reduce((sum, value) => sum + value, 0) / (words.length || 1)) * 100) /
      100,
    burstiness:
      Math.round((stddev(sentenceLengths) / (meanSentenceLength || 1)) * 100) / 100,
    lexicalDiversity:
      Math.round((new Set(lowerWords).size / (words.length || 1)) * 100) / 100,
    punctuationDensity:
      Math.round((punctuation / (words.length || 1)) * 1000) / 1000,
    longWordRatio:
      Math.round(
        (lowerWords.filter((word) => syllableCount(word) >= 3).length / (words.length || 1)) *
          100,
      ) / 100,
    cadence: syllables,
    sentenceLengths,
  };
}

export type VoiceFidelity = {
  score: number;
  sentenceShape: number;
  cadence: number;
  punctuation: number;
  lexical: number;
  length: number;
};

/**
 * Weighted fidelity: sentence geometry and cadence carry the most weight.
 * This deliberately penalises "beautiful" rewrites that sand off authorship.
 */
export function voiceFidelity(original: string, candidate: string): VoiceFidelity {
  const source = computeVoiceMetrics(original);
  const target = computeVoiceMetrics(candidate);

  const pairCount = Math.min(source.sentences, target.sentences);
  let shapeSum = 0;
  for (let i = 0; i < pairCount; i += 1) {
    const a = source.sentenceLengths[i];
    const b = target.sentenceLengths[i];
    shapeSum += 1 - Math.abs(a - b) / Math.max(a, b, 1);
  }
  const sentenceShape = pairCount > 0 ? shapeSum / Math.max(source.sentences, target.sentences) : 0;

  const cadence =
    1 -
    Math.abs(source.avgSyllablesPerWord - target.avgSyllablesPerWord) /
      Math.max(source.avgSyllablesPerWord, 0.01);

  const punctuation =
    1 -
    Math.abs(source.punctuationDensity - target.punctuationDensity) /
      Math.max(source.punctuationDensity, 0.001);

  const sourceTokens = new Set(tokenizeWords(original).map((word) => word.toLowerCase()));
  const targetTokens = new Set(tokenizeWords(candidate).map((word) => word.toLowerCase()));
  let intersection = 0;
  sourceTokens.forEach((token) => {
    if (targetTokens.has(token)) intersection += 1;
  });
  const lexical = intersection / Math.max(sourceTokens.size, targetTokens.size, 1);

  const length =
    1 - Math.abs(source.words - target.words) / Math.max(source.words, target.words, 1);

  const weighted =
    0.34 * sentenceShape +
    0.22 * cadence +
    0.14 * punctuation +
    0.16 * length +
    0.14 * lexical;

  const score = Math.round(Math.min(1, Math.max(0, weighted)) * 1000) / 10;

  return {
    score,
    sentenceShape: Math.round(sentenceShape * 1000) / 10,
    cadence: Math.round(cadence * 1000) / 10,
    punctuation: Math.round(punctuation * 1000) / 10,
    lexical: Math.round(lexical * 1000) / 10,
    length: Math.round(length * 1000) / 10,
  };
}

export const originalMetrics = computeVoiceMetrics(VOICE_ORIGINAL);
export const surgicalMetrics = computeVoiceMetrics(VOICE_SURGICAL);
export const llmMetrics = computeVoiceMetrics(VOICE_LLM);
export const surgicalFidelity = voiceFidelity(VOICE_ORIGINAL, VOICE_SURGICAL);
export const llmFidelity = voiceFidelity(VOICE_ORIGINAL, VOICE_LLM);

export const toneContract = {
  approved: ['Confident', 'Precise', 'Expansive', 'Human'],
  prohibited: ['Hyperbolic absolutes', 'Anthropomorphic aggression', 'Future guarantees'],
};
