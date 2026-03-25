import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import { File, Directory, Paths } from 'expo-file-system';
import { ensureRecordingsDir, getRecordingPath, generateRecordingFilename, getFileSize } from '../utils/audio';
import { getTodayDate } from '../utils/time';
import * as queries from '../db/queries';
import type { Recording } from '../db/schema';

let currentRecording: Audio.Recording | null = null;
let recordingStartTime: number = 0;

export async function startRecording(options?: {
  isMeeting?: boolean;
  language?: string;
  onRecordingStatusUpdate?: (status: Audio.RecordingStatus) => void;
}): Promise<void> {
  ensureRecordingsDir();

  // Request permissions
  const permission = await Audio.requestPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Microphone permission not granted');
  }

  // Configure audio mode
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    shouldDuckAndroid: false,
  });

  // Create and start recording with metering enabled
  // Pass status callback and 100ms update interval directly to createAsync
  const { recording } = await Audio.Recording.createAsync(
    {
      ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
      isMeteringEnabled: true,
    },
    options?.onRecordingStatusUpdate ?? undefined,
    100
  );

  currentRecording = recording;
  recordingStartTime = Date.now();
}

export async function pauseRecording(): Promise<void> {
  if (currentRecording) {
    await currentRecording.pauseAsync();
  }
}

export async function resumeRecording(): Promise<void> {
  if (currentRecording) {
    await currentRecording.startAsync();
  }
}

export async function stopRecording(options?: {
  isMeeting?: boolean;
  language?: string;
}): Promise<Recording> {
  if (!currentRecording) {
    throw new Error('No active recording');
  }

  // Capture URI before stopping — getURI() can return null after unload
  const uri = currentRecording.getURI();
  await currentRecording.stopAndUnloadAsync();
  currentRecording = null;

  if (!uri) {
    throw new Error('Recording URI is null');
  }

  // Move recording to our recordings directory
  const filename = generateRecordingFilename();
  const destPath = getRecordingPath(filename);

  const sourceFile = new File(uri);
  const destFile = new File(destPath);
  sourceFile.move(destFile);

  // Get file size and calculate duration
  const sizeBytes = getFileSize(destPath);
  const duration = Math.round((Date.now() - recordingStartTime) / 1000);

  // Reset audio mode
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
  });

  // Save to database
  const recording = await queries.createRecording({
    filePath: destPath,
    duration,
    format: 'm4a',
    sizeBytes,
    language: options?.language ?? 'en',
    isMeeting: options?.isMeeting ?? false,
  });

  // Update streak
  await queries.updateStreak(getTodayDate());

  return recording;
}

export async function cancelRecording(): Promise<void> {
  if (currentRecording) {
    // Capture URI before stopping
    const uri = currentRecording.getURI();
    await currentRecording.stopAndUnloadAsync();
    currentRecording = null;

    if (uri) {
      const file = new File(uri);
      if (file.exists) file.delete();
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      interruptionModeIOS: InterruptionModeIOS.MixWithOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
    });
  }
}

export function isRecording(): boolean {
  return currentRecording !== null;
}
