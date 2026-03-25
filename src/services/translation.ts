import { openaiTranslate, deeplTranslate } from '../ai/cloud';
import * as queries from '../db/queries';
import { getLanguageName } from '../constants/languages';

export async function translateTranscript(
  transcriptId: string,
  targetLanguage: string,
  options: {
    engine: 'openai' | 'deepl';
    apiKey?: string;
  }
): Promise<string> {
  // Check for existing translation
  const existing = await queries.getTranslation(transcriptId, targetLanguage);
  if (existing) return existing.content;

  // Get transcript
  const db = await import('../db/client').then((m) => m.getDatabase());
  const { transcripts } = await import('../db/schema');
  const { eq } = await import('drizzle-orm');
  const results = await db
    .select()
    .from(transcripts)
    .where(eq(transcripts.id, transcriptId))
    .limit(1);
  const transcript = results[0];
  if (!transcript) throw new Error('Transcript not found');

  const targetLangName = getLanguageName(targetLanguage);
  let translated: string;

  switch (options.engine) {
    case 'deepl':
      translated = await deeplTranslate(transcript.content, targetLanguage, options.apiKey);
      break;
    case 'openai':
      translated = await openaiTranslate(transcript.content, targetLangName, options.apiKey);
      break;
    default:
      throw new Error(`Unknown translation engine: ${options.engine}`);
  }

  // Save translation
  await queries.createTranslation({
    transcriptId,
    targetLanguage,
    content: translated,
    engine: options.engine,
  });

  return translated;
}
