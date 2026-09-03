import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/app-card';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

type SectionCardProps = {
  title: string;
  children: ReactNode;
};

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <AppCard>
      <ThemedText type="sectionTitle">{title}</ThemedText>
      <View style={styles.body}>{children}</View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: Spacing.two,
  },
});
