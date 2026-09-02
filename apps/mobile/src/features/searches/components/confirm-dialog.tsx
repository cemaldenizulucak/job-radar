import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  confirmDisabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  confirmDisabled = false,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          style={StyleSheet.absoluteFill}
          onPress={onCancel}
        />
        <View
          style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText themeColor="textSecondary">{message}</ThemedText>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: theme.backgroundSelected,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}>
              <ThemedText type="smallBold">{cancelLabel}</ThemedText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={confirmDisabled}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: destructive ? theme.danger : theme.accent,
                  opacity: confirmDisabled || pressed ? 0.7 : 1,
                },
              ]}>
              <ThemedText type="smallBold" style={styles.confirmLabel}>
                {confirmLabel}
              </ThemedText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmLabel: {
    color: '#ffffff',
  },
});
