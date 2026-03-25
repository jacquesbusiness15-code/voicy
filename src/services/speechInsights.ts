export interface SpeechInsights {
  wordCount: number;
  sentenceCount: number;
  uniqueWords: number;
  speakingPaceWPM: number;
  readingTimeMinutes: number;
  characterCount: number;
}

export function calculateSpeechInsights(
  transcriptText: string,
  durationSeconds: number
): SpeechInsights {
  const words = transcriptText.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;
  const sentences = transcriptText.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const uniqueWords = new Set(words.map((w) => w.toLowerCase().replace(/[^a-z]/g, ''))).size;
  const durationMinutes = durationSeconds / 60;
  const speakingPaceWPM = durationMinutes > 0 ? Math.round(wordCount / durationMinutes) : 0;
  const readingTimeMinutes = Math.max(1, Math.round(wordCount / 200));

  return {
    wordCount,
    sentenceCount: sentences.length,
    uniqueWords,
    speakingPaceWPM,
    readingTimeMinutes,
    characterCount: transcriptText.length,
  };
}
