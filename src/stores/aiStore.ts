import { create } from 'zustand';
import type { Conversation, ConversationMessage } from '../db/schema';
import * as queries from '../db/queries';

interface AIState {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: ConversationMessage[];
  isProcessing: boolean;
  isTranscribing: boolean;
  transcriptionProgress: number;
  error: string | null;

  loadConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<Conversation>;
  selectConversation: (id: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, sourceIds?: string[]) => Promise<ConversationMessage>;
  setProcessing: (processing: boolean) => void;
  setTranscribing: (transcribing: boolean, progress?: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

export const useAIStore = create<AIState>((set, get) => ({
  conversations: [],
  currentConversation: null,
  messages: [],
  isProcessing: false,
  isTranscribing: false,
  transcriptionProgress: 0,
  error: null,

  loadConversations: async () => {
    const conversations = await queries.getAllConversations();
    set({ conversations });
  },

  createConversation: async (title?: string) => {
    const conversation = await queries.createConversation(title);
    set((state) => ({
      conversations: [conversation, ...state.conversations],
      currentConversation: conversation,
      messages: [],
    }));
    return conversation;
  },

  selectConversation: async (id: string) => {
    const conversations = get().conversations;
    const conversation = conversations.find((c) => c.id === id) ?? null;
    const messages = conversation ? await queries.getMessages(id) : [];
    set({ currentConversation: conversation, messages });
  },

  addMessage: async (role, content, sourceIds) => {
    const { currentConversation } = get();
    if (!currentConversation) throw new Error('No active conversation');

    const message = await queries.addMessage({
      conversationId: currentConversation.id,
      role,
      content,
      sourceRecordingIds: sourceIds,
    });

    set((state) => ({
      messages: [...state.messages, message],
    }));

    return message;
  },

  setProcessing: (processing) => set({ isProcessing: processing }),
  setTranscribing: (transcribing, progress = 0) =>
    set({ isTranscribing: transcribing, transcriptionProgress: progress }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));
