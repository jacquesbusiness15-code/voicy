import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Pressable, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../src/constants/theme';
import * as queries from '../src/db/queries';

export default function WriteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) {
      Alert.alert('Empty Note', 'Please write something before saving.');
      return;
    }
    setIsSaving(true);
    try {
      const noteTitle = title.trim() || content.trim().split('\n')[0].substring(0, 60);
      const recording = await queries.createRecording({
        title: noteTitle,
        filePath: 'text-only',
        duration: 0,
        format: 'text',
        sizeBytes: content.length,
        language: 'en',
        isMeeting: false,
      });
      await queries.createTranscript({
        recordingId: recording.id,
        content: content.trim(),
        language: 'en',
        engine: 'manual',
      });
      router.replace(`/recording/${recording.id}`);
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.headerIcon} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
          <MaterialCommunityIcons name="close" size={22} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Write</Text>
        <Pressable
          style={[styles.saveButton, (!content.trim() || isSaving) && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={!content.trim() || isSaving}
        >
          <Text style={styles.saveText}>{isSaving ? 'Saving...' : 'Save'}</Text>
        </Pressable>
      </View>

      {/* Title input */}
      <TextInput
        style={styles.titleInput}
        placeholder="Title (optional)"
        placeholderTextColor={VoicyColors.secondaryText}
        value={title}
        onChangeText={setTitle}
        maxLength={120}
      />

      {/* Content input */}
      <TextInput
        style={styles.contentInput}
        placeholder="Start writing..."
        placeholderTextColor={VoicyColors.secondaryText}
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus
        textAlignVertical="top"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: VoicyColors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: VoicyColors.white,
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: VoicyColors.white,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
  },
  saveText: {
    color: VoicyColors.black,
    fontSize: 15,
    fontWeight: '600',
  },
  titleInput: {
    color: VoicyColors.white,
    fontSize: 24,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  contentInput: {
    flex: 1,
    color: VoicyColors.white,
    fontSize: 17,
    lineHeight: 28,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
