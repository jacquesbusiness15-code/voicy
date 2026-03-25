import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as SecureStore from 'expo-secure-store';
import { VoicyColors } from '../src/constants/theme';
import { setSetting } from '../src/db/queries';
import { useSettingsStore } from '../src/stores/settingsStore';
import { validateApiKey } from '../src/utils/validateApiKey';

const STEPS = ['welcome', 'api-key', 'done'] as const;
type Step = typeof STEPS[number];

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const [step, setStep] = useState<Step>('welcome');
  const [apiKey, setApiKey] = useState('');
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async () => {
    await setSetting('hasCompletedOnboarding', 'true');
    router.replace('/');
  };

  const handleSaveKey = async () => {
    if (!apiKey.trim()) {
      // Skip key setup
      setStep('done');
      return;
    }

    setValidating(true);
    setError('');
    try {
      const result = await validateApiKey('openai', apiKey.trim());
      if (!result.valid) {
        setError(result.error ?? 'Invalid key.');
        return;
      }
      await SecureStore.setItemAsync('voicy_openai_key', apiKey.trim());
      updateSetting('openaiApiKey', apiKey.trim());
      setStep('done');
    } catch (e: any) {
      setError(e.message || 'Validation failed.');
    } finally {
      setValidating(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 }]}>
      {step === 'welcome' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="microphone" size={48} color={VoicyColors.white} />
          </View>
          <Text style={styles.title}>Welcome to Voicy</Text>
          <Text style={styles.subtitle}>
            Your private voice notes app with AI superpowers. Record, transcribe, summarize, and search across all your notes.
          </Text>
          <Text style={styles.feature}>
            <Text style={styles.featureBold}>Local-first </Text>
            — your recordings stay on your device
          </Text>
          <Text style={styles.feature}>
            <Text style={styles.featureBold}>AI-powered </Text>
            — transcriptions, summaries, and more
          </Text>
          <Text style={styles.feature}>
            <Text style={styles.featureBold}>No subscriptions </Text>
            — bring your own API keys
          </Text>
          <View style={styles.spacer} />
          <Pressable style={styles.primaryButton} onPress={() => setStep('api-key')}>
            <Text style={styles.primaryButtonText}>Get Started</Text>
          </Pressable>
        </View>
      )}

      {step === 'api-key' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="key-variant" size={40} color={VoicyColors.aiGreen} />
          </View>
          <Text style={styles.title}>Set Up Your API Key</Text>
          <Text style={styles.subtitle}>
            Voicy uses OpenAI for transcription and AI features. Enter your OpenAI API key to get started. You can add more keys later in Settings.
          </Text>
          <TextInput
            value={apiKey}
            onChangeText={(t) => { setApiKey(t); setError(''); }}
            placeholder="sk-proj-..."
            mode="outlined"
            secureTextEntry
            autoCapitalize="none"
            textColor={VoicyColors.white}
            style={styles.input}
            outlineColor={error ? VoicyColors.error : VoicyColors.divider}
            activeOutlineColor={error ? VoicyColors.error : VoicyColors.white}
            editable={!validating}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {validating ? <Text style={styles.validatingText}>Validating key...</Text> : null}
          <View style={styles.spacer} />
          <Pressable style={styles.primaryButton} onPress={handleSaveKey} disabled={validating}>
            <Text style={styles.primaryButtonText}>{apiKey.trim() ? 'Validate & Continue' : 'Skip for Now'}</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => setStep('welcome')}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </Pressable>
        </View>
      )}

      {step === 'done' && (
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <MaterialCommunityIcons name="check-circle" size={48} color={VoicyColors.aiGreen} />
          </View>
          <Text style={styles.title}>You're All Set!</Text>
          <Text style={styles.subtitle}>
            Start recording your first voice note. You can always change your settings later.
          </Text>
          <View style={styles.spacer} />
          <Pressable style={styles.primaryButton} onPress={handleFinish}>
            <Text style={styles.primaryButtonText}>Start Using Voicy</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.dots}>
        {STEPS.map((s) => (
          <View key={s} style={[styles.dot, s === step && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: VoicyColors.cardBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    marginTop: 40,
  },
  title: {
    color: VoicyColors.white,
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  subtitle: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 24,
  },
  feature: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    lineHeight: 28,
    textAlign: 'center',
  },
  featureBold: {
    color: VoicyColors.white,
    fontWeight: '600',
  },
  input: {
    backgroundColor: VoicyColors.inputBg,
    width: '100%',
    marginTop: 8,
  },
  error: {
    color: VoicyColors.error,
    fontSize: 13,
    marginTop: 8,
    textAlign: 'center',
  },
  validatingText: {
    color: VoicyColors.aiGreen,
    fontSize: 13,
    marginTop: 8,
  },
  spacer: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: VoicyColors.white,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: VoicyColors.black,
    fontSize: 17,
    fontWeight: '600',
  },
  secondaryButton: {
    paddingVertical: 12,
    marginTop: 8,
  },
  secondaryButtonText: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: VoicyColors.inputBg,
  },
  dotActive: {
    backgroundColor: VoicyColors.white,
    width: 24,
  },
});
