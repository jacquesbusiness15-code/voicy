import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable, Platform, Linking } from 'react-native';
import { Text, Switch, Portal, Dialog, Button, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Paths, Directory } from 'expo-file-system';
import { VoicyColors } from '../src/constants/theme';
import { validateApiKey } from '../src/utils/validateApiKey';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useCalendarStore } from '../src/stores/calendarStore';
import { useAuthStore } from '../src/stores/authStore';
import { useGoogleAuth } from '../src/hooks/useGoogleAuth';
import { getSetting, setSetting } from '../src/db/queries';
import { resetDatabase } from '../src/db/client';
import { getLanguageName } from '../src/constants/languages';
import { importFromWhatsApp } from '../src/services/whatsapp';


function SettingsRow({ title, value, onPress, isDestructive, badge }: {
  title: string; value?: string; onPress?: () => void; isDestructive?: boolean; badge?: string;
}) {
  return (
    <>
      <Pressable style={styles.row} onPress={onPress} disabled={!onPress} accessibilityLabel={title} accessibilityRole="button">
        <View style={styles.rowLeft}>
          <Text style={[styles.rowTitle, isDestructive && { color: VoicyColors.error }]}>{title}</Text>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowRight}>
          {value ? <Text style={styles.rowValue}>{value}</Text> : null}
          {onPress ? <MaterialCommunityIcons name="chevron-right" size={18} color={VoicyColors.secondaryText} /> : null}
        </View>
      </Pressable>
      <View style={styles.divider} />
    </>
  );
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return '';
  return `${key.substring(0, 5)}...${key.substring(key.length - 4)}`;
}

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const settings = useSettingsStore();
  const [showApiKeyDialog, setShowApiKeyDialog] = useState<'openai' | 'anthropic' | 'deepl' | 'assemblyai' | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [apiKeyValidating, setApiKeyValidating] = useState(false);
  const [apiKeyError, setApiKeyError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [userName, setUserName] = useState('User');
  const [showNameDialog, setShowNameDialog] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showAboutDialog, setShowAboutDialog] = useState(false);
  const [showCalendarDisconnect, setShowCalendarDisconnect] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showWhatsAppDialog, setShowWhatsAppDialog] = useState(false);
  const { isConnected: calendarConnected, connectedEmail: calendarEmail, signOut: calendarSignOut } = useCalendarStore();
  const { user: authUser, signOut: authSignOut, changePassword } = useAuthStore();
  const { promptAsync, isReady: googleAuthReady } = useGoogleAuth();

  useEffect(() => {
    getSetting('userName').then((name) => { if (name) setUserName(name); });
  }, []);

  const handleSaveName = async () => {
    const name = nameInput.trim() || 'User';
    await setSetting('userName', name);
    setUserName(name);
    setShowNameDialog(false);
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will remove temporary files. Your recordings and data will not be affected.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        try {
          const cacheDir = new Directory(Paths.cache);
          if (cacheDir.exists) {
            cacheDir.delete();
            cacheDir.create();
          }
          Alert.alert('Done', 'Cache cleared successfully.');
        } catch (e: any) {
          Alert.alert('Error', e.message);
        }
      }},
    ]);
  };

  const handleAbout = () => setShowAboutDialog(true);

  const handleChangePassword = async () => {
    if (!newPassword.trim()) return;
    if (newPassword !== confirmNewPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }
    const result = await changePassword(newPassword);
    if (result.error) {
      Alert.alert('Error', result.error);
    } else {
      Alert.alert('Success', 'Password changed successfully.');
      setShowChangePassword(false);
      setNewPassword('');
      setConfirmNewPassword('');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await authSignOut();
        router.replace('/auth');
      }},
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete ALL your data including recordings, transcripts, and settings. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: () => {
          Alert.alert('Are you absolutely sure?', 'All data will be permanently lost.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Yes, Delete', style: 'destructive', onPress: async () => {
              try {
                await authSignOut();
                await resetDatabase();
                await Promise.all([
                  SecureStore.deleteItemAsync('voicy_openai_key'),
                  SecureStore.deleteItemAsync('voicy_anthropic_key'),
                  SecureStore.deleteItemAsync('voicy_deepl_key'),
                  SecureStore.deleteItemAsync('voicy_assemblyai_key'),
                  SecureStore.deleteItemAsync('voicy_google_tokens'),
                ]);
                try {
                  const cacheDir = new Directory(Paths.cache);
                  if (cacheDir.exists) { cacheDir.delete(); cacheDir.create(); }
                } catch {}
                router.replace('/auth');
              } catch (e: any) {
                Alert.alert('Error', e.message);
              }
            }},
          ]);
        }},
      ]
    );
  };

  const handleGetSupport = () => {
    const subject = encodeURIComponent('Voicy Support Request');
    const body = encodeURIComponent(`\n\n---\nVoicy v1.0.0 | ${Platform.OS} ${Platform.Version}`);
    Linking.openURL(`mailto:jacquesdong8@gmail.com?subject=${subject}&body=${body}`);
  };

  const handleShareFeedback = () => {
    const subject = encodeURIComponent('Voicy Feedback');
    Linking.openURL(`mailto:jacquesdong8@gmail.com?subject=${subject}`);
  };

  const handleSaveApiKey = async () => {
    if (!showApiKeyDialog) return;

    // Allow clearing a key without validation
    if (!apiKeyInput.trim()) {
      await SecureStore.deleteItemAsync(`voicy_${showApiKeyDialog}_key`);
      settings.updateSetting(`${showApiKeyDialog}ApiKey` as any, '');
      setShowApiKeyDialog(null);
      setApiKeyInput('');
      setApiKeyError('');
      return;
    }

    setApiKeyValidating(true);
    setApiKeyError('');
    try {
      const result = await validateApiKey(showApiKeyDialog, apiKeyInput.trim());
      if (!result.valid) {
        setApiKeyError(result.error ?? 'Invalid API key.');
        return;
      }
      await SecureStore.setItemAsync(`voicy_${showApiKeyDialog}_key`, apiKeyInput.trim());
      settings.updateSetting(`${showApiKeyDialog}ApiKey` as any, apiKeyInput.trim());
      setShowApiKeyDialog(null);
      setApiKeyInput('');
      setApiKeyError('');
    } catch (e: any) {
      setApiKeyError(e.message || 'Validation failed.');
    } finally {
      setApiKeyValidating(false);
    }
  };

  const loadApiKeyForEdit = async (provider: 'openai' | 'anthropic' | 'deepl' | 'assemblyai') => {
    const stored = await SecureStore.getItemAsync(`voicy_${provider}_key`);
    setApiKeyInput(stored ?? '');
    setShowApiKeyDialog(provider);
  };

  const themeLabel = settings.theme === 'system' ? 'Auto' : settings.theme === 'dark' ? 'Dark' : 'Light';
  const languageLabel = getLanguageName(settings.defaultLanguage);

  return (
    <ScrollView style={[styles.container, { paddingTop: insets.top }]}>
      <Pressable style={styles.closeButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} accessibilityLabel="Close settings" accessibilityRole="button">
        <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
      </Pressable>

      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="emoticon-outline" size={48} color={VoicyColors.white} />
        </View>
      </View>

      <Text style={styles.sectionTitle}>APP</Text>
      <View style={styles.card}>
        <SettingsRow title="Name" value={userName} onPress={() => { setNameInput(userName === 'User' ? '' : userName); setShowNameDialog(true); }} />
        <SettingsRow title="About" onPress={handleAbout} />
        <SettingsRow title="Theme" value={themeLabel} onPress={() => {
          const next = settings.theme === 'system' ? 'dark' : settings.theme === 'dark' ? 'light' : 'system';
          settings.updateSetting('theme', next);
        }} />
        <SettingsRow title="Language" value={languageLabel} onPress={() => router.push('/language-picker')} />
        <SettingsRow title="Names to remember" onPress={() => router.push('/names-to-remember')} />
        <SettingsRow title="Notifications" onPress={() => router.push('/notification-settings')} />
        <SettingsRow title="WhatsApp" onPress={() => setShowWhatsAppDialog(true)} />
        <SettingsRow
          title="Google Calendar"
          value={calendarConnected ? calendarEmail ?? 'Connected' : 'Not connected'}
          onPress={() => {
            if (calendarConnected) {
              setShowCalendarDisconnect(true);
            } else if (googleAuthReady) {
              promptAsync();
            }
          }}
        />
        <SettingsRow title="Calendar" onPress={() => { router.canGoBack() ? router.back() : router.replace('/'); router.push('/calendar'); }} />
        <SettingsRow title="Cache" badge="NEW" onPress={handleClearCache} />
      </View>

      <Text style={styles.sectionTitle}>ACCOUNT</Text>
      <View style={styles.card}>
        <SettingsRow title="Email" value={authUser?.email ?? 'Not signed in'} />
        <SettingsRow title="Change password" onPress={() => { setNewPassword(''); setConfirmNewPassword(''); setShowChangePassword(true); }} />
      </View>

      <Text style={styles.sectionTitle}>API KEYS</Text>
      <Text style={styles.sectionSubtext}>Enter your own API keys. Keys are stored securely on-device.</Text>
      <View style={styles.card}>
        <SettingsRow title="OpenAI API Key" value={settings.openaiApiKey ? maskKey(settings.openaiApiKey) : 'Not set'} onPress={() => loadApiKeyForEdit('openai')} />
        <SettingsRow title="Anthropic API Key" value={settings.anthropicApiKey ? maskKey(settings.anthropicApiKey) : 'Not set'} onPress={() => loadApiKeyForEdit('anthropic')} />
        <SettingsRow title="DeepL API Key" value={settings.deeplApiKey ? maskKey(settings.deeplApiKey) : 'Not set'} onPress={() => loadApiKeyForEdit('deepl')} />
        <SettingsRow title="AssemblyAI API Key" value={settings.assemblyaiApiKey ? maskKey(settings.assemblyaiApiKey) : 'Not set'} onPress={() => loadApiKeyForEdit('assemblyai')} />
      </View>

      <Text style={styles.sectionTitle}>MORE</Text>
      <View style={styles.card}>
        <SettingsRow title="Privacy Policy" onPress={() => router.push('/privacy-policy')} />
        <SettingsRow title="Terms of Service" onPress={() => router.push('/terms')} />
        <SettingsRow title="Get support" onPress={handleGetSupport} />
        <SettingsRow title="Delete account" isDestructive onPress={handleDeleteAccount} />
        <SettingsRow title="Share feedback" onPress={handleShareFeedback} />
      </View>

      <Pressable style={styles.signOutRow} onPress={handleSignOut}>
        <MaterialCommunityIcons name="logout" size={18} color={VoicyColors.error} />
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Pressable onLongPress={() => setShowAdvanced(!showAdvanced)}>
        <Text style={styles.versionFooter}>Version 1.0.0</Text>
      </Pressable>

      {showAdvanced && (
        <>
          <Text style={styles.sectionTitle}>ADVANCED</Text>
          <View style={styles.card}>
            <SettingsRow title="AI Provider" value={settings.aiProvider === 'openai' ? 'OpenAI' : 'Claude'} onPress={() => {
              settings.updateSetting('aiProvider', (settings.aiProvider === 'openai' ? 'anthropic' : 'openai') as any);
            }} />
            <SettingsRow title="Audio Quality" value={settings.audioQuality} onPress={() => {
              const levels = ['low', 'medium', 'high', 'lossless'] as const;
              const idx = levels.indexOf(settings.audioQuality as any);
              settings.updateSetting('audioQuality', levels[(idx + 1) % levels.length] as any);
            }} />
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>Auto-transcribe</Text>
              <Switch value={settings.autoTranscribe} onValueChange={(v) => settings.updateSetting('autoTranscribe', v)} trackColor={{ true: VoicyColors.aiGreen, false: VoicyColors.inputBg }} />
            </Pressable>
            <View style={styles.divider} />
            <Pressable style={styles.row}>
              <Text style={styles.rowTitle}>App Lock</Text>
              <Switch value={settings.appLockEnabled} onValueChange={(v) => settings.updateSetting('appLockEnabled', v)} trackColor={{ true: VoicyColors.aiGreen, false: VoicyColors.inputBg }} />
            </Pressable>
            <View style={styles.divider} />
          </View>
        </>
      )}

      <View style={{ height: 40 }} />

      <Portal>
        <Dialog visible={!!showApiKeyDialog} onDismiss={() => { if (!apiKeyValidating) { setShowApiKeyDialog(null); setApiKeyError(''); } }} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>
            {showApiKeyDialog === 'openai' ? 'OpenAI' : showApiKeyDialog === 'anthropic' ? 'Anthropic' : showApiKeyDialog === 'assemblyai' ? 'AssemblyAI' : 'DeepL'} API Key
          </Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: VoicyColors.secondaryText, marginBottom: 12 }}>Stored securely on device only.</Text>
            <TextInput value={apiKeyInput} onChangeText={(t) => { setApiKeyInput(t); setApiKeyError(''); }} placeholder="sk-..." mode="outlined" secureTextEntry autoCapitalize="none" textColor={VoicyColors.white} style={{ backgroundColor: VoicyColors.inputBg }} outlineColor={apiKeyError ? VoicyColors.error : VoicyColors.divider} activeOutlineColor={apiKeyError ? VoicyColors.error : VoicyColors.white} editable={!apiKeyValidating} />
            {apiKeyError ? <Text style={{ color: VoicyColors.error, fontSize: 13, marginTop: 8 }}>{apiKeyError}</Text> : null}
            {apiKeyValidating ? <Text style={{ color: VoicyColors.aiGreen, fontSize: 13, marginTop: 8 }}>Validating key...</Text> : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => { setShowApiKeyDialog(null); setApiKeyError(''); }} textColor={VoicyColors.white} disabled={apiKeyValidating}>Cancel</Button>
            <Button onPress={handleSaveApiKey} textColor={VoicyColors.aiGreen} disabled={apiKeyValidating} loading={apiKeyValidating}>Save</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={showNameDialog} onDismiss={() => setShowNameDialog(false)} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Your Name</Dialog.Title>
          <Dialog.Content>
            <TextInput value={nameInput} onChangeText={setNameInput} placeholder="Enter your name" mode="outlined" autoCapitalize="words" textColor={VoicyColors.white} style={{ backgroundColor: VoicyColors.inputBg }} outlineColor={VoicyColors.divider} activeOutlineColor={VoicyColors.white} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowNameDialog(false)} textColor={VoicyColors.white}>Cancel</Button>
            <Button onPress={handleSaveName} textColor={VoicyColors.aiGreen}>Save</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={showAboutDialog} onDismiss={() => setShowAboutDialog(false)} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>About Voicy</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: VoicyColors.secondaryText, lineHeight: 22 }}>
              Voicy is a personal voice notes app that uses AI to transcribe, summarize, and organize your recordings.
            </Text>
            <Text style={{ color: VoicyColors.secondaryText, marginTop: 12, lineHeight: 22 }}>
              Built with Expo & React Native.
            </Text>
            <Text style={{ color: VoicyColors.secondaryText, marginTop: 12, lineHeight: 22 }}>
              Version 1.0.0
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowAboutDialog(false)} textColor={VoicyColors.aiGreen}>OK</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={showCalendarDisconnect} onDismiss={() => setShowCalendarDisconnect(false)} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Google Calendar</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: VoicyColors.secondaryText }}>
              Connected as {calendarEmail}. Disconnect to stop syncing calendar events.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowCalendarDisconnect(false)} textColor={VoicyColors.white}>Cancel</Button>
            <Button onPress={() => { calendarSignOut(); setShowCalendarDisconnect(false); }} textColor={VoicyColors.error}>Disconnect</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={showChangePassword} onDismiss={() => setShowChangePassword(false)} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Change Password</Dialog.Title>
          <Dialog.Content>
            <TextInput value={newPassword} onChangeText={setNewPassword} placeholder="New password" mode="outlined" secureTextEntry autoCapitalize="none" textColor={VoicyColors.white} style={{ backgroundColor: VoicyColors.inputBg, marginBottom: 12 }} outlineColor={VoicyColors.divider} activeOutlineColor={VoicyColors.white} />
            <TextInput value={confirmNewPassword} onChangeText={setConfirmNewPassword} placeholder="Confirm new password" mode="outlined" secureTextEntry autoCapitalize="none" textColor={VoicyColors.white} style={{ backgroundColor: VoicyColors.inputBg }} outlineColor={VoicyColors.divider} activeOutlineColor={VoicyColors.white} />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowChangePassword(false)} textColor={VoicyColors.white}>Cancel</Button>
            <Button onPress={handleChangePassword} textColor={VoicyColors.aiGreen}>Save</Button>
          </Dialog.Actions>
        </Dialog>
        <Dialog visible={showWhatsAppDialog} onDismiss={() => setShowWhatsAppDialog(false)} style={styles.dialog}>
          <Dialog.Title style={{ color: VoicyColors.white }}>WhatsApp</Dialog.Title>
          <Dialog.Content>
            <Text style={{ color: VoicyColors.secondaryText, marginBottom: 16 }}>
              Import WhatsApp voice messages for transcription, or share transcripts to WhatsApp from any recording.
            </Text>
            <Button mode="outlined" onPress={async () => { setShowWhatsAppDialog(false); await importFromWhatsApp(); }} textColor={VoicyColors.white} style={{ borderColor: VoicyColors.divider, marginBottom: 8 }}>
              Import Voice Messages
            </Button>
            <Text style={{ color: VoicyColors.secondaryText, fontSize: 13 }}>
              To share to WhatsApp, open a recording and use the share option.
            </Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowWhatsAppDialog(false)} textColor={VoicyColors.aiGreen}>Close</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  closeButton: { alignSelf: 'flex-end', width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center', marginRight: 16, marginBottom: 8 },
  avatarContainer: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, borderRadius: 24, backgroundColor: VoicyColors.cardBg, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { color: VoicyColors.secondaryText, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  sectionSubtext: { color: VoicyColors.secondaryText, fontSize: 13, paddingHorizontal: 16, paddingBottom: 8 },
  card: { marginHorizontal: 16, backgroundColor: VoicyColors.cardBg, borderRadius: 16, overflow: 'hidden' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { color: VoicyColors.white, fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowValue: { color: VoicyColors.secondaryText, fontSize: 15 },
  divider: { height: 0.5, backgroundColor: VoicyColors.divider },
  badge: { backgroundColor: '#00796B', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { color: VoicyColors.white, fontSize: 10, fontWeight: '700' },
  signOutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 24, paddingVertical: 8 },
  signOutText: { color: VoicyColors.error, fontSize: 16 },
  versionFooter: { color: VoicyColors.secondaryText, fontSize: 13, textAlign: 'center', marginTop: 24 },
  dialog: { backgroundColor: VoicyColors.cardBg, borderRadius: 16 },
});
