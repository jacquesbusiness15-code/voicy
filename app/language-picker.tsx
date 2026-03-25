import React, { useState, useMemo } from 'react';
import { View, StyleSheet, FlatList, Pressable } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useRouter } from 'expo-router';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VoicyColors } from '../src/constants/theme';
import { useSettingsStore } from '../src/stores/settingsStore';
import { LANGUAGES } from '../src/constants/languages';

export default function LanguagePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { defaultLanguage, updateSetting } = useSettingsStore();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return LANGUAGES;
    const q = search.toLowerCase();
    return LANGUAGES.filter(
      (l) => l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleSelect = (code: string) => {
    updateSetting('defaultLanguage', code);
    router.back();
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={VoicyColors.white} />
        </Pressable>
        <Text style={styles.title}>Language</Text>
        <View style={{ width: 40 }} />
      </View>

      <TextInput
        placeholder="Search languages..."
        value={search}
        onChangeText={setSearch}
        mode="outlined"
        autoCapitalize="none"
        textColor={VoicyColors.white}
        style={styles.searchInput}
        outlineColor={VoicyColors.divider}
        activeOutlineColor={VoicyColors.aiGreen}
        left={<TextInput.Icon icon="magnify" color={VoicyColors.secondaryText} />}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.code}
        renderItem={({ item }) => (
          <Pressable style={styles.row} onPress={() => handleSelect(item.code)}>
            <View style={styles.rowText}>
              <Text style={styles.langName}>{item.name}</Text>
              <Text style={styles.langNative}>{item.nativeName}</Text>
            </View>
            {item.code === defaultLanguage && (
              <MaterialCommunityIcons name="check" size={20} color={VoicyColors.aiGreen} />
            )}
          </Pressable>
        )}
        ItemSeparatorComponent={() => <View style={styles.divider} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: VoicyColors.black },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: VoicyColors.inputBg, alignItems: 'center', justifyContent: 'center' },
  title: { color: VoicyColors.white, fontSize: 18, fontWeight: '600' },
  searchInput: { marginHorizontal: 16, marginBottom: 8, backgroundColor: VoicyColors.inputBg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowText: { flex: 1 },
  langName: { color: VoicyColors.white, fontSize: 16 },
  langNative: { color: VoicyColors.secondaryText, fontSize: 13, marginTop: 2 },
  divider: { height: 0.5, backgroundColor: VoicyColors.divider, marginHorizontal: 16 },
});
