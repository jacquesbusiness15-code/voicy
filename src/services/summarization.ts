import { chatWithAI } from '../ai/cloud';
import { PROMPTS, fillPrompt } from '../ai/prompts';
import * as queries from '../db/queries';
import type { AIOutput } from '../db/schema';
import type { AIProvider } from '../constants/models';

export type OutputType =
  | 'summary'
  | 'bullet_points'
  | 'todo'
  | 'meeting_report'
  | 'blog_post'
  | 'email_draft'
  | 'tweet'
  | 'translate'
  | 'cleanup'
  | 'fix'
  | 'custom';

const PROMPT_MAP: Record<string, string> = {
  summary: PROMPTS.summary,
  bullet_points: PROMPTS.bulletPoints,
  todo: PROMPTS.todoList,
  meeting_report: PROMPTS.meetingReport,
  blog_post: PROMPTS.blogPost,
  email_draft: PROMPTS.emailDraft,
  tweet: PROMPTS.tweet,
  fix: PROMPTS.fix,
};

export async function generateAIOutput(
  recordingId: string,
  type: OutputType,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
    customPrompt?: string;
  }
): Promise<AIOutput> {
  // Get transcript
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) {
    throw new Error('No transcript found. Please transcribe the recording first.');
  }

  // Check for existing output of same type
  const existing = await queries.getAIOutputs(recordingId, type);
  if (existing.length > 0) {
    return existing[0];
  }

  let promptTemplate: string;
  if (type === 'custom' && options.customPrompt) {
    promptTemplate = PROMPTS.custom;
  } else {
    promptTemplate = PROMPT_MAP[type];
    if (!promptTemplate) throw new Error(`Unknown output type: ${type}`);
  }

  const filledPrompt = fillPrompt(promptTemplate, {
    text: transcript.content,
    prompt: options.customPrompt ?? '',
  });

  const content = await chatWithAI(
    [{ role: 'user', content: filledPrompt }],
    options.provider,
    options.apiKeys
  );

  const output = await queries.createAIOutput({
    recordingId,
    type,
    content,
    engine: options.provider,
    prompt: options.customPrompt,
  });

  return output;
}

export async function regenerateAIOutput(
  recordingId: string,
  type: OutputType,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
    customPrompt?: string;
  }
): Promise<AIOutput> {
  // Delete existing outputs of this type
  const db = await import('../db/client').then((m) => m.getDatabase());
  const { aiOutputs } = await import('../db/schema');
  const { eq, and } = await import('drizzle-orm');
  await db
    .delete(aiOutputs)
    .where(and(eq(aiOutputs.recordingId, recordingId), eq(aiOutputs.type, type)));

  return generateAIOutput(recordingId, type, options);
}

export async function autoTag(
  recordingId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
  }
): Promise<void> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) return;

  const filledPrompt = fillPrompt(PROMPTS.autoTag, { text: transcript.content });

  const response = await chatWithAI(
    [{ role: 'user', content: filledPrompt }],
    options.provider,
    options.apiKeys
  );

  const tagNames = response
    .split('\n')
    .map((t) => t.trim().toLowerCase().replace(/^[-#*]\s*/, ''))
    .filter((t) => t.length > 0 && t.length < 50);

  for (const name of tagNames) {
    // Find or create tag
    const allTags = await queries.getAllTags();
    let tag = allTags.find((t) => t.name === name);
    if (!tag) {
      tag = await queries.createTag(name);
    }
    await queries.addTagToRecording(recordingId, tag.id, true);
  }
}
