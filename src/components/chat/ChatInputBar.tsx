import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { useAnimatedStyle, withTiming, interpolateColor, useSharedValue, withRepeat, withSequence } from 'react-native-reanimated';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../../constants/theme';
import { AttachmentPreview } from './AttachmentPreview';
import { AttachmentPicker } from './AttachmentPicker';
import type { PendingAttachment } from '../../types/chat';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  onSend: (attachments?: PendingAttachment[]) => void;
  isProcessing: boolean;
  disabled?: boolean;
  placeholder?: string;
  bottomInset: number;
  showAttach?: boolean;
  showMic?: boolean;
  isRecordingVoice?: boolean;
  isTranscribingVoice?: boolean;
  onMicPress?: () => void;
  onMicStop?: () => void;
  onMicCancel?: () => void;
  recordingDuration?: number;
}

export function ChatInputBar({
  value,
  onChangeText,
  onSend,
  isProcessing,
  disabled,
  placeholder = 'Type a message...',
  bottomInset,
  showAttach = true,
  showMic = true,
  isRecordingVoice = false,
  isTranscribingVoice = false,
  onMicPress,
  onMicStop,
  onMicCancel,
  recordingDuration = 0,
}: Props) {
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [pickerVisible, setPickerVisible] = useState(false);
  const hasText = value.trim().length > 0;
  const hasContent = hasText || pendingAttachments.length > 0;
  const canSend = hasContent && !isProcessing && !disabled;

  // Animated send button background
  const sendBgProgress = useSharedValue(0);
  React.useEffect(() => {
    sendBgProgress.value = withTiming(canSend ? 1 : 0, { duration: 200 });
  }, [canSend, sendBgProgress]);

  const sendAnimatedStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      sendBgProgress.value,
      [0, 1],
      [VoicyColors.inputBg, VoicyColors.white],
    ),
  }));

  // Pulsing red dot for recording
  const pulseOpacity = useSharedValue(1);
  React.useEffect(() => {
    if (isRecordingVoice) {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
      );
    } else {
      pulseOpacity.value = withTiming(1, { duration: 200 });
    }
  }, [isRecordingVoice, pulseOpacity]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const handleSend = () => {
    if (!canSend) return;
    onSend(pendingAttachments.length > 0 ? pendingAttachments : undefined);
    setPendingAttachments([]);
  };

  const handleRemoveAttachment = (index: number) => {
    setPendingAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickAttachments = (picked: PendingAttachment[]) => {
    setPendingAttachments((prev) => [...prev, ...picked]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.wrapper, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <AttachmentPreview attachments={pendingAttachments} onRemove={handleRemoveAttachment} />

      {isRecordingVoice ? (
        // Recording state UI
        <View style={styles.recordingRow}>
          <Pressable onPress={onMicCancel} style={styles.recordingCancelBtn}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={VoicyColors.error} />
          </Pressable>
          <View style={styles.recordingInfo}>
            <Animated.View style={[styles.recordingDot, pulseStyle]} />
            <Text style={styles.recordingTime}>{formatDuration(recordingDuration)}</Text>
          </View>
          <Pressable onPress={onMicStop} style={styles.recordingStopBtn}>
            <MaterialCommunityIcons name="stop" size={20} color={VoicyColors.white} />
          </Pressable>
        </View>
      ) : isTranscribingVoice ? (
        <View style={styles.recordingRow}>
          <Text style={styles.transcribingText}>Transcribing...</Text>
        </View>
      ) : (
        // Normal input UI
        <View style={styles.inputRow}>
          {showAttach && (
            <Pressable onPress={() => setPickerVisible(true)} style={styles.attachBtn}>
              <MaterialCommunityIcons name="plus" size={22} color={VoicyColors.secondaryText} />
            </Pressable>
          )}

          <View style={styles.inputContainer}>
            <TextInput
              value={value}
              onChangeText={onChangeText}
              placeholder={placeholder}
              placeholderTextColor={VoicyColors.secondaryText}
              style={styles.input}
              multiline
              maxLength={2000}
              onSubmitEditing={handleSend}
            />

            {!hasText && showMic && onMicPress ? (
              <Pressable onPress={onMicPress} style={styles.micBtn}>
                <MaterialCommunityIcons name="microphone-outline" size={20} color={VoicyColors.secondaryText} />
              </Pressable>
            ) : (
              <AnimatedPressable
                onPress={handleSend}
                disabled={!canSend}
                style={[styles.sendBtn, sendAnimatedStyle]}
              >
                <MaterialCommunityIcons
                  name="arrow-up"
                  size={18}
                  color={canSend ? VoicyColors.black : VoicyColors.secondaryText}
                />
              </AnimatedPressable>
            )}
          </View>
        </View>
      )}

      <AttachmentPicker
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        onPick={handlePickAttachments}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, paddingTop: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  attachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: VoicyColors.inputBg,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    color: VoicyColors.white,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  micBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  // Recording state
  recordingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: VoicyColors.inputBg,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 12,
  },
  recordingCancelBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,69,58,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: VoicyColors.error,
  },
  recordingTime: { color: VoicyColors.white, fontSize: 15, fontWeight: '500' },
  recordingStopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.coral,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transcribingText: { color: VoicyColors.secondaryText, fontSize: 15, textAlign: 'center', flex: 1, paddingVertical: 8 },
});
