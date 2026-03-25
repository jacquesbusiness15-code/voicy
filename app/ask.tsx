import React, { useState, useCallback, useEffect } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';
import { useAIStore } from '../src/stores/aiStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { askAI } from '../src/services/askAI';
import { ChatMessageList } from '../src/components/chat/ChatMessageList';
import { ChatInputBar } from '../src/components/chat/ChatInputBar';
import { useChatVoiceInput } from '../src/hooks/useChatVoiceInput';
import { useToastStore } from '../src/stores/toastStore';
import { useNetworkStore } from '../src/stores/networkStore';

const SUGGESTIONS = [
  'What did I talk about this week?',
  'Summarize my recent meetings',
  'What are my open action items?',
  'What ideas have I mentioned?',
];

export default function AskAIScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentConversation, messages, isProcessing, createConversation, addMessage, setProcessing, loadConversations } = useAIStore();
  const { aiProvider, openaiApiKey, anthropicApiKey } = useSettingsStore();
  const [inputText, setInputText] = useState('');
  const voice = useChatVoiceInput();
  const toast = useToastStore();
  const { isConnected, isInternetReachable } = useNetworkStore();

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const hasApiKey = openaiApiKey || anthropicApiKey;

  const handleSend = useCallback(async (text?: string) => {
    const question = text ?? inputText.trim();
    if (!question) return;
    if (!isConnected || isInternetReachable === false) {
      toast.show('No internet connection', 'error');
      return;
    }
    setInputText('');
    try {
      let convId = currentConversation?.id;
      if (!convId) { const conv = await createConversation(question.substring(0, 50)); convId = conv.id; }
      await addMessage('user', question);
      setProcessing(true);
      const { answer, sourceRecordingIds } = await askAI(question, convId, { provider: aiProvider, apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey } });
      await addMessage('assistant', answer, sourceRecordingIds);
    } catch (e: any) {
      await addMessage('assistant', `Error: ${e.message || 'Failed. Check API keys in Settings.'}`);
    } finally { setProcessing(false); }
  }, [inputText, currentConversation, createConversation, addMessage, setProcessing, aiProvider, openaiApiKey, anthropicApiKey]);

  const handleMicPress = useCallback(async () => {
    try {
      await voice.startRecording();
    } catch (e: any) {
      toast.show(e.message, 'error');
    }
  }, [voice]);

  const handleMicStop = useCallback(async () => {
    try {
      const text = await voice.stopRecording();
      if (text) setInputText((prev) => (prev ? prev + ' ' + text : text));
    } catch (e: any) {
      toast.show(e.message, 'error');
    }
  }, [voice]);

  const handleSourcePress = useCallback((recordingId: string) => {
    router.push(`/recording/${recordingId}`);
  }, [router]);

  const emptyState = (
    <View style={styles.emptyState}>
      <Text style={styles.emptyTitle}>Ask anything about your notes</Text>
      <Text style={styles.emptySubtitle}>AI searches across all recordings</Text>
      {!hasApiKey && <Text style={[styles.emptySubtitle, { color: VoicyColors.error }]}>Add an API key in Settings first</Text>}
      <View style={styles.suggestionsGrid}>
        {SUGGESTIONS.map((s) => (
          <Pressable key={s} onPress={() => hasApiKey && handleSend(s)} style={[styles.suggestionCard, !hasApiKey && { opacity: 0.5 }]}>
            <Text style={styles.suggestionText}>{s}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Ask AI</Text>
        <Pressable style={styles.headerIcon} onPress={async () => { await createConversation(); }}>
          <MaterialCommunityIcons name="message-plus" size={20} color={VoicyColors.white} />
        </Pressable>
      </View>

      {messages.length === 0 ? emptyState : (
        <ChatMessageList
          messages={messages}
          isProcessing={isProcessing}
          onSourcePress={handleSourcePress}
        />
      )}

      <ChatInputBar
        value={inputText}
        onChangeText={setInputText}
        onSend={() => handleSend()}
        isProcessing={isProcessing}
        disabled={!hasApiKey}
        placeholder="Ask about your notes..."
        bottomInset={insets.bottom}
        showMic={!!openaiApiKey}
        isRecordingVoice={voice.isRecording}
        isTranscribingVoice={voice.isTranscribing}
        onMicPress={handleMicPress}
        onMicStop={handleMicStop}
        onMicCancel={voice.cancelRecording}
        recordingDuration={voice.duration}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  headerIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: VoicyColors.white, fontSize: 18, fontWeight: '600' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyTitle: { color: VoicyColors.white, fontSize: 20, fontWeight: '600', marginBottom: 8 },
  emptySubtitle: { color: VoicyColors.secondaryText, fontSize: 14, marginBottom: 4 },
  suggestionsGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 24, maxWidth: 340 },
  suggestionCard: { backgroundColor: VoicyColors.cardBg, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 16, width: '47%' },
  suggestionText: { color: VoicyColors.white, fontSize: 13 },
});
