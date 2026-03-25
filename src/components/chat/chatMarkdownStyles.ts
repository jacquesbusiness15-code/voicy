import { StyleSheet, Platform } from 'react-native';
import { VoicyColors } from '../../constants/theme';

export const chatMarkdownStyles = StyleSheet.create({
  body: { color: VoicyColors.white, fontSize: 15, lineHeight: 22 },
  strong: { color: VoicyColors.white, fontWeight: '700' as const },
  em: { color: VoicyColors.white, fontStyle: 'italic' as const },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: VoicyColors.secondaryText,
    paddingLeft: 12,
    backgroundColor: 'transparent',
    marginVertical: 4,
  },
  paragraph: { marginBottom: 4 },
  heading2: { color: VoicyColors.white, fontSize: 18, fontWeight: '700' as const, marginTop: 12, marginBottom: 6 },
  heading3: { color: VoicyColors.white, fontSize: 16, fontWeight: '600' as const, marginTop: 8, marginBottom: 4 },
  list_item: { color: VoicyColors.white, fontSize: 15, lineHeight: 22 },
  bullet_list: { marginBottom: 4 },
  ordered_list: { marginBottom: 4 },
  code_inline: {
    backgroundColor: VoicyColors.inputBg,
    color: VoicyColors.coral,
    paddingHorizontal: 4,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  fence: {
    backgroundColor: VoicyColors.inputBg,
    padding: 12,
    borderRadius: 8,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: VoicyColors.white,
  },
  link: { color: VoicyColors.aiGreen },
});
