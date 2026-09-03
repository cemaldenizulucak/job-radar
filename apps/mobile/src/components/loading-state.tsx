import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useTheme } from '@/hooks/use-theme';

type LoadingStateProps = {
  message?: string;
};

export function LoadingState({ message = uiCopy.loading }: LoadingStateProps) {
  const theme = useTheme();

  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={theme.accent} />
      <ThemedText type="meta" themeColor="textSecondary">
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
});
