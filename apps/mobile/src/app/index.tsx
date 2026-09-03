import { Redirect, type Href } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/loading-state';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/features/auth/hooks/useAuth';

const JOBS_HREF = '/jobs' as Href;
const LOGIN_HREF = '/login' as Href;

export default function RootIndex() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <ThemedView style={styles.root}>
        <SafeAreaView style={styles.root}>
          <LoadingState />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return <Redirect href={isAuthenticated ? JOBS_HREF : LOGIN_HREF} />;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'center',
  },
});
