import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'voicy.db';

let dbInstance: ReturnType<typeof drizzle> | null = null;
let sqliteDb: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
  if (dbInstance) return dbInstance;

  sqliteDb = await SQLite.openDatabaseAsync(DB_NAME);

  // Enable WAL mode for better performance
  await sqliteDb.execAsync('PRAGMA journal_mode = WAL;');
  await sqliteDb.execAsync('PRAGMA foreign_keys = ON;');

  dbInstance = drizzle(sqliteDb, { schema });
  return dbInstance;
}

export async function resetDatabase() {
  if (sqliteDb) {
    await sqliteDb.closeAsync();
  }
  await SQLite.deleteDatabaseAsync(DB_NAME);
  dbInstance = null;
  sqliteDb = null;
}

export async function initializeDatabase() {
  const db = await getDatabase();

  // Create tables using raw SQL (since we're not using drizzle-kit push in production)
  const sqliteInstance = sqliteDb!;

  await sqliteInstance.execAsync(`
    CREATE TABLE IF NOT EXISTS recordings (
      id TEXT PRIMARY KEY,
      title TEXT,
      file_path TEXT NOT NULL,
      duration INTEGER NOT NULL DEFAULT 0,
      format TEXT NOT NULL DEFAULT 'm4a',
      size_bytes INTEGER NOT NULL DEFAULT 0,
      language TEXT DEFAULT 'en',
      is_meeting INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'en',
      engine TEXT NOT NULL DEFAULT 'whisper-local',
      confidence REAL,
      segments TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS translations (
      id TEXT PRIMARY KEY,
      transcript_id TEXT NOT NULL REFERENCES transcripts(id) ON DELETE CASCADE,
      target_language TEXT NOT NULL,
      content TEXT NOT NULL,
      engine TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_outputs (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      engine TEXT NOT NULL,
      prompt TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT
    );

    CREATE TABLE IF NOT EXISTS recording_tags (
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
      is_auto_generated INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (recording_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS embeddings (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      vector BLOB,
      model TEXT NOT NULL DEFAULT 'local',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT,
      recording_id TEXT REFERENCES recordings(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      source_recording_ids TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS imports (
      id TEXT PRIMARY KEY,
      recording_id TEXT REFERENCES recordings(id) ON DELETE SET NULL,
      original_file_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      extracted_text TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS streaks (
      date TEXT PRIMARY KEY,
      recording_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      timestamp REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_prompts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      recording_id TEXT NOT NULL REFERENCES recordings(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      size_bytes INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      google_calendar_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      location TEXT,
      meet_link TEXT,
      attendees TEXT,
      auto_record INTEGER NOT NULL DEFAULT 0,
      recording_id TEXT REFERENCES recordings(id) ON DELETE SET NULL,
      status TEXT DEFAULT 'confirmed',
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS recordings_fts USING fts5(
      title,
      content,
      content='',
      tokenize='unicode61'
    );
  `);

  // Migrations for existing databases
  try {
    await sqliteInstance.execAsync(`ALTER TABLE conversations ADD COLUMN recording_id TEXT REFERENCES recordings(id) ON DELETE CASCADE;`);
  } catch {
    // Column already exists — safe to ignore
  }

  try {
    await sqliteInstance.execAsync(`ALTER TABLE conversation_messages ADD COLUMN attachments TEXT;`);
  } catch {
    // Column already exists — safe to ignore
  }

  return db;
}
