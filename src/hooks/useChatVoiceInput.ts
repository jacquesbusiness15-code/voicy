import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { openaiTranscribe } from '../ai/cloud';
import { useSettingsStore } from '../stores/settingsStore';

interface UseChatVoiceInputReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  duration: number;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
  cancelRecording: () => void;
}

export function useChatVoiceInput(): UseChatVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { openaiApiKey } = useSettingsStore();

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (timerRef.current) clearInterval(timerRef.current);
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) throw new Error('Microphone permission denied');

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start voice recording:', err);
      throw err;
    }
  }, []);

  const stopRecording = useCallback(async (): Promise<string> => {
    if (!recordingRef.current) return '';

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;

      if (!uri) throw new Error('No recording URI');

      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });

      if (!openaiApiKey) throw new Error('OpenAI API key required for voice transcription');

      setIsTranscribing(true);
      try {
        const result = await openaiTranscribe(uri, openaiApiKey, 'whisper-1');
        return result.text;
      } finally {
        setIsTranscribing(false);
        // Clean up temp file
        try { await FileSystem.deleteAsync(uri, { idempotent: true }); } catch {}
      }
    } catch (err) {
      setIsTranscribing(false);
      console.error('Voice transcription failed:', err);
      throw err;
    }
  }, [openaiApiKey]);

  const cancelRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recordingRef.current) {
      recordingRef.current.stopAndUnloadAsync().catch(() => {});
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      if (uri) FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
    setIsRecording(false);
    setDuration(0);
  }, []);

  return { isRecording, isTranscribing, duration, startRecording, stopRecording, cancelRecording };
}
