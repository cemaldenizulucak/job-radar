import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  leading?: ReactNode;
};

export function ScreenHeader({ title, subtitle, right, leading }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      {leading}
      <View style={styles.titleRow}>
        <View style={styles.copy}>
          <ThemedText type="screenTitle">{title}</ThemedText>
          {subtitle ? (
            <ThemedText type="meta" themeColor="textSecondary">
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  copy: {
    flex: 1,
    gap: Spacing.one,
  },
});
