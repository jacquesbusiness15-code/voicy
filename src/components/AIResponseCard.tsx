import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, useTheme, Button, ActivityIndicator, IconButton } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';

interface Props {
  content?: string;
  type: string;
  isLoading?: boolean;
  onGenerate?: () => void;
  onRegenerate?: () => void;
  icon: string;
  emptyText: string;
  generateLabel: string;
}

export function AIResponseCard({
  content,
  type,
  isLoading,
  onGenerate,
  onRegenerate,
  icon,
  emptyText,
  generateLabel,
}: Props) {
  const theme = useTheme();

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
        <Text variant="bodyMedium" style={{ marginTop: 16, color: theme.colors.onSurfaceVariant }}>
          Generating...
        </Text>
      </View>
    );
  }

  if (!content) {
    return (
      <View style={styles.centered}>
        <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant, marginBottom: 16 }}>
          {emptyText}
        </Text>
        {onGenerate && (
          <Button mode="contained" onPress={onGenerate} icon={icon}>
            {generateLabel}
          </Button>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <IconButton
          icon="content-copy"
          size={20}
          onPress={async () => {
            if (content) await Clipboard.setStringAsync(content);
          }}
        />
        {onRegenerate && (
          <IconButton icon="refresh" size={20} onPress={onRegenerate} />
        )}
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <Text variant="bodyMedium" style={{ lineHeight: 24 }}>
          {content}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingTop: 0,
  },
});
