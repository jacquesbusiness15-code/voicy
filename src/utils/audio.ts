import { Paths, Directory, File } from 'expo-file-system';

const RECORDINGS_DIR_NAME = 'recordings';

export function getRecordingsDir(): Directory {
  return new Directory(Paths.document, RECORDINGS_DIR_NAME);
}

export function ensureRecordingsDir(): void {
  const dir = getRecordingsDir();
  if (!dir.exists) {
    dir.create();
  }
}

export function getRecordingPath(filename: string): string {
  const dir = getRecordingsDir();
  const file = new File(dir, filename);
  return file.uri;
}

export function generateRecordingFilename(format: string = 'm4a'): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `recording-${timestamp}.${format}`;
}

export function getFileSize(filePath: string): number {
  const file = new File(filePath);
  return file.exists && file.size ? file.size : 0;
}

export function deleteAudioFile(filePath: string): void {
  const file = new File(filePath);
  if (file.exists) {
    file.delete();
  }
}

export function getAudioMimeType(format: string): string {
  const mimeTypes: Record<string, string> = {
    m4a: 'audio/mp4',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
    aac: 'audio/aac',
  };
  return mimeTypes[format] ?? 'audio/mp4';
}
