import { useState, useRef, useCallback, useEffect } from 'react';
import { Audio, AVPlaybackStatus } from 'expo-av';

interface PlayerState {
  isPlaying: boolean;
  isLoaded: boolean;
  duration: number;
  position: number;
  playbackSpeed: number;
}

export function usePlayer() {
  const [state, setState] = useState<PlayerState>({
    isPlaying: false,
    isLoaded: false,
    duration: 0,
    position: 0,
    playbackSpeed: 1.0,
  });
  const soundRef = useRef<Audio.Sound | null>(null);

  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    setState((s) => ({
      ...s,
      isPlaying: status.isPlaying,
      isLoaded: true,
      duration: (status.durationMillis ?? 0) / 1000,
      position: (status.positionMillis ?? 0) / 1000,
    }));
    if (status.didJustFinish) {
      setState((s) => ({ ...s, isPlaying: false, position: 0 }));
    }
  }, []);

  const load = useCallback(
    async (uri: string) => {
      // Clean up existing sound
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: false },
        onPlaybackStatusUpdate
      );
      soundRef.current = sound;

      const status = await sound.getStatusAsync();
      if (status.isLoaded) {
        setState((s) => ({
          ...s,
          isLoaded: true,
          duration: (status.durationMillis ?? 0) / 1000,
          position: 0,
        }));
      }
    },
    [onPlaybackStatusUpdate]
  );

  const play = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.playAsync();
  }, []);

  const pause = useCallback(async () => {
    if (!soundRef.current) return;
    await soundRef.current.pauseAsync();
  }, []);

  const seekTo = useCallback(async (positionSeconds: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(positionSeconds * 1000);
    setState((s) => ({ ...s, position: positionSeconds }));
  }, []);

  const skipForward = useCallback(
    async (seconds: number = 15) => {
      const newPos = Math.min(state.position + seconds, state.duration);
      await seekTo(newPos);
    },
    [state.position, state.duration, seekTo]
  );

  const skipBackward = useCallback(
    async (seconds: number = 15) => {
      const newPos = Math.max(state.position - seconds, 0);
      await seekTo(newPos);
    },
    [state.position, seekTo]
  );

  const setSpeed = useCallback(async (speed: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setRateAsync(speed, true);
    setState((s) => ({ ...s, playbackSpeed: speed }));
  }, []);

  const unload = useCallback(async () => {
    if (soundRef.current) {
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
    setState({
      isPlaying: false,
      isLoaded: false,
      duration: 0,
      position: 0,
      playbackSpeed: 1.0,
    });
  }, []);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  return {
    ...state,
    load,
    play,
    pause,
    seekTo,
    skipForward,
    skipBackward,
    setSpeed,
    unload,
  };
}
