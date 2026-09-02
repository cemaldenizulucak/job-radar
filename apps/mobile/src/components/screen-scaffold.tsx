import { type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenScaffoldProps = {
  children: ReactNode;
  scroll?: boolean;
  contentContainerStyle?: ScrollViewProps['contentContainerStyle'];
};

export function ScreenScaffold({
  children,
  scroll = true,
  contentContainerStyle,
}: ScreenScaffoldProps) {
  const body = (
    <View style={styles.inner}>
      {children}
    </View>
  );

  return (
    <ThemedView style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {body}
          </ScrollView>
        ) : (
          <View style={styles.fill}>{body}</View>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  fill: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing.five,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
});
