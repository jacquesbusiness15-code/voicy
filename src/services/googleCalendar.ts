import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import type { NewCalendarEvent } from '../db/schema';
import { resilientFetch } from '../utils/resilientFetch';

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID ?? '';
const TOKEN_KEY = 'voicy_google_tokens';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  email: string;
}

export async function getStoredTokens(): Promise<GoogleTokens | null> {
  const raw = await SecureStore.getItemAsync(TOKEN_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as GoogleTokens;
  } catch {
    return null;
  }
}

export async function storeTokens(tokens: GoogleTokens): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, JSON.stringify(tokens));
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<GoogleTokens> {
  const response = await resilientFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }).toString(),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json();

  // Fetch user email
  const email = await fetchUserEmail(data.access_token);

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    email,
  };

  await storeTokens(tokens);
  return tokens;
}

async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
  const response = await resilientFetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_CLIENT_ID,
      grant_type: 'refresh_token',
    }).toString(),
  });

  if (!response.ok) {
    // Refresh token is invalid — user needs to re-authenticate
    await clearTokens();
    throw new Error('SESSION_EXPIRED');
  }

  const data = await response.json();
  const stored = await getStoredTokens();

  const tokens: GoogleTokens = {
    accessToken: data.access_token,
    refreshToken: stored?.refreshToken ?? refreshToken,
    expiresAt: Date.now() + (data.expires_in * 1000),
    email: stored?.email ?? '',
  };

  await storeTokens(tokens);
  return tokens;
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = await getStoredTokens();
  if (!tokens) throw new Error('NOT_CONNECTED');

  // Refresh if expiring within 5 minutes
  if (Date.now() > tokens.expiresAt - 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

async function fetchUserEmail(accessToken: string): Promise<string> {
  const response = await resilientFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return '';
  const data = await response.json();
  return data.email ?? '';
}

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
  hangoutLink?: string;
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  status?: string;
  organizer?: { email: string };
}

function parseGoogleEvent(event: GoogleCalendarEvent): NewCalendarEvent | null {
  const startTime = event.start?.dateTime ?? event.start?.date;
  const endTime = event.end?.dateTime ?? event.end?.date;

  if (!startTime || !endTime) return null;

  return {
    id: event.id,
    googleCalendarId: 'primary',
    title: event.summary ?? 'Untitled Event',
    description: event.description ?? null,
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    location: event.location ?? null,
    meetLink: event.hangoutLink ?? null,
    attendees: event.attendees ? JSON.stringify(event.attendees.map(a => ({
      email: a.email,
      name: a.displayName,
      status: a.responseStatus,
    }))) : null,
    autoRecord: false,
    recordingId: null,
    status: event.status ?? 'confirmed',
    syncedAt: new Date().toISOString(),
  };
}

export async function fetchUpcomingEvents(days: number = 7): Promise<NewCalendarEvent[]> {
  const accessToken = await getValidAccessToken();

  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });

  const response = await resilientFetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try refreshing token once
      const tokens = await getStoredTokens();
      if (tokens) {
        const refreshed = await refreshAccessToken(tokens.refreshToken);
        const retryResponse = await resilientFetch(`${CALENDAR_API}/calendars/primary/events?${params}`, {
          headers: { Authorization: `Bearer ${refreshed.accessToken}` },
        });
        if (retryResponse.ok) {
          const data = await retryResponse.json();
          return (data.items ?? []).map(parseGoogleEvent).filter(Boolean) as NewCalendarEvent[];
        }
      }
      throw new Error('SESSION_EXPIRED');
    }
    throw new Error(`Calendar API error: ${response.status}`);
  }

  const data = await response.json();
  return (data.items ?? []).map(parseGoogleEvent).filter(Boolean) as NewCalendarEvent[];
}
