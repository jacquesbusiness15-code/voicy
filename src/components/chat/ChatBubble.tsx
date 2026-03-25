import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInLeft, FadeInRight } from 'react-native-reanimated';
import Markdown from 'react-native-markdown-display';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../../constants/theme';
import { chatMarkdownStyles } from './chatMarkdownStyles';
import { BubbleAttachment } from './BubbleAttachment';
import type { ConversationMessage } from '../../db/schema';
import type { ChatAttachment } from '../../types/chat';

interface Props {
  message: ConversationMessage;
  onSourcePress?: (recordingId: string, index: number) => void;
  attachments?: ChatAttachment[];
}

export function ChatBubble({ message, onSourcePress, attachments }: Props) {
  const isUser = message.role === 'user';

  return (
    <Animated.View
      entering={isUser ? FadeInRight.duration(300) : FadeInLeft.duration(300)}
      style={[styles.bubble, isUser ? styles.userBubble : styles.aiBubble]}
    >
      <View style={[styles.bubbleInner, { backgroundColor: isUser ? VoicyColors.coral : VoicyColors.cardBg }]}>
        {attachments && attachments.length > 0 && (
          <View style={styles.attachments}>
            {attachments.map((att, i) => (
              <BubbleAttachment key={i} attachment={att} />
            ))}
          </View>
        )}
        {isUser ? (
          <Text style={styles.bubbleText}>{message.content}</Text>
        ) : (
          <Markdown style={chatMarkdownStyles}>{message.content}</Markdown>
        )}
      </View>

      {!isUser && message.sourceRecordingIds && onSourcePress && (
        <View style={styles.sources}>
          {JSON.parse(message.sourceRecordingIds).slice(0, 3).map((id: string, i: number) => (
            <Pressable key={id} onPress={() => onSourcePress(id, i)} style={styles.sourceBtn}>
              <MaterialCommunityIcons name="link-variant" size={12} color={VoicyColors.aiGreen} />
              <Text style={styles.sourceText}>Source {i + 1}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { marginBottom: 12, maxWidth: '82%' },
  userBubble: { alignSelf: 'flex-end' },
  aiBubble: { alignSelf: 'flex-start' },
  bubbleInner: { padding: 14, borderRadius: 20 },
  bubbleText: { fontSize: 15, lineHeight: 22, color: VoicyColors.white },
  attachments: { marginBottom: 8, gap: 6 },
  sources: { flexDirection: 'row', gap: 6, marginTop: 6 },
  sourceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: VoicyColors.inputBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sourceText: { color: VoicyColors.aiGreen, fontSize: 12 },
});
