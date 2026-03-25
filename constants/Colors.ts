const tintColorLight = '#FFFFFF';
const tintColorDark = '#FFFFFF';

export default {
  light: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorLight,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#FFFFFF',
    background: '#000000',
    tint: tintColorDark,
    tabIconDefault: '#8E8E93',
    tabIconSelected: tintColorDark,
  },
} as Record<string, Record<string, string>>;
