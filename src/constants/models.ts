export type AIProvider = 'local' | 'openai' | 'anthropic';
export type WhisperModel = 'tiny' | 'base' | 'small' | 'medium';
export type TranscriptionModel = 'whisper-1' | 'gpt-4o-transcribe' | 'gpt-4o-mini-transcribe' | 'assemblyai';

export interface WhisperModelInfo {
  id: WhisperModel;
  name: string;
  sizeLabel: string;
  sizeBytes: number;
  languages: number;
  description: string;
}

export const WHISPER_MODELS: WhisperModelInfo[] = [
  {
    id: 'tiny',
    name: 'Tiny',
    sizeLabel: '75 MB',
    sizeBytes: 75_000_000,
    languages: 99,
    description: 'Fastest, lower accuracy. Good for quick notes.',
  },
  {
    id: 'base',
    name: 'Base',
    sizeLabel: '142 MB',
    sizeBytes: 142_000_000,
    languages: 99,
    description: 'Good balance of speed and accuracy.',
  },
  {
    id: 'small',
    name: 'Small',
    sizeLabel: '466 MB',
    sizeBytes: 466_000_000,
    languages: 99,
    description: 'High accuracy, moderate speed.',
  },
  {
    id: 'medium',
    name: 'Medium',
    sizeLabel: '1.5 GB',
    sizeBytes: 1_500_000_000,
    languages: 99,
    description: 'Best accuracy, slower processing.',
  },
];

export interface TranscriptionModelInfo {
  id: TranscriptionModel;
  name: string;
  description: string;
}

export const TRANSCRIPTION_MODELS: TranscriptionModelInfo[] = [
  {
    id: 'gpt-4o-transcribe',
    name: 'GPT-4o Transcribe',
    description: 'Best quality, multi-language support.',
  },
  {
    id: 'gpt-4o-mini-transcribe',
    name: 'GPT-4o Mini',
    description: 'Good quality, cheaper, multi-language support.',
  },
  {
    id: 'whisper-1',
    name: 'Whisper',
    description: 'Fast, single-language only.',
  },
  {
    id: 'assemblyai',
    name: 'AssemblyAI',
    description: 'Audio-based speaker detection, high accuracy.',
  },
];

export const AI_PROVIDERS = {
  local: { name: 'On-Device', description: 'Private, works offline' },
  openai: { name: 'OpenAI', description: 'GPT-4o, high quality' },
  anthropic: { name: 'Anthropic', description: 'Claude, high quality' },
} as const;

export const DEFAULT_SETTINGS = {
  audioQuality: 'high' as 'low' | 'medium' | 'high' | 'lossless',
  defaultLanguage: 'en',
  autoTranscribe: true,
  aiProvider: 'openai' as AIProvider,
  whisperModel: 'base' as WhisperModel,
  transcriptionModel: 'assemblyai' as TranscriptionModel,
  theme: 'system' as 'light' | 'dark' | 'system',
  appLockEnabled: false,
  appLockTimeout: 60,
  syncEnabled: false,
};
