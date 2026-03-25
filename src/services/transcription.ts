import { openaiTranscribe, assemblyaiTranscribe, chatWithAI } from '../ai/cloud';
import type { AssemblyAIUtterance } from '../ai/cloud';
import { PROMPTS, fillPrompt } from '../ai/prompts';
import * as queries from '../db/queries';
import type { Transcript } from '../db/schema';
import type { AIProvider } from '../constants/models';
import { generateEmbeddingsForRecording } from './askAI';
import { autoTag, generateAIOutput } from './summarization';

async function getSpeakerNamesHint(): Promise<string> {
  const raw = await queries.getSetting('speakerNames');
  if (!raw) return '';
  try {
    const names: string[] = JSON.parse(raw);
    if (names.length === 0) return '';
    return `\nThe following people may be speaking: ${names.join(', ')}. When you can identify a speaker, use their real name instead of "Voice N".\n`;
  } catch {
    return '';
  }
}

export async function transcribeRecording(
  recordingId: string,
  audioPath: string,
  options: {
    engine: 'whisper-local' | 'openai' | 'assemblyai';
    language?: string;
    apiKey?: string;
    assemblyaiApiKey?: string;
    transcriptionModel?: string;
    aiProvider?: AIProvider;
    apiKeys?: { openai?: string; anthropic?: string };
    speakersExpected?: number;
  }
): Promise<Transcript> {
  let text = '';
  let segments: any[] | undefined;
  let openaiSegments: any[] | undefined; // Preserve fine-grained OpenAI segments for LLM fallback
  let confidence: number | undefined;
  let detectedLanguage: string | undefined;
  let hasSpeakerLabelsFromAudio = false;
  // Only use transcriptionModel for OpenAI models; non-OpenAI values (e.g. 'assemblyai') fall back to default
  const openaiModel = (options.transcriptionModel && ['gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'].includes(options.transcriptionModel))
    ? options.transcriptionModel : 'gpt-4o-transcribe';

  switch (options.engine) {
    case 'openai': {
      const result = await openaiTranscribe(audioPath, options.apiKey, openaiModel);
      text = result.text;
      segments = result.segments;
      detectedLanguage = result.detectedLanguage;

      // Save OpenAI segments before they might be overwritten by AssemblyAI
      openaiSegments = segments ? [...segments] : undefined;

      // OpenAI/Whisper has NO speaker diarization — if AssemblyAI key is available,
      // also run AssemblyAI to get audio-based speaker labels (the only reliable method)
      if (options.assemblyaiApiKey) {
        try {
          const aaiResult = await assemblyaiTranscribe(
            audioPath,
            options.assemblyaiApiKey,
            { speakersExpected: options.speakersExpected }
          );
          if (aaiResult.utterances && aaiResult.utterances.length > 0) {
            // Use AssemblyAI's speaker-labeled output (audio-based diarization is far
            // more accurate than LLM text-guessing) but keep timestamps from its data
            text = formatAssemblyAIUtterances(aaiResult.utterances);
            segments = aaiResult.utterances.map((u) => ({
              start: u.start / 1000,
              end: u.end / 1000,
              text: u.text,
              speaker: u.speaker,
            }));
            hasSpeakerLabelsFromAudio = true;
          }
        } catch (e: any) {
          console.warn('AssemblyAI speaker diarization fallback failed, using OpenAI text only:', e.message);
        }
      }
      break;
    }

    case 'assemblyai': {
      const aaiResult = await assemblyaiTranscribe(
        audioPath,
        options.assemblyaiApiKey,
        { speakersExpected: options.speakersExpected }
      );
      if (aaiResult.utterances && aaiResult.utterances.length > 0) {
        text = formatAssemblyAIUtterances(aaiResult.utterances);
        hasSpeakerLabelsFromAudio = true;
      } else {
        text = aaiResult.text;
      }
      segments = aaiResult.utterances?.map((u) => ({
        start: u.start / 1000,
        end: u.end / 1000,
        text: u.text,
        speaker: u.speaker,
      }));
      detectedLanguage = aaiResult.detectedLanguage;
      break;
    }

    case 'whisper-local': {
      // Local whisper not yet available - fall back to OpenAI cloud (direct or via proxy)
      const result = await openaiTranscribe(audioPath, options.apiKey, openaiModel);
      text = result.text;
      segments = result.segments;
      detectedLanguage = result.detectedLanguage;

      // Save OpenAI segments before they might be overwritten by AssemblyAI
      openaiSegments = segments ? [...segments] : undefined;

      // Also run AssemblyAI for speaker diarization (same as OpenAI path)
      try {
        const aaiResult = await assemblyaiTranscribe(
          audioPath,
          options.assemblyaiApiKey,
          { speakersExpected: options.speakersExpected }
        );
        if (aaiResult.utterances && aaiResult.utterances.length > 0) {
          text = formatAssemblyAIUtterances(aaiResult.utterances);
          segments = aaiResult.utterances.map((u) => ({
            start: u.start / 1000,
            end: u.end / 1000,
            text: u.text,
            speaker: u.speaker,
          }));
          hasSpeakerLabelsFromAudio = true;
        }
      } catch (e: any) {
        console.warn('AssemblyAI speaker diarization fallback failed:', e.message);
      }
      break;
    }

    default:
      throw new Error(`Unknown transcription engine: ${options.engine}`);
  }

  // Save transcript to database — use Whisper's detected language instead of user default
  const transcript = await queries.createTranscript({
    recordingId,
    content: text,
    language: detectedLanguage ?? options.language ?? 'en',
    engine: options.engine,
    confidence,
    segments: segments ? JSON.stringify(segments) : undefined,
  });

  // Auto-generate AI title (with first-sentence fallback)
  if (text) {
    const fallbackTitle = text.split(/[.!?\n]/)[0]?.trim().substring(0, 100) || 'Untitled';
    await queries.updateRecording(recordingId, { title: fallbackTitle });

    // Non-blocking AI title generation — replaces fallback once ready
    (async () => {
      try {
        const prompt = fillPrompt(PROMPTS.generateTitle, { text: text.substring(0, 1000) });
        const aiTitle = await chatWithAI(
          [{ role: 'user', content: prompt }],
          'openai',
          { openai: options.apiKey }
        );
        const cleanTitle = aiTitle.trim().replace(/^["']|["']$/g, '').substring(0, 100);
        if (cleanTitle) {
          await queries.updateRecording(recordingId, { title: cleanTitle });
        }
      } catch (e: any) {
        console.warn('AI title generation failed:', e.message);
      }
    })();
  }

  {
    // Auto-generate embeddings for semantic search (non-blocking)
    generateEmbeddingsForRecording(recordingId, options.apiKey).catch((e) =>
      console.warn('Embedding generation failed:', e.message)
    );

    // Auto-tag from transcript content (non-blocking)
    autoTag(recordingId, {
      provider: 'openai',
      apiKeys: { openai: options.apiKey },
    }).catch((e) => console.warn('Auto-tagging failed:', e.message));

    // Auto-diarize, then format, then generate AI outputs (non-blocking)
    // AI outputs MUST run after diarization so they include voice labels and timestamps
    const diarProvider = options.aiProvider ?? 'openai';
    const diarKeys = options.apiKeys ?? { openai: options.apiKey };
    (async () => {
      const alreadyDiarized = hasSpeakerLabelsFromAudio;
      const rec = await queries.getRecordingById(recordingId);

      // Auto-detect multiple speakers from timing gaps in segments
      const needsDiarization = rec?.isMeeting || detectMultipleSpeakers(segments);

      // Count how many distinct speakers AssemblyAI found
      const audioSpeakerCount = alreadyDiarized && segments
        ? new Set(segments.map((s: any) => s.speaker).filter(Boolean)).size
        : 0;

      if (alreadyDiarized && audioSpeakerCount <= 1 && needsDiarization) {
        // AssemblyAI detected only 1 speaker but context suggests multiple speakers
        // (e.g. meeting mode, or conversational patterns in text). The audio system
        // likely under-segmented — fall back to LLM diarization which can use text
        // cues like Q&A patterns, contradictory statements, and addressal to split speakers.
        //
        // IMPORTANT: If we have fine-grained OpenAI segments, temporarily restore them
        // before running LLM diarization. AssemblyAI's utterance-level segments are too
        // coarse (already merged per speaker) and all labeled as the same speaker,
        // giving the LLM nothing useful to work with.
        try {
          if (openaiSegments && openaiSegments.length > 0) {
            await queries.updateTranscriptSegments(transcript.id, JSON.stringify(openaiSegments));
            // Also restore original text without speaker labels for clean LLM input
            const plainText = openaiSegments.map((s: any) => s.text?.trim() ?? '').filter(Boolean).join(' ');
            if (plainText) {
              await queries.updateTranscriptContent(transcript.id, plainText);
            }
          }
          await diarizeTranscript(recordingId, { provider: diarProvider, apiKeys: diarKeys, speakersExpected: options.speakersExpected });
        } catch (e: any) {
          console.warn('LLM diarization fallback failed:', e.message);
        }
      } else if (alreadyDiarized && audioSpeakerCount >= 2) {
        // Audio-based diarization found multiple speakers — these labels are authoritative.
        // Only run refinement if the audio detected significantly MORE speakers than expected,
        // which suggests over-segmentation (same person split into multiple voices).
        // Otherwise, trust the audio labels — they are far more reliable than LLM guessing.
        const expectedCount = options.speakersExpected ?? 0;
        const likelyOverSegmented = expectedCount >= 2 && audioSpeakerCount > expectedCount;
        if (likelyOverSegmented) {
          try {
            await refineDiarization(recordingId, { provider: diarProvider, apiKeys: diarKeys, speakersExpected: expectedCount });
          } catch (e: any) {
            console.warn('Diarization refinement failed:', e.message);
          }
        }
      } else if (needsDiarization && !alreadyDiarized) {
        // No audio-based labels at all — use full LLM diarization from scratch
        try {
          await diarizeTranscript(recordingId, { provider: diarProvider, apiKeys: diarKeys, speakersExpected: options.speakersExpected });
        } catch (e: any) {
          console.warn('Auto-diarization failed:', e.message);
        }
      }

      // Only format non-diarized transcripts — formatting can corrupt speaker labels
      const hasSpeakerLabels = alreadyDiarized || needsDiarization;
      if (!hasSpeakerLabels) {
        try {
          await formatTranscript(recordingId, { provider: diarProvider, apiKeys: diarKeys });
        } catch (e: any) {
          console.warn('Auto-formatting failed:', e.message);
        }
      }

      // Generate bullet points AFTER diarization/formatting so they include voice labels
      generateAIOutput(recordingId, 'bullet_points', {
        provider: 'openai',
        apiKeys: { openai: options.apiKey },
      }).catch((e) => console.warn('Auto bullet points failed:', e.message));
    })();
  }

  return transcript;
}

export async function retranscribe(
  recordingId: string,
  audioPath: string,
  options: {
    engine: 'whisper-local' | 'openai' | 'assemblyai';
    language?: string;
    apiKey?: string;
    assemblyaiApiKey?: string;
    transcriptionModel?: string;
    aiProvider?: AIProvider;
    apiKeys?: { openai?: string; anthropic?: string };
    speakersExpected?: number;
  }
): Promise<Transcript> {
  // Delete existing transcript first
  const existing = await queries.getTranscriptByRecordingId(recordingId);
  if (existing) {
    const db = await import('../db/client').then((m) => m.getDatabase());
    const { transcripts } = await import('../db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(transcripts).where(eq(transcripts.id, existing.id));
  }

  return transcribeRecording(recordingId, audioPath, options);
}

export async function diarizeTranscript(
  recordingId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
    speakersExpected?: number;
  }
): Promise<string> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) throw new Error('No transcript found. Please transcribe first.');

  // Build timing context from segments if available
  let segmentsBlock = '';
  if (transcript.segments) {
    try {
      const segs = JSON.parse(transcript.segments);
      if (Array.isArray(segs) && segs.length > 0) {
        const hasSpeakerLabels = segs.some((s: any) => s.speaker);
        const timingLines: string[] = [];
        for (let i = 0; i < segs.length; i++) {
          const s = segs[i];
          const start = formatTimestamp(s.start);
          const end = formatTimestamp(s.end);
          const duration = (s.end - s.start).toFixed(1);
          // Include audio-detected speaker label if available
          const speakerHint = hasSpeakerLabels && s.speaker ? ` [Audio Speaker: ${s.speaker}]` : '';
          timingLines.push(`[#${i + 1}] [${start} → ${end}] (${duration}s)${speakerHint} ${s.text?.trim() ?? ''}`);

          // Add gap annotation between segments
          if (i < segs.length - 1) {
            const gap = segs[i + 1].start - s.end;
            if (gap >= 1.5) {
              timingLines.push(`  ⏸ ${gap.toFixed(1)}s gap  ← LIKELY SPEAKER CHANGE`);
            } else if (gap >= 0.5) {
              timingLines.push(`  ⏸ ${gap.toFixed(1)}s gap  ← POSSIBLE SPEAKER CHANGE`);
            } else if (gap >= 0.2) {
              timingLines.push(`  ⏸ ${gap.toFixed(1)}s gap`);
            }
          }
        }
        const speakerNote = hasSpeakerLabels
          ? '\nNOTE: [Audio Speaker: X] labels are from audio analysis detecting different voice frequencies. These are HIGHLY reliable — use them as your primary guide for who is speaking. Map each audio speaker letter to a Voice number consistently.'
          : '';
        segmentsBlock = `## Timing data (use gaps and speaker labels to detect speaker changes)\nIMPORTANT: Use the start time from each segment for the timestamp in your output. Convert to M:SS format (e.g., 0:32, 1:05, 12:30).${speakerNote}\n\n${timingLines.join('\n')}\n\n`;
      }
    } catch {
      // Ignore malformed segments
    }
  }

  // Build speaker count hint for the prompt
  const speakerCountHint = options.speakersExpected && options.speakersExpected >= 2
    ? `IMPORTANT: The user indicated there are ${options.speakersExpected} speakers in this recording. You MUST identify exactly ${options.speakersExpected} distinct voices. Every time one person finishes speaking and another responds, that is a speaker change — label it as a new Voice. Do NOT collapse multiple people into one voice.\n\n`
    : '';

  // Include saved speaker names so the AI can use real names
  const speakerNamesHint = await getSpeakerNamesHint();

  const prompt = fillPrompt(PROMPTS.diarize, {
    text: transcript.content,
    segments: segmentsBlock,
    speakerCountHint: speakerCountHint + speakerNamesHint,
  });
  const diarized = await chatWithAI(
    [{ role: 'user', content: prompt }],
    options.provider,
    options.apiKeys,
    { temperature: 0.1, maxTokens: 16384 }
  );

  // Extract only the labeled dialog, stripping chain-of-thought analysis
  let finalOutput = diarized;
  const dialogMatch = diarized.match(/<dialog>([\s\S]*?)<\/dialog>/);
  if (dialogMatch) {
    finalOutput = dialogMatch[1].trim();
  } else {
    // Fallback: if no <dialog> tags, strip everything before the first "Voice N" line
    // to remove any chain-of-thought analysis the LLM may have output
    const firstVoiceLine = diarized.match(/^(Voice \d+|[A-Z][a-z]+ )\s*\(/m);
    if (firstVoiceLine && firstVoiceLine.index !== undefined && firstVoiceLine.index > 0) {
      finalOutput = diarized.substring(firstVoiceLine.index).trim();
    }
  }

  await queries.updateTranscriptContent(transcript.id, finalOutput);
  return finalOutput;
}

export async function refineDiarization(
  recordingId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
    speakersExpected?: number;
  }
): Promise<string> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) throw new Error('No transcript found.');

  // Only refine if the transcript has speaker labels
  if (!transcript.content.match(/^Voice \d+/m)) {
    return transcript.content;
  }

  const speakerHint = options.speakersExpected
    ? `\nIMPORTANT: The user indicated there are ${options.speakersExpected} speakers. Merge voices down to exactly ${options.speakersExpected} if there are more. Do NOT create additional voices.\n`
    : '';
  const prompt = fillPrompt(PROMPTS.refineDiarization, { text: transcript.content, speakerHint });
  const refined = await chatWithAI(
    [{ role: 'user', content: prompt }],
    options.provider,
    options.apiKeys,
    { temperature: 0.05, maxTokens: 8192 }
  );

  const cleanOutput = refined.trim();
  if (cleanOutput) {
    await queries.updateTranscriptContent(transcript.id, cleanOutput);
    return cleanOutput;
  }
  return transcript.content;
}

function formatAssemblyAIUtterances(utterances: AssemblyAIUtterance[]): string {
  // Map AssemblyAI's "A"/"B"/"C" labels to "Voice 1"/"Voice 2"/"Voice 3"
  const speakerMap = new Map<string, string>();
  let nextSpeakerNum = 1;

  const lines: string[] = [];
  for (const u of utterances) {
    if (!speakerMap.has(u.speaker)) {
      speakerMap.set(u.speaker, `Voice ${nextSpeakerNum}`);
      nextSpeakerNum++;
    }
    const label = speakerMap.get(u.speaker)!;
    const mins = Math.floor(u.start / 60000);
    const secs = Math.floor((u.start % 60000) / 1000);
    const timestamp = `${mins}:${secs.toString().padStart(2, '0')}`;
    lines.push(`${label} (${timestamp}): ${u.text}`);
  }

  // Always keep speaker labels — even if AssemblyAI detected only 1 speaker,
  // the labels are needed for downstream diarization to refine/split if needed.
  // Stripping labels here loses information that the LLM fallback could use.
  return lines.join('\n');
}

/**
 * Detect likely multiple speakers from audio segments using timing gaps
 * AND conversational patterns in the text.
 */
function detectMultipleSpeakers(segments?: any[]): boolean {
  if (!segments || segments.length < 2) return false;

  let significantGaps = 0;
  let conversationalPatterns = 0;
  const fullText = segments.map((s) => s.text?.trim() ?? '').join(' ').toLowerCase();

  // Check timing gaps — speaker changes often happen with gaps as short as 0.5s
  for (let i = 0; i < segments.length - 1; i++) {
    const gap = segments[i + 1].start - segments[i].end;
    if (gap >= 0.5) significantGaps++;
  }

  // Check for conversational patterns that indicate multiple speakers
  const conversationSignals = [
    /\b(you said|you mentioned|you think|you were|do you|are you|can you|would you|will you)\b/,
    /\b(I agree|I disagree|that's right|that's wrong|exactly|no,|yes,|yeah,|nah,)\b/,
    /\b(what do you|how do you|where do you|why do you|who do you)\b/,
    /\b(thank you|thanks for|nice to meet|hello|hey there|good morning|good afternoon)\b/,
    /\b(in my opinion|from my perspective|I believe|I think that|personally)\b/,
  ];

  for (const pattern of conversationSignals) {
    if (pattern.test(fullText)) conversationalPatterns++;
  }

  // Multiple speakers if: 2+ timing gaps, OR 1+ gap with conversational patterns,
  // OR strong conversational patterns alone (3+)
  return significantGaps >= 2 || (significantGaps >= 1 && conversationalPatterns >= 1) || conversationalPatterns >= 3;
}

function formatTimestamp(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 10);
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms}`;
}

export async function formatTranscript(
  recordingId: string,
  options: {
    provider: AIProvider;
    apiKeys: { openai?: string; anthropic?: string };
  }
): Promise<string> {
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) throw new Error('No transcript found. Please transcribe first.');

  const prompt = fillPrompt(PROMPTS.formatTranscript, { text: transcript.content });
  const formatted = await chatWithAI(
    [{ role: 'user', content: prompt }],
    options.provider,
    options.apiKeys
  );

  await queries.updateTranscriptContent(transcript.id, formatted);
  return formatted;
}
