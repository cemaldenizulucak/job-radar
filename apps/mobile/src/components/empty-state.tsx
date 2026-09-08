import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type EmptyStateProps = {
  title: string;
  message?: string;
  icon?: ReactNode;
};

export function EmptyState({ title, message, icon }: EmptyStateProps) {
  return (
    <View style={styles.wrap}>
      {icon ? <View style={styles.icon}>{icon}</View> : null}
      <ThemedText type="cardTitle" style={styles.title}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="meta" themeColor="textSecondary" style={styles.title}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
    paddingHorizontal: Spacing.three,
  },
  icon: {
    marginBottom: Spacing.one,
  },
  title: {
    textAlign: 'center',
  },
});
