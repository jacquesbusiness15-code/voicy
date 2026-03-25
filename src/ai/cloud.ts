import { File } from 'expo-file-system';
import type { AIProvider } from '../constants/models';
import { resilientFetch } from '../utils/resilientFetch';
import { supabase, SUPABASE_URL } from '../lib/supabase';
import { assertOnline } from '../utils/networkGuard';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// ── Proxy Helper ──────────────────────────────────────────────

async function proxyFetch(
  functionName: string,
  endpoint: string,
  options: RequestInit & { timeoutMs?: number; maxRetries?: number }
): Promise<Response> {
  assertOnline();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Sign in required to use AI features.');
  }

  const url = `${SUPABASE_URL}/functions/v1/${functionName}`;
  const { timeoutMs, maxRetries, ...fetchOptions } = options;

  return resilientFetch(url, {
    ...fetchOptions,
    timeoutMs,
    maxRetries,
    headers: {
      ...(fetchOptions.headers as Record<string, string>),
      Authorization: `Bearer ${session.access_token}`,
      'x-endpoint': endpoint,
    },
  });
}

// ── OpenAI ──────────────────────────────────────────────────

export async function openaiTranscribe(
  audioPath: string,
  apiKey?: string,
  model: string = 'gpt-4o-transcribe'
): Promise<{ text: string; segments?: any[]; detectedLanguage?: string }> {
  assertOnline();
  const file = new File(audioPath);
  if (!file.exists) throw new Error('Audio file not found');

  const formData = new FormData();
  formData.append('file', {
    uri: audioPath,
    type: 'audio/mp4',
    name: 'recording.m4a',
  } as any);
  formData.append('model', model);
  const isWhisper = model === 'whisper-1';
  const isGpt4oTranscribe = model.startsWith('gpt-4o');
  if (isGpt4oTranscribe) {
    formData.append('response_format', 'json');
    formData.append('timestamp_granularities[]', 'segment');
    formData.append('prompt', 'IMPORTANT: This is a TRANSCRIPTION, not a translation. Transcribe each part in its ORIGINAL spoken language. If someone speaks German, write German. If someone speaks Arabic, write Arabic (العربية). If someone speaks Russian, write Russian (Русский). If someone speaks Japanese, write Japanese (日本語). If someone speaks Korean, write Korean (한국어). If someone speaks Hindi, write Hindi (हिन्दी). When transcribing Chinese, use Simplified Chinese (简体中文). NEVER translate any part to English or any other language. Keep each segment in the language it was spoken in.');
  } else if (isWhisper) {
    formData.append('response_format', 'verbose_json');
  } else {
    formData.append('response_format', 'json');
  }

  const response = apiKey
    ? await resilientFetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
        timeoutMs: 120000,
      })
    : await proxyFetch('openai', 'transcriptions', {
        method: 'POST',
        body: formData,
        timeoutMs: 120000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI transcription failed: ${error}`);
  }

  const result = await response.json();
  return {
    text: result.text,
    segments: result.segments,
    detectedLanguage: result.language,
  };
}

export async function openaiChat(
  messages: ChatMessage[],
  apiKey?: string,
  model: string = 'gpt-4o',
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  assertOnline();
  const body = JSON.stringify({
    model,
    messages,
    temperature: options?.temperature ?? 0.7,
    max_tokens: options?.maxTokens ?? 4096,
  });

  const response = apiKey
    ? await resilientFetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        timeoutMs: 60000,
      })
    : await proxyFetch('openai', 'chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 60000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI chat failed: ${error}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content ?? '';
}

export async function openaiEmbed(
  text: string,
  apiKey?: string
): Promise<number[]> {
  assertOnline();
  const body = JSON.stringify({
    model: 'text-embedding-3-small',
    input: text,
  });

  const response = apiKey
    ? await resilientFetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        timeoutMs: 15000,
      })
    : await proxyFetch('openai', 'embeddings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 15000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI embedding failed: ${error}`);
  }

  const result = await response.json();
  return result.data[0]?.embedding ?? [];
}

// ── Anthropic ───────────────────────────────────────────────

export async function anthropicChat(
  messages: ChatMessage[],
  apiKey?: string,
  model: string = 'claude-sonnet-4-20250514',
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  assertOnline();
  const systemMessage = messages.find((m) => m.role === 'system');
  const chatMessages = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const body = JSON.stringify({
    model,
    max_tokens: options?.maxTokens ?? 4096,
    temperature: options?.temperature ?? 1.0,
    system: systemMessage?.content,
    messages: chatMessages,
  });

  const response = apiKey
    ? await resilientFetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        timeoutMs: 60000,
      })
    : await proxyFetch('anthropic', 'messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 60000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic chat failed: ${error}`);
  }

  const result = await response.json();
  return result.content[0]?.text ?? '';
}

// ── Translation ─────────────────────────────────────────────

export async function openaiTranslate(
  text: string,
  targetLanguage: string,
  apiKey?: string
): Promise<string> {
  return openaiChat(
    [
      {
        role: 'system',
        content: `You are a professional translator. Translate the following text to ${targetLanguage}. Only output the translation, nothing else.`,
      },
      { role: 'user', content: text },
    ],
    apiKey
  );
}

export async function deeplTranslate(
  text: string,
  targetLang: string,
  apiKey?: string
): Promise<string> {
  assertOnline();
  const body = JSON.stringify({
    text: [text],
    target_lang: targetLang.toUpperCase(),
  });

  const response = apiKey
    ? await resilientFetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `DeepL-Auth-Key ${apiKey}`,
        },
        body,
        timeoutMs: 15000,
      })
    : await proxyFetch('deepl', 'translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 15000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepL translation failed: ${error}`);
  }

  const result = await response.json();
  return result.translations[0]?.text ?? '';
}

// ── AssemblyAI ─────────────────────────────────────────────

export interface AssemblyAIUtterance {
  speaker: string;
  text: string;
  start: number;
  end: number;
  confidence: number;
}

async function assemblyaiUpload(audioPath: string, apiKey?: string): Promise<string> {
  assertOnline();
  const file = new File(audioPath);
  if (!file.exists) throw new Error('Audio file not found');

  const bytes = await file.bytes();

  const response = apiKey
    ? await resilientFetch('https://api.assemblyai.com/v2/upload', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/octet-stream',
        },
        body: bytes,
        timeoutMs: 120000,
      })
    : await proxyFetch('assemblyai', 'upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: bytes,
        timeoutMs: 120000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`AssemblyAI upload failed: ${error}`);
  }

  const result = await response.json();
  return result.upload_url;
}

export async function assemblyaiTranscribe(
  audioPath: string,
  apiKey?: string,
  options?: { speakersExpected?: number }
): Promise<{
  text: string;
  utterances?: AssemblyAIUtterance[];
  detectedLanguage?: string;
}> {
  const uploadUrl = await assemblyaiUpload(audioPath, apiKey);

  const requestBody: Record<string, any> = {
    audio_url: uploadUrl,
    speech_models: ['universal-3-pro'],
    speaker_labels: true,
    language_detection: true,
  };

  if (options?.speakersExpected && options.speakersExpected >= 2) {
    requestBody.speakers_expected = options.speakersExpected;
  }

  const jsonBody = JSON.stringify(requestBody);

  const submitResponse = apiKey
    ? await resilientFetch('https://api.assemblyai.com/v2/transcript', {
        method: 'POST',
        headers: {
          Authorization: apiKey,
          'Content-Type': 'application/json',
        },
        body: jsonBody,
        timeoutMs: 15000,
      })
    : await proxyFetch('assemblyai', 'transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: jsonBody,
        timeoutMs: 15000,
      });

  if (!submitResponse.ok) {
    const error = await submitResponse.text();
    throw new Error(`AssemblyAI transcription request failed: ${error}`);
  }

  const { id } = await submitResponse.json();

  // Poll for completion (every 3s, max 10 minutes)
  const maxAttempts = 200;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const pollResponse = apiKey
      ? await resilientFetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
          headers: { Authorization: apiKey },
          timeoutMs: 10000,
          maxRetries: 1,
        })
      : await proxyFetch('assemblyai', `poll/${id}`, {
          method: 'GET',
          timeoutMs: 10000,
          maxRetries: 1,
        });

    if (!pollResponse.ok) {
      const error = await pollResponse.text();
      throw new Error(`AssemblyAI polling failed: ${error}`);
    }

    const result = await pollResponse.json();

    if (result.status === 'completed') {
      return {
        text: result.text ?? '',
        utterances: result.utterances ?? undefined,
        detectedLanguage: result.language_code ?? undefined,
      };
    }

    if (result.status === 'error') {
      throw new Error(`AssemblyAI transcription failed: ${result.error ?? 'Unknown error'}`);
    }
  }

  throw new Error('AssemblyAI transcription timed out. The audio may be too long or the service may be experiencing issues.');
}

// ── OpenAI Text-to-Speech ──────────────────────────────────

export type TTSVoice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';

export async function openaiTextToSpeech(
  text: string,
  apiKey?: string,
  options?: {
    voice?: TTSVoice;
    model?: 'tts-1' | 'tts-1-hd';
    speed?: number;
  }
): Promise<ArrayBuffer> {
  assertOnline();
  const body = JSON.stringify({
    model: options?.model ?? 'tts-1',
    voice: options?.voice ?? 'nova',
    input: text,
    response_format: 'mp3',
    speed: options?.speed ?? 1.0,
  });

  const response = apiKey
    ? await resilientFetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        timeoutMs: 60000,
      })
    : await proxyFetch('openai', 'speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        timeoutMs: 60000,
      });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI TTS failed: ${error}`);
  }

  return response.arrayBuffer();
}

// ── Unified Interface ───────────────────────────────────────

export async function chatWithAI(
  messages: ChatMessage[],
  provider: AIProvider,
  apiKeys: { openai?: string; anthropic?: string },
  options?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  switch (provider) {
    case 'openai':
      return openaiChat(messages, apiKeys.openai, 'gpt-4o', options);
    case 'anthropic':
      return anthropicChat(messages, apiKeys.anthropic, 'claude-sonnet-4-20250514', options);
    case 'local': {
      // Use user key if available, otherwise fall through to proxy
      if (apiKeys.openai) return openaiChat(messages, apiKeys.openai, 'gpt-4o', options);
      if (apiKeys.anthropic) return anthropicChat(messages, apiKeys.anthropic, 'claude-sonnet-4-20250514', options);
      // No user keys — use proxy (defaults to OpenAI)
      return openaiChat(messages, undefined, 'gpt-4o', options);
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
