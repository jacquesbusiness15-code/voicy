import React, { useRef, useCallback } from 'react';
import { FlatList, StyleSheet } from 'react-native';
import { ChatBubble } from './ChatBubble';
import { TypingIndicator } from './TypingIndicator';
import type { ConversationMessage } from '../../db/schema';

interface Props {
  messages: ConversationMessage[];
  isProcessing: boolean;
  onSourcePress?: (recordingId: string, index: number) => void;
  ListHeaderComponent?: React.ReactElement | null;
  ListEmptyComponent?: React.ReactElement | null;
}

export function ChatMessageList({ messages, isProcessing, onSourcePress, ListHeaderComponent, ListEmptyComponent }: Props) {
  const flatListRef = useRef<FlatList>(null);

  const renderItem = useCallback(({ item }: { item: ConversationMessage }) => (
    <ChatBubble message={item} onSourcePress={onSourcePress} />
  ), [onSourcePress]);

  const keyExtractor = useCallback((item: ConversationMessage) => item.id, []);

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      contentContainerStyle={styles.list}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={isProcessing ? <TypingIndicator /> : null}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 8, flexGrow: 1 },
});
