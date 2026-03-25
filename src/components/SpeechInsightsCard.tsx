import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { SpeechInsights } from '../services/speechInsights';

interface Props {
  insights: SpeechInsights;
}

function InsightTile({ icon, label, value, theme }: {
  icon: string;
  label: string;
  value: string;
  theme: any;
}) {
  return (
    <View style={[styles.tile, { backgroundColor: theme.colors.surfaceVariant }]}>
      <MaterialCommunityIcons name={icon as any} size={20} color={theme.colors.primary} />
      <Text variant="titleLarge" style={[styles.tileValue, { color: theme.colors.onSurface }]}>
        {value}
      </Text>
      <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
        {label}
      </Text>
    </View>
  );
}

export function SpeechInsightsCard({ insights }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        <InsightTile
          icon="text-short"
          label="Words"
          value={insights.wordCount.toLocaleString()}
          theme={theme}
        />
        <InsightTile
          icon="speedometer"
          label="WPM"
          value={insights.speakingPaceWPM.toString()}
          theme={theme}
        />
        <InsightTile
          icon="clock-outline"
          label="Read time"
          value={`${insights.readingTimeMinutes}m`}
          theme={theme}
        />
        <InsightTile
          icon="format-list-numbered"
          label="Sentences"
          value={insights.sentenceCount.toString()}
          theme={theme}
        />
        <InsightTile
          icon="alphabetical-variant"
          label="Unique words"
          value={insights.uniqueWords.toLocaleString()}
          theme={theme}
        />
        <InsightTile
          icon="counter"
          label="Characters"
          value={insights.characterCount.toLocaleString()}
          theme={theme}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  tile: {
    width: '47%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: {
    fontWeight: '700',
    fontSize: 24,
  },
});
