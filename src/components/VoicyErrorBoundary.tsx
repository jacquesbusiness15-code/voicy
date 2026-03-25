import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import * as Sentry from '@sentry/react-native';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../constants/theme';

interface ErrorBoundaryProps {
  error: Error;
  retry: () => void;
}

export function VoicyErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const [showDetails, setShowDetails] = useState(false);

  // Report to Sentry if configured
  React.useEffect(() => {
    try { Sentry.captureException(error); } catch {}
  }, [error]);

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="alert-circle-outline" size={56} color={VoicyColors.secondaryText} />
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.subtitle}>An unexpected error occurred. You can try again or restart the app.</Text>

      <Pressable style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryText}>Try Again</Text>
      </Pressable>

      <Pressable onPress={() => setShowDetails(!showDetails)} hitSlop={8}>
        <Text style={styles.detailsToggle}>{showDetails ? 'Hide details' : 'Show details'}</Text>
      </Pressable>

      {showDetails && (
        <View style={styles.detailsBox}>
          <Text style={styles.detailsText} selectable>{error.message}{'\n\n'}{error.stack?.slice(0, 500)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { color: VoicyColors.white, fontSize: 22, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  subtitle: { color: VoicyColors.secondaryText, fontSize: 15, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  retryButton: { backgroundColor: VoicyColors.white, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 14, marginBottom: 16 },
  retryText: { color: VoicyColors.black, fontSize: 16, fontWeight: '600' },
  detailsToggle: { color: VoicyColors.secondaryText, fontSize: 13, textDecorationLine: 'underline' },
  detailsBox: { marginTop: 12, backgroundColor: VoicyColors.cardBg, borderRadius: 12, padding: 12, width: '100%', maxHeight: 200 },
  detailsText: { color: VoicyColors.secondaryText, fontSize: 11, fontFamily: 'monospace' },
});
