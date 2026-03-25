import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Menu } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDuration } from '../utils/time';
import { getTranscriptByRecordingId } from '../db/queries';
import { VoicyColors } from '../constants/theme';
import { format, isToday, isYesterday, parseISO } from 'date-fns';
import type { Recording } from '../db/schema';

interface Props {
  recording: Recording;
  onDelete: () => void;
  onToggleFavorite: () => void;
}

function formatRecordingDate(dateStr: string): string {
  const date = parseISO(dateStr);
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today · ${time}`;
  if (isYesterday(date)) return `Yesterday · ${time}`;
  return `${format(date, 'MMM d')} · ${time}`;
}

export function RecordingListItem({ recording, onDelete, onToggleFavorite }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState('');
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    getTranscriptByRecordingId(recording.id).then((t) => {
      if (t) setPreview(t.content.substring(0, 200));
    });
  }, [recording.id]);

  return (
    <Pressable
      onPress={() => router.push(`/recording/${recording.id}`)}
      style={styles.container}
      accessibilityLabel={recording.title ?? 'Untitled Recording'}
      accessibilityRole="button"
    >
      {/* Date */}
      <Text style={styles.date}>
        {formatRecordingDate(recording.createdAt)}
      </Text>

      {/* Title */}
      <Text style={styles.title} numberOfLines={2}>
        {recording.title ?? 'Untitled Recording'}
      </Text>

      {/* Preview */}
      {preview ? (
        <Text style={styles.preview} numberOfLines={3}>
          {preview}
        </Text>
      ) : null}
      {preview ? <Text style={styles.ellipsis}>...</Text> : null}

      {/* Bottom row: play pill + menu */}
      <View style={styles.bottomRow}>
        <View style={styles.playPill}>
          {recording.format === 'text' ? (
            <>
              <MaterialCommunityIcons name="volume-high" size={14} color={VoicyColors.white} />
              <Text style={styles.duration}>Read aloud</Text>
            </>
          ) : (
            <>
              <MaterialCommunityIcons name="play" size={14} color={VoicyColors.white} />
              <Text style={styles.duration}>{formatDuration(recording.duration)}</Text>
            </>
          )}
        </View>

        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <Pressable onPress={() => setMenuVisible(true)} style={styles.menuButton}>
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={VoicyColors.secondaryText} />
            </Pressable>
          }
          contentStyle={{ backgroundColor: VoicyColors.cardBg }}
        >
          <Menu.Item
            onPress={() => { setMenuVisible(false); onToggleFavorite(); }}
            title={recording.isFavorite ? 'Unfavorite' : 'Favorite'}
            leadingIcon={recording.isFavorite ? 'heart-off' : 'heart'}
            titleStyle={{ color: VoicyColors.white }}
          />
          <Menu.Item
            onPress={() => { setMenuVisible(false); onDelete(); }}
            title="Delete"
            leadingIcon="delete"
            titleStyle={{ color: VoicyColors.error }}
          />
        </Menu>
      </View>

      {/* Divider */}
      <View style={styles.divider} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  date: {
    color: VoicyColors.secondaryText,
    fontSize: 13,
    marginBottom: 4,
  },
  title: {
    color: VoicyColors.white,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 23,
    marginBottom: 2,
  },
  preview: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  ellipsis: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    marginTop: -2,
    marginBottom: 6,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  playPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: VoicyColors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  duration: {
    color: VoicyColors.white,
    fontSize: 13,
    fontWeight: '500',
  },
  menuButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 0.5,
    backgroundColor: VoicyColors.divider,
  },
});
