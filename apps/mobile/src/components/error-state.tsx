import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';

type ErrorStateProps = {
  title: string;
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({
  title,
  message = uiCopy.errorHint,
  onRetry,
}: ErrorStateProps) {
  return (
    <View style={styles.wrap}>
      <ThemedText type="cardTitle">{title}</ThemedText>
      <ThemedText type="meta" themeColor="textSecondary">
        {message}
      </ThemedText>
      {onRetry ? <AppButton label={uiCopy.retry} onPress={onRetry} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'flex-start',
  },
});
