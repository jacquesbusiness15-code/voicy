import React from 'react';
import { View, ScrollView, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';

export default function TermsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <MaterialCommunityIcons name="close" size={24} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Terms of Service</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={styles.updated}>Last updated: March 23, 2026</Text>

        <Text style={styles.heading}>1. Acceptance of Terms</Text>
        <Text style={styles.body}>
          By using Voicy ("the app"), you agree to these Terms of Service. If you do not agree, please do not use the app.
        </Text>

        <Text style={styles.heading}>2. Description of Service</Text>
        <Text style={styles.body}>
          Voicy is a voice notes application that allows you to record audio, transcribe recordings using AI, generate summaries and other AI-powered outputs, and manage your voice notes locally on your device.
        </Text>

        <Text style={styles.heading}>3. User Responsibilities</Text>
        <Text style={styles.body}>
          You are responsible for:{'\n\n'}
          - Providing and managing your own API keys for third-party AI services{'\n'}
          - All costs incurred through your use of third-party APIs{'\n'}
          - Ensuring your recordings comply with local laws regarding consent and recording{'\n'}
          - Maintaining the security of your account credentials{'\n'}
          - Backing up your data, as Voicy stores data locally on your device
        </Text>

        <Text style={styles.heading}>4. API Keys and Third-Party Services</Text>
        <Text style={styles.body}>
          Voicy integrates with third-party AI services (OpenAI, Anthropic, DeepL, AssemblyAI) using API keys you provide. You are bound by the terms of service of each provider you use. We are not responsible for the availability, accuracy, or pricing of these services.
        </Text>

        <Text style={styles.heading}>5. Recording Laws</Text>
        <Text style={styles.body}>
          Many jurisdictions require consent from all parties before recording conversations. You are solely responsible for complying with all applicable recording and privacy laws in your jurisdiction. Voicy provides the tool; you are responsible for how you use it.
        </Text>

        <Text style={styles.heading}>6. Intellectual Property</Text>
        <Text style={styles.body}>
          You retain full ownership of all content you create using Voicy, including recordings, transcripts, and AI-generated outputs. The Voicy app, its design, code, and branding are our intellectual property.
        </Text>

        <Text style={styles.heading}>7. Disclaimer of Warranties</Text>
        <Text style={styles.body}>
          Voicy is provided "as is" without warranties of any kind. We do not guarantee the accuracy of transcriptions, translations, or AI-generated content. AI outputs should be reviewed for accuracy before relying on them.
        </Text>

        <Text style={styles.heading}>8. Limitation of Liability</Text>
        <Text style={styles.body}>
          To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app, including but not limited to data loss, API charges, or inaccurate AI outputs.
        </Text>

        <Text style={styles.heading}>9. Account Termination</Text>
        <Text style={styles.body}>
          You may delete your account at any time through the app's settings. We reserve the right to terminate accounts that violate these terms.
        </Text>

        <Text style={styles.heading}>10. Changes to Terms</Text>
        <Text style={styles.body}>
          We may update these terms from time to time. Continued use of the app after changes constitutes acceptance of the updated terms.
        </Text>

        <Text style={styles.heading}>11. Contact</Text>
        <Text style={styles.body}>
          For questions about these terms, please contact us through the "Get Support" option in Settings.
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
