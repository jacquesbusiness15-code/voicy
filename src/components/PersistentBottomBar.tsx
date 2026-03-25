import React from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { VoicyColors } from '../constants/theme';

export function PersistentBottomBar() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      {/* Glass input pill */}
      <Pressable
        onPress={() => router.push('/ask')}
        style={styles.askPillOuter}
        accessibilityLabel="Ask anything"
        accessibilityRole="button"
      >
        {/* Top highlight edge for glass effect */}
        <View style={styles.askPillHighlight} />
        <View style={styles.askPillContent}>
          <Text style={styles.askText}>Ask anything</Text>
        </View>
      </Pressable>

      {/* Record button with white ring */}
      <Pressable
        onPress={() => router.push('/record')}
        style={styles.recordButtonOuter}
        accessibilityLabel="Record voice note"
        accessibilityRole="button"
      >
        <View style={styles.recordButtonInner} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
    backgroundColor: VoicyColors.black,
  },
  askPillOuter: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.08)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  askPillHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 26,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  askPillContent: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  askText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 17,
    fontFamily: Platform.select({ ios: 'System', android: 'sans-serif' }),
  },
  recordButtonOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ff5a4f',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.6,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  recordButtonInner: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ff6b5f',
  },
});
