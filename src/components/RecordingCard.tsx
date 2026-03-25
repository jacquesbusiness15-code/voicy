import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDuration, formatRelativeDate } from '../utils/time';
import { getTranscriptByRecordingId, getTagsForRecording } from '../db/queries';
import type { Recording, Tag } from '../db/schema';

interface Props {
  recording: Recording;
  onLongPress?: () => void;
}

export function RecordingCard({ recording, onLongPress }: Props) {
  const theme = useTheme();
  const router = useRouter();
  const [transcriptPreview, setTranscriptPreview] = useState('');
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    getTranscriptByRecordingId(recording.id).then((t) => {
      if (t) setTranscriptPreview(t.content.substring(0, 120));
    });
    getTagsForRecording(recording.id).then(setTags);
  }, [recording.id]);

  return (
    <Pressable
      onPress={() => router.push(`/recording/${recording.id}`)}
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.colors.surface,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
    >
      {/* Title row */}
      <View style={styles.titleRow}>
        <Text variant="titleMedium" numberOfLines={1} style={[styles.title, { color: theme.colors.onSurface }]}>
          {recording.title ?? 'Untitled Recording'}
        </Text>
        {recording.isFavorite && (
          <MaterialCommunityIcons name="heart" size={16} color={theme.colors.error} />
        )}
      </View>

      {/* Transcript preview */}
      {transcriptPreview ? (
        <Text
          variant="bodySmall"
          numberOfLines={2}
          style={[styles.preview, { color: theme.colors.onSurfaceVariant }]}
        >
          {transcriptPreview}
        </Text>
      ) : null}

      {/* Tags */}
      {tags.length > 0 && (
        <View style={styles.tagRow}>
          {tags.slice(0, 3).map((tag) => (
            <View
              key={tag.id}
              style={[styles.tagPill, { backgroundColor: theme.colors.primaryContainer }]}
            >
              <Text variant="labelSmall" style={{ color: theme.colors.primary, fontSize: 10 }}>
                {tag.name}
              </Text>
            </View>
          ))}
          {tags.length > 3 && (
            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
              +{tags.length - 3}
            </Text>
          )}
        </View>
      )}

      {/* Footer: duration, time, meeting badge */}
      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={theme.colors.onSurfaceVariant} />
          <Text variant="bodySmall" style={[styles.metaText, { color: theme.colors.onSurfaceVariant }]}>
            {formatDuration(recording.duration)}
          </Text>
          {recording.isMeeting && (
            <View style={[styles.meetingBadge, { backgroundColor: theme.colors.secondaryContainer }]}>
              <Text variant="labelSmall" style={{ color: theme.colors.secondary, fontSize: 10 }}>
                Meeting
              </Text>
            </View>
          )}
        </View>
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatRelativeDate(recording.createdAt)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    flex: 1,
    fontWeight: '600',
  },
  preview: {
    lineHeight: 18,
    marginBottom: 8,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    marginRight: 8,
  },
  meetingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
});
