import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { TokenResponse } from 'expo-auth-session';
import * as googleCalendar from '../services/googleCalendar';
import * as queries from '../db/queries';
import { scheduleNotificationsForEvents } from '../services/meetingNotifications';
import type { CalendarEvent } from '../db/schema';

const TOKEN_KEY = 'voicy_google_tokens';

interface CalendarState {
  isConnected: boolean;
  connectedEmail: string | null;
  events: CalendarEvent[];
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncAt: string | null;
  error: string | null;

  checkConnection: () => Promise<void>;
  signIn: (authentication: TokenResponse) => Promise<void>;
  signOut: () => Promise<void>;
  syncEvents: () => Promise<void>;
  loadEvents: () => Promise<void>;
  toggleAutoRecord: (eventId: string) => Promise<void>;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  isConnected: false,
  connectedEmail: null,
  events: [],
  isLoading: false,
  isSyncing: false,
  lastSyncAt: null,
  error: null,

  checkConnection: async () => {
    const tokens = await googleCalendar.getStoredTokens();
    if (tokens) {
      set({ isConnected: true, connectedEmail: tokens.email });
    } else {
      set({ isConnected: false, connectedEmail: null });
    }
  },

  signIn: async (authentication: TokenResponse) => {
    try {
      set({ isLoading: true, error: null });

      // Store tokens from the auth response
      const tokens = {
        accessToken: authentication.accessToken,
        refreshToken: authentication.refreshToken ?? '',
        expiresAt: authentication.issuedAt
          ? (authentication.issuedAt + (authentication.expiresIn ?? 3600)) * 1000
          : Date.now() + 3600 * 1000,
        email: '',
      };

      // Fetch user email with the access token
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });
      if (userInfoResponse.ok) {
        const userInfo = await userInfoResponse.json();
        tokens.email = userInfo.email ?? '';
      }

      await googleCalendar.storeTokens(tokens);
      set({ isConnected: true, connectedEmail: tokens.email });

      // Initial sync
      await get().syncEvents();
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  signOut: async () => {
    await googleCalendar.clearTokens();
    await queries.deleteAllCalendarEvents();
    set({
      isConnected: false,
      connectedEmail: null,
      events: [],
      lastSyncAt: null,
      error: null,
    });
  },

  syncEvents: async () => {
    if (get().isSyncing) return;

    try {
      set({ isSyncing: true, error: null });

      const fetchedEvents = await googleCalendar.fetchUpcomingEvents(14);
      await queries.upsertCalendarEvents(fetchedEvents);

      // Reload from DB (preserves local autoRecord flags)
      const events = await queries.getUpcomingEvents();
      const now = new Date().toISOString();
      set({ events, lastSyncAt: now });

      // Schedule notifications for auto-record events
      await scheduleNotificationsForEvents(events);
    } catch (e: any) {
      if (e.message === 'SESSION_EXPIRED' || e.message === 'NOT_CONNECTED') {
        set({ isConnected: false, connectedEmail: null, error: 'Session expired. Please reconnect.' });
      } else {
        set({ error: e.message });
      }
    } finally {
      set({ isSyncing: false });
    }
  },

  loadEvents: async () => {
    try {
      set({ isLoading: true });
      const events = await queries.getUpcomingEvents();
      set({ events });
    } catch (e: any) {
      set({ error: e.message });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleAutoRecord: async (eventId: string) => {
    const event = get().events.find(e => e.id === eventId);
    if (!event) return;

    const newValue = !event.autoRecord;
    await queries.setEventAutoRecord(eventId, newValue);

    // Update local state
    set({
      events: get().events.map(e =>
        e.id === eventId ? { ...e, autoRecord: newValue } : e
      ),
    });

    // Reschedule notifications
    await scheduleNotificationsForEvents(get().events);
  },
}));
