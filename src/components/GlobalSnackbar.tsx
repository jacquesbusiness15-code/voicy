import React from 'react';
import { Snackbar } from 'react-native-paper';
import { useToastStore } from '../stores/toastStore';
import { VoicyColors, Colors } from '../constants/theme';

const TYPE_COLORS = {
  error: VoicyColors.error,
  success: Colors.success,
  info: Colors.info,
};

export default function GlobalSnackbar() {
  const { message, type, visible, hide } = useToastStore();

  return (
    <Snackbar
      visible={visible}
      onDismiss={hide}
      duration={4000}
      onIconPress={hide}
      style={{ backgroundColor: TYPE_COLORS[type] }}
      wrapperStyle={{ zIndex: 200 }}
    >
      {message ?? ''}
    </Snackbar>
  );
}
