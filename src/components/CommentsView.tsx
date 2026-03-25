import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, TextInput, IconButton, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { createComment, getComments, deleteComment } from '../db/queries';
import { formatDuration } from '../utils/time';
import type { Comment } from '../db/schema';

interface Props {
  recordingId: string;
  currentPosition?: number;
  onTimestampPress?: (time: number) => void;
}

export function CommentsView({ recordingId, currentPosition, onTimestampPress }: Props) {
  const theme = useTheme();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [addTimestamp, setAddTimestamp] = useState(false);

  const loadComments = useCallback(async () => {
    const results = await getComments(recordingId);
    setComments(results);
  }, [recordingId]);

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  const handleAdd = async () => {
    if (!newComment.trim()) return;
    await createComment({
      recordingId,
      content: newComment.trim(),
      timestamp: addTimestamp && currentPosition ? currentPosition : undefined,
    });
    setNewComment('');
    setAddTimestamp(false);
    loadComments();
  };

  const handleDelete = async (id: string) => {
    await deleteComment(id);
    loadComments();
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={comments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={comments.length === 0 ? styles.emptyContainer : styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="comment-outline" size={40} color={theme.colors.onSurfaceVariant} />
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginTop: 8 }}>
              No comments yet
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.commentCard, { backgroundColor: theme.colors.surfaceVariant }]}>
            {item.timestamp != null && (
              <Pressable onPress={() => onTimestampPress?.(item.timestamp!)}>
                <Text variant="labelSmall" style={[styles.timestamp, { color: theme.colors.primary }]}>
                  {formatDuration(item.timestamp)}
                </Text>
              </Pressable>
            )}
            <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, flex: 1 }}>
              {item.content}
            </Text>
            <IconButton
              icon="close"
              size={14}
              onPress={() => handleDelete(item.id)}
              style={styles.deleteBtn}
            />
          </View>
        )}
      />

      {/* Add comment input */}
      <View style={[styles.inputRow, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.outline }]}>
        <Pressable
          onPress={() => setAddTimestamp(!addTimestamp)}
          style={[
            styles.timestampToggle,
            { backgroundColor: addTimestamp ? theme.colors.primaryContainer : theme.colors.surfaceVariant },
          ]}
        >
          <MaterialCommunityIcons
            name="clock-outline"
            size={16}
            color={addTimestamp ? theme.colors.primary : theme.colors.onSurfaceVariant}
          />
        </Pressable>
        <TextInput
          mode="flat"
          placeholder="Add a comment..."
          value={newComment}
          onChangeText={setNewComment}
          onSubmitEditing={handleAdd}
          style={[styles.input, { backgroundColor: 'transparent' }]}
          underlineColor="transparent"
          activeUnderlineColor="transparent"
          dense
        />
        <IconButton
          icon="send"
          size={20}
          iconColor={theme.colors.primary}
          onPress={handleAdd}
          disabled={!newComment.trim()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  empty: {
    alignItems: 'center',
    padding: 32,
  },
  commentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  timestamp: {
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  deleteBtn: {
    margin: 0,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
  },
  timestampToggle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 14,
  },
});
