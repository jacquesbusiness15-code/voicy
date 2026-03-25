import React, { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, AppState, type AppStateStatus } from 'react-native';
import { Text, Button, useTheme, TextInput } from 'react-native-paper';
import { useSettingsStore } from '../stores/settingsStore';
import {
  isBiometricAvailable,
  authenticateWithBiometric,
  hasPIN,
  verifyPIN,
} from '../services/security';

interface Props {
  children: React.ReactNode;
}

export function AppLockGate({ children }: Props) {
  const theme = useTheme();
  const appLockEnabled = useSettingsStore((s) => s.appLockEnabled);
  const [isLocked, setIsLocked] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  const attemptUnlock = useCallback(async () => {
    if (!appLockEnabled) {
      setIsLocked(false);
      setIsChecking(false);
      return;
    }

    // Try biometric first
    const biometricAvail = await isBiometricAvailable();
    if (biometricAvail) {
      const success = await authenticateWithBiometric();
      if (success) {
        setIsLocked(false);
        setIsChecking(false);
        return;
      }
    }

    // Check if PIN is set
    const pinSet = await hasPIN();
    if (pinSet) {
      setShowPinInput(true);
      setIsLocked(true);
      setIsChecking(false);
      return;
    }

    // No auth method configured, just unlock
    setIsLocked(false);
    setIsChecking(false);
  }, [appLockEnabled]);

  useEffect(() => {
    attemptUnlock();
  }, [attemptUnlock]);

  // Lock when app goes to background
  useEffect(() => {
    const handleAppState = (nextState: AppStateStatus) => {
      if (nextState === 'background' && appLockEnabled) {
        setIsLocked(true);
        setShowPinInput(false);
        setPinInput('');
      } else if (nextState === 'active' && isLocked && appLockEnabled) {
        attemptUnlock();
      }
    };

    const sub = AppState.addEventListener('change', handleAppState);
    return () => sub.remove();
  }, [appLockEnabled, isLocked, attemptUnlock]);

  const handlePinSubmit = useCallback(async () => {
    const valid = await verifyPIN(pinInput);
    if (valid) {
      setIsLocked(false);
      setShowPinInput(false);
      setPinInput('');
      setPinError('');
    } else {
      setPinError('Incorrect PIN');
      setPinInput('');
    }
  }, [pinInput]);

  if (isChecking) return null;

  if (isLocked) {
    return (
      <View style={[styles.lockScreen, { backgroundColor: theme.colors.background }]}>
        <Text variant="headlineMedium" style={[styles.lockTitle, { color: theme.colors.onBackground }]}>
          Voicy is Locked
        </Text>
        {showPinInput ? (
          <View style={styles.pinContainer}>
            <TextInput
              mode="outlined"
              label="Enter PIN"
              value={pinInput}
              onChangeText={setPinInput}
              onSubmitEditing={handlePinSubmit}
              secureTextEntry
              keyboardType="number-pad"
              maxLength={6}
              style={styles.pinInput}
              error={!!pinError}
            />
            {pinError ? (
              <Text variant="bodySmall" style={{ color: theme.colors.error, marginTop: 4 }}>
                {pinError}
              </Text>
            ) : null}
            <Button mode="contained" onPress={handlePinSubmit} style={styles.unlockButton}>
              Unlock
            </Button>
          </View>
        ) : (
          <Button mode="contained" onPress={attemptUnlock} style={styles.unlockButton}>
            Unlock with Biometrics
          </Button>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  lockScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockTitle: {
    marginBottom: 32,
  },
  pinContainer: {
    width: '100%',
    maxWidth: 280,
    alignItems: 'center',
  },
  pinInput: {
    width: '100%',
    marginBottom: 16,
  },
  unlockButton: {
    marginTop: 16,
  },
});
