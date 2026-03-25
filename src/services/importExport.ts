import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { ensureRecordingsDir, getRecordingPath } from '../utils/audio';
import * as queries from '../db/queries';
import type { Recording } from '../db/schema';

const SUPPORTED_AUDIO = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'aac', 'wma'];

export async function importFile(): Promise<Recording | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['audio/*', 'application/pdf', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';

  if (SUPPORTED_AUDIO.includes(ext)) {
    return importAudioFile(asset.uri, asset.name, asset.size ?? 0);
  } else if (ext === 'pdf' || ext === 'txt') {
    return importDocumentFile(asset.uri, asset.name, ext);
  }

  throw new Error(`Unsupported file type: ${ext}`);
}

async function importAudioFile(
  uri: string,
  filename: string,
  size: number
): Promise<Recording> {
  ensureRecordingsDir();

  const ext = filename.split('.').pop()?.toLowerCase() ?? 'm4a';
  const newFilename = `import-${randomUUID()}.${ext}`;
  const destPath = getRecordingPath(newFilename);

  const sourceFile = new File(uri);
  const destFile = new File(destPath);
  sourceFile.copy(destFile);

  const recording = await queries.createRecording({
    title: filename.replace(/\.[^.]+$/, ''),
    filePath: destPath,
    duration: 0,
    format: ext,
    sizeBytes: size,
    language: 'en',
    isMeeting: false,
  });

  // Create import record
  const db = await import('../db/client').then((m) => m.getDatabase());
  const { imports } = await import('../db/schema');
  await db.insert(imports).values({
    id: randomUUID(),
    recordingId: recording.id,
    originalFileName: filename,
    fileType: 'audio',
    filePath: destPath,
    createdAt: new Date().toISOString(),
  });

  return recording;
}

async function importDocumentFile(
  uri: string,
  filename: string,
  ext: string
): Promise<Recording> {
  let extractedText = '';

  if (ext === 'txt') {
    const file = new File(uri);
    extractedText = await file.text();
  } else if (ext === 'pdf') {
    extractedText = '[PDF imported - text extraction available with cloud AI]';
  }

  const recording = await queries.createRecording({
    title: filename.replace(/\.[^.]+$/, ''),
    filePath: uri,
    duration: 0,
    format: ext,
    sizeBytes: 0,
    language: 'en',
    isMeeting: false,
  });

  if (extractedText && ext === 'txt') {
    await queries.createTranscript({
      recordingId: recording.id,
      content: extractedText,
      language: 'en',
      engine: 'import',
    });
  }

  const db = await import('../db/client').then((m) => m.getDatabase());
  const { imports: importsTable } = await import('../db/schema');
  await db.insert(importsTable).values({
    id: randomUUID(),
    recordingId: recording.id,
    originalFileName: filename,
    fileType: ext === 'pdf' ? 'pdf' : 'audio',
    filePath: uri,
    extractedText: extractedText || null,
    createdAt: new Date().toISOString(),
  });

  return recording;
}

export async function exportRecording(recordingId: string): Promise<void> {
  const recording = await queries.getRecordingById(recordingId);
  if (!recording) throw new Error('Recording not found');

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(recording.filePath, {
    mimeType: 'audio/mp4',
    dialogTitle: `Export: ${recording.title ?? 'Recording'}`,
  });
}

export async function exportTranscript(recordingId: string): Promise<void> {
  const recording = await queries.getRecordingById(recordingId);
  const transcript = await queries.getTranscriptByRecordingId(recordingId);
  if (!transcript) throw new Error('No transcript found');

  const filename = `${recording?.title ?? 'transcript'}.txt`;
  const file = new File(Paths.cache, filename);
  file.write(transcript.content);

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/plain',
    dialogTitle: `Export Transcript: ${recording?.title ?? 'Recording'}`,
  });
}

export async function exportAllData(): Promise<void> {
  const allRecordings = await queries.getAllRecordings();

  const exportData: any = {
    exportDate: new Date().toISOString(),
    version: '1.0.0',
    recordings: [],
  };

  for (const recording of allRecordings) {
    const transcript = await queries.getTranscriptByRecordingId(recording.id);
    const tags = await queries.getTagsForRecording(recording.id);
    const aiOutputs = await queries.getAIOutputs(recording.id);

    exportData.recordings.push({
      ...recording,
      transcript: transcript?.content ?? null,
      tags: tags.map((t) => t.name),
      aiOutputs: aiOutputs.map((o) => ({ type: o.type, content: o.content })),
    });
  }

  const filename = `voicy-export-${new Date().toISOString().split('T')[0]}.json`;
  const file = new File(Paths.cache, filename);
  file.write(JSON.stringify(exportData, null, 2));

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export All Voicy Data',
  });
}
