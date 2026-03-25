import { useEffect } from 'react';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useCalendarStore } from '../stores/calendarStore';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.GOOGLE_CLIENT_ID ?? '';

export function useGoogleAuth() {
  const signIn = useCalendarStore((s) => s.signIn);

  const [request, response, promptAsync] = Google.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    iosClientId: GOOGLE_CLIENT_ID,
    androidClientId: GOOGLE_CLIENT_ID,
    scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'openid',
      'email',
    ],
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      signIn(response.authentication);
    }
  }, [response, signIn]);

  return {
    request,
    promptAsync,
    isReady: !!request,
  };
}
