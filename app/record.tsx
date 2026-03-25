import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Portal, Dialog, Button, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';
import { useRecorder } from '../src/hooks/useRecorder';
import { AudioWaveform } from '../src/components/AudioWaveform';
import { formatDuration } from '../src/utils/time';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useToastStore } from '../src/stores/toastStore';
import { useNetworkStore } from '../src/stores/networkStore';
import { transcribeRecording } from '../src/services/transcription';
import { appendTranscriptContent, linkRecordingToEvent } from '../src/db/queries';
import * as queries from '../src/db/queries';

export default function RecordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const recorder = useRecorder();
  const { appendToRecordingId, appendToTitle, isMeeting: isMeetingParam, eventId, eventTitle } = useLocalSearchParams<{ appendToRecordingId?: string; appendToTitle?: string; isMeeting?: string; eventId?: string; eventTitle?: string }>();
  const defaultLanguage = useSettingsStore((s) => s.defaultLanguage);
  const autoTranscribe = useSettingsStore((s) => s.autoTranscribe);
  const openaiApiKey = useSettingsStore((s) => s.openaiApiKey);
  const anthropicApiKey = useSettingsStore((s) => s.anthropicApiKey);
  const aiProvider = useSettingsStore((s) => s.aiProvider);
  const transcriptionModel = useSettingsStore((s) => s.transcriptionModel);
  const assemblyaiApiKey = useSettingsStore((s) => s.assemblyaiApiKey);

  const toast = useToastStore();
  const { isConnected, isInternetReachable } = useNetworkStore();
  const isOffline = !isConnected || isInternetReachable === false;
  const isAppendMode = !!appendToRecordingId;

  const [isMeeting, setIsMeeting] = useState(isMeetingParam === 'true');
  const [speakerCount, setSpeakerCount] = useState(2);
  const [language] = useState(defaultLanguage);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  const handleStart = useCallback(async () => {
    try { await recorder.start({ isMeeting, language }); } catch (e: any) { toast.show(e.message, 'error'); }
  }, [recorder, isMeeting, language]);

  const handleStop = useCallback(async () => {
    if (isTranscribing) return;
    try {
      const recording = await recorder.stop({ isMeeting, language });

      if (isAppendMode && appendToRecordingId) {
        // Transcribe the new segment
        if (isOffline) { toast.show('No internet — recording saved, transcription skipped', 'info'); router.replace(`/recording/${appendToRecordingId}`); return; }
        const hasTranscriptionKey = !!(assemblyaiApiKey || openaiApiKey);
        const engine = assemblyaiApiKey ? 'assemblyai' : (openaiApiKey ? 'openai' : 'whisper-local');
        if (hasTranscriptionKey) {
          setIsTranscribing(true);
          try {
            let transcribeEngine = engine;
            try {
              await transcribeRecording(recording.id, recording.filePath, { engine, apiKey: openaiApiKey, assemblyaiApiKey, transcriptionModel, aiProvider, apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey }, speakersExpected: isMeeting ? speakerCount : undefined });
            } catch (e: any) {
              // Fallback to OpenAI if AssemblyAI failed
              if (engine === 'assemblyai' && openaiApiKey) {
                await transcribeRecording(recording.id, recording.filePath, { engine: 'openai', apiKey: openaiApiKey, aiProvider, apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey }, speakersExpected: isMeeting ? speakerCount : undefined });
                transcribeEngine = 'openai';
              } else {
                throw e;
              }
            }
            // Get the new transcript and append to original
            const newTranscript = await queries.getTranscriptByRecordingId(recording.id);
            if (newTranscript) {
              await appendTranscriptContent(appendToRecordingId, newTranscript.content);
            }
            // Update original recording duration
            const originalRecording = await queries.getRecordingById(appendToRecordingId);
            if (originalRecording) {
              const db = await import('../src/db/client').then((m) => m.getDatabase());
              const { recordings } = await import('../src/db/schema');
              const { eq } = await import('drizzle-orm');
              await db.update(recordings).set({
                duration: originalRecording.duration + recording.duration,
                updatedAt: new Date().toISOString(),
              }).where(eq(recordings.id, appendToRecordingId));
            }
          } catch (e: any) { toast.show(e.message, 'error'); }
          finally { setIsTranscribing(false); }
        }
        router.replace(`/recording/${appendToRecordingId}`);
      } else {
        if (autoTranscribe && isOffline) {
          toast.show('No internet — recording saved, transcription skipped', 'info');
          router.replace(`/recording/${recording.id}`);
          return;
        }
        const hasKey = !!(assemblyaiApiKey || openaiApiKey);
        const eng = assemblyaiApiKey ? 'assemblyai' : (openaiApiKey ? 'openai' : 'whisper-local');
        if (autoTranscribe) {
          setIsTranscribing(true);
          try {
            await transcribeRecording(recording.id, recording.filePath, { engine: eng, apiKey: openaiApiKey, assemblyaiApiKey, transcriptionModel, aiProvider, apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey }, speakersExpected: isMeeting ? speakerCount : undefined });
          } catch (e: any) {
            // Fallback to OpenAI if AssemblyAI failed
            if (eng === 'assemblyai' && openaiApiKey) {
              console.warn('AssemblyAI failed, falling back to OpenAI:', e.message);
              try {
                await transcribeRecording(recording.id, recording.filePath, { engine: 'openai', apiKey: openaiApiKey, aiProvider, apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey }, speakersExpected: isMeeting ? speakerCount : undefined });
              } catch (fallbackErr: any) {
                toast.show(`Transcription failed: ${fallbackErr.message}`, 'error');
              }
            } else {
              toast.show(e.message, 'error');
            }
          } finally { setIsTranscribing(false); }
        }
        // Link recording to calendar event if applicable
        if (eventId) {
          await linkRecordingToEvent(eventId, recording.id);
        }

        router.replace(`/recording/${recording.id}`);
      }
    } catch (e: any) { toast.show(e.message, 'error'); }
  }, [recorder, isMeeting, speakerCount, language, router, autoTranscribe, openaiApiKey, assemblyaiApiKey, transcriptionModel, isAppendMode, appendToRecordingId, eventId]);

  const handleCancel = useCallback(async () => {
    setShowCancelDialog(false);
    await recorder.cancel();
    router.canGoBack() ? router.back() : router.replace('/');
  }, [recorder, router]);

  const isRecording = recorder.isRecording;
  const isPaused = recorder.isPaused;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Close */}
      <Pressable style={styles.closeButton} onPress={() => isRecording ? setShowCancelDialog(true) : router.canGoBack() ? router.back() : router.replace('/')}>
        <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
      </Pressable>

      {/* Meeting toggle + speaker count (hidden in append mode) */}
      {!isAppendMode && (
        <View style={styles.meetingRow}>
          <Pressable onPress={() => !isRecording && setIsMeeting(!isMeeting)} style={[styles.meetingToggle, { backgroundColor: isMeeting ? VoicyColors.cardBg : VoicyColors.inputBg }]}>
            <MaterialCommunityIcons name="account-group" size={16} color={isMeeting ? VoicyColors.white : VoicyColors.secondaryText} />
            <Text style={{ color: isMeeting ? VoicyColors.white : VoicyColors.secondaryText, fontSize: 13 }}>Meeting</Text>
          </Pressable>
          {isMeeting && !isRecording && (
            <View style={styles.speakerCountRow}>
              <Pressable onPress={() => setSpeakerCount(Math.max(2, speakerCount - 1))} style={styles.speakerCountBtn}>
                <MaterialCommunityIcons name="minus" size={16} color={VoicyColors.white} />
              </Pressable>
              <Text style={{ color: VoicyColors.white, fontSize: 13, minWidth: 50, textAlign: 'center' }}>{speakerCount} voices</Text>
              <Pressable onPress={() => setSpeakerCount(Math.min(10, speakerCount + 1))} style={styles.speakerCountBtn}>
                <MaterialCommunityIcons name="plus" size={16} color={VoicyColors.white} />
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* Append banner */}
      {isAppendMode && (
        <View style={styles.appendBanner}>
          <MaterialCommunityIcons name="plus-circle" size={16} color={VoicyColors.secondaryText} />
          <Text style={styles.appendText}>Adding to current note</Text>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
            <MaterialCommunityIcons name="close" size={16} color={VoicyColors.secondaryText} />
          </Pressable>
        </View>
      )}

      {/* Timer */}
      <Text style={styles.timer}>{formatDuration(recorder.duration)}</Text>

      {/* Status */}
      <Text style={styles.status}>
        {isTranscribing ? 'Transcribing...' : !isRecording ? 'Tap to start' : isPaused ? 'Paused' : 'Listening...'}
      </Text>
      {isTranscribing && <ActivityIndicator color={VoicyColors.aiGreen} style={{ marginBottom: 16 }} />}

      {/* Waveform */}
      <View style={styles.waveform}>
        <AudioWaveform isActive={isRecording && !isPaused} metering={recorder.metering} height={100} barCount={50} />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {!isRecording ? (
          <Pressable onPress={handleStart} style={styles.recordButton} accessibilityLabel="Start recording" accessibilityRole="button" />
        ) : isAppendMode ? (
          <View style={styles.recordingControls}>
            <Pressable onPress={isPaused ? recorder.resume : recorder.pause} style={styles.controlBtn} accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'} accessibilityRole="button">
              <MaterialCommunityIcons name={isPaused ? 'play' : 'pause'} size={24} color={VoicyColors.white} />
            </Pressable>
            <Pressable onPress={handleStop} style={styles.doneButton} accessibilityLabel="Done recording" accessibilityRole="button">
              <MaterialCommunityIcons name="check" size={24} color={VoicyColors.white} />
              <Text style={{ color: VoicyColors.white, fontWeight: '600', fontSize: 16, marginLeft: 6 }}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.recordingControls}>
            <Pressable onPress={() => setShowCancelDialog(true)} style={styles.controlBtn} accessibilityLabel="Cancel recording" accessibilityRole="button">
              <MaterialCommunityIcons name="close" size={24} color={VoicyColors.white} />
            </Pressable>
            <Pressable onPress={isPaused ? recorder.resume : recorder.pause} style={styles.controlBtn} accessibilityLabel={isPaused ? 'Resume recording' : 'Pause recording'} accessibilityRole="button">
              <MaterialCommunityIcons name={isPaused ? 'play' : 'pause'} size={24} color={VoicyColors.white} />
            </Pressable>
            <Pressable onPress={handleStop} style={styles.stopButton} accessibilityLabel="Stop recording" accessibilityRole="button">
              <MaterialCommunityIcons name="stop" size={28} color={VoicyColors.white} />
            </Pressable>
          </View>
        )}
      </View>

      <Portal>
        <Dialog visible={showCancelDialog} onDismiss={() => setShowCancelDialog(false)} style={{ backgroundColor: VoicyColors.cardBg, borderRadius: 16 }}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Discard?</Dialog.Title>
          <Dialog.Content><Text style={{ color: VoicyColors.secondaryText }}>This recording will be lost.</Text></Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCancelDialog(false)} textColor={VoicyColors.white}>Keep</Button>
            <Button onPress={handleCancel} textColor={VoicyColors.error}>Discard</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black, alignItems: 'center', justifyContent: 'center', padding: 24 },
  closeButton: { position: 'absolute', top: 56, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  meetingRow: { position: 'absolute', top: 56, right: 16, alignItems: 'flex-end', gap: 8 },
  meetingToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  speakerCountRow: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: VoicyColors.cardBg, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 4 },
  speakerCountBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  appendBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: VoicyColors.cardBg, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 10, position: 'absolute', top: 56, right: 16, left: 72 },
  appendText: { color: VoicyColors.secondaryText, fontSize: 14, flex: 1 },
  timer: { color: VoicyColors.white, fontSize: 56, fontWeight: '700', fontVariant: ['tabular-nums'], marginBottom: 4 },
  status: { color: VoicyColors.secondaryText, fontSize: 15, marginBottom: 24 },
  waveform: { width: '100%', marginBottom: 48 },
  controls: { alignItems: 'center' },
  recordButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: VoicyColors.coral },
  recordingControls: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  controlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  stopButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: VoicyColors.coral, alignItems: 'center', justifyContent: 'center' },
  doneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, backgroundColor: '#2d6a2e' },
});
