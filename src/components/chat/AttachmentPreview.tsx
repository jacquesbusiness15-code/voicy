import React from 'react';
import { View, StyleSheet, Image, Pressable, ScrollView } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../../constants/theme';
import type { PendingAttachment } from '../../types/chat';

interface Props {
  attachments: PendingAttachment[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.content}>
      {attachments.map((att, i) => (
        <View key={i} style={styles.item}>
          {att.type === 'image' ? (
            <Image source={{ uri: att.localUri }} style={styles.thumb} />
          ) : (
            <View style={styles.docThumb}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color={VoicyColors.aiGreen} />
              <Text style={styles.docName} numberOfLines={1}>{att.name}</Text>
            </View>
          )}
          <Pressable onPress={() => onRemove(i)} style={styles.removeBtn}>
            <MaterialCommunityIcons name="close-circle" size={18} color={VoicyColors.white} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { maxHeight: 80 },
  content: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
  item: { position: 'relative' },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  docThumb: {
    width: 100,
    height: 64,
    borderRadius: 10,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  docName: { color: VoicyColors.secondaryText, fontSize: 10, marginTop: 2, textAlign: 'center' },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: VoicyColors.error,
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
