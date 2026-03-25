import React from 'react';
import { View, StyleSheet, Pressable, Modal, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from 'expo-document-picker';
import { VoicyColors } from '../../constants/theme';
import type { PendingAttachment } from '../../types/chat';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  onPick: (attachments: PendingAttachment[]) => void;
}

export function AttachmentPicker({ visible, onDismiss, onPick }: Props) {
  const pickImage = async () => {
    onDismiss();
    try {
      const ImagePicker = await import('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (result.canceled || !result.assets.length) return;

      const attachments: PendingAttachment[] = result.assets.map((asset) => ({
        uri: asset.uri,
        localUri: asset.uri,
        type: 'image',
        name: asset.fileName ?? `image_${Date.now()}.jpg`,
        mimeType: asset.mimeType ?? 'image/jpeg',
        size: asset.fileSize,
      }));
      onPick(attachments);
    } catch {
      Alert.alert('Error', 'Image picker is not available. Please rebuild the app.');
    }
  };

  const pickDocument = async () => {
    onDismiss();
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/*', 'image/*'],
      multiple: true,
    });
    if (result.canceled || !result.assets?.length) return;

    const attachments: PendingAttachment[] = result.assets.map((asset) => ({
      uri: asset.uri,
      localUri: asset.uri,
      type: asset.mimeType?.startsWith('image/') ? 'image' : 'document',
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? undefined,
    }));
    onPick(attachments);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <View style={styles.sheet}>
          <Pressable style={styles.option} onPress={pickImage}>
            <MaterialCommunityIcons name="image-outline" size={24} color={VoicyColors.aiGreen} />
            <Text style={styles.optionText}>Photo Library</Text>
          </Pressable>
          <Pressable style={styles.option} onPress={pickDocument}>
            <MaterialCommunityIcons name="file-document-outline" size={24} color={VoicyColors.aiGreen} />
            <Text style={styles.optionText}>Document</Text>
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: VoicyColors.cardBg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 40,
    gap: 4,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  optionText: { color: VoicyColors.white, fontSize: 16 },
  cancelBtn: {
    marginTop: 8,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: VoicyColors.inputBg,
  },
  cancelText: { color: VoicyColors.secondaryText, fontSize: 16 },
});
