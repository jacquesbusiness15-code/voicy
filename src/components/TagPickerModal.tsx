import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, TextInput } from 'react-native';
import { Text, Portal, Modal } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../constants/theme';
import * as queries from '../db/queries';
import { getOrCreateTag, toggleTagOnRecording } from '../services/tags';
import type { Tag } from '../db/schema';

interface TagPickerModalProps {
  visible: boolean;
  onDismiss: () => void;
  recordingId: string;
  onTagsChanged?: () => void;
}

export function TagPickerModal({ visible, onDismiss, recordingId, onTagsChanged }: TagPickerModalProps) {
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [recordingTagIds, setRecordingTagIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');

  useEffect(() => {
    if (visible) loadTags();
  }, [visible, recordingId]);

  const loadTags = async () => {
    const tags = await queries.getAllTags();
    const recordingTags = await queries.getTagsForRecording(recordingId);
    setAllTags(tags);
    setRecordingTagIds(new Set(recordingTags.map((t) => t.id)));
  };

  const handleToggle = async (tagId: string) => {
    await toggleTagOnRecording(recordingId, tagId);
    setRecordingTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
    onTagsChanged?.();
  };

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const tag = await getOrCreateTag(newTagName.trim());
    if (!recordingTagIds.has(tag.id)) {
      await queries.addTagToRecording(recordingId, tag.id);
      setRecordingTagIds((prev) => new Set(prev).add(tag.id));
      onTagsChanged?.();
    }
    setNewTagName('');
    await loadTags();
  };

  return (
    <Portal>
      <Modal visible={visible} onDismiss={onDismiss} contentContainerStyle={styles.modal}>
        <Text style={styles.title}>Tags</Text>

        {/* Existing tags */}
        <View style={styles.tagsContainer}>
          {allTags.map((tag) => {
            const selected = recordingTagIds.has(tag.id);
            return (
              <Pressable
                key={tag.id}
                style={[styles.tagChip, selected && { backgroundColor: tag.color ?? VoicyColors.aiGreen }]}
                onPress={() => handleToggle(tag.id)}
              >
                <Text style={[styles.tagText, selected && { color: VoicyColors.black }]}>
                  #{tag.name}
                </Text>
                {selected && (
                  <MaterialCommunityIcons name="check" size={14} color={VoicyColors.black} style={{ marginLeft: 4 }} />
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Add new tag */}
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            placeholder="New tag..."
            placeholderTextColor={VoicyColors.secondaryText}
            value={newTagName}
            onChangeText={setNewTagName}
            onSubmitEditing={handleAddTag}
            maxLength={50}
          />
          <Pressable style={styles.addButton} onPress={handleAddTag}>
            <MaterialCommunityIcons name="plus" size={20} color={VoicyColors.white} />
          </Pressable>
        </View>

        {/* Close */}
        <Pressable style={styles.closeButton} onPress={onDismiss}>
          <Text style={styles.closeText}>Done</Text>
        </Pressable>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  modal: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 20,
    margin: 24,
  },
  title: {
    color: VoicyColors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: VoicyColors.inputBg,
  },
  tagText: {
    color: VoicyColors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  addInput: {
    flex: 1,
    backgroundColor: VoicyColors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: VoicyColors.white,
    fontSize: 15,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: VoicyColors.aiGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.inputBg,
  },
  closeText: {
    color: VoicyColors.white,
    fontSize: 15,
    fontWeight: '500',
  },
});
