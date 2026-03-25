import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Pressable, Alert } from 'react-native';
import { Text, Switch } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { VoicyColors } from '../src/constants/theme';
import { getSetting, setSetting } from '../src/db/queries';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [meetingReminders, setMeetingReminders] = useState(true);
  const [permissionGranted, setPermissionGranted] = useState(false);

  useEffect(() => {
    Notifications.getPermissionsAsync().then(({ status }) => {
      setPermissionGranted(status === 'granted');
    });
    getSetting('notificationsEnabled').then((val) => {
      if (val !== undefined) setNotificationsEnabled(val !== 'false');
    });
    getSetting('meetingRemindersEnabled').then((val) => {
      if (val !== undefined) setMeetingReminders(val !== 'false');
    });
  }, []);

  const handleToggleNotifications = async (value: boolean) => {
    if (value && !permissionGranted) {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings to receive alerts.');
        return;
      }
      setPermissionGranted(true);
    }
    setNotificationsEnabled(value);
    await setSetting('notificationsEnabled', String(value));
  };

  const handleToggleMeetingReminders = async (value: boolean) => {
    setMeetingReminders(value);
    await setSetting('meetingRemindersEnabled', String(value));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Enable Notifications</Text>
            <Text style={styles.rowSubtitle}>Receive alerts and reminders</Text>
          </View>
          <Switch
            value={notificationsEnabled}
            onValueChange={handleToggleNotifications}
            trackColor={{ true: VoicyColors.aiGreen, false: VoicyColors.inputBg }}
          />
        </View>
        <View style={styles.divider} />
        <View style={[styles.row, !notificationsEnabled && { opacity: 0.4 }]}>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Meeting Reminders</Text>
            <Text style={styles.rowSubtitle}>Get notified 1 minute before meetings with auto-record enabled</Text>
          </View>
          <Switch
            value={meetingReminders && notificationsEnabled}
            onValueChange={handleToggleMeetingReminders}
            disabled={!notificationsEnabled}
            trackColor={{ true: VoicyColors.aiGreen, false: VoicyColors.inputBg }}
          />
        </View>
      </View>

      {!permissionGranted && (
        <Text style={styles.permissionNote}>
          Notification permissions have not been granted. Toggle notifications on to request permission.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  title: { color: VoicyColors.white, fontSize: 18, fontWeight: '600' },
  card: { marginHorizontal: 16, backgroundColor: VoicyColors.cardBg, borderRadius: 16, overflow: 'hidden', marginTop: 16 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowContent: { flex: 1, marginRight: 12 },
  rowTitle: { color: VoicyColors.white, fontSize: 16 },
  rowSubtitle: { color: VoicyColors.secondaryText, fontSize: 13, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: VoicyColors.divider },
  permissionNote: { color: VoicyColors.secondaryText, fontSize: 13, paddingHorizontal: 16, paddingTop: 16, lineHeight: 18 },
});
