import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { format, subDays, isSameDay, isToday, isYesterday } from 'date-fns';

interface Props {
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  datesWithRecordings: Set<string>;
}

export function CalendarStrip({ selectedDate, onSelectDate, datesWithRecordings }: Props) {
  const theme = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, i) => subDays(today, 29 - i));

  useEffect(() => {
    // Scroll to end (today) on mount
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, []);

  const handlePress = (date: Date) => {
    if (selectedDate && isSameDay(date, selectedDate)) {
      onSelectDate(null); // Deselect
    } else {
      onSelectDate(date);
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {days.map((date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const isSelected = selectedDate && isSameDay(date, selectedDate);
        const hasRecordings = datesWithRecordings.has(dateStr);
        const dayLabel = isToday(date) ? 'Today' : isYesterday(date) ? 'Yday' : format(date, 'EEE');

        return (
          <Pressable
            key={dateStr}
            onPress={() => handlePress(date)}
            style={[
              styles.dayItem,
              isSelected && { backgroundColor: theme.colors.primary, borderRadius: 16 },
            ]}
          >
            <Text
              variant="labelSmall"
              style={[
                styles.dayLabel,
                { color: isSelected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant },
              ]}
            >
              {dayLabel}
            </Text>
            <Text
              variant="titleMedium"
              style={[
                styles.dayNumber,
                {
                  color: isSelected ? theme.colors.onPrimary : theme.colors.onBackground,
                  fontWeight: isToday(date) ? '700' : '500',
                },
              ]}
            >
              {format(date, 'd')}
            </Text>
            {hasRecordings && !isSelected && (
              <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
            )}
            {hasRecordings && isSelected && (
              <View style={[styles.dot, { backgroundColor: theme.colors.onPrimary }]} />
            )}
            {!hasRecordings && <View style={styles.dotPlaceholder} />}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  dayItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 72,
    paddingVertical: 6,
  },
  dayLabel: {
    fontSize: 10,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 18,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },
  dotPlaceholder: {
    width: 5,
    height: 5,
    marginTop: 4,
  },
});
