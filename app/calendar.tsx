import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { VoicyColors } from '../src/constants/theme';
import { useRecordingStore } from '../src/stores/recordingStore';
import { useCalendarStore } from '../src/stores/calendarStore';
import { useGoogleAuth } from '../src/hooks/useGoogleAuth';
import { MeetingEventCard } from '../src/components/MeetingEventCard';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isToday,
  isSameDay,
  isSameMonth,
  addMonths,
  subMonths,
} from 'date-fns';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { streak, recordingDates, loadRecordingDates, loadStreak, setSelectedDate: setStoreSelectedDate } = useRecordingStore();
  const { isConnected, events, loadEvents, syncEvents, isSyncing, isLoading, error, toggleAutoRecord } = useCalendarStore();
  const { promptAsync, isReady: googleAuthReady } = useGoogleAuth();

  const [viewMonth, setViewMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('right');

  const isCurrentMonth = isSameMonth(viewMonth, new Date());

  useEffect(() => {
    loadRecordingDates(
      format(startOfMonth(viewMonth), 'yyyy-MM-dd'),
      format(endOfMonth(viewMonth), 'yyyy-MM-dd')
    );
    loadStreak();
    if (isConnected) {
      loadEvents();
      syncEvents();
    }
  }, [viewMonth, isConnected]);

  const goToPrevMonth = useCallback(() => {
    setSlideDirection('left');
    setViewMonth((prev) => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setSlideDirection('right');
    setViewMonth((prev) => addMonths(prev, 1));
  }, []);

  const jumpToToday = useCallback(() => {
    setSlideDirection('right');
    setViewMonth(new Date());
    setSelectedDate(new Date());
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadRecordingDates(
        format(startOfMonth(viewMonth), 'yyyy-MM-dd'),
        format(endOfMonth(viewMonth), 'yyyy-MM-dd')
      ),
      isConnected ? syncEvents() : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [loadRecordingDates, syncEvents, isConnected, viewMonth]);

  const monthStart = startOfMonth(viewMonth);
  const monthEnd = endOfMonth(viewMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get day of week for first day (0=Sun, adjust to Mon=0)
  const firstDayOfWeek = (getDay(monthStart) + 6) % 7;
  const blanks = Array.from({ length: firstDayOfWeek }, (_, i) => i);

  // Build a set of dates that have calendar events
  const eventDates = new Set(
    events.map((e) => format(new Date(e.startTime), 'yyyy-MM-dd'))
  );

  // Selected day data
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedDayEvents = events.filter(
    (e) => format(new Date(e.startTime), 'yyyy-MM-dd') === selectedDateStr
  );
  const hasRecordingsOnSelectedDay = recordingDates.has(selectedDateStr);

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top }]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={VoicyColors.white}
        />
      }
    >
      {/* Close button */}
      <Pressable
        style={styles.closeButton}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      >
        <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
      </Pressable>

      {/* Calendar card */}
      <View style={styles.card}>
        {/* Header with month navigation */}
        <View style={styles.cardHeader}>
          <View style={styles.navRow}>
            <Pressable style={styles.navArrow} onPress={goToPrevMonth}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={VoicyColors.white} />
            </Pressable>
            <View style={styles.monthTitleContainer}>
              <Text style={styles.year}>{format(viewMonth, 'yyyy')}</Text>
              <Text style={styles.month}>{format(viewMonth, 'MMMM')}</Text>
            </View>
            <Pressable style={styles.navArrow} onPress={goToNextMonth}>
              <MaterialCommunityIcons name="chevron-right" size={22} color={VoicyColors.white} />
            </Pressable>
          </View>
          <View style={styles.headerActions}>
            {isSyncing && (
              <View style={styles.syncIndicator}>
                <ActivityIndicator size="small" color={VoicyColors.aiGreen} />
                <Text style={styles.syncText}>Syncing...</Text>
              </View>
            )}
            <Pressable
              style={styles.highlightsButton}
              onPress={() =>
                router.push({
                  pathname: '/ai-output',
                  params: { mode: 'monthly-summary', month: format(viewMonth, 'yyyy-MM') },
                })
              }
            >
              <MaterialCommunityIcons name="dots-hexagon" size={16} color={VoicyColors.aiGreen} />
              <Text style={styles.highlightsText}>View highlights</Text>
            </Pressable>
          </View>
        </View>

        {/* Jump to today pill */}
        {!isCurrentMonth && (
          <Pressable style={styles.jumpToday} onPress={jumpToToday}>
            <MaterialCommunityIcons name="calendar-today" size={14} color={VoicyColors.aiGreen} />
            <Text style={styles.jumpTodayText}>Today</Text>
          </Pressable>
        )}

        {/* Day headers */}
        <View style={styles.dayHeaders}>
          {DAYS.map((d, i) => (
            <Text key={i} style={styles.dayHeader}>
              {d}
            </Text>
          ))}
        </View>

        {/* Day grid with slide animation */}
        <Animated.View
          key={format(viewMonth, 'yyyy-MM')}
          entering={slideDirection === 'right' ? SlideInRight.duration(200) : SlideInLeft.duration(200)}
          style={styles.dayGrid}
        >
          {blanks.map((_, i) => (
            <View key={`blank-${i}`} style={styles.dayCell} />
          ))}
          {days.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const hasRecording = recordingDates.has(dayStr);
            const hasEvent = eventDates.has(dayStr);
            const today = isToday(day);
            const isSelected = isSameDay(day, selectedDate);

            return (
              <Pressable key={dayStr} style={styles.dayCell} onPress={() => setSelectedDate(day)}>
                <View
                  style={[
                    styles.dayNumber,
                    today && !isSelected && styles.todayCircle,
                    isSelected && styles.selectedCircle,
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      today && styles.todayText,
                      isSelected && styles.selectedText,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
                <View style={styles.dotRow}>
                  {hasRecording && <View style={styles.recordingDot} />}
                  {hasEvent && <View style={styles.eventDot} />}
                </View>
              </Pressable>
            );
          })}
        </Animated.View>

        {/* Streak */}
        <View style={styles.streakRow}>
          <MaterialCommunityIcons
            name="fire"
            size={18}
            color={streak > 0 ? '#f59e0b' : VoicyColors.secondaryText}
          />
          <Text style={styles.streakText}>
            {streak > 0
              ? `${streak}-day recording streak`
              : 'Start your streak by recording today!'}
          </Text>
        </View>
      </View>

      {/* Error state */}
      {error && (
        <View style={styles.errorCard}>
          <MaterialCommunityIcons name="alert-circle-outline" size={20} color={VoicyColors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => syncEvents()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Connect calendar prompt */}
      {!isConnected && (
        <View style={styles.connectPrompt}>
          <MaterialCommunityIcons name="calendar-month" size={48} color="#4285F4" />
          <Text style={styles.connectTitle}>Connect your calendar</Text>
          <Text style={styles.connectSubtext}>See your meetings and auto-record them</Text>
          <Pressable
            style={styles.connectCta}
            onPress={() => googleAuthReady && promptAsync()}
          >
            <Text style={styles.connectCtaText}>Connect Google Calendar</Text>
          </Pressable>
        </View>
      )}

      {/* Selected day section */}
      <View style={styles.eventsSection}>
        <Text style={styles.eventsSectionTitle}>
          {isToday(selectedDate) ? 'Today' : format(selectedDate, 'MMM d, yyyy')}
        </Text>

        {isLoading && (
          <ActivityIndicator color={VoicyColors.aiGreen} style={{ marginVertical: 16 }} />
        )}

        {/* Events using MeetingEventCard */}
        {isConnected &&
          selectedDayEvents.map((event) => (
            <MeetingEventCard
              key={event.id}
              event={event}
              onToggleAutoRecord={() => toggleAutoRecord(event.id)}
              onPress={() =>
                router.push({
                  pathname: '/record',
                  params: { isMeeting: 'true', eventId: event.id, eventTitle: event.title },
                })
              }
            />
          ))}

        {/* Recording link */}
        {hasRecordingsOnSelectedDay && (
          <Pressable
            style={styles.recordingCard}
            onPress={() => {
              setStoreSelectedDate(selectedDateStr);
              router.push('/');
            }}
          >
            <MaterialCommunityIcons name="microphone" size={18} color={VoicyColors.aiGreen} />
            <Text style={styles.recordingCardText}>View recordings from this day</Text>
            <MaterialCommunityIcons name="chevron-right" size={18} color={VoicyColors.secondaryText} />
          </Pressable>
        )}

        {/* Empty state for selected day */}
        {!isLoading && selectedDayEvents.length === 0 && !hasRecordingsOnSelectedDay && (
          <Text style={styles.nothingText}>Nothing on this day</Text>
        )}
      </View>

      {/* Legend */}
      {isConnected && (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={styles.recordingDot} />
            <Text style={styles.legendText}>Recording</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={styles.eventDot} />
            <Text style={styles.legendText}>Meeting</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
    padding: 16,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 20,
  },
  cardHeader: {
    marginBottom: 20,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  navArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitleContainer: {
    alignItems: 'center',
  },
  year: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
  },
  month: {
    color: VoicyColors.white,
    fontSize: 28,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  syncText: {
    color: VoicyColors.secondaryText,
    fontSize: 12,
  },
  highlightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: VoicyColors.aiGreen,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginLeft: 'auto',
  },
  highlightsText: {
    color: VoicyColors.aiGreen,
    fontSize: 13,
    fontWeight: '500',
  },
  jumpToday: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: VoicyColors.aiGreen,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  jumpTodayText: {
    color: VoicyColors.aiGreen,
    fontSize: 13,
    fontWeight: '500',
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    color: VoicyColors.secondaryText,
    fontSize: 14,
    fontWeight: '500',
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '500',
  },
  todayCircle: {
    backgroundColor: '#48484a',
  },
  todayText: {
    fontWeight: '700',
  },
  selectedCircle: {
    backgroundColor: VoicyColors.aiGreen,
  },
  selectedText: {
    color: VoicyColors.black,
    fontWeight: '700',
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 8,
    alignItems: 'center',
  },
  recordingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: VoicyColors.aiGreen,
  },
  eventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4285F4',
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
  },
  streakText: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  errorText: {
    color: VoicyColors.error,
    flex: 1,
    fontSize: 13,
  },
  retryText: {
    color: VoicyColors.aiGreen,
    fontWeight: '600',
    fontSize: 13,
  },
  connectPrompt: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    marginTop: 20,
  },
  connectTitle: {
    color: VoicyColors.white,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
  },
  connectSubtext: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    marginTop: 4,
  },
  connectCta: {
    backgroundColor: '#4285F4',
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 16,
  },
  connectCtaText: {
    color: VoicyColors.white,
    fontWeight: '600',
    fontSize: 15,
  },
  eventsSection: {
    marginTop: 20,
  },
  eventsSectionTitle: {
    color: VoicyColors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  recordingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 8,
  },
  recordingCardText: {
    color: VoicyColors.white,
    flex: 1,
    fontSize: 14,
  },
  nothingText: {
    color: VoicyColors.secondaryText,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
  },
  legend: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
    paddingHorizontal: 4,
    marginBottom: 32,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendText: {
    color: VoicyColors.secondaryText,
    fontSize: 12,
  },
});
