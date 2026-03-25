import { useState, useRef, useCallback, useEffect } from 'react';
import * as recording from '../services/recording';
import type { Recording } from '../db/schema';

interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  metering: number;
}

export function useRecorder() {
  const [state, setState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    metering: -160,
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) + pausedDurationRef.current;
      setState((s) => ({ ...s, duration: elapsed }));
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(
    async (options?: { isMeeting?: boolean; language?: string }) => {
      await recording.startRecording({
        ...options,
        onRecordingStatusUpdate: (status) => {
          if (status.isRecording && status.metering !== undefined) {
            setState((s) => ({ ...s, metering: status.metering! }));
          }
        },
      });
      pausedDurationRef.current = 0;
      setState({ isRecording: true, isPaused: false, duration: 0, metering: -160 });
      startTimer();
    },
    [startTimer]
  );

  const pause = useCallback(async () => {
    await recording.pauseRecording();
    stopTimer();
    pausedDurationRef.current = state.duration;
    setState((s) => ({ ...s, isPaused: true }));
  }, [state.duration, stopTimer]);

  const resume = useCallback(async () => {
    await recording.resumeRecording();
    setState((s) => ({ ...s, isPaused: false }));
    startTimer();
  }, [startTimer]);

  const stop = useCallback(
    async (options?: { isMeeting?: boolean; language?: string }): Promise<Recording> => {
      stopTimer();
      const result = await recording.stopRecording(options);
      setState({ isRecording: false, isPaused: false, duration: 0, metering: -160 });
      return result;
    },
    [stopTimer]
  );

  const cancel = useCallback(async () => {
    stopTimer();
    await recording.cancelRecording();
    setState({ isRecording: false, isPaused: false, duration: 0, metering: -160 });
  }, [stopTimer]);

  useEffect(() => {
    return () => stopTimer();
  }, [stopTimer]);

  return {
    ...state,
    start,
    pause,
    resume,
    stop,
    cancel,
  };
}
