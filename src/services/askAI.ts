import { chatWithAI, openaiEmbed } from '../ai/cloud';
import { PROMPTS, fillPrompt } from '../ai/prompts';
import * as queries from '../db/queries';
import type { AIProvider } from '../constants/models';

interface SearchResult {
  recordingId: string;
  chunkText: string;
  score: number;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export async function generateEmbeddingsForRecording(
  recordingId: string,
  apiKey?: string
): Promise<void> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) return;

  // Chunk text into ~200 token segments (~800 chars)
  const chunks = chunkText(transcript.content, 800);

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await openaiEmbed(chunks[i], apiKey);
    await queries.storeEmbedding({
      recordingId,
      chunkIndex: i,
      chunkText: chunks[i],
      vector: new Float32Array(embedding),
      model: 'openai-3-small',
    });
  }
}

function chunkText(text: string, maxChars: number): string[] {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = '';

  for (const sentence of sentences) {
    if (current.length + sentence.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }
    current += sentence + ' ';
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

export async function semanticSearch(
  query: string,
  apiKey?: string,
  topK: number = 5
): Promise<SearchResult[]> {
  // Generate embedding for query
  const queryEmbedding = await openaiEmbed(query, apiKey);

  // Get all embeddings
  const allEmbeddings = await queries.getAllEmbeddings();

  // Calculate similarities
  const scored = allEmbeddings
    .map((emb) => {
      if (!emb.vector) return null;
      const vector = Array.from(new Float32Array(emb.vector as ArrayBuffer));
      return {
        recordingId: emb.recordingId,
        chunkText: emb.chunkText,
        score: cosineSimilarity(queryEmbedding, vector),
      };
    })
    .filter((r): r is SearchResult => r !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return scored;
}

export async function askAboutNote(
  question: string,
  recordingId: string,
  conversationId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
  }
): Promise<{ answer: string }> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) {
    return { answer: 'No transcript found for this note. Please transcribe it first.' };
  }

  const systemPrompt = fillPrompt(PROMPTS.noteChat, { text: transcript.content });

  const history = await queries.getMessages(conversationId);
  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: question },
  ];

  const answer = await chatWithAI(messages, options.provider, options.apiKeys);
  return { answer };
}

export async function askAI(
  question: string,
  conversationId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
  }
): Promise<{ answer: string; sourceRecordingIds: string[] }> {
  // Try semantic search (uses user key or proxy)
  let context = '';
  let sourceRecordingIds: string[] = [];

  {
    try {
      const results = await semanticSearch(question, options.apiKeys.openai, 5);
      if (results.length > 0) {
        sourceRecordingIds = [...new Set(results.map((r) => r.recordingId))];

        // Build context with recording titles
        const contextParts: string[] = [];
        for (const result of results) {
          const recording = await queries.getRecordingById(result.recordingId);
          const title = recording?.title ?? 'Untitled Recording';
          contextParts.push(`[From: ${title}]\n${result.chunkText}`);
        }
        context = contextParts.join('\n\n---\n\n');
      }
    } catch {
      // Fall back to keyword search if embedding search fails
    }
  }

  // If no semantic results, fall back to keyword search
  if (!context) {
    const searchResults = await queries.searchRecordings(question);
    if (searchResults.length > 0) {
      sourceRecordingIds = searchResults.slice(0, 5).map((r) => r.id);
      const contextParts: string[] = [];
      for (const recording of searchResults.slice(0, 5)) {
        const transcript = await queries.getTranscriptByRecordingId(recording.id);
        if (transcript) {
          contextParts.push(
            `[From: ${recording.title ?? 'Untitled'}]\n${transcript.content.substring(0, 500)}`
          );
        }
      }
      context = contextParts.join('\n\n---\n\n');
    }
  }

  if (!context) {
    context = 'No relevant notes found in the database.';
  }

  // Get conversation history
  const history = await queries.getMessages(conversationId);
  const messages = [
    {
      role: 'system' as const,
      content: fillPrompt(PROMPTS.askAI, { context, question: '' }),
    },
    ...history.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user' as const, content: question },
  ];

  const answer = await chatWithAI(messages, options.provider, options.apiKeys);

  return { answer, sourceRecordingIds };
}
