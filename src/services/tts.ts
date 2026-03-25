import { File } from 'expo-file-system';
import { openaiTextToSpeech, type TTSVoice } from '../ai/cloud';
import { ensureRecordingsDir, generateRecordingFilename, getRecordingPath, getFileSize } from '../utils/audio';
import * as queries from '../db/queries';

export async function generateTTSAudio(
  recordingId: string,
  text: string,
  options?: {
    apiKey?: string;
    voice?: TTSVoice;
    model?: 'tts-1' | 'tts-1-hd';
    speed?: number;
  }
): Promise<string> {
  // Generate audio via OpenAI TTS (uses proxy if no apiKey)
  const audioBuffer = await openaiTextToSpeech(text, options?.apiKey, {
    voice: options.voice,
    model: options.model,
    speed: options.speed,
  });

  // Save MP3 file to recordings directory
  ensureRecordingsDir();
  const filename = generateRecordingFilename('mp3');
  const filePath = getRecordingPath(filename);

  const file = new File(filePath);
  const bytes = new Uint8Array(audioBuffer);
  file.write(bytes);

  const sizeBytes = getFileSize(filePath);

  // Update the recording to point to the new audio file
  await queries.updateRecording(recordingId, {
    filePath,
    format: 'mp3',
    sizeBytes,
  });

  return filePath;
}
