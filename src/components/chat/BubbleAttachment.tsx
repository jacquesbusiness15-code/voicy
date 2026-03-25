import React from 'react';
import { View, StyleSheet, Image, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../../constants/theme';
import type { ChatAttachment } from '../../types/chat';

interface Props {
  attachment: ChatAttachment;
  onPress?: () => void;
}

export function BubbleAttachment({ attachment, onPress }: Props) {
  if (attachment.type === 'image') {
    return (
      <Pressable onPress={onPress}>
        <Image source={{ uri: attachment.uri }} style={styles.image} resizeMode="cover" />
      </Pressable>
    );
  }

  return (
    <Pressable onPress={onPress} style={styles.docCard}>
      <MaterialCommunityIcons name="file-document-outline" size={20} color={VoicyColors.aiGreen} />
      <View style={styles.docInfo}>
        <Text style={styles.docName} numberOfLines={1}>{attachment.name}</Text>
        {attachment.size != null && (
          <Text style={styles.docSize}>{formatBytes(attachment.size)}</Text>
        )}
      </View>
    </Pressable>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const styles = StyleSheet.create({
  image: {
    width: 200,
    height: 150,
    borderRadius: 12,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 10,
    borderRadius: 12,
  },
  docInfo: { flex: 1 },
  docName: { color: VoicyColors.white, fontSize: 13, fontWeight: '500' },
  docSize: { color: VoicyColors.secondaryText, fontSize: 11, marginTop: 2 },
});
