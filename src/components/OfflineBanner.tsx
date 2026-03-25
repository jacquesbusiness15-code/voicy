import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNetworkStore } from '../stores/networkStore';
import { VoicyColors } from '../constants/theme';

export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetworkStore();
  const insets = useSafeAreaInsets();

  const isOffline = !isConnected || isInternetReachable === false;
  if (!isOffline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <MaterialCommunityIcons name="wifi-off" size={16} color={VoicyColors.white} />
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: VoicyColors.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingBottom: 8,
    paddingHorizontal: 16,
  },
  text: {
    color: VoicyColors.white,
    fontSize: 13,
    fontWeight: '600',
  },
});
