import { useState, useRef, useCallback, useEffect } from 'react';

let Speech: typeof import('expo-speech') | null = null;
try {
  Speech = require('expo-speech');
} catch {
  // Native module not available (e.g. Expo Go)
}

interface TTSState {
  isPlaying: boolean;
  duration: number;
  position: number;
  playbackSpeed: number;
}

// Rough estimate: ~150 words per minute at 1x speed
const WORDS_PER_SECOND = 2.5;

export function useTTS() {
  const [state, setState] = useState<TTSState>({
    isPlaying: false,
    duration: 0,
    position: 0,
    playbackSpeed: 1.0,
  });
  const textRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const pausedPositionRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const estimateDuration = useCallback((text: string, speed: number) => {
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    return wordCount / (WORDS_PER_SECOND * speed);
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = (Date.now() - startTimeRef.current) / 1000;
      const pos = pausedPositionRef.current + elapsed;
      setState((s) => {
        if (pos >= s.duration) {
          return { ...s, position: s.duration, isPlaying: false };
        }
        return { ...s, position: pos };
      });
    }, 250);
  }, [clearTimer]);

  const load = useCallback((text: string) => {
    Speech?.stop();
    clearTimer();
    textRef.current = text;
    pausedPositionRef.current = 0;
    const dur = estimateDuration(text, 1.0);
    setState({
      isPlaying: false,
      duration: dur,
      position: 0,
      playbackSpeed: 1.0,
    });
  }, [clearTimer, estimateDuration]);

  const play = useCallback(() => {
    if (!textRef.current) return;
    Speech?.stop();
    setState((s) => ({ ...s, isPlaying: true }));
    startTimer();
    Speech?.speak(textRef.current, {
      rate: state.playbackSpeed,
      onDone: () => {
        clearTimer();
        pausedPositionRef.current = 0;
        setState((s) => ({ ...s, isPlaying: false, position: 0 }));
      },
      onStopped: () => {
        clearTimer();
        setState((s) => ({ ...s, isPlaying: false }));
      },
    });
  }, [state.playbackSpeed, startTimer, clearTimer]);

  const pause = useCallback(() => {
    Speech?.stop();
    clearTimer();
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    pausedPositionRef.current += elapsed;
    setState((s) => ({ ...s, isPlaying: false, position: pausedPositionRef.current }));
  }, [clearTimer]);

  const seekTo = useCallback((positionSeconds: number) => {
    // TTS doesn't support seeking, so we just update the position tracker
    pausedPositionRef.current = positionSeconds;
    setState((s) => ({ ...s, position: positionSeconds }));
    if (state.isPlaying) {
      // Restart speech from beginning (TTS limitation)
      Speech?.stop();
      clearTimer();
      startTimer();
      Speech?.speak(textRef.current, {
        rate: state.playbackSpeed,
        onDone: () => {
          clearTimer();
          pausedPositionRef.current = 0;
          setState((s) => ({ ...s, isPlaying: false, position: 0 }));
        },
        onStopped: () => {
          clearTimer();
          setState((s) => ({ ...s, isPlaying: false }));
        },
      });
    }
  }, [state.isPlaying, state.playbackSpeed, clearTimer, startTimer]);

  const skipForward = useCallback((seconds: number = 15) => {
    seekTo(Math.min(state.position + seconds, state.duration));
  }, [state.position, state.duration, seekTo]);

  const skipBackward = useCallback((seconds: number = 15) => {
    seekTo(Math.max(state.position - seconds, 0));
  }, [state.position, seekTo]);

  const setSpeed = useCallback((speed: number) => {
    const newDuration = estimateDuration(textRef.current, speed);
    // Scale position proportionally
    const ratio = state.position / (state.duration || 1);
    const newPosition = ratio * newDuration;
    pausedPositionRef.current = newPosition;
    setState((s) => ({ ...s, playbackSpeed: speed, duration: newDuration, position: newPosition }));
    if (state.isPlaying) {
      Speech?.stop();
      clearTimer();
      startTimer();
      Speech?.speak(textRef.current, {
        rate: speed,
        onDone: () => {
          clearTimer();
          pausedPositionRef.current = 0;
          setState((s) => ({ ...s, isPlaying: false, position: 0 }));
        },
        onStopped: () => {
          clearTimer();
          setState((s) => ({ ...s, isPlaying: false }));
        },
      });
    }
  }, [state.isPlaying, state.position, state.duration, estimateDuration, clearTimer, startTimer]);

  const unload = useCallback(() => {
    Speech?.stop();
    clearTimer();
    textRef.current = '';
    pausedPositionRef.current = 0;
    setState({ isPlaying: false, duration: 0, position: 0, playbackSpeed: 1.0 });
  }, [clearTimer]);

  useEffect(() => {
    return () => {
      Speech?.stop();
      clearTimer();
    };
  }, [clearTimer]);

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
