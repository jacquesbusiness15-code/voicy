import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { formatDuration } from '../utils/time';
import Slider from '@react-native-community/slider';

interface Props {
  isPlaying: boolean;
  duration: number;
  position: number;
  playbackSpeed: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (position: number) => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0];

export function AudioPlayer({
  isPlaying,
  duration,
  position,
  playbackSpeed,
  onPlay,
  onPause,
  onSeek,
  onSkipForward,
  onSkipBackward,
  onSpeedChange,
}: Props) {
  const theme = useTheme();

  const nextSpeed = () => {
    const idx = SPEEDS.indexOf(playbackSpeed);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    onSpeedChange(next);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.surface }]}>
      {/* Progress bar */}
      <Slider
        style={styles.slider}
        minimumValue={0}
        maximumValue={duration || 1}
        value={position}
        onSlidingComplete={onSeek}
        minimumTrackTintColor={theme.colors.primary}
        maximumTrackTintColor={theme.colors.surfaceVariant}
        thumbTintColor={theme.colors.primary}
      />
      <View style={styles.timeRow}>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {formatDuration(position)}
        </Text>
        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
          -{formatDuration(Math.max(0, duration - position))}
        </Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Speed pill */}
        <Pressable
          onPress={nextSpeed}
          style={[styles.speedPill, { backgroundColor: theme.colors.surfaceVariant }]}
          accessibilityLabel={`Playback speed ${playbackSpeed}x`}
          accessibilityRole="button"
        >
          <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant, fontWeight: '600' }}>
            {playbackSpeed}x
          </Text>
        </Pressable>

        <Pressable onPress={onSkipBackward} style={styles.skipButton} accessibilityLabel="Skip back 15 seconds" accessibilityRole="button">
          <MaterialCommunityIcons name="rewind-15" size={26} color={theme.colors.onSurface} />
        </Pressable>

        <Pressable
          onPress={isPlaying ? onPause : onPlay}
          style={[styles.playButton, { backgroundColor: theme.colors.primary }]}
          accessibilityLabel={isPlaying ? 'Pause' : 'Play'}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={isPlaying ? 'pause' : 'play'}
            size={28}
            color={theme.colors.onPrimary}
          />
        </Pressable>

        <Pressable onPress={onSkipForward} style={styles.skipButton} accessibilityLabel="Skip forward 15 seconds" accessibilityRole="button">
          <MaterialCommunityIcons name="fast-forward-15" size={26} color={theme.colors.onSurface} />
        </Pressable>

        {/* Spacer to balance speed pill */}
        <View style={styles.speedPill}>
          <Text variant="labelSmall" style={{ opacity: 0 }}>
            {playbackSpeed}x
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  slider: {
    width: '100%',
    height: 32,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
    marginTop: -4,
    marginBottom: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  skipButton: {
    padding: 4,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 40,
    alignItems: 'center',
  },
});
