import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, Switch } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { format, isToday, isTomorrow } from 'date-fns';
import { VoicyColors } from '../constants/theme';
import type { CalendarEvent } from '../db/schema';

interface Props {
  event: CalendarEvent;
  onToggleAutoRecord: () => void;
  onPress: () => void;
}

function formatEventTime(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);

  let dayLabel = format(start, 'MMM d');
  if (isToday(start)) dayLabel = 'Today';
  else if (isTomorrow(start)) dayLabel = 'Tomorrow';

  return `${dayLabel}, ${format(start, 'h:mm a')} – ${format(end, 'h:mm a')}`;
}

export function MeetingEventCard({ event, onToggleAutoRecord, onPress }: Props) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={styles.titleRow}>
          <MaterialCommunityIcons name="calendar-clock" size={18} color={VoicyColors.aiGreen} />
          <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
        </View>
        {event.recordingId && (
          <MaterialCommunityIcons name="check-circle" size={16} color={VoicyColors.aiGreen} />
        )}
      </View>

      <Text style={styles.time}>{formatEventTime(event.startTime, event.endTime)}</Text>

      {event.location ? (
        <Text style={styles.location} numberOfLines={1}>{event.location}</Text>
      ) : null}

      {event.meetLink ? (
        <View style={styles.meetRow}>
          <MaterialCommunityIcons name="video" size={14} color="#4285F4" />
          <Text style={styles.meetText}>Google Meet</Text>
        </View>
      ) : null}

      <View style={styles.bottomRow}>
        <View style={styles.autoRecordRow}>
          <Text style={styles.autoRecordLabel}>Auto-record</Text>
          <Switch
            value={event.autoRecord}
            onValueChange={onToggleAutoRecord}
            trackColor={{ true: VoicyColors.aiGreen, false: VoicyColors.inputBg }}
            style={styles.switch}
          />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    borderWidth: 0.5,
    borderColor: VoicyColors.divider,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  title: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  time: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    marginBottom: 4,
  },
  location: {
    color: VoicyColors.secondaryText,
    fontSize: 13,
    marginBottom: 4,
  },
  meetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  meetText: {
    color: '#4285F4',
    fontSize: 13,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 8,
  },
  autoRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  autoRecordLabel: {
    color: VoicyColors.secondaryText,
    fontSize: 13,
  },
  switch: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
});
