import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import Markdown from 'react-native-markdown-display';
import { VoicyColors } from '../src/constants/theme';
import * as queries from '../src/db/queries';
import { format, parseISO } from 'date-fns';

const SPEAKER_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C42', '#98D8C8', '#B19CD9', '#FF6F91', '#88D8B0', '#C9B1FF'];

const markdownStyles = StyleSheet.create({
  body: { color: VoicyColors.white, fontSize: 17, lineHeight: 28 },
  strong: { color: VoicyColors.white, fontWeight: '700' as const },
  em: { color: VoicyColors.white, fontStyle: 'italic' as const },
  blockquote: { borderLeftWidth: 3, borderLeftColor: VoicyColors.secondaryText, paddingLeft: 12, backgroundColor: 'transparent', marginVertical: 4 },
  paragraph: { marginBottom: 8 },
  heading2: { color: VoicyColors.white, fontSize: 20, fontWeight: '700' as const, marginTop: 16, marginBottom: 8 },
  heading3: { color: VoicyColors.white, fontSize: 18, fontWeight: '600' as const, marginTop: 12, marginBottom: 6 },
  list_item: { color: VoicyColors.white, fontSize: 17, lineHeight: 28 },
  bullet_list: { marginBottom: 8 },
  ordered_list: { marginBottom: 8 },
});

function stripMarkdown(s: string): string {
  return s.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
}

/** Detect and render speaker-attributed content with colored labels and timestamps */
function renderAIContent(content: string) {
  // Match voice/speaker labels with optional timestamps:
  // "Voice 1:", "Voice 1 (0:32):", "**Voice 1 (1:05):**", "John:", "**John (2:15):**"
  const voicePattern = /^(?:\*\*|__)?(?:Voice \d+|[A-ZÀ-ÖØ-Þ\u00C0-\u024F][\w\u00C0-\u024F'-]+(?:[-\s][A-ZÀ-ÖØ-Þa-zà-öø-ÿ\u00C0-\u024F][\w\u00C0-\u024F'-]*)*)(?:\s*\(\d+:\d{2}\))?(?:\*\*|__)?:\s/;

  const lines = content.split('\n');
  const hasVoices = lines.some((l) => voicePattern.test(l.trim()));

  if (!hasVoices) {
    return <Markdown style={markdownStyles}>{content}</Markdown>;
  }

  // Parse content into segments: speaker-attributed blocks and regular markdown blocks
  const speakerMap: Record<string, number> = {};
  let nextIndex = 0;
  const segments: { type: 'speaker'; speaker: string; timestamp: string; text: string }[] | { type: 'markdown'; text: string }[] = [];
  const blocks: ({ type: 'speaker'; speaker: string; timestamp: string; text: string } | { type: 'markdown'; text: string })[] = [];

  let currentMarkdown = '';

  for (const line of lines) {
    const trimmed = line.trim();

    // Check if this line starts with a voice label
    const match = trimmed.match(/^(?:\*\*|__)?(.+?)(?:\s*\((\d+:\d{2})\))?(?:\*\*|__)?:\s(.+)/);
    if (match && voicePattern.test(trimmed)) {
      // Flush any accumulated markdown
      if (currentMarkdown.trim()) {
        blocks.push({ type: 'markdown', text: currentMarkdown.trim() });
        currentMarkdown = '';
      }

      const speaker = stripMarkdown(match[1]).trim();
      const timestamp = match[2] ?? '';
      const text = match[3];

      // Check if we can merge with previous speaker block
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'speaker' && last.speaker === speaker && !timestamp) {
        last.text += '\n' + text;
      } else {
        blocks.push({ type: 'speaker', speaker, timestamp, text });
      }
    } else if (blocks.length > 0 && blocks[blocks.length - 1].type === 'speaker' && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*')) {
      // Continuation of speaker block (non-empty, not a heading or list)
      const last = blocks[blocks.length - 1] as { type: 'speaker'; text: string };
      last.text += '\n' + trimmed;
    } else {
      // Regular markdown content
      currentMarkdown += line + '\n';
    }
  }

  // Flush remaining markdown
  if (currentMarkdown.trim()) {
    blocks.push({ type: 'markdown', text: currentMarkdown.trim() });
  }

  return blocks.map((block, i) => {
    if (block.type === 'markdown') {
      return <Markdown key={i} style={markdownStyles}>{block.text}</Markdown>;
    }

    const { speaker, timestamp, text } = block;
    if (!(speaker in speakerMap)) {
      speakerMap[speaker] = nextIndex++;
    }
    const color = SPEAKER_COLORS[speakerMap[speaker] % SPEAKER_COLORS.length];

    return (
      <View key={i} style={speakerStyles.speakerBlock}>
        <View style={speakerStyles.speakerHeader}>
          <View style={[speakerStyles.speakerDot, { backgroundColor: color }]} />
          <Text style={[speakerStyles.speakerLabel, { color }]}>{speaker}</Text>
          {timestamp ? <Text style={speakerStyles.timestamp}>{timestamp}</Text> : null}
        </View>
        <Markdown style={markdownStyles}>{text}</Markdown>
      </View>
    );
  });
}

export default function AIOutputScreen() {
  const { recordingId, outputType } = useLocalSearchParams<{ recordingId: string; outputType: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState('');
  const [createdAt, setCreatedAt] = useState('');
  const [outputId, setOutputId] = useState('');

  useEffect(() => {
    if (recordingId && outputType) {
      queries.getAIOutputs(recordingId, outputType).then((outputs) => {
        if (outputs.length > 0) {
          setContent(outputs[0].content);
          setCreatedAt(outputs[0].createdAt);
          setOutputId(outputs[0].id);
        }
      });
    }
  }, [recordingId, outputType]);

  const typeLabels: Record<string, string> = {
    summary: 'Summary',
    bullet_points: 'Main points',
    todo: 'To-do list',
    meeting_report: 'Meeting report',
    blog_post: 'Blog post',
    email_draft: 'Email',
    tweet: 'Tweet',
    translate: 'Translate',
    cleanup: 'Cleanup',
    custom: 'Custom',
  };

  const title = typeLabels[outputType ?? ''] ?? 'AI Output';
  const dateLabel = createdAt ? `${title} created on ${format(parseISO(createdAt), 'd MMMM')}` : '';

  const handleCopy = async () => {
    await Clipboard.setStringAsync(content);
  };

  const handleDelete = async () => {
    if (outputId) {
      const db = await import('../src/db/client').then((m) => m.getDatabase());
      const { aiOutputs } = await import('../src/db/schema');
      const { eq } = await import('drizzle-orm');
      await db.delete(aiOutputs).where(eq(aiOutputs.id, outputId));
      router.canGoBack() ? router.back() : router.replace('/');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.dateLabel} numberOfLines={1}>{dateLabel}</Text>
        <View style={styles.headerActions}>
          <Pressable onPress={handleDelete} style={styles.headerIcon}>
            <MaterialCommunityIcons name="delete" size={20} color={VoicyColors.error} />
          </Pressable>
          <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.headerIcon}>
            <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
          </Pressable>
        </View>
      </View>

      {/* Title */}
      <Text style={styles.title}>{title}</Text>

      {/* Content */}
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {renderAIContent(content)}
      </ScrollView>

      {/* Copy button */}
      <View style={styles.footer}>
        <Pressable style={styles.copyButton} onPress={handleCopy}>
          <Text style={styles.copyText}>Copy</Text>
        </Pressable>
      </View>
    </View>
  );
}

const speakerStyles = StyleSheet.create({
  speakerBlock: {
    marginBottom: 14,
  },
  speakerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  speakerLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  timestamp: {
    fontSize: 12,
    color: VoicyColors.secondaryText,
    marginLeft: 4,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dateLabel: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerIcon: {
    padding: 4,
  },
  title: {
    color: VoicyColors.white,
    fontSize: 28,
    fontWeight: '700',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  footer: {
    padding: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  copyButton: {
    backgroundColor: VoicyColors.cardBg,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  copyText: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '500',
  },
});
