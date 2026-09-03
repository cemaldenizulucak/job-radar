import { Modal, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, cardElevation } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
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
  cancelLabel = uiCopy.cancel,
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
      presentationStyle="overFullScreen"
      onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
        <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={styles.safeArea}>
          <View
            style={[
              styles.card,
              cardElevation(theme.scheme),
              { backgroundColor: theme.backgroundElement },
            ]}>
            <ThemedText type="cardTitle">{title}</ThemedText>
            {message ? (
              <ThemedText themeColor="textSecondary">{message}</ThemedText>
            ) : null}
            <View style={styles.actions}>
              <AppButton
                label={cancelLabel}
                variant="secondary"
                onPress={onCancel}
                style={styles.action}
              />
              <AppButton
                label={confirmLabel}
                variant={destructive ? 'danger' : 'primary'}
                disabled={confirmDisabled}
                onPress={onConfirm}
                style={styles.action}
              />
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
  },
});
