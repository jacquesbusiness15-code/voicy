import React, { useEffect, useState } from 'react';
import { View, Alert, useColorScheme } from 'react-native';
import { Stack, useSegments, useRouter } from 'expo-router';
import { PaperProvider, configureFonts } from 'react-native-paper';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import NetInfo from '@react-native-community/netinfo';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { DarkTheme, VoicyColors } from '../src/constants/theme';
import { initializeDatabase } from '../src/db/client';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useCalendarStore } from '../src/stores/calendarStore';
import { useAuthStore } from '../src/stores/authStore';
import { useNetworkStore } from '../src/stores/networkStore';
import { requestNotificationPermissions } from '../src/services/meetingNotifications';
import { getSetting } from '../src/db/queries';
import { AppLockGate } from '../src/components/AppLockGate';
import { OfflineBanner } from '../src/components/OfflineBanner';
import GlobalSnackbar from '../src/components/GlobalSnackbar';
import { PersistentBottomBar } from '../src/components/PersistentBottomBar';

const sentryDsn = Constants.expoConfig?.extra?.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    tracesSampleRate: 0.2,
    enableAutoSessionTracking: true,
  });
}

// Configure notification behavior when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export { VoicyErrorBoundary as ErrorBoundary } from '../src/components/VoicyErrorBoundary';

export const unstable_settings = {
  initialRouteName: 'index',
};

SplashScreen.preventAutoHideAsync();

const fontConfig = {
  fontFamily: 'Inter_400Regular',
};

const fonts = configureFonts({
  config: {
    ...fontConfig,
    displayLarge: { ...fontConfig, fontFamily: 'Inter_700Bold' },
    displayMedium: { ...fontConfig, fontFamily: 'Inter_700Bold' },
    displaySmall: { ...fontConfig, fontFamily: 'Inter_600SemiBold' },
    headlineLarge: { ...fontConfig, fontFamily: 'Inter_700Bold' },
    headlineMedium: { ...fontConfig, fontFamily: 'Inter_600SemiBold' },
    headlineSmall: { ...fontConfig, fontFamily: 'Inter_600SemiBold' },
    titleLarge: { ...fontConfig, fontFamily: 'Inter_600SemiBold' },
    titleMedium: { ...fontConfig, fontFamily: 'Inter_500Medium' },
    titleSmall: { ...fontConfig, fontFamily: 'Inter_500Medium' },
    bodyLarge: { ...fontConfig, fontFamily: 'Inter_400Regular' },
    bodyMedium: { ...fontConfig, fontFamily: 'Inter_400Regular' },
    bodySmall: { ...fontConfig, fontFamily: 'Inter_400Regular' },
    labelLarge: { ...fontConfig, fontFamily: 'Inter_500Medium' },
    labelMedium: { ...fontConfig, fontFamily: 'Inter_500Medium' },
    labelSmall: { ...fontConfig, fontFamily: 'Inter_500Medium' },
  },
});

const MODAL_SCREENS = ['settings', 'ask', 'record', 'calendar', 'ai-output', 'custom-prompt', 'write', 'recording', 'auth', 'language-picker', 'names-to-remember', 'notification-settings', 'privacy-policy', 'terms', 'onboarding'];

function RootLayout() {
  const [dbReady, setDbReady] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const checkConnection = useCalendarStore((s) => s.checkConnection);
  const syncEvents = useCalendarStore((s) => s.syncEvents);
  const initializeAuth = useAuthStore((s) => s.initialize);
  const authSession = useAuthStore((s) => s.session);
  const authInitialized = useAuthStore((s) => s.isInitialized);
  const segments = useSegments();
  const router = useRouter();

  const setNetworkStatus = useNetworkStore((s) => s.setStatus);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkStatus(state.isConnected ?? false, state.isInternetReachable);
    });
    return () => unsubscribe();
  }, [setNetworkStatus]);

  useEffect(() => {
    async function init() {
      try {
        await initializeDatabase();
        await loadSettings();
        await initializeAuth();
        await requestNotificationPermissions();

        // Check calendar connection and sync if connected
        await checkConnection();
        const calState = useCalendarStore.getState();
        if (calState.isConnected) {
          syncEvents();
        }

        // Check onboarding status
        const onboarded = await getSetting('hasCompletedOnboarding');
        setHasCompletedOnboarding(onboarded === 'true');
      } catch (e) {
        console.error('Failed to initialize:', e);
      } finally {
        setDbReady(true);
      }
    }
    init();
  }, [loadSettings, checkConnection, syncEvents, initializeAuth]);

  // Handle notification taps for auto-record
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.action === 'auto-record' && data?.eventId) {
        router.push({ pathname: '/record', params: { isMeeting: 'true', eventId: data.eventId as string } });
      }
    });
    return () => subscription.remove();
  }, [router]);

  // Handle foreground notifications for meetings
  useEffect(() => {
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data;
      if (data?.action === 'auto-record' && data?.eventId) {
        Alert.alert(
          'Meeting Starting',
          notification.request.content.title ?? 'A meeting is about to start',
          [
            { text: 'Skip', style: 'cancel' },
            {
              text: 'Start Recording',
              onPress: () => {
                router.push({ pathname: '/record', params: { isMeeting: 'true', eventId: data.eventId as string } });
              },
            },
          ]
        );
      }
    });
    return () => subscription.remove();
  }, [router]);

  // Auth gate + onboarding routing
  useEffect(() => {
    if (!dbReady || !authInitialized || hasCompletedOnboarding === null) return;

    const currentScreen = segments[0];
    const inAuthScreen = currentScreen === 'auth';
    const inOnboarding = currentScreen === 'onboarding';

    if (!authSession && !inAuthScreen) {
      router.replace('/auth');
    } else if (authSession && inAuthScreen) {
      if (!hasCompletedOnboarding) {
        router.replace('/onboarding');
      } else {
        router.replace('/');
      }
    } else if (authSession && !hasCompletedOnboarding && !inOnboarding && !inAuthScreen) {
      router.replace('/onboarding');
    }
  }, [dbReady, authInitialized, authSession, hasCompletedOnboarding, segments, router]);

  // Only hide splash once BOTH db and fonts are ready
  useEffect(() => {
    if (dbReady && fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [dbReady, fontsLoaded]);

  if (!dbReady || !fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: VoicyColors.black }} />;
  }

  const theme = { ...DarkTheme, fonts };

  // Hide bottom bar on modal screens
  const currentSegment = segments[0] ?? 'index';
  const showBottomBar = !MODAL_SCREENS.includes(currentSegment);

  return (
    <PaperProvider theme={theme}>
      <AppLockGate>
        <OfflineBanner />
        <View style={{ flex: 1, backgroundColor: VoicyColors.black }}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: VoicyColors.black },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="recording/[id]" />
            <Stack.Screen name="settings" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ask" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="record" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="calendar" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="ai-output" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="custom-prompt" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="write" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="auth" options={{ presentation: 'card', animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ presentation: 'card', animation: 'fade' }} />
            <Stack.Screen name="language-picker" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="names-to-remember" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="notification-settings" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="privacy-policy" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="terms" options={{ presentation: 'card', animation: 'slide_from_bottom' }} />
          </Stack>
          {showBottomBar && <PersistentBottomBar />}
        </View>
      </AppLockGate>
      <GlobalSnackbar />
    </PaperProvider>
  );
}

export default Sentry.wrap(RootLayout);
