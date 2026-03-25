import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, useTheme, Button, ActivityIndicator } from 'react-native-paper';
import { formatDuration } from '../utils/time';

interface Segment {
  start: number;
  end: number;
  text: string;
}

interface Props {
  content?: string;
  segments?: string;
  isTranscribing?: boolean;
  onTranscribe?: () => void;
  onSegmentPress?: (time: number) => void;
}

export function TranscriptView({
  content,
  segments,
  isTranscribing,
  onTranscribe,
  onSegmentPress,
}: Props) {
  const theme = useTheme();

  if (isTranscribing) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
          Transcribing...
        </Text>
      </View>
    );
  }

  if (!content) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          No transcript yet
        </Text>
        {onTranscribe && (
          <Button mode="contained" onPress={onTranscribe} icon="text-recognition">
            Transcribe
          </Button>
        )}
      </View>
    );
  }

  let parsedSegments: Segment[] | null = null;
  try {
    if (segments) {
      parsedSegments = JSON.parse(segments);
    }
  } catch {
    // Ignore parse errors
  }

  if (parsedSegments && parsedSegments.length > 0) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {parsedSegments.map((seg, i) => (
          <Pressable
            key={i}
            onPress={() => onSegmentPress?.(seg.start)}
            style={styles.segmentRow}
          >
            <Text
              variant="labelSmall"
              style={[styles.timestamp, { color: theme.colors.primary }]}
            >
              {formatDuration(seg.start)}
            </Text>
            <Text variant="bodyMedium" style={styles.segmentText}>
              {seg.text.trim()}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <Text variant="bodyMedium" style={{ lineHeight: 24 }}>
        {content}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timestamp: {
    width: 52,
    marginRight: 8,
    paddingTop: 2,
  },
  segmentText: {
    flex: 1,
    lineHeight: 22,
  },
});
