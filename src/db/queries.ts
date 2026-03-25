import { eq, desc, asc, like, and, sql } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';
import { getDatabase } from './client';
import * as schema from './schema';
import type {
  Recording,
  NewRecording,
  Transcript,
  AIOutput,
  Tag,
  Conversation,
  ConversationMessage,
  CalendarEvent,
  NewCalendarEvent,
} from './schema';

// ── Recordings ──────────────────────────────────────────────

export async function createRecording(data: Omit<NewRecording, 'id' | 'createdAt' | 'updatedAt'>): Promise<Recording> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const id = randomUUID();
  const recording = {
    id,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.recordings).values(recording);
  return recording as Recording;
}

export async function getAllRecordings(options?: {
  search?: string;
  isMeeting?: boolean;
  isFavorite?: boolean;
  tagId?: string;
  sortBy?: 'newest' | 'oldest' | 'longest' | 'shortest';
}): Promise<Recording[]> {
  const db = await getDatabase();
  const conditions = [];

  if (options?.isMeeting !== undefined) {
    conditions.push(eq(schema.recordings.isMeeting, options.isMeeting));
  }
  if (options?.isFavorite !== undefined) {
    conditions.push(eq(schema.recordings.isFavorite, options.isFavorite));
  }

  let orderBy;
  switch (options?.sortBy) {
    case 'oldest':
      orderBy = asc(schema.recordings.createdAt);
      break;
    case 'longest':
      orderBy = desc(schema.recordings.duration);
      break;
    case 'shortest':
      orderBy = asc(schema.recordings.duration);
      break;
    default:
      orderBy = desc(schema.recordings.createdAt);
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const results = await db
    .select()
    .from(schema.recordings)
    .where(where)
    .orderBy(orderBy);

  if (options?.search) {
    const searchLower = options.search.toLowerCase();
    return results.filter(
      (r) =>
        r.title?.toLowerCase().includes(searchLower) ||
        r.id.toLowerCase().includes(searchLower)
    );
  }

  return results;
}

export async function getRecordingById(id: string): Promise<Recording | undefined> {
  const db = await getDatabase();
  const results = await db
    .select()
    .from(schema.recordings)
    .where(eq(schema.recordings.id, id))
    .limit(1);
  return results[0];
}

export async function updateRecording(id: string, data: Partial<Recording>): Promise<void> {
  const db = await getDatabase();
  await db
    .update(schema.recordings)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.recordings.id, id));
}

export async function deleteRecording(id: string): Promise<void> {
  const db = await getDatabase();
  await db.delete(schema.recordings).where(eq(schema.recordings.id, id));
}

export async function getRecordingDates(startDate: string, endDate: string): Promise<string[]> {
  const db = await getDatabase();
  const results = await db
    .select({ createdAt: schema.recordings.createdAt })
    .from(schema.recordings);

  const dates = new Set<string>();
  for (const r of results) {
    const date = r.createdAt.split('T')[0];
    if (date >= startDate && date <= endDate) {
      dates.add(date);
    }
  }
  return Array.from(dates);
}

// ── Transcripts ─────────────────────────────────────────────

export async function createTranscript(data: {
  recordingId: string;
  content: string;
  language: string;
  engine: string;
  confidence?: number;
  segments?: string;
}): Promise<Transcript> {
  const db = await getDatabase();
  const id = randomUUID();
  const transcript = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.transcripts).values(transcript);
  return transcript as Transcript;
}

export async function getTranscriptByRecordingId(recordingId: string): Promise<Transcript | undefined> {
  const db = await getDatabase();
  const results = await db
    .select()
    .from(schema.transcripts)
    .where(eq(schema.transcripts.recordingId, recordingId))
    .limit(1);
  return results[0];
}

export async function updateTranscriptContent(transcriptId: string, content: string): Promise<void> {
  const db = await getDatabase();
  await db.update(schema.transcripts).set({ content }).where(eq(schema.transcripts.id, transcriptId));
}

export async function updateTranscriptSegments(transcriptId: string, segments: string): Promise<void> {
  const db = await getDatabase();
  await db.update(schema.transcripts).set({ segments }).where(eq(schema.transcripts.id, transcriptId));
}

export async function appendTranscriptContent(recordingId: string, additionalContent: string): Promise<void> {
  const existing = await getTranscriptByRecordingId(recordingId);
  if (existing) {
    const newContent = existing.content + '\n\n' + additionalContent;
    await updateTranscriptContent(existing.id, newContent);
  }
}

// ── Translations ────────────────────────────────────────────

export async function createTranslation(data: {
  transcriptId: string;
  targetLanguage: string;
  content: string;
  engine: string;
}) {
  const db = await getDatabase();
  const id = randomUUID();
  const translation = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.translations).values(translation);
  return translation;
}

export async function getTranslation(transcriptId: string, targetLanguage: string) {
  const db = await getDatabase();
  const results = await db
    .select()
    .from(schema.translations)
    .where(
      and(
        eq(schema.translations.transcriptId, transcriptId),
        eq(schema.translations.targetLanguage, targetLanguage)
      )
    )
    .limit(1);
  return results[0];
}

export async function getTranslationsForRecording(recordingId: string) {
  const db = await getDatabase();
  const transcript = await getTranscriptByRecordingId(recordingId);
  if (!transcript) return [];
  return db
    .select()
    .from(schema.translations)
    .where(eq(schema.translations.transcriptId, transcript.id))
    .orderBy(desc(schema.translations.createdAt));
}

// ── AI Outputs ──────────────────────────────────────────────

export async function createAIOutput(data: {
  recordingId: string;
  type: string;
  content: string;
  engine: string;
  prompt?: string;
}): Promise<AIOutput> {
  const db = await getDatabase();
  const id = randomUUID();
  const output = {
    id,
    ...data,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.aiOutputs).values(output);
  return output as AIOutput;
}

export async function getAIOutputs(recordingId: string, type?: string): Promise<AIOutput[]> {
  const db = await getDatabase();
  const conditions = [eq(schema.aiOutputs.recordingId, recordingId)];
  if (type) conditions.push(eq(schema.aiOutputs.type, type));

  return db
    .select()
    .from(schema.aiOutputs)
    .where(and(...conditions))
    .orderBy(desc(schema.aiOutputs.createdAt));
}

// ── Tags ────────────────────────────────────────────────────

export async function createTag(name: string, color?: string): Promise<Tag> {
  const db = await getDatabase();
  const id = randomUUID();
  const tag = { id, name, color: color ?? null };
  await db.insert(schema.tags).values(tag);
  return tag;
}

export async function getAllTags(): Promise<Tag[]> {
  const db = await getDatabase();
  return db.select().from(schema.tags).orderBy(asc(schema.tags.name));
}

export async function getTagsForRecording(recordingId: string): Promise<Tag[]> {
  const db = await getDatabase();
  const results = await db
    .select({ tag: schema.tags })
    .from(schema.recordingTags)
    .innerJoin(schema.tags, eq(schema.recordingTags.tagId, schema.tags.id))
    .where(eq(schema.recordingTags.recordingId, recordingId));
  return results.map((r) => r.tag);
}

export async function addTagToRecording(recordingId: string, tagId: string, isAutoGenerated = false) {
  const db = await getDatabase();
  await db.insert(schema.recordingTags).values({ recordingId, tagId, isAutoGenerated }).onConflictDoNothing();
}

export async function removeTagFromRecording(recordingId: string, tagId: string) {
  const db = await getDatabase();
  await db
    .delete(schema.recordingTags)
    .where(
      and(
        eq(schema.recordingTags.recordingId, recordingId),
        eq(schema.recordingTags.tagId, tagId)
      )
    );
}

// ── Conversations ───────────────────────────────────────────

export async function createConversation(title?: string, recordingId?: string): Promise<Conversation> {
  const db = await getDatabase();
  const id = randomUUID();
  const conversation = {
    id,
    title: title ?? null,
    recordingId: recordingId ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.conversations).values(conversation);
  return conversation;
}

export async function getConversationForRecording(recordingId: string): Promise<Conversation | undefined> {
  const db = await getDatabase();
  const results = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.recordingId, recordingId))
    .limit(1);
  return results[0];
}

export async function getAllConversations(): Promise<Conversation[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(schema.conversations)
    .orderBy(desc(schema.conversations.createdAt));
}

export async function addMessage(data: {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  sourceRecordingIds?: string[];
  attachments?: string;
}): Promise<ConversationMessage> {
  const db = await getDatabase();
  const id = randomUUID();
  const message = {
    id,
    conversationId: data.conversationId,
    role: data.role,
    content: data.content,
    sourceRecordingIds: data.sourceRecordingIds ? JSON.stringify(data.sourceRecordingIds) : null,
    attachments: data.attachments ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.conversationMessages).values(message);
  return message;
}

export async function getMessages(conversationId: string): Promise<ConversationMessage[]> {
  const db = await getDatabase();
  return db
    .select()
    .from(schema.conversationMessages)
    .where(eq(schema.conversationMessages.conversationId, conversationId))
    .orderBy(asc(schema.conversationMessages.createdAt));
}

// ── Comments ───────────────────────────────────────────────

export async function createComment(data: {
  recordingId: string;
  content: string;
  timestamp?: number;
}) {
  const db = await getDatabase();
  const id = randomUUID();
  const comment = {
    id,
    recordingId: data.recordingId,
    content: data.content,
    timestamp: data.timestamp ?? null,
    createdAt: new Date().toISOString(),
  };
  await db.insert(schema.comments).values(comment);
  return comment;
}

export async function getComments(recordingId: string) {
  const db = await getDatabase();
  return db
    .select()
    .from(schema.comments)
    .where(eq(schema.comments.recordingId, recordingId))
    .orderBy(asc(schema.comments.createdAt));
}

export async function deleteComment(commentId: string) {
  const db = await getDatabase();
  await db.delete(schema.comments).where(eq(schema.comments.id, commentId));
}

// ── Embeddings ──────────────────────────────────────────────

export async function storeEmbedding(data: {
  recordingId: string;
  chunkIndex: number;
  chunkText: string;
  vector: Float32Array;
  model: string;
}) {
  const db = await getDatabase();
  const id = randomUUID();
  await db.insert(schema.embeddings).values({
    id,
    recordingId: data.recordingId,
    chunkIndex: data.chunkIndex,
    chunkText: data.chunkText,
    vector: Buffer.from(data.vector.buffer),
    model: data.model,
    createdAt: new Date().toISOString(),
  });
}

export async function getAllEmbeddings() {
  const db = await getDatabase();
  return db.select().from(schema.embeddings);
}

// ── Streaks ─────────────────────────────────────────────────

export async function updateStreak(date: string) {
  const db = await getDatabase();
  const existing = await db
    .select()
    .from(schema.streaks)
    .where(eq(schema.streaks.date, date))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(schema.streaks)
      .set({ recordingCount: existing[0].recordingCount + 1 })
      .where(eq(schema.streaks.date, date));
  } else {
    await db.insert(schema.streaks).values({ date, recordingCount: 1 });
  }
}

export async function getStreakDays(limit = 30) {
  const db = await getDatabase();
  return db
    .select()
    .from(schema.streaks)
    .orderBy(desc(schema.streaks.date))
    .limit(limit);
}

export async function getCurrentStreak(): Promise<number> {
  const days = await getStreakDays(365);
  if (days.length === 0) return 0;

  let streak = 0;
  const today = new Date();

  for (let i = 0; i < days.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    const expectedDate = expected.toISOString().split('T')[0];

    if (days[i]?.date === expectedDate) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Settings ────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | undefined> {
  const db = await getDatabase();
  const results = await db
    .select()
    .from(schema.settings)
    .where(eq(schema.settings.key, key))
    .limit(1);
  return results[0]?.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db
    .insert(schema.settings)
    .values({ key, value })
    .onConflictDoUpdate({
      target: schema.settings.key,
      set: { value },
    });
}

// ── Saved Prompts ──────────────────────────────────────────

export async function createSavedPrompt(title: string, promptText: string) {
  const db = await getDatabase();
  const id = randomUUID();
  const prompt = { id, title, promptText, createdAt: new Date().toISOString() };
  await db.insert(schema.savedPrompts).values(prompt);
  return prompt;
}

export async function getAllSavedPrompts() {
  const db = await getDatabase();
  return db.select().from(schema.savedPrompts).orderBy(desc(schema.savedPrompts.createdAt));
}

export async function deleteSavedPrompt(id: string) {
  const db = await getDatabase();
  await db.delete(schema.savedPrompts).where(eq(schema.savedPrompts.id, id));
}

// ── Attachments ────────────────────────────────────────────

export async function createAttachment(data: {
  recordingId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  sizeBytes?: number;
}) {
  const db = await getDatabase();
  const id = randomUUID();
  const attachment = { id, ...data, sizeBytes: data.sizeBytes ?? 0, createdAt: new Date().toISOString() };
  await db.insert(schema.attachments).values(attachment);
  return attachment;
}

export async function getAttachmentsForRecording(recordingId: string) {
  const db = await getDatabase();
  return db.select().from(schema.attachments).where(eq(schema.attachments.recordingId, recordingId));
}

export async function deleteAttachment(id: string) {
  const db = await getDatabase();
  await db.delete(schema.attachments).where(eq(schema.attachments.id, id));
}

// ── Full-text Search ────────────────────────────────────────

export async function searchRecordings(query: string): Promise<Recording[]> {
  const db = await getDatabase();
  const allRecordings = await db
    .select()
    .from(schema.recordings)
    .orderBy(desc(schema.recordings.createdAt));

  const searchLower = query.toLowerCase();

  // Get transcripts for content search
  const transcriptResults = await db.select().from(schema.transcripts);
  const transcriptMap = new Map(transcriptResults.map((t) => [t.recordingId, t]));

  return allRecordings.filter((r) => {
    if (r.title?.toLowerCase().includes(searchLower)) return true;
    const transcript = transcriptMap.get(r.id);
    if (transcript?.content.toLowerCase().includes(searchLower)) return true;
    return false;
  });
}

// ── Calendar Events ────────────────────────────────────────

export async function upsertCalendarEvents(events: NewCalendarEvent[]): Promise<void> {
  const db = await getDatabase();
  for (const event of events) {
    await db.insert(schema.calendarEvents)
      .values(event)
      .onConflictDoUpdate({
        target: schema.calendarEvents.id,
        set: {
          title: event.title,
          description: event.description,
          startTime: event.startTime,
          endTime: event.endTime,
          location: event.location,
          meetLink: event.meetLink,
          attendees: event.attendees,
          status: event.status,
          syncedAt: event.syncedAt,
        },
      });
  }
}

export async function getUpcomingEvents(): Promise<CalendarEvent[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  return db.select()
    .from(schema.calendarEvents)
    .where(
      and(
        sql`${schema.calendarEvents.startTime} >= ${now}`,
        sql`${schema.calendarEvents.status} != 'cancelled'`
      )
    )
    .orderBy(asc(schema.calendarEvents.startTime));
}

export async function getEventsForDateRange(start: string, end: string): Promise<CalendarEvent[]> {
  const db = await getDatabase();
  return db.select()
    .from(schema.calendarEvents)
    .where(
      and(
        sql`${schema.calendarEvents.startTime} >= ${start}`,
        sql`${schema.calendarEvents.startTime} <= ${end}`,
        sql`${schema.calendarEvents.status} != 'cancelled'`
      )
    )
    .orderBy(asc(schema.calendarEvents.startTime));
}

export async function setEventAutoRecord(eventId: string, autoRecord: boolean): Promise<void> {
  const db = await getDatabase();
  await db.update(schema.calendarEvents)
    .set({ autoRecord })
    .where(eq(schema.calendarEvents.id, eventId));
}

export async function linkRecordingToEvent(eventId: string, recordingId: string): Promise<void> {
  const db = await getDatabase();
  await db.update(schema.calendarEvents)
    .set({ recordingId })
    .where(eq(schema.calendarEvents.id, eventId));
}

export async function deleteAllCalendarEvents(): Promise<void> {
  const db = await getDatabase();
  await db.delete(schema.calendarEvents);
}

export async function getAutoRecordEvents(): Promise<CalendarEvent[]> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  return db.select()
    .from(schema.calendarEvents)
    .where(
      and(
        eq(schema.calendarEvents.autoRecord, true),
        sql`${schema.calendarEvents.startTime} >= ${now}`,
        sql`${schema.calendarEvents.status} != 'cancelled'`
      )
    )
    .orderBy(asc(schema.calendarEvents.startTime));
}
