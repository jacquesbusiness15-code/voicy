import { Link, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../src/constants/theme';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View style={styles.container}>
        <MaterialCommunityIcons name="file-question-outline" size={56} color={VoicyColors.secondaryText} />
        <Text variant="headlineSmall" style={styles.title}>Page not found</Text>
        <Link href="/" style={styles.link} accessibilityLabel="Go to home screen" accessibilityRole="link">
          <Text variant="bodyLarge" style={styles.linkText}>
            Go to home screen
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: VoicyColors.black,
  },
  title: {
    color: VoicyColors.white,
    marginTop: 16,
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    color: VoicyColors.aiGreen,
    textDecorationLine: 'underline',
  },
});
