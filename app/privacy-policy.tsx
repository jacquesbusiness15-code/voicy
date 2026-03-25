import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <MaterialCommunityIcons name="close" size={24} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 23, 2026</Text>

        <Text style={styles.heading}>1. Overview</Text>
        <Text style={styles.body}>
          Voicy ("we", "our", "the app") is a voice notes application that records, transcribes, and processes audio using AI services. We are committed to protecting your privacy. This policy explains what data we collect, how it is used, and your rights.
        </Text>

        <Text style={styles.heading}>2. Data Storage</Text>
        <Text style={styles.body}>
          All audio recordings, transcripts, and notes are stored locally on your device using an encrypted SQLite database. Your data is not uploaded to our servers. Voicy is a local-first application.
        </Text>

        <Text style={styles.heading}>3. API Keys</Text>
        <Text style={styles.body}>
          You provide your own API keys to use AI features (OpenAI, Anthropic, DeepL, AssemblyAI). These keys are stored securely on your device using the operating system's encrypted key storage (Keychain on iOS, Keystore on Android). We never transmit, collect, or have access to your API keys.
        </Text>

        <Text style={styles.heading}>4. Third-Party AI Services</Text>
        <Text style={styles.body}>
          When you use transcription, summarization, translation, or other AI features, your audio or text data is sent directly from your device to the third-party service provider using your own API key. We do not act as an intermediary. Please review the privacy policies of these services:{'\n\n'}
          - OpenAI (openai.com/privacy){'\n'}
          - Anthropic (anthropic.com/privacy){'\n'}
          - DeepL (deepl.com/privacy){'\n'}
          - AssemblyAI (assemblyai.com/privacy)
        </Text>

        <Text style={styles.heading}>5. Authentication</Text>
        <Text style={styles.body}>
          Voicy uses Supabase for account authentication. When you sign up, your email address and an encrypted password are stored on Supabase's servers. We do not store passwords on your device. Your authentication session is managed securely.
        </Text>

        <Text style={styles.heading}>6. Google Calendar</Text>
        <Text style={styles.body}>
          If you connect your Google Calendar, we request read-only access to your calendar events to display upcoming meetings and enable auto-recording reminders. OAuth tokens are stored securely on your device. We do not store your calendar data on any external server.
        </Text>

        <Text style={styles.heading}>7. Data Sharing</Text>
        <Text style={styles.body}>
          We do not sell, share, or transfer your personal data to any third parties. The only external data transmission occurs when you actively use AI features, which communicate directly with the service providers using your own credentials.
        </Text>

        <Text style={styles.heading}>8. Data Deletion</Text>
        <Text style={styles.body}>
          You can delete your account and all associated data at any time through Settings {">"} Delete Account. This removes your local data and your authentication record. Individual recordings can be deleted at any time from within the app.
        </Text>

        <Text style={styles.heading}>9. Children's Privacy</Text>
        <Text style={styles.body}>
          Voicy is not directed at children under 13. We do not knowingly collect data from children.
        </Text>

        <Text style={styles.heading}>10. Changes to This Policy</Text>
        <Text style={styles.body}>
          We may update this policy from time to time. Updates will be reflected in the app with a new "Last updated" date. Continued use of the app constitutes acceptance of the updated policy.
        </Text>

        <Text style={styles.heading}>11. Contact</Text>
        <Text style={styles.body}>
          If you have questions about this privacy policy, please contact us through the "Get Support" option in Settings.
        </Text>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: VoicyColors.white, fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16 },
  updated: { color: VoicyColors.secondaryText, fontSize: 13, marginBottom: 20 },
  heading: { color: VoicyColors.white, fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 8 },
  body: { color: VoicyColors.secondaryText, fontSize: 14, lineHeight: 22 },
});
