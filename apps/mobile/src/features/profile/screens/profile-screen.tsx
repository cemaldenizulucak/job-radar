import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { ScreenHeader } from '@/components/screen-header';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionCard } from '@/components/section-card';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { uiCopy } from '@/constants/ui';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { useTheme } from '@/hooks/use-theme';

import { ConfirmDialog } from '@/features/searches/components/confirm-dialog';

import { TelegramSettingsSection } from '@/features/telegram/components/telegram-settings-section';

import { profileCopy } from '../copy';
import { LocationFields } from '../components/location-fields';
import {
  getProfile,
  updateProfile,
  updateProfileNotifications,
  type ProfileRecord,
} from '../services/profile.service';
import { locationSetupUserMessage } from '../utils/location-setup';

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

  return profileCopy.signedIn;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'J';
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? 'R';
  return `${first}${second}`.toUpperCase();
}

export function ProfileScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [countryError, setCountryError] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);
  const [isSavingLocation, setIsSavingLocation] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      return;
    }

    try {
      const next = await getProfile();
      setProfile(next);
      setCountry(next.country ?? '');
      setCity(next.city ?? '');
      setProfileError(null);
    } catch (caught) {
      setProfileError(
        typeof __DEV__ !== 'undefined' && __DEV__ && caught instanceof Error
          ? caught.message
          : profileCopy.loadError,
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const displayName = user ? accountDisplayName(user, profile) : profileCopy.signedIn;
  const email = profile?.email ?? user?.email ?? null;
  const notificationsEnabled = profile?.notificationsEnabled ?? true;

  const handleSignOut = () => {
    setSignOutOpen(false);
    setIsSigningOut(true);
    void signOut().finally(() => {
      setIsSigningOut(false);
    });
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
            country: null,
            city: null,
          },
    );
    setIsSavingNotifications(true);

    try {
      setProfile(await updateProfileNotifications(value));
      setProfileError(null);
    } catch (caught) {
      setProfile(previous);
      setProfileError(
        typeof __DEV__ !== 'undefined' && __DEV__ && caught instanceof Error
          ? caught.message
          : profileCopy.updateError,
      );
    } finally {
      setIsSavingNotifications(false);
    }
  };

  const handleSaveLocation = async () => {
    if (!user || isSavingLocation) {
      return;
    }

    const trimmedCountry = country.trim();

    setCountryError(null);
    setIsSavingLocation(true);

    try {
      setProfile(
        await updateProfile({
          country: trimmedCountry || null,
          city: city.trim() || null,
        }),
      );
      setCountry(trimmedCountry);
      setCity(city.trim());
      setProfileError(null);
    } catch {
      setProfileError(locationSetupUserMessage());
    } finally {
      setIsSavingLocation(false);
    }
  };

  return (
    <ScreenScaffold>
      <ScreenHeader title={profileCopy.screenTitle} />

      <View
        style={[
          styles.account,
          { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        ]}>
        <View style={[styles.avatar, { backgroundColor: theme.accentMuted }]}>
          <ThemedText type="cardTitle" style={{ color: theme.accent }}>
            {initials(displayName)}
          </ThemedText>
        </View>
        <View style={styles.accountCopy}>
          <ThemedText type="meta" themeColor="textSecondary">
            {profileCopy.fullName}
          </ThemedText>
          <ThemedText type="cardTitle">{displayName}</ThemedText>
          {email ? (
            <>
              <ThemedText type="meta" themeColor="textSecondary">
                {profileCopy.email}
              </ThemedText>
              <ThemedText themeColor="textSecondary">{email}</ThemedText>
            </>
          ) : null}
        </View>
      </View>

      {profileError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {profileError}
        </ThemedText>
      ) : null}

      <SectionCard title={profileCopy.locationSection}>
        <ThemedText type="meta" themeColor="textSecondary">
          {profileCopy.locationHint}
        </ThemedText>
        <LocationFields
          country={country}
          city={city}
          onCountryChange={(value) => {
            setCountry(value);
            if (countryError) {
              setCountryError(null);
            }
          }}
          onCityChange={setCity}
          countryError={countryError ?? undefined}
          disabled={isSavingLocation || !user}
        />
        <AppButton
          label={profileCopy.saveLocation}
          loading={isSavingLocation}
          disabled={!user}
          onPress={() => {
            void handleSaveLocation();
          }}
        />
      </SectionCard>

      <SectionCard title={profileCopy.favorites}>
        <ThemedText type="meta" themeColor="textSecondary">
          {profileCopy.favoritesHint}
        </ThemedText>
        <AppButton
          label={profileCopy.favorites}
          variant="secondary"
          onPress={() => router.push('/jobs/favorites' as Href)}
        />
      </SectionCard>

      <SectionCard title={profileCopy.notifications}>
        <View style={styles.row}>
          <ThemedText type="meta" themeColor="textSecondary" style={styles.rowCopy}>
            {profileCopy.notificationsHint}
          </ThemedText>
          <Switch
            value={notificationsEnabled}
            disabled={isSavingNotifications || !user}
            onValueChange={(value) => {
              void handleNotificationsChange(value);
            }}
            trackColor={{ false: theme.backgroundSelected, true: theme.accent }}
          />
        </View>
      </SectionCard>

      <TelegramSettingsSection enabled={Boolean(user)} />

      <SectionCard title={profileCopy.scanFrequency}>
        <ThemedText>{profileCopy.scanFrequencyValue}</ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {profileCopy.scanFrequencyHint}
        </ThemedText>
      </SectionCard>

      <SectionCard title={profileCopy.cv}>
        <View style={[styles.cvBox, { borderColor: theme.border }]}>
          <ThemedText type="meta" themeColor="textSecondary">
            {profileCopy.cvEmpty}
          </ThemedText>
        </View>
      </SectionCard>

      <AppButton
        label={isSigningOut ? profileCopy.signingOut : profileCopy.signOut}
        variant="danger"
        disabled={isSigningOut}
        onPress={() => setSignOutOpen(true)}
      />

      <ConfirmDialog
        visible={signOutOpen}
        title={profileCopy.signOutTitle}
        message=""
        confirmLabel={profileCopy.signOut}
        cancelLabel={uiCopy.cancel}
        destructive
        confirmDisabled={isSigningOut}
        onCancel={() => setSignOutOpen(false)}
        onConfirm={handleSignOut}
      />
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.three,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: {
    flex: 1,
    gap: Spacing.half,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowCopy: {
    flex: 1,
  },
  cvBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
});
