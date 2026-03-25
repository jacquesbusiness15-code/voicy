import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { useTheme } from 'react-native-paper';

interface Props {
  isActive: boolean;
  metering?: number;
  barCount?: number;
  height?: number;
}

function normalizeDb(db: number): number {
  const clamped = Math.max(-60, Math.min(0, db));
  return (clamped + 60) / 60;
}

function WaveBar({ index, isActive, metering, maxHeight }: {
  index: number;
  isActive: boolean;
  metering: number;
  maxHeight: number;
}) {
  const theme = useTheme();
  const height = useSharedValue(4);

  // Each bar has a unique base amplitude offset for organic variation
  const barSeed = useMemo(() => 0.3 + (Math.sin(index * 2.39) * 0.5 + 0.5) * 0.7, [index]);
  const barSpeed = useMemo(() => 250 + (Math.cos(index * 1.73) * 0.5 + 0.5) * 200, [index]);

  useEffect(() => {
    if (isActive) {
      const level = normalizeDb(metering);
      // Scale bar height by real audio level, with per-bar variation for organic look
      const targetMax = Math.max(6, level * barSeed * maxHeight);
      const targetMin = Math.max(4, targetMax * 0.3);

      height.value = withRepeat(
        withSequence(
          withTiming(targetMax, { duration: barSpeed, easing: Easing.inOut(Easing.sin) }),
          withTiming(targetMin, { duration: barSpeed, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        true
      );
    } else {
      height.value = withTiming(4, { duration: 300 });
    }
  }, [isActive, metering, maxHeight, barSeed, barSpeed, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bar,
        { backgroundColor: isActive ? theme.colors.primary : theme.colors.outline },
        animatedStyle,
      ]}
    />
  );
}

export function AudioWaveform({ isActive, metering = -160, barCount = 30, height = 80 }: Props) {
  return (
    <View style={[styles.container, { height }]}>
      {Array.from({ length: barCount }, (_, i) => (
        <WaveBar key={i} index={i} isActive={isActive} metering={metering} maxHeight={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  bar: {
    width: 3,
    borderRadius: 1.5,
    minHeight: 3,
  },
});
