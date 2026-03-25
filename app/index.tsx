import React, { useCallback, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, Pressable, Alert } from 'react-native';
import { Text, Menu, Portal, Dialog, Button } from 'react-native-paper';
import { useRouter, useFocusEffect } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RecordingListItem } from '../src/components/RecordingListItem';
import { useRecordingStore } from '../src/stores/recordingStore';
import { importFile } from '../src/services/importExport';
import { VoicyColors } from '../src/constants/theme';
import { useCalendarStore } from '../src/stores/calendarStore';
import { useGoogleAuth } from '../src/hooks/useGoogleAuth';
import { MeetingEventCard } from '../src/components/MeetingEventCard';
import type { Recording } from '../src/db/schema';

type FilterMode = 'all' | 'meetings' | 'favorites';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    recordings,
    isLoading,
    filterMode,
    loadRecordings,
    setFilterMode,
    deleteRecording,
    toggleFavorite,
    loadStreak,
    loadRecordingDates,
  } = useRecordingStore();

  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<Recording | null>(null);
  const { isConnected: calendarConnected, events: calendarEvents, isSyncing, syncEvents, loadEvents, toggleAutoRecord, checkConnection } = useCalendarStore();
  const { promptAsync, isReady: googleAuthReady } = useGoogleAuth();

  useFocusEffect(
    useCallback(() => {
      loadRecordings();
      loadStreak();
      loadRecordingDates();
      checkConnection().then(() => {
        const state = useCalendarStore.getState();
        if (state.isConnected) {
          loadEvents();
          syncEvents();
        }
      });
    }, [loadRecordings, loadStreak, loadRecordingDates, checkConnection, loadEvents, syncEvents])
  );

  const filters: { key: FilterMode; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'favorites', label: 'Shared' },
    { key: 'meetings', label: 'Meeting' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Voicy</Text>
        <View style={styles.headerIcons}>
          <Pressable style={[styles.iconButton, { zIndex: 2 }]} accessibilityLabel="Search recordings" accessibilityRole="button">
            <MaterialCommunityIcons name="magnify" size={22} color={VoicyColors.white} />
          </Pressable>
          <View style={{ width: 36, height: 36, zIndex: 1 }}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <Pressable style={styles.iconButton} onPress={() => setMenuVisible(true)} accessibilityLabel="More options" accessibilityRole="button">
                  <MaterialCommunityIcons name="dots-horizontal" size={22} color={VoicyColors.white} />
                </Pressable>
              }
              contentStyle={{ backgroundColor: VoicyColors.cardBg }}
            >
              <Menu.Item
                onPress={() => { setMenuVisible(false); router.push('/write'); }}
                title="Write"
                leadingIcon="square-edit-outline"
                titleStyle={{ color: VoicyColors.white }}
              />
              <Menu.Item
                onPress={async () => {
                  setMenuVisible(false);
                  try {
                    const recording = await importFile();
                    if (recording) {
                      router.push(`/recording/${recording.id}`);
                    }
                  } catch (e: any) {
                    Alert.alert('Import Error', e.message);
                  }
                }}
                title="Import"
                leadingIcon="file-import"
                titleStyle={{ color: VoicyColors.white }}
              />
              <Menu.Item
                onPress={() => { setMenuVisible(false); router.push('/calendar'); }}
                title="Calendar"
                leadingIcon="calendar"
                titleStyle={{ color: VoicyColors.white }}
              />
              <Menu.Item
                onPress={() => { setMenuVisible(false); router.push('/settings'); }}
                title="Settings"
                leadingIcon="cog"
                titleStyle={{ color: VoicyColors.white }}
              />
            </Menu>
          </View>
        </View>
      </View>

      {/* Filter pills */}
      <View style={styles.filterRow}>
        {filters.map((f) => {
          const active = filterMode === f.key;
          return (
            <Pressable
              key={f.key}
              onPress={() => setFilterMode(f.key)}
              style={[
                styles.filterPill,
                { backgroundColor: active ? VoicyColors.pillActiveBg : VoicyColors.pillInactiveBg },
                active && styles.filterPillActive,
              ]}
              accessibilityLabel={f.label}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: active ? VoicyColors.black : VoicyColors.white },
                ]}
              >
                {f.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Recording list */}
      <FlatList
        data={recordings}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          filterMode === 'meetings' && calendarConnected && calendarEvents.length > 0 ? (
            <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              <Text style={{ color: VoicyColors.secondaryText, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 10 }}>UPCOMING MEETINGS</Text>
              {calendarEvents.map((event) => (
                <MeetingEventCard
                  key={event.id}
                  event={event}
                  onToggleAutoRecord={() => toggleAutoRecord(event.id)}
                  onPress={() => router.push({ pathname: '/record', params: { isMeeting: 'true', eventId: event.id, eventTitle: event.title } })}
                />
              ))}
              {recordings.length > 0 && (
                <Text style={{ color: VoicyColors.secondaryText, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 16, marginBottom: 10 }}>MEETING RECORDINGS</Text>
              )}
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <RecordingListItem
            recording={item}
            onDelete={() => setDeleteDialog(item)}
            onToggleFavorite={() => toggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          filterMode === 'meetings' ? (
            calendarConnected ? (
              <View style={styles.meetingEmpty}>
                <MaterialCommunityIcons name="calendar-check" size={40} color={VoicyColors.secondaryText} />
                <Text style={styles.meetingTitle}>No upcoming meetings</Text>
                <Text style={styles.meetingSubtext}>Your Google Calendar events will appear here.</Text>
              </View>
            ) : (
            <View style={styles.meetingEmpty}>
              <Text style={styles.meetingTitle}>Get instant notes from your Meetings.</Text>
              <Text style={styles.meetingSubtext}>Connect your calendar and select the meetings you want to record on auto.</Text>
              <View style={styles.calendarCard}>
                <View style={styles.calendarIconWrap}>
                  <MaterialCommunityIcons name="calendar-month" size={28} color="#4285F4" />
                </View>
                <Text style={styles.calendarLabel}>Google calendar</Text>
                <Pressable style={styles.connectButton} onPress={() => googleAuthReady && promptAsync()}>
                  <Text style={styles.connectText}>Connect</Text>
                </Pressable>
              </View>
            </View>
            )
          ) : filterMode === 'favorites' ? (
            <View style={styles.sharedEmpty}>
              <MaterialCommunityIcons name="file-document-outline" size={40} color={VoicyColors.secondaryText} />
              <Text style={styles.sharedTitle}>You haven't shared any notes yet.</Text>
              <Text style={styles.sharedSubtext}>To share a note, expand the note, just tap '... More' in notes settings and select Share</Text>
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No recordings yet</Text>
              <Text style={styles.emptySubtext}>Tap the record button to start</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl refreshing={isLoading || isSyncing} onRefresh={() => { loadRecordings(); if (calendarConnected) syncEvents(); }} tintColor={VoicyColors.white} />
        }
        contentContainerStyle={recordings.length === 0 ? styles.emptyContainer : styles.listContent}
      />

      {/* Delete Dialog */}
      <Portal>
        <Dialog visible={!!deleteDialog} onDismiss={() => setDeleteDialog(null)} style={{ backgroundColor: VoicyColors.cardBg, borderRadius: 16 }}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Delete Recording</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: VoicyColors.secondaryText }}>
              Delete "{deleteDialog?.title ?? 'Untitled'}"? This cannot be undone.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleteDialog(null)} textColor={VoicyColors.white}>Cancel</Button>
            <Button
              textColor={VoicyColors.error}
              onPress={async () => {
                if (deleteDialog) {
                  await deleteRecording(deleteDialog.id);
                  setDeleteDialog(null);
                }
              }}
            >
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitle: {
    color: VoicyColors.white,
    fontSize: 34,
    fontWeight: '700',
  },
  headerIcons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3a3a3c',
  },
  filterPillActive: {
    borderColor: 'transparent',
  },
  filterText: {
    fontSize: 15,
    fontWeight: '500',
  },
  listContent: {
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 80,
  },
  emptyText: {
    color: VoicyColors.secondaryText,
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    marginTop: 8,
  },
  meetingEmpty: {
    padding: 24,
    paddingTop: 40,
  },
  meetingTitle: {
    color: VoicyColors.white,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 30,
    marginBottom: 8,
  },
  meetingSubtext: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 24,
  },
  calendarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  calendarIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  calendarLabel: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  connectButton: {
    borderWidth: 1,
    borderColor: VoicyColors.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  connectText: {
    color: VoicyColors.white,
    fontSize: 14,
    fontWeight: '500',
  },
  sharedEmpty: {
    alignItems: 'center',
    padding: 32,
    paddingTop: 60,
    gap: 8,
  },
  sharedTitle: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
    fontWeight: '500',
    marginTop: 8,
  },
  sharedSubtext: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
