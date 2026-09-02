import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { ScreenScaffold } from '@/components/screen-scaffold';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';

import {
  getProfile,
  updateProfileNotifications,
  type ProfileRecord,
} from '../services/profile.service';

function accountDisplayName(
  user: { id: string; email: string | null; name: string | null },
  profile: ProfileRecord | null,
): string {
  const fromProfile = profile?.fullName?.trim();
  if (fromProfile) {
    return fromProfile;
  }

  const fromAuth = user.name?.trim();
  if (fromAuth) {
    return fromAuth;
  }

  const email = profile?.email?.trim() || user.email?.trim();
  if (email) {
    return email;
  }

  return user.id;
}

export function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      setProfile(await getProfile());
      setProfileError(null);
    } catch (caught) {
      setProfileError(
        caught instanceof Error ? caught.message : 'Couldn’t load profile.',
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const displayName = user ? accountDisplayName(user, profile) : null;
  const email = profile?.email ?? user?.email ?? null;
  const notificationsEnabled = profile?.notificationsEnabled ?? true;

  const confirmSignOut = () => {
    Alert.alert('Log out of JobRadar?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setIsSigningOut(true);
          void signOut().finally(() => {
            setIsSigningOut(false);
          });
        },
      },
    ]);
  };

  const handleNotificationsChange = async (value: boolean) => {
    if (!user || isSavingNotifications) {
      return;
    }

    const previous = profile;
    setProfile((current) =>
      current
        ? { ...current, notificationsEnabled: value }
        : {
            userId: user.id,
            fullName: user.name,
            email: user.email,
            notificationsEnabled: value,
            timezone: null,
          },
    );
    setIsSavingNotifications(true);

    try {
      setProfile(await updateProfileNotifications(value));
      setProfileError(null);
    } catch (caught) {
      setProfile(previous);
      setProfileError(
        caught instanceof Error
          ? caught.message
          : 'Couldn’t update notification preference.',
      );
    } finally {
      setIsSavingNotifications(false);
    }
  };

  return (
    <ScreenScaffold>
      <View style={styles.header}>
        <ThemedText style={styles.title}>Profile</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Account and scan preferences.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Account
        </ThemedText>
        <ThemedText style={styles.name}>{displayName ?? 'Signed in'}</ThemedText>
        {email ? (
          <ThemedText themeColor="textSecondary">{email}</ThemedText>
        ) : null}
        {user?.id ? (
          <ThemedText type="small" themeColor="textSecondary">
            Account id {user.id}
          </ThemedText>
        ) : null}
      </View>

      {profileError ? (
        <ThemedText type="small" style={{ color: theme.danger }}>
          {profileError}
        </ThemedText>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/jobs/favorites' as Href)}
        style={({ pressed }) => [
          styles.card,
          { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.88 : 1 },
        ]}>
        <ThemedText type="smallBold">Favorites</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Saved listings, independent of search tabs.
        </ThemedText>
      </Pressable>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <ThemedText type="smallBold">Notifications</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              New job digests after each backend scan.
            </ThemedText>
          </View>
          <Switch
            value={notificationsEnabled}
            disabled={isSavingNotifications || !user}
            onValueChange={(value) => {
              void handleNotificationsChange(value);
            }}
            trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
          />
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Scan schedule</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Morning 08:00 · Midday 13:00 · Evening 19:00
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Runs on the server, even if this phone is offline.
        </ThemedText>
      </View>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">CV</ThemedText>
        <View style={[styles.cvBox, { borderColor: theme.backgroundSelected }]}>
          <ThemedText type="small" themeColor="textSecondary">
            No CV uploaded yet. Relevance scoring will use this later.
          </ThemedText>
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        disabled={isSigningOut}
        onPress={confirmSignOut}
        style={({ pressed }) => [
          styles.signOut,
          {
            backgroundColor: theme.backgroundElement,
            opacity: isSigningOut || pressed ? 0.7 : 1,
          },
        ]}>
        <ThemedText type="smallBold" style={{ color: theme.danger }}>
          {isSigningOut ? 'Signing out…' : 'Sign out'}
        </ThemedText>
      </Pressable>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.one,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: 700,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  name: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowCopy: {
    flex: 1,
    gap: Spacing.one,
  },
  cvBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: Spacing.three,
  },
  signOut: {
    borderRadius: 16,
    padding: Spacing.three,
    alignItems: 'center',
  },
});
