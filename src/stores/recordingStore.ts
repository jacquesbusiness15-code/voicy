import { create } from 'zustand';
import type { Recording, Transcript, AIOutput, Tag } from '../db/schema';
import * as queries from '../db/queries';

interface RecordingState {
  recordings: Recording[];
  currentRecording: Recording | null;
  currentTranscript: Transcript | null;
  currentTags: Tag[];
  currentAIOutputs: AIOutput[];
  isLoading: boolean;
  searchQuery: string;
  filterMode: 'all' | 'meetings' | 'favorites';
  sortBy: 'newest' | 'oldest' | 'longest' | 'shortest';
  streak: number;
  selectedDate: string | null;
  recordingDates: Set<string>;

  loadRecordings: () => Promise<void>;
  loadRecordingDetail: (id: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilterMode: (mode: 'all' | 'meetings' | 'favorites') => void;
  setSortBy: (sort: 'newest' | 'oldest' | 'longest' | 'shortest') => void;
  setSelectedDate: (date: string | null) => void;
  deleteRecording: (id: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  loadStreak: () => Promise<void>;
  loadRecordingDates: (startDate?: string, endDate?: string) => Promise<void>;
}

export const useRecordingStore = create<RecordingState>((set, get) => ({
  recordings: [],
  currentRecording: null,
  currentTranscript: null,
  currentTags: [],
  currentAIOutputs: [],
  isLoading: false,
  searchQuery: '',
  filterMode: 'all',
  sortBy: 'newest',
  streak: 0,
  selectedDate: null,
  recordingDates: new Set(),

  loadRecordings: async () => {
    set({ isLoading: true });
    const { searchQuery, filterMode, sortBy, selectedDate } = get();
    let recordings = await queries.getAllRecordings({
      search: searchQuery || undefined,
      isMeeting: filterMode === 'meetings' ? true : undefined,
      isFavorite: filterMode === 'favorites' ? true : undefined,
      sortBy,
    });

    // Filter by selected date if set
    if (selectedDate) {
      recordings = recordings.filter(
        (r) => r.createdAt.split('T')[0] === selectedDate
      );
    }

    set({ recordings, isLoading: false });
  },

  loadRecordingDetail: async (id: string) => {
    set({ isLoading: true });
    const [recording, transcript, tags, aiOutputs] = await Promise.all([
      queries.getRecordingById(id),
      queries.getTranscriptByRecordingId(id),
      queries.getTagsForRecording(id),
      queries.getAIOutputs(id),
    ]);
    set({
      currentRecording: recording ?? null,
      currentTranscript: transcript ?? null,
      currentTags: tags,
      currentAIOutputs: aiOutputs,
      isLoading: false,
    });
  },

  setSearchQuery: (query: string) => {
    set({ searchQuery: query });
    get().loadRecordings();
  },

  setFilterMode: (mode) => {
    set({ filterMode: mode });
    get().loadRecordings();
  },

  setSortBy: (sort) => {
    set({ sortBy: sort });
    get().loadRecordings();
  },

  setSelectedDate: (date) => {
    set({ selectedDate: date });
    get().loadRecordings();
  },

  deleteRecording: async (id: string) => {
    await queries.deleteRecording(id);
    await get().loadRecordings();
  },

  toggleFavorite: async (id: string) => {
    const recording = await queries.getRecordingById(id);
    if (recording) {
      await queries.updateRecording(id, { isFavorite: !recording.isFavorite });
      await get().loadRecordings();
      if (get().currentRecording?.id === id) {
        await get().loadRecordingDetail(id);
      }
    }
  },

  loadStreak: async () => {
    const streak = await queries.getCurrentStreak();
    set({ streak });
  },

  loadRecordingDates: async (startDate?: string, endDate?: string) => {
    const today = new Date();
    const start = startDate ?? (() => {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const end = endDate ?? today.toISOString().split('T')[0];
    const dates = await queries.getRecordingDates(start, end);
    set({ recordingDates: new Set(dates) });
  },
}));
