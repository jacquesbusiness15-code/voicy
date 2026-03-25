import { Alert, Linking } from 'react-native';
import { importFile } from './importExport';

export async function shareToWhatsApp(text: string): Promise<void> {
  const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('WhatsApp Not Found', 'WhatsApp is not installed on this device.');
      return;
    }
    await Linking.openURL(url);
  } catch {
    Alert.alert('Error', 'Could not open WhatsApp.');
  }
}

export async function importFromWhatsApp(): Promise<void> {
  try {
    const recording = await importFile();
    if (recording) {
      Alert.alert('Success', 'Voice message imported successfully.');
    }
  } catch (e: any) {
    Alert.alert('Import Error', e.message);
  }
}
