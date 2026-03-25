import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, StyleSheet, ScrollView, Alert, Pressable, FlatList, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useToastStore } from '../../src/stores/toastStore';
import { useNetworkStore } from '../../src/stores/networkStore';
import { Text, Menu, Portal, Dialog, Button, ActivityIndicator } from 'react-native-paper';
import { ChatMessageList } from '../../src/components/chat/ChatMessageList';
import { ChatInputBar } from '../../src/components/chat/ChatInputBar';
import { useChatVoiceInput } from '../../src/hooks/useChatVoiceInput';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { usePlayer } from '../../src/hooks/usePlayer';
import { useTTS } from '../../src/hooks/useTTS';
import { AudioPlayer } from '../../src/components/AudioPlayer';
import { LoadingOverlay } from '../../src/components/LoadingOverlay';
import { useRecordingStore } from '../../src/stores/recordingStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { transcribeRecording } from '../../src/services/transcription';
import { generateAIOutput, type OutputType } from '../../src/services/summarization';
import { exportRecording, exportTranscript, exportAllData } from '../../src/services/importExport';
import { shareToWhatsApp } from '../../src/services/whatsapp';
import { translateTranscript } from '../../src/services/translation';
import { diarizeTranscript, formatTranscript } from '../../src/services/transcription';
import Markdown from 'react-native-markdown-display';
import { LANGUAGES, getLanguageName } from '../../src/constants/languages';
import { createAIOutput, getConversationForRecording, createConversation, addMessage, getMessages } from '../../src/db/queries';
import { askAboutNote } from '../../src/services/askAI';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths, Directory } from 'expo-file-system';
import { TagPickerModal } from '../../src/components/TagPickerModal';
import { VoicyColors } from '../../src/constants/theme';
import { formatDuration } from '../../src/utils/time';
import { generateTTSAudio } from '../../src/services/tts';
import { getRelatedNotes } from '../../src/services/relatedNotes';
import { getTranscriptByRecordingId, updateTranscriptContent, createAttachment, getAttachmentsForRecording, deleteAttachment } from '../../src/db/queries';
import type { Attachment, ConversationMessage } from '../../src/db/schema';
import { format, parseISO } from 'date-fns';

type TabKey = 'transcript' | 'creation' | 'chat';

const SPEAKER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8', '#B19CD9', '#FF6F91', '#88D8B0', '#C9B1FF'];

const markdownStyles = StyleSheet.create({
  body: { color: VoicyColors.white, fontSize: 17, lineHeight: 28 },
  strong: { color: VoicyColors.white, fontWeight: 'normal' as const },
  em: { color: VoicyColors.white, fontStyle: 'normal' as const },
  blockquote: { borderLeftWidth: 0, paddingLeft: 0, backgroundColor: 'transparent', borderRadius: 0, paddingVertical: 0, marginVertical: 0 },
  paragraph: { marginBottom: 12 },
  link: { color: VoicyColors.aiGreen },
});

function stripMarkdown(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
}

function renderTranscriptContent(content: string) {
  // Match voice labels with optional timestamp and markdown wrapping
  // e.g. "Voice 1:", "Voice 1 (0:32):", "**Voice 1 (1:05):**", "John:"
  const voicePattern = /^(?:\*\*|__)?(?:Voice \d+|[A-ZÀ-ÖØ-Þ\u00C0-\u024F][\w\u00C0-\u024F'-]+(?:[-\s][A-ZÀ-ÖØ-Þa-zà-öø-ÿ\u00C0-\u024F][\w\u00C0-\u024F'-]*)*)(?:\s*\(\d+:\d{2}\))?(?:\*\*|__)?:\s/;
  const lines = content.split('\n');
  const hasVoices = lines.some((l) => voicePattern.test(l.trim()));

  if (!hasVoices) {
    return <Markdown style={markdownStyles}>{content}</Markdown>;
  }

  // Group consecutive lines by speaker
  const speakerMap: Record<string, number> = {};
  let nextIndex = 0;
  const segments: { speaker: string; timestamp: string; text: string }[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Match speaker label with optional timestamp and markdown markers
    // Captures: (1) speaker name, (2) optional timestamp like "0:32", (3) spoken text
    const match = trimmed.match(/^(?:\*\*|__)?(.+?)(?:\s*\((\d+:\d{2})\))?(?:\*\*|__)?:\s(.+)/);
    if (match && voicePattern.test(trimmed)) {
      const speaker = stripMarkdown(match[1]).trim();
      const timestamp = match[2] ?? '';
      const text = match[3];
      const last = segments[segments.length - 1];
      if (last && last.speaker === speaker && !timestamp) {
        // Continuation of same speaker without new timestamp — merge
        last.text += '\n' + text;
      } else {
        segments.push({ speaker, timestamp, text });
      }
    } else if (segments.length > 0) {
      // Continuation of previous speaker
      segments[segments.length - 1].text += '\n' + trimmed;
    } else {
      segments.push({ speaker: '', timestamp: '', text: trimmed });
    }
  }

  return segments.map((seg, i) => {
    if (!seg.speaker) {
      return <Markdown key={i} style={markdownStyles}>{seg.text}</Markdown>;
    }
    if (!(seg.speaker in speakerMap)) {
      speakerMap[seg.speaker] = nextIndex++;
    }
    const color = SPEAKER_COLORS[speakerMap[seg.speaker] % SPEAKER_COLORS.length];
    return (
      <View key={i} style={transcriptStyles.speakerLine}>
        <View style={transcriptStyles.speakerHeader}>
          <Text style={[transcriptStyles.speakerLabel, { color }]}>{seg.speaker}</Text>
          {seg.timestamp ? <Text style={transcriptStyles.timestamp}>{seg.timestamp}</Text> : null}
        </View>
        <Markdown style={markdownStyles}>{seg.text}</Markdown>
      </View>
    );
  });
}

const transcriptStyles = StyleSheet.create({
  speakerLine: { marginBottom: 14 },
  speakerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  speakerLabel: { fontSize: 13, fontWeight: '700' },
  timestamp: { fontSize: 12, color: VoicyColors.secondaryText },
});

const CREATE_ITEMS: { key: OutputType; label: string; icon: string }[] = [
  { key: 'summary', label: 'Summary', icon: 'text-box-check' },
  { key: 'meeting_report', label: 'Meeting report', icon: 'file-document' },
  { key: 'bullet_points', label: 'Main points', icon: 'format-list-bulleted' },
  { key: 'todo', label: 'To-do list', icon: 'checkbox-marked' },
  { key: 'translate', label: 'Translate', icon: 'translate' },
  { key: 'tweet', label: 'Tweet', icon: 'send' },
  { key: 'blog_post', label: 'Blog post', icon: 'pencil' },
  { key: 'email_draft', label: 'Email', icon: 'email-outline' },
  { key: 'cleanup', label: 'Cleanup', icon: 'broom' },
];

export default function RecordingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToastStore();
  const { isConnected, isInternetReachable } = useNetworkStore();
  const isOffline = !isConnected || isInternetReachable === false;
  const player = usePlayer();
  const tts = useTTS();
  const {
    currentRecording,
    currentTranscript,
    currentTags,
    currentAIOutputs,
    isLoading,
    loadRecordingDetail,
    toggleFavorite,
    deleteRecording,
  } = useRecordingStore();
  const { aiProvider, openaiApiKey, anthropicApiKey, deeplApiKey, assemblyaiApiKey, transcriptionModel } = useSettingsStore();

  const [activeTab, setActiveTab] = useState<TabKey>('transcript');
  const [mainMenuVisible, setMainMenuVisible] = useState(false);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingLabel, setGeneratingLabel] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [showPlayer, setShowPlayer] = useState(false);
  const [exportDialogVisible, setExportDialogVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [tagPickerVisible, setTagPickerVisible] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [relatedNotes, setRelatedNotes] = useState<{ recordingId: string; title: string; date: string; preview: string }[]>([]);
  const [showTranslateDialog, setShowTranslateDialog] = useState(false);
  const [languageSearch, setLanguageSearch] = useState('');
  const [noteConversationId, setNoteConversationId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ConversationMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatProcessing, setIsChatProcessing] = useState(false);
  const [isGeneratingTTS, setIsGeneratingTTS] = useState(false);
  const chatListRef = useRef<FlatList>(null);
  const chatVoice = useChatVoiceInput();

  useEffect(() => {
    if (id) {
      loadRecordingDetail(id);
      getAttachmentsForRecording(id).then(setAttachments).catch(() => {});

      // Periodic refresh to pick up background AI outputs (tags, bullets, diarization, formatting)
      // Refresh every 5s for the first 30s after opening, then stop
      let count = 0;
      const interval = setInterval(() => {
        count++;
        loadRecordingDetail(id);
        if (count >= 6) clearInterval(interval);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [id, loadRecordingDetail]);

  useEffect(() => {
    if (!id) return;
    getRelatedNotes(id, 3).then(async (notes) => {
      const enriched = await Promise.all(
        notes.map(async (n) => {
          const transcript = await getTranscriptByRecordingId(n.recordingId);
          const rec = await import('../../src/db/queries').then((q) => q.getRecordingById(n.recordingId));
          return {
            recordingId: n.recordingId,
            title: n.title,
            date: rec ? format(parseISO(rec.createdAt), 'd MMMM') : '',
            preview: transcript ? transcript.content.substring(0, 120) : '',
          };
        })
      );
      setRelatedNotes(enriched.filter((n) => n.preview));
    }).catch(() => {});
  }, [id]);

  // Load existing note conversation
  useEffect(() => {
    if (!id) return;
    getConversationForRecording(id).then(async (conv) => {
      if (conv) {
        setNoteConversationId(conv.id);
        const msgs = await getMessages(conv.id);
        setChatMessages(msgs);
      }
    }).catch(() => {});
  }, [id]);

  const isTextOnly = currentRecording?.filePath === 'text-only' || currentRecording?.format === 'text';

  useEffect(() => {
    if (currentRecording?.filePath && !isTextOnly) {
      player.load(currentRecording.filePath);
    }
    return () => { void player.unload(); };
  }, [currentRecording?.filePath, isTextOnly]);

  useEffect(() => {
    if (isTextOnly && currentTranscript?.content) {
      tts.load(currentTranscript.content);
    }
    return () => { tts.unload(); };
  }, [isTextOnly, currentTranscript?.content]);

  const apiKeys = { openai: openaiApiKey, anthropic: anthropicApiKey };

  const handleTranscribe = useCallback(async () => {
    if (!currentRecording) return;
    if (isOffline) { toast.show('No internet connection', 'error'); return; }
    setIsTranscribing(true);
    try {
      const engine = assemblyaiApiKey ? 'assemblyai' : (openaiApiKey ? 'openai' : 'whisper-local');
      await transcribeRecording(currentRecording.id, currentRecording.filePath, {
        engine,
        apiKey: openaiApiKey,
        assemblyaiApiKey,
        transcriptionModel,
        aiProvider,
        apiKeys,
        speakersExpected: currentRecording.isMeeting ? 2 : undefined,
      });
      await loadRecordingDetail(currentRecording.id);
    } catch (e: any) {
      toast.show(e.message, 'error');
    } finally {
      setIsTranscribing(false);
    }
  }, [currentRecording, openaiApiKey, assemblyaiApiKey, transcriptionModel, loadRecordingDetail]);

  const handleCreate = useCallback(async (type: OutputType) => {
    if (!currentRecording || isGenerating) return;
    if (isOffline) { toast.show('No internet connection', 'error'); return; }
    setCreateMenuVisible(false);
    setGeneratingLabel(`Creating a ${type.replace('_', ' ')} from your note`);
    setIsGenerating(true);
    try {
      await generateAIOutput(currentRecording.id, type, { provider: aiProvider, apiKeys });
      await loadRecordingDetail(currentRecording.id);
      // Navigate to the output view
      router.push({ pathname: '/ai-output', params: { recordingId: currentRecording.id, outputType: type } });
    } catch (e: any) {
      toast.show(e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [currentRecording, aiProvider, apiKeys, loadRecordingDetail, router]);

  const handleTranslate = useCallback(async (targetLangCode: string) => {
    if (!currentRecording || !currentTranscript) return;
    if (isOffline) { toast.show('No internet connection', 'error'); return; }
    setShowTranslateDialog(false);
    const langName = getLanguageName(targetLangCode);
    setGeneratingLabel(`Translating to ${langName}`);
    setIsGenerating(true);
    try {
      const engine = deeplApiKey ? 'deepl' : 'openai';
      const apiKey = deeplApiKey || openaiApiKey;
      if (!apiKey) throw new Error('No translation API key configured. Add a DeepL or OpenAI key in Settings.');
      const translated = await translateTranscript(currentTranscript.id, targetLangCode, { engine, apiKey });
      // Save as AI output so it shows in Creation tab
      await createAIOutput({
        recordingId: currentRecording.id,
        type: 'translate',
        content: `Translation (${langName}):\n\n${translated}`,
        engine,
      });
      await loadRecordingDetail(currentRecording.id);
      router.push({ pathname: '/ai-output', params: { recordingId: currentRecording.id, outputType: 'translate' } });
    } catch (e: any) {
      toast.show(e.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  }, [currentRecording, currentTranscript, deeplApiKey, openaiApiKey, loadRecordingDetail, router]);

  const handleChatSend = useCallback(async () => {
    const question = chatInput.trim();
    if (!question || !currentRecording) return;
    if (isOffline) { toast.show('No internet connection', 'error'); return; }
    setChatInput('');
    try {
      let convId = noteConversationId;
      if (!convId) {
        const conv = await createConversation(
          `Chat: ${currentRecording.title ?? 'Untitled'}`,
          currentRecording.id
        );
        convId = conv.id;
        setNoteConversationId(convId);
      }
      const userMsg = await addMessage({ conversationId: convId, role: 'user', content: question });
      setChatMessages((prev) => [...prev, userMsg]);
      setIsChatProcessing(true);
      const { answer } = await askAboutNote(question, currentRecording.id, convId, {
        provider: aiProvider,
        apiKeys,
      });
      const aiMsg = await addMessage({ conversationId: convId, role: 'assistant', content: answer });
      setChatMessages((prev) => [...prev, aiMsg]);
    } catch (e: any) {
      if (noteConversationId) {
        const errMsg = await addMessage({ conversationId: noteConversationId, role: 'assistant', content: `Error: ${e.message}` });
        setChatMessages((prev) => [...prev, errMsg]);
      }
    } finally {
      setIsChatProcessing(false);
    }
  }, [chatInput, currentRecording, noteConversationId, aiProvider, apiKeys]);

  const handleGenerateAudio = useCallback(async () => {
    if (!currentRecording || !currentTranscript) return;
    if (isOffline) { toast.show('No internet connection', 'error'); return; }
    setIsGeneratingTTS(true);
    try {
      const filePath = await generateTTSAudio(currentRecording.id, currentTranscript.content, {
        apiKey: openaiApiKey,
      });
      await loadRecordingDetail(currentRecording.id);
      // Load the new audio file into the player
      player.load(filePath);
    } catch (e: any) {
      toast.show(e.message, 'error');
    } finally {
      setIsGeneratingTTS(false);
    }
  }, [currentRecording, currentTranscript, openaiApiKey, loadRecordingDetail, player]);

  const handleCopyTranscript = useCallback(async () => {
    if (currentTranscript) {
      await Clipboard.setStringAsync(currentTranscript.content);
    }
    setMainMenuVisible(false);
  }, [currentTranscript]);

  const handleDelete = useCallback(async () => {
    if (!currentRecording) return;
    await deleteRecording(currentRecording.id);
    router.canGoBack() ? router.back() : router.replace('/');
  }, [currentRecording, deleteRecording, router]);

  if (isLoading || !currentRecording) {
    return (
      <View style={[styles.centered, { backgroundColor: VoicyColors.black }]}>
        <ActivityIndicator size="large" color={VoicyColors.white} />
      </View>
    );
  }

  const dateStr = format(parseISO(currentRecording.createdAt), 'h:mm a · MMM d, yyyy');

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header icons */}
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <MaterialCommunityIcons name="chevron-left" size={24} color={VoicyColors.white} />
        </Pressable>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerIcon} onPress={() => {
            const isCurrentlyPlaying = isTextOnly ? tts.isPlaying : player.isPlaying;
            if (isCurrentlyPlaying) {
              isTextOnly ? tts.pause() : player.pause();
              setShowPlayer(false);
            } else {
              setShowPlayer(true);
              isTextOnly ? tts.play() : player.play();
            }
          }}>
            <MaterialCommunityIcons name={(isTextOnly ? tts.isPlaying : player.isPlaying) ? 'pause' : 'play'} size={20} color={VoicyColors.white} />
          </Pressable>
          <Pressable style={styles.headerIcon} onPress={async () => { try { await exportRecording(currentRecording.id); } catch {} }}>
            <MaterialCommunityIcons name="export-variant" size={20} color={VoicyColors.white} />
          </Pressable>
          <Menu
            visible={mainMenuVisible}
            onDismiss={() => setMainMenuVisible(false)}
            anchor={
              <Pressable style={styles.headerIcon} onPress={() => setMainMenuVisible(true)}>
                <MaterialCommunityIcons name="dots-horizontal" size={20} color={VoicyColors.white} />
              </Pressable>
            }
            contentStyle={{ backgroundColor: VoicyColors.cardBg }}
          >
            <Menu.Item onPress={handleCopyTranscript} title="Copy transcript" leadingIcon="content-copy" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              try {
                if (currentTranscript) {
                  const filename = `${currentRecording.title ?? 'transcript'}.txt`;
                  const file = new File(Paths.cache, filename);
                  file.write(currentTranscript.content);
                  await Sharing.shareAsync(file.uri, { mimeType: 'text/plain', dialogTitle: `Share: ${currentRecording.title}` });
                } else if (currentRecording.filePath && currentRecording.filePath !== 'text-only') {
                  await Sharing.shareAsync(currentRecording.filePath, { mimeType: 'audio/mp4', dialogTitle: `Share: ${currentRecording.title}` });
                }
              } catch (e: any) { toast.show(e.message, 'error'); }
            }} title="Share" leadingIcon="share-variant" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              if (currentTranscript) {
                await shareToWhatsApp(currentTranscript.content);
              } else {
                Alert.alert('No Transcript', 'Transcribe the recording first to share text to WhatsApp.');
              }
            }} title="WhatsApp" leadingIcon="whatsapp" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={() => { setMainMenuVisible(false); setCreateMenuVisible(true); }} title="Create" leadingIcon="creation" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={() => { setMainMenuVisible(false); router.push({ pathname: '/record', params: { appendToRecordingId: currentRecording.id, appendToTitle: currentRecording.title ?? 'Untitled' } }); }} title="Continue recording" leadingIcon="microphone" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              try {
                const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf', 'text/plain'], copyToCacheDirectory: true });
                if (result.canceled || !result.assets?.[0]) return;
                const asset = result.assets[0];
                const attachDir = new Directory(Paths.document, 'attachments');
                if (!attachDir.exists) attachDir.create();
                const sourceFile = new File(asset.uri);
                const destFile = new File(attachDir, asset.name);
                sourceFile.copy(destFile);
                const ext = asset.name.split('.').pop()?.toLowerCase() ?? '';
                const fileType = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext) ? 'image' : 'document';
                await createAttachment({ recordingId: currentRecording.id, fileName: asset.name, filePath: destFile.uri, fileType, sizeBytes: asset.size ?? 0 });
                const updated = await getAttachmentsForRecording(currentRecording.id);
                setAttachments(updated);
              } catch (e: any) { toast.show(e.message, 'error'); }
            }} title="Attach" leadingIcon="image" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={() => { setMainMenuVisible(false); setTagPickerVisible(true); }} title="Tag" leadingIcon="pound" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={() => { setMainMenuVisible(false); setExportDialogVisible(true); }} title="Export" leadingIcon="file-export" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              if (!currentTranscript) { toast.show('No transcript to fix', 'error'); return; }
              setGeneratingLabel('Fixing your transcript');
              setIsGenerating(true);
              try {
                const output = await generateAIOutput(currentRecording.id, 'fix', { provider: aiProvider, apiKeys });
                await updateTranscriptContent(currentTranscript.id, output.content);
                await loadRecordingDetail(currentRecording.id);
              } catch (e: any) { toast.show(e.message, 'error'); } finally { setIsGenerating(false); }
            }} title="Fix" leadingIcon="auto-fix" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              if (!currentTranscript) { toast.show('No transcript to analyze', 'error'); return; }
              setGeneratingLabel('Detecting speakers...');
              setIsGenerating(true);
              try {
                await diarizeTranscript(currentRecording.id, { provider: aiProvider, apiKeys });
                await loadRecordingDetail(currentRecording.id);
              } catch (e: any) { toast.show(e.message, 'error'); } finally { setIsGenerating(false); }
            }} title="Detect speakers" leadingIcon="account-voice" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={async () => {
              setMainMenuVisible(false);
              if (!currentTranscript) { toast.show('No transcript to format', 'error'); return; }
              setGeneratingLabel('Formatting transcript...');
              setIsGenerating(true);
              try {
                await formatTranscript(currentRecording.id, { provider: aiProvider, apiKeys });
                await loadRecordingDetail(currentRecording.id);
              } catch (e: any) { toast.show(e.message, 'error'); } finally { setIsGenerating(false); }
            }} title="Format" leadingIcon="format-text" titleStyle={{ color: VoicyColors.white }} />
            <Menu.Item onPress={() => { setMainMenuVisible(false); if (currentTranscript) { setEditedContent(currentTranscript.content); setIsEditing(true); } }} title="Edit" leadingIcon="pencil" titleStyle={{ color: VoicyColors.white }} />
          </Menu>
        </View>
      </View>

      {/* Create submenu */}
      <Menu
        visible={createMenuVisible}
        onDismiss={() => setCreateMenuVisible(false)}
        anchor={{ x: 280, y: insets.top + 48 }}
        contentStyle={{ backgroundColor: VoicyColors.cardBg }}
      >
        {CREATE_ITEMS.map((item) => (
          <Menu.Item
            key={item.key}
            onPress={() => {
              if (item.key === 'translate') {
                setCreateMenuVisible(false);
                setLanguageSearch('');
                setShowTranslateDialog(true);
              } else {
                handleCreate(item.key);
              }
            }}
            title={item.label}
            leadingIcon={item.icon}
            titleStyle={{ color: VoicyColors.white }}
          />
        ))}
        <Menu.Item
          onPress={() => { setCreateMenuVisible(false); router.push({ pathname: '/custom-prompt', params: { recordingId: currentRecording.id } }); }}
          title="Custom prompt"
          leadingIcon="plus"
          titleStyle={{ color: VoicyColors.white }}
        />
      </Menu>

      {/* Title */}
      <Text style={styles.title}>{currentRecording.title ?? 'Untitled Recording'}</Text>
      <Text style={styles.dateText}>{dateStr}</Text>

      {/* Generate audio button for text-only notes */}
      {isTextOnly && (
        <Pressable
          style={[styles.generateAudioBtn, isGeneratingTTS && { opacity: 0.6 }]}
          onPress={handleGenerateAudio}
          disabled={isGeneratingTTS}
        >
          {isGeneratingTTS ? (
            <ActivityIndicator size="small" color={VoicyColors.black} />
          ) : (
            <MaterialCommunityIcons name="text-to-speech" size={18} color={VoicyColors.black} />
          )}
          <Text style={styles.generateAudioText}>
            {isGeneratingTTS ? 'Generating audio...' : 'Generate audio'}
          </Text>
        </Pressable>
      )}

      {/* Mini player */}
      {showPlayer && (
        <AudioPlayer
          isPlaying={isTextOnly ? tts.isPlaying : player.isPlaying}
          duration={isTextOnly ? tts.duration : player.duration}
          position={isTextOnly ? tts.position : player.position}
          playbackSpeed={isTextOnly ? tts.playbackSpeed : player.playbackSpeed}
          onPlay={isTextOnly ? tts.play : player.play}
          onPause={isTextOnly ? tts.pause : player.pause}
          onSeek={isTextOnly ? tts.seekTo : player.seekTo}
          onSkipForward={isTextOnly ? () => tts.skipForward() : () => player.skipForward()}
          onSkipBackward={isTextOnly ? () => tts.skipBackward() : () => player.skipBackward()}
          onSpeedChange={isTextOnly ? tts.setSpeed : player.setSpeed}
        />
      )}

      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['transcript', 'creation', 'chat'] as const).map((tab) => {
          const active = activeTab === tab;
          const label = tab === 'transcript' ? 'Transcript' : tab === 'creation' ? 'Creation' : 'Chat';
          return (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[
                styles.tabPill,
                active
                  ? { backgroundColor: VoicyColors.white }
                  : { borderWidth: 1, borderColor: '#48484a' },
              ]}
            >
              <Text style={[styles.tabText, { color: active ? VoicyColors.black : VoicyColors.white }]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Tab content */}
      {activeTab !== 'chat' ? (
        <ScrollView style={styles.tabContent} contentContainerStyle={{ paddingBottom: 100 }}>
          {activeTab === 'transcript' && (
            <>
              {isTranscribing ? (
                <View style={styles.centered}>
                  <ActivityIndicator size="large" color={VoicyColors.white} />
                  <Text style={styles.loadingText}>Transcribing...</Text>
                </View>
              ) : currentTranscript ? (
                <>
                  {isEditing ? (
                    <View>
                      <TextInput
                        style={[styles.transcriptText, styles.transcriptInput]}
                        value={editedContent}
                        onChangeText={setEditedContent}
                        multiline
                        autoFocus
                        textAlignVertical="top"
                      />
                      <View style={styles.editActions}>
                        <Pressable style={styles.editCancelButton} onPress={() => setIsEditing(false)}>
                          <Text style={{ color: VoicyColors.white, fontWeight: '500' }}>Cancel</Text>
                        </Pressable>
                        <Pressable style={styles.editSaveButton} onPress={async () => {
                          if (currentTranscript) {
                            await updateTranscriptContent(currentTranscript.id, editedContent);
                            await loadRecordingDetail(currentRecording.id);
                            setIsEditing(false);
                          }
                        }}>
                          <Text style={{ color: VoicyColors.black, fontWeight: '600' }}>Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <View style={{ paddingTop: 8 }}>{renderTranscriptContent(currentTranscript.content)}</View>
                  )}
                  {(() => {
                    const bulletPoints = currentAIOutputs.find((o) => o.type === 'bullet_points');
                    if (!bulletPoints) return null;
                    return (
                      <View style={styles.keyPointsCard}>
                        <Text style={styles.keyPointsTitle}>Key Points</Text>
                        <Text style={styles.keyPointsContent}>{bulletPoints.content}</Text>
                      </View>
                    );
                  })()}
                  {attachments.length > 0 && (
                    <View style={styles.attachmentsSection}>
                      <Text style={styles.relatedTitle}>Attachments</Text>
                      {attachments.map((att) => (
                        <Pressable
                          key={att.id}
                          style={styles.attachmentCard}
                          onLongPress={() => {
                            Alert.alert('Delete Attachment', `Remove "${att.fileName}"?`, [
                              { text: 'Cancel', style: 'cancel' },
                              { text: 'Delete', style: 'destructive', onPress: async () => {
                                await deleteAttachment(att.id);
                                const updated = await getAttachmentsForRecording(currentRecording.id);
                                setAttachments(updated);
                              }},
                            ]);
                          }}
                        >
                          <MaterialCommunityIcons
                            name={att.fileType === 'image' ? 'image' : 'file-document'}
                            size={24}
                            color={VoicyColors.secondaryText}
                          />
                          <Text style={styles.attachmentName} numberOfLines={1}>{att.fileName}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                  {relatedNotes.length > 0 && (
                    <View style={styles.relatedSection}>
                      <Text style={styles.relatedTitle}>Related notes</Text>
                      {relatedNotes.map((note) => (
                        <Pressable
                          key={note.recordingId}
                          style={styles.relatedCard}
                          onPress={() => router.push(`/recording/${note.recordingId}`)}
                        >
                          <Text style={styles.relatedCardTitle} numberOfLines={1}>{note.title}</Text>
                          <Text style={styles.relatedCardDate}>{note.date}</Text>
                          <Text style={styles.relatedCardPreview} numberOfLines={3}>{note.preview}</Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No transcript yet</Text>
                  <Pressable style={styles.transcribeButton} onPress={handleTranscribe}>
                    <Text style={styles.transcribeButtonText}>Transcribe</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}

          {activeTab === 'creation' && (
            <>
              {currentAIOutputs.length === 0 ? (
                <View style={styles.centered}>
                  <Text style={styles.emptyText}>No AI creations yet</Text>
                  <Text style={styles.emptySubtext}>Tap ··· → Create to generate</Text>
                </View>
              ) : (
                currentAIOutputs.map((output) => {
                  const typeLabels: Record<string, string> = {
                    summary: 'Summary', bullet_points: 'Main points', todo: 'To-do list',
                    meeting_report: 'Meeting report', blog_post: 'Blog post', email_draft: 'Email',
                    tweet: 'Tweet', translate: 'Translate', cleanup: 'Cleanup', custom: 'Custom',
                  };
                  return (
                    <Pressable
                      key={output.id}
                      style={styles.creationCard}
                      onPress={() => router.push({ pathname: '/ai-output', params: { recordingId: currentRecording.id, outputType: output.type } })}
                    >
                      <Text style={styles.creationTitle}>{typeLabels[output.type] ?? output.type}</Text>
                      <Text style={styles.creationPreview} numberOfLines={3}>
                        {output.content}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </>
          )}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}>
          <ChatMessageList
            messages={chatMessages}
            isProcessing={isChatProcessing}
            ListEmptyComponent={
              <View style={styles.centered}>
                <Text style={styles.emptyText}>Ask about this note</Text>
                <Text style={styles.emptySubtext}>AI will answer based on the transcript</Text>
              </View>
            }
          />
          <ChatInputBar
            value={chatInput}
            onChangeText={setChatInput}
            onSend={handleChatSend}
            isProcessing={isChatProcessing}
            disabled={!openaiApiKey && !anthropicApiKey}
            placeholder="Ask about this note..."
            bottomInset={insets.bottom}
            showMic={!!openaiApiKey}
            isRecordingVoice={chatVoice.isRecording}
            isTranscribingVoice={chatVoice.isTranscribing}
            onMicPress={async () => { try { await chatVoice.startRecording(); } catch (e: any) { toast.show(e.message, 'error'); } }}
            onMicStop={async () => { try { const text = await chatVoice.stopRecording(); if (text) setChatInput((prev) => (prev ? prev + ' ' + text : text)); } catch (e: any) { toast.show(e.message, 'error'); } }}
            onMicCancel={chatVoice.cancelRecording}
            recordingDuration={chatVoice.duration}
          />
        </KeyboardAvoidingView>
      )}

      {/* Tag picker */}
      <TagPickerModal
        visible={tagPickerVisible}
        onDismiss={() => setTagPickerVisible(false)}
        recordingId={currentRecording.id}
        onTagsChanged={() => loadRecordingDetail(currentRecording.id)}
      />

      {/* Translate language picker */}
      <Portal>
        <Dialog visible={showTranslateDialog} onDismiss={() => setShowTranslateDialog(false)} style={{ backgroundColor: VoicyColors.cardBg, borderRadius: 16, maxHeight: '70%' }}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Translate to</Dialog.Title>
          <Dialog.Content>
            <TextInput
              style={{ backgroundColor: VoicyColors.inputBg, color: VoicyColors.white, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 15, marginBottom: 12 }}
              placeholder="Search languages..."
              placeholderTextColor={VoicyColors.secondaryText}
              value={languageSearch}
              onChangeText={setLanguageSearch}
              autoCapitalize="none"
            />
            <FlatList
              data={LANGUAGES.filter((l) => {
                const q = languageSearch.toLowerCase();
                return !q || l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q);
              })}
              keyExtractor={(item) => item.code}
              style={{ maxHeight: 300 }}
              renderItem={({ item }) => (
                <Pressable
                  style={{ paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 0.5, borderBottomColor: VoicyColors.divider }}
                  onPress={() => handleTranslate(item.code)}
                >
                  <Text style={{ color: VoicyColors.white, fontSize: 16 }}>{item.name}</Text>
                  <Text style={{ color: VoicyColors.secondaryText, fontSize: 13 }}>{item.nativeName}</Text>
                </Pressable>
              )}
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setShowTranslateDialog(false)} textColor={VoicyColors.white}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Export dialog */}
      <Portal>
        <Dialog visible={exportDialogVisible} onDismiss={() => setExportDialogVisible(false)} style={{ backgroundColor: VoicyColors.cardBg, borderRadius: 16 }}>
          <Dialog.Title style={{ color: VoicyColors.white }}>Export</Dialog.Title>
          <Dialog.Content>
            <Pressable style={styles.exportOption} onPress={async () => { setExportDialogVisible(false); try { await exportRecording(currentRecording.id); } catch (e: any) { toast.show(e.message, 'error'); } }}>
              <MaterialCommunityIcons name="music-note" size={20} color={VoicyColors.white} />
              <Text style={{ color: VoicyColors.white, fontSize: 16, marginLeft: 12 }}>Audio file</Text>
            </Pressable>
            <Pressable style={styles.exportOption} onPress={async () => { setExportDialogVisible(false); try { await exportTranscript(currentRecording.id); } catch (e: any) { toast.show(e.message, 'error'); } }}>
              <MaterialCommunityIcons name="text-box" size={20} color={VoicyColors.white} />
              <Text style={{ color: VoicyColors.white, fontSize: 16, marginLeft: 12 }}>Transcript (.txt)</Text>
            </Pressable>
            <Pressable style={styles.exportOption} onPress={async () => { setExportDialogVisible(false); try { await exportAllData(); } catch (e: any) { toast.show(e.message, 'error'); } }}>
              <MaterialCommunityIcons name="code-json" size={20} color={VoicyColors.white} />
              <Text style={{ color: VoicyColors.white, fontSize: 16, marginLeft: 12 }}>All data (JSON)</Text>
            </Pressable>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setExportDialogVisible(false)} textColor={VoicyColors.white}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      {/* Loading overlay */}
      <LoadingOverlay
        visible={isGenerating}
        message={generatingLabel}
        onClose={() => setIsGenerating(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    minHeight: 200,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerRight: {
    flexDirection: 'row',
    gap: 4,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: VoicyColors.white,
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 16,
    lineHeight: 36,
  },
  dateText: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  generateAudioBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.aiGreen,
  },
  generateAudioText: {
    color: VoicyColors.black,
    fontSize: 14,
    fontWeight: '600',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  tabPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 24,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  transcriptText: {
    color: VoicyColors.white,
    fontSize: 17,
    lineHeight: 28,
    paddingTop: 8,
  },
  loadingText: {
    color: VoicyColors.secondaryText,
    marginTop: 16,
  },
  emptyText: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
  },
  emptySubtext: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    marginTop: 8,
  },
  transcribeButton: {
    marginTop: 16,
    backgroundColor: VoicyColors.white,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
  },
  transcribeButtonText: {
    color: VoicyColors.black,
    fontWeight: '600',
    fontSize: 15,
  },
  creationCard: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 0.5,
    borderColor: VoicyColors.divider,
  },
  creationTitle: {
    color: VoicyColors.white,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  creationPreview: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  keyPointsCard: {
    marginTop: 24,
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
  },
  keyPointsTitle: {
    color: VoicyColors.white,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 10,
  },
  keyPointsContent: {
    color: VoicyColors.secondaryText,
    fontSize: 15,
    lineHeight: 22,
  },
  relatedSection: {
    marginTop: 32,
    paddingBottom: 16,
  },
  relatedTitle: {
    color: VoicyColors.white,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  relatedCard: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  relatedCardTitle: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  relatedCardDate: {
    color: VoicyColors.secondaryText,
    fontSize: 13,
    marginBottom: 6,
  },
  relatedCardPreview: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  attachmentsSection: {
    marginTop: 24,
    paddingBottom: 8,
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  attachmentName: {
    color: VoicyColors.white,
    fontSize: 15,
    flex: 1,
  },
  transcriptInput: {
    borderWidth: 1,
    borderColor: VoicyColors.divider,
    borderRadius: 12,
    padding: 12,
    minHeight: 200,
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
  },
  editCancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.inputBg,
  },
  editSaveButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.white,
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: VoicyColors.divider,
  },
  chatBubble: {
    marginBottom: 12,
    maxWidth: '82%',
  },
  chatBubbleUser: {
    alignSelf: 'flex-end',
  },
  chatBubbleAI: {
    alignSelf: 'flex-start',
  },
  chatBubbleInner: {
    padding: 14,
    borderRadius: 20,
  },
  chatBubbleText: {
    color: VoicyColors.white,
    fontSize: 15,
    lineHeight: 22,
  },
  chatTyping: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
  },
  chatTypingText: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
  },
  chatInputRow: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: VoicyColors.inputBg,
    borderRadius: 24,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 4,
  },
  chatInputField: {
    flex: 1,
    color: VoicyColors.white,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  chatSendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
