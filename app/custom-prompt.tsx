import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, Pressable, TextInput, FlatList, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { VoicyColors } from '../src/constants/theme';
import { generateAIOutput } from '../src/services/summarization';
import { useSettingsStore } from '../src/stores/settingsStore';
import { createSavedPrompt, getAllSavedPrompts, deleteSavedPrompt } from '../src/db/queries';
import type { SavedPrompt } from '../src/db/schema';

export default function CustomPromptScreen() {
  const { recordingId } = useLocalSearchParams<{ recordingId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { aiProvider, openaiApiKey, anthropicApiKey } = useSettingsStore();

  const [promptText, setPromptText] = useState('');
  const [activeTab, setActiveTab] = useState<'custom' | 'saved'>('custom');
  const [isCreating, setIsCreating] = useState(false);
  const [saveChecked, setSaveChecked] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);

  const loadSaved = useCallback(async () => {
    const prompts = await getAllSavedPrompts();
    setSavedPrompts(prompts);
  }, []);

  useEffect(() => {
    loadSaved();
  }, [loadSaved]);

  const handleCreate = async () => {
    if (!promptText.trim() || !recordingId) return;
    setIsCreating(true);
    try {
      if (saveChecked) {
        const title = promptText.trim().substring(0, 60);
        await createSavedPrompt(title, promptText.trim());
        await loadSaved();
      }
      await generateAIOutput(recordingId, 'custom', {
        provider: aiProvider,
        apiKeys: { openai: openaiApiKey, anthropic: anthropicApiKey },
        customPrompt: promptText.trim(),
      });
      router.canGoBack() ? router.back() : router.replace('/');
    } catch (e: any) {
      console.error(e);
      Alert.alert('Error', e.message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleUseSaved = (prompt: SavedPrompt) => {
    setPromptText(prompt.promptText);
    setActiveTab('custom');
  };

  const handleDeleteSaved = (prompt: SavedPrompt) => {
    Alert.alert('Delete Prompt', `Delete "${prompt.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteSavedPrompt(prompt.id);
        await loadSaved();
      }},
    ]);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        <Pressable onPress={() => setActiveTab('custom')}>
          <Text style={[styles.tab, activeTab === 'custom' && styles.tabActive]}>Custom</Text>
          {activeTab === 'custom' && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable onPress={() => setActiveTab('saved')}>
          <Text style={[styles.tab, activeTab === 'saved' && styles.tabActive]}>Saved</Text>
          {activeTab === 'saved' && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      {activeTab === 'custom' ? (
        <>
          {/* Text input */}
          <View style={styles.inputCard}>
            <TextInput
              style={styles.input}
              placeholder="Enter your instructions here"
              placeholderTextColor={VoicyColors.secondaryText}
              value={promptText}
              onChangeText={setPromptText}
              multiline
              maxLength={4000}
              textAlignVertical="top"
            />
          </View>

          {/* Character count */}
          <Text style={styles.charCount}>{promptText.length}/4000</Text>

          {/* Bottom actions */}
          <View style={styles.actions}>
            <Pressable style={styles.saveRow} onPress={() => setSaveChecked(!saveChecked)}>
              <View style={[styles.checkbox, saveChecked && styles.checkboxChecked]}>
                {saveChecked && <MaterialCommunityIcons name="check" size={14} color={VoicyColors.black} />}
              </View>
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
            <View style={styles.buttons}>
              <Pressable style={styles.cancelButton} onPress={() => router.canGoBack() ? router.back() : router.replace('/')}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.createButton, !promptText.trim() && { opacity: 0.5 }]}
                onPress={handleCreate}
                disabled={!promptText.trim() || isCreating}
              >
                <Text style={styles.createText}>{isCreating ? 'Creating...' : 'Create'}</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <FlatList
          data={savedPrompts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable style={styles.savedCard} onPress={() => handleUseSaved(item)} onLongPress={() => handleDeleteSaved(item)}>
              <Text style={styles.savedTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.savedPreview} numberOfLines={2}>{item.promptText}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No saved prompts yet</Text>
              <Text style={[styles.emptyText, { fontSize: 13, marginTop: 4 }]}>
                Check "Save" when creating a prompt to save it here
              </Text>
            </View>
          }
          contentContainerStyle={savedPrompts.length === 0 ? { flex: 1 } : { paddingBottom: 40 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: VoicyColors.black,
    padding: 16,
  },
  tabRow: {
    flexDirection: 'row',
    gap: 24,
    marginBottom: 20,
  },
  tab: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
    fontWeight: '500',
    paddingBottom: 8,
  },
  tabActive: {
    color: VoicyColors.white,
  },
  tabUnderline: {
    height: 3,
    backgroundColor: VoicyColors.white,
    borderRadius: 1.5,
  },
  inputCard: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    minHeight: 200,
  },
  input: {
    color: VoicyColors.white,
    fontSize: 16,
    lineHeight: 24,
    minHeight: 170,
  },
  charCount: {
    color: VoicyColors.secondaryText,
    fontSize: 13,
    textAlign: 'right',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: VoicyColors.secondaryText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: VoicyColors.aiGreen,
    borderColor: VoicyColors.aiGreen,
  },
  saveLabel: {
    color: VoicyColors.white,
    fontSize: 15,
  },
  buttons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.inputBg,
  },
  cancelText: {
    color: VoicyColors.white,
    fontSize: 15,
    fontWeight: '500',
  },
  createButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: VoicyColors.white,
  },
  createText: {
    color: VoicyColors.black,
    fontSize: 15,
    fontWeight: '600',
  },
  savedCard: {
    backgroundColor: VoicyColors.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  savedTitle: {
    color: VoicyColors.white,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  savedPreview: {
    color: VoicyColors.secondaryText,
    fontSize: 14,
    lineHeight: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: VoicyColors.secondaryText,
    fontSize: 16,
  },
});
