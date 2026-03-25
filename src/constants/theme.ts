import { MD3DarkTheme, MD3LightTheme } from 'react-native-paper';

export const VoicyColors = {
  coral: '#FF6D5A',
  aiGreen: '#34d399',
  divider: '#38383A',
  pillActive: '#FFFFFF',
  pillActiveBg: '#FFFFFF',
  pillInactiveBg: '#2c2c2e',
  secondaryText: '#8E8E93',
  cardBg: '#1c1c1e',
  inputBg: '#2c2c2e',
  black: '#000000',
  white: '#FFFFFF',
  error: '#FF453A',
};

export const Colors = {
  primary: VoicyColors.white,
  accent: VoicyColors.coral,
  error: VoicyColors.error,
  warning: '#f59e0b',
  info: '#3b82f6',
  success: VoicyColors.aiGreen,
};

export const LightTheme = {
  ...MD3LightTheme,
  roundness: 16,
  colors: {
    ...MD3LightTheme.colors,
    primary: '#FFFFFF',
    primaryContainer: '#2c2c2e',
    secondary: VoicyColors.coral,
    secondaryContainer: '#2c2c2e',
    background: '#000000',
    surface: '#1c1c1e',
    surfaceVariant: '#2c2c2e',
    error: VoicyColors.error,
    onPrimary: '#000000',
    onBackground: '#FFFFFF',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#8E8E93',
    outline: '#38383A',
    elevation: {
      level0: 'transparent',
      level1: '#1c1c1e',
      level2: '#222224',
      level3: '#2c2c2e',
      level4: '#333335',
      level5: '#3a3a3c',
    },
  },
};

export const DarkTheme = {
  ...MD3DarkTheme,
  roundness: 16,
  colors: {
    ...MD3DarkTheme.colors,
    primary: '#FFFFFF',
    primaryContainer: '#2c2c2e',
    secondary: VoicyColors.coral,
    secondaryContainer: '#2c2c2e',
    background: '#000000',
    surface: '#1c1c1e',
    surfaceVariant: '#2c2c2e',
    error: VoicyColors.error,
    onPrimary: '#000000',
    onBackground: '#FFFFFF',
    onSurface: '#FFFFFF',
    onSurfaceVariant: '#8E8E93',
    outline: '#38383A',
    elevation: {
      level0: 'transparent',
      level1: '#1c1c1e',
      level2: '#222224',
      level3: '#2c2c2e',
      level4: '#333335',
      level5: '#3a3a3c',
    },
  },
};
