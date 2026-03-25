import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { DEFAULT_SETTINGS, type AIProvider, type WhisperModel, type TranscriptionModel } from '../constants/models';
import * as queries from '../db/queries';


interface SettingsState {
  theme: 'light' | 'dark' | 'system';
  audioQuality: 'low' | 'medium' | 'high' | 'lossless';
  defaultLanguage: string;
  autoTranscribe: boolean;
  aiProvider: AIProvider;
  whisperModel: WhisperModel;
  transcriptionModel: TranscriptionModel;
  appLockEnabled: boolean;
  appLockTimeout: number;
  syncEnabled: boolean;
  supabaseUrl: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  deeplApiKey: string;
  assemblyaiApiKey: string;
  isLoaded: boolean;
  error: string | null;

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => Promise<void>;
  clearError: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  supabaseUrl: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  deeplApiKey: '',
  assemblyaiApiKey: '',
  isLoaded: false,
  error: null,

  loadSettings: async () => {
    const keys = [
      'theme', 'audioQuality', 'defaultLanguage', 'autoTranscribe',
      'aiProvider', 'whisperModel', 'transcriptionModel', 'appLockEnabled', 'appLockTimeout',
      'syncEnabled', 'supabaseUrl',
    ];

    for (const key of keys) {
      const value = await queries.getSetting(key);
      if (value !== undefined) {
        let parsed: any = value;
        if (value === 'true') parsed = true;
        else if (value === 'false') parsed = false;
        else if (!isNaN(Number(value)) && key === 'appLockTimeout') parsed = Number(value);
        set({ [key]: parsed } as any);
      }
    }

    // Load API keys from SecureStore (user-provided keys only)
    const [openaiKey, anthropicKey, deeplKey, assemblyaiKey] = await Promise.all([
      SecureStore.getItemAsync('voicy_openai_key'),
      SecureStore.getItemAsync('voicy_anthropic_key'),
      SecureStore.getItemAsync('voicy_deepl_key'),
      SecureStore.getItemAsync('voicy_assemblyai_key'),
    ]);
    set({
      openaiApiKey: openaiKey || '',
      anthropicApiKey: anthropicKey || '',
      deeplApiKey: deeplKey || '',
      assemblyaiApiKey: assemblyaiKey || '',
    });

    set({ isLoaded: true });
  },

  clearError: () => set({ error: null }),

  updateSetting: async (key, value) => {
    set({ [key]: value } as any);
    // Don't persist API keys to SQLite - they go to SecureStore
    const secureKeys = ['openaiApiKey', 'anthropicApiKey', 'deeplApiKey', 'assemblyaiApiKey'];
    if (!secureKeys.includes(key as string)) {
      await queries.setSetting(key as string, String(value));
    }
  },
}));
