import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, FlatList, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';
import { getSetting, setSetting } from '../src/db/queries';

export default function NamesToRememberScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [names, setNames] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    getSetting('speakerNames').then((val) => {
      if (val) {
        try { setNames(JSON.parse(val)); } catch {}
      }
    });
  }, []);

  const persist = useCallback(async (updated: string[]) => {
    setNames(updated);
    await setSetting('speakerNames', JSON.stringify(updated));
  }, []);

  const handleAdd = () => {
    const trimmed = newName.trim();
    if (!trimmed || names.includes(trimmed)) return;
    persist([...names, trimmed]);
    setNewName('');
  };

  const handleRemove = (name: string) => {
    persist(names.filter((n) => n !== name));
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={VoicyColors.white} />
          </Pressable>
          <Text style={styles.title}>Names to Remember</Text>
          <View style={{ width: 40 }} />
        </View>

        <Text style={styles.description}>
          Add names of people you frequently speak with. These names help the AI identify speakers in your transcriptions.
        </Text>

        <FlatList
          data={names}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={styles.nameIcon}>
                <MaterialCommunityIcons name="account-outline" size={20} color={VoicyColors.white} />
              </View>
              <Text style={styles.nameText}>{item}</Text>
              <Pressable onPress={() => handleRemove(item)} hitSlop={8}>
                <MaterialCommunityIcons name="close-circle-outline" size={20} color={VoicyColors.secondaryText} />
              </Pressable>
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.divider} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No names added yet. Add names below to help with speaker identification.</Text>
          }
          contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
        />

        <View style={styles.inputRow}>
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder="Add a name..."
            mode="outlined"
            autoCapitalize="words"
            textColor={VoicyColors.white}
            style={styles.input}
            outlineColor={VoicyColors.divider}
            activeOutlineColor={VoicyColors.aiGreen}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
          />
          <Pressable style={[styles.addButton, !newName.trim() && { opacity: 0.4 }]} onPress={handleAdd} disabled={!newName.trim()}>
            <MaterialCommunityIcons name="plus" size={24} color={VoicyColors.black} />
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + 8 }} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  title: { color: VoicyColors.white, fontSize: 18, fontWeight: '600' },
  description: { color: VoicyColors.secondaryText, fontSize: 14, paddingHorizontal: 16, paddingBottom: 16, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  nameIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: VoicyColors.cardBg, alignItems: 'center', justifyContent: 'center' },
  nameText: { color: VoicyColors.white, fontSize: 16, flex: 1 },
  divider: { height: 0.5, backgroundColor: VoicyColors.divider, marginHorizontal: 16 },
  emptyText: { color: VoicyColors.secondaryText, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, paddingTop: 40 },
  inputRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 8 },
  input: { flex: 1, backgroundColor: VoicyColors.inputBg },
  addButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: VoicyColors.aiGreen, alignItems: 'center', justifyContent: 'center' },
});
