import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Pressable } from 'react-native';
import { Text, TextInput, Button } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../src/constants/theme';
import { useAuthStore } from '../src/stores/authStore';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn, signUp, resetPassword, isLoading, error, clearError } = useAuthStore();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async () => {
    setLocalError('');
    clearError();

    if (!email.trim() || !password.trim()) {
      setLocalError('Please enter both email and password.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setLocalError('Password must be at least 6 characters.');
      return;
    }

    const result = mode === 'signin'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);

    if (!result.error) {
      router.replace('/');
    }
  };

  const handleResetPassword = async () => {
    if (!resetEmail.trim()) {
      setLocalError('Please enter your email address.');
      return;
    }
    setLocalError('');
    const result = await resetPassword(resetEmail.trim());
    if (!result.error) {
      setResetSent(true);
    }
  };

  const displayError = localError || error;

  if (showForgotPassword) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 20 }]}>
        <Pressable style={styles.backButton} onPress={() => { setShowForgotPassword(false); setResetSent(false); setLocalError(''); clearError(); }} accessibilityLabel="Go back" accessibilityRole="button">
          <MaterialCommunityIcons name="arrow-left" size={22} color={VoicyColors.white} />
        </Pressable>

        <View style={styles.header}>
          <MaterialCommunityIcons name="lock-reset" size={48} color={VoicyColors.aiGreen} />
          <Text style={styles.title}>Reset Password</Text>
          <Text style={styles.subtitle}>Enter your email to receive a reset link</Text>
        </View>

        {resetSent ? (
          <View style={styles.form}>
            <View style={styles.successBox}>
              <MaterialCommunityIcons name="check-circle-outline" size={24} color={VoicyColors.aiGreen} />
              <Text style={styles.successText}>Password reset email sent. Check your inbox.</Text>
            </View>
            <Button mode="contained" onPress={() => { setShowForgotPassword(false); setResetSent(false); }} style={styles.button} buttonColor={VoicyColors.aiGreen} textColor={VoicyColors.black}>
              Back to Sign In
            </Button>
          </View>
        ) : (
          <View style={styles.form}>
            <TextInput
              label="Email"
              value={resetEmail}
              onChangeText={setResetEmail}
              mode="outlined"
              keyboardType="email-address"
              autoCapitalize="none"
              textColor={VoicyColors.white}
              style={styles.input}
              outlineColor={VoicyColors.divider}
              activeOutlineColor={VoicyColors.aiGreen}
            />
            {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}
            <Button mode="contained" onPress={handleResetPassword} loading={isLoading} disabled={isLoading} style={styles.button} buttonColor={VoicyColors.aiGreen} textColor={VoicyColors.black}>
              Send Reset Link
            </Button>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={[styles.container, { paddingTop: insets.top + 20 }]} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <MaterialCommunityIcons name="microphone-outline" size={56} color={VoicyColors.aiGreen} />
          <Text style={styles.title}>Voicy</Text>
          <Text style={styles.subtitle}>{mode === 'signin' ? 'Welcome back' : 'Create your account'}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            textColor={VoicyColors.white}
            style={styles.input}
            outlineColor={VoicyColors.divider}
            activeOutlineColor={VoicyColors.aiGreen}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry
            autoCapitalize="none"
            textColor={VoicyColors.white}
            style={styles.input}
            outlineColor={VoicyColors.divider}
            activeOutlineColor={VoicyColors.aiGreen}
          />
          {mode === 'signup' && (
            <TextInput
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              mode="outlined"
              secureTextEntry
              autoCapitalize="none"
              textColor={VoicyColors.white}
              style={styles.input}
              outlineColor={VoicyColors.divider}
              activeOutlineColor={VoicyColors.aiGreen}
            />
          )}

          {displayError ? <Text style={styles.errorText}>{displayError}</Text> : null}

          <Button mode="contained" onPress={handleSubmit} loading={isLoading} disabled={isLoading} style={styles.button} buttonColor={VoicyColors.aiGreen} textColor={VoicyColors.black}>
            {mode === 'signin' ? 'Sign In' : 'Sign Up'}
          </Button>

          {mode === 'signin' && (
            <Pressable onPress={() => { setShowForgotPassword(true); setResetEmail(email); setLocalError(''); clearError(); }} accessibilityLabel="Forgot password" accessibilityRole="link">
              <Text style={styles.linkText}>Forgot password?</Text>
            </Pressable>
          )}

          <Pressable onPress={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setLocalError(''); clearError(); }} accessibilityLabel={mode === 'signin' ? 'Switch to sign up' : 'Switch to sign in'} accessibilityRole="link">
            <Text style={styles.linkText}>
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingBottom: 40 },
  backButton: { position: 'absolute', top: 16, left: 16, width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { color: VoicyColors.white, fontSize: 32, fontWeight: '700', marginTop: 12 },
  subtitle: { color: VoicyColors.secondaryText, fontSize: 16, marginTop: 4 },
  form: { paddingHorizontal: 24 },
  input: { backgroundColor: VoicyColors.inputBg, marginBottom: 12 },
  button: { marginTop: 8, borderRadius: 12, paddingVertical: 4 },
  errorText: { color: VoicyColors.error, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  linkText: { color: VoicyColors.aiGreen, fontSize: 14, textAlign: 'center', marginTop: 16 },
  successBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: VoicyColors.cardBg, padding: 16, borderRadius: 12, marginBottom: 16 },
  successText: { color: VoicyColors.white, fontSize: 14, flex: 1 },
});
