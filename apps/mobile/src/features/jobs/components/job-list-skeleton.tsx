import { View, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function JobListSkeleton() {
  const theme = useTheme();

  return (
    <View style={styles.list}>
      {[0, 1, 2].map((index) => (
        <View
          key={index}
          style={[
            styles.card,
            {
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}>
          <View style={[styles.line, styles.short, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.line, { backgroundColor: theme.backgroundSelected }]} />
          <View style={[styles.line, styles.medium, { backgroundColor: theme.backgroundSelected }]} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.two,
    minHeight: 128,
  },
  line: {
    height: 12,
    borderRadius: Radius.sm,
    width: '100%',
  },
  short: {
    width: '28%',
  },
  medium: {
    width: '62%',
  },
});
