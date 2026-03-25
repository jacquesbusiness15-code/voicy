import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Portal } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../constants/theme';

interface Props {
  visible: boolean;
  message: string;
  onClose?: () => void;
}

export function LoadingOverlay({ visible, message, onClose }: Props) {
  if (!visible) return null;

  return (
    <Portal>
      <View style={styles.overlay}>
        <Pressable style={styles.closeButton} onPress={onClose}>
          <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
        </Pressable>
        <View style={styles.content}>
          <Text style={styles.sparkle}>✦</Text>
          <Text style={styles.message}>{message} ...</Text>
        </View>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: VoicyColors.black,
    zIndex: 100,
  },
  closeButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sparkle: {
    color: VoicyColors.aiGreen,
    fontSize: 18,
  },
  message: {
    color: VoicyColors.aiGreen,
    fontSize: 16,
    fontWeight: '400',
  },
});
