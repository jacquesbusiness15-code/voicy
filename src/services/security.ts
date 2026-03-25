import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const PIN_KEY = 'voicy_pin';

// Rate limiting state
let failedAttempts = 0;
let lockoutUntil: number | null = null;

export function getFailedAttempts(): number {
  return failedAttempts;
}

export function getLockoutRemaining(): number {
  if (!lockoutUntil) return 0;
  const remaining = lockoutUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

function checkLockout(): void {
  if (lockoutUntil && Date.now() < lockoutUntil) {
    const seconds = Math.ceil((lockoutUntil - Date.now()) / 1000);
    throw new Error(`Too many failed attempts. Try again in ${seconds}s.`);
  }
  // Reset lockout if expired
  if (lockoutUntil && Date.now() >= lockoutUntil) {
    lockoutUntil = null;
  }
}

function recordFailedAttempt(): void {
  failedAttempts++;
  if (failedAttempts >= 10) {
    lockoutUntil = Date.now() + 5 * 60 * 1000; // 5 minutes
  } else if (failedAttempts >= 5) {
    lockoutUntil = Date.now() + 30 * 1000; // 30 seconds
  }
}

function resetAttempts(): void {
  failedAttempts = 0;
  lockoutUntil = null;
}

async function hashPIN(pin: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, pin);
}

function isHashed(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}

export async function isBiometricAvailable(): Promise<boolean> {
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Unlock Voicy',
    cancelLabel: 'Use PIN',
    disableDeviceFallback: false,
    fallbackLabel: 'Use PIN',
  });
  return result.success;
}

export async function setPIN(pin: string): Promise<void> {
  const hash = await hashPIN(pin);
  await SecureStore.setItemAsync(PIN_KEY, hash);
}

export async function verifyPIN(pin: string): Promise<boolean> {
  checkLockout();

  const stored = await SecureStore.getItemAsync(PIN_KEY);
  if (!stored) return false;

  // Legacy migration: if stored value is plain text (not a hash), migrate it
  if (!isHashed(stored)) {
    if (stored === pin) {
      // Migrate to hashed storage
      await setPIN(pin);
      resetAttempts();
      return true;
    }
    recordFailedAttempt();
    return false;
  }

  const inputHash = await hashPIN(pin);
  if (inputHash === stored) {
    resetAttempts();
    return true;
  }

  recordFailedAttempt();
  return false;
}

export async function hasPIN(): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(PIN_KEY);
  return stored !== null;
}

export async function removePIN(): Promise<void> {
  await SecureStore.deleteItemAsync(PIN_KEY);
}

export async function loadSecureApiKey(provider: string): Promise<string | null> {
  return SecureStore.getItemAsync(`voicy_${provider}_key`);
}

export async function saveSecureApiKey(provider: string, key: string): Promise<void> {
  await SecureStore.setItemAsync(`voicy_${provider}_key`, key);
}
