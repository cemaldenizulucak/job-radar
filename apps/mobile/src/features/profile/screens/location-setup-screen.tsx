import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { AuthScreenLayout } from '@/features/auth/components/auth-screen-layout';
import { AuthSubmitButton } from '@/features/auth/components/auth-submit-button';
import { AuthTextField } from '@/features/auth/components/auth-text-field';
import { useTheme } from '@/hooks/use-theme';
import { hasProfileCountry } from '@/lib/search-location';

import { profileCopy } from '../copy';
import { getProfile, updateProfile } from '../services/profile.service';
import {
  LOCATION_SETUP_JOBS_HREF,
  locationSetupUserMessage,
  shouldEnterAppAfterLocationSave,
} from '../utils/location-setup';

type LocationSetupScreenProps = {
  onComplete: () => void;
};

export function LocationSetupScreen({ onComplete }: LocationSetupScreenProps) {
  const theme = useTheme();
  const router = useRouter();
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [countryError, setCountryError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void getProfile()
      .then((profile) => {
        if (cancelled) {
          return;
        }

        if (hasProfileCountry(profile)) {
          onComplete();
          return;
        }

        setCountry(profile.country ?? '');
        setCity(profile.city ?? '');
      })
      .catch(() => {
        if (!cancelled) {
          onComplete();
        }
      });

    return () => {
      cancelled = true;
    };
  }, [onComplete]);

  const onSubmit = async () => {
    const trimmedCountry = country.trim();
    if (!trimmedCountry) {
      setCountryError(profileCopy.countryRequired);
      return;
    }

    setCountryError(null);
    setFormError(null);
    setIsSubmitting(true);

    try {
      const saved = await updateProfile({
        country: trimmedCountry,
        city: city.trim() || null,
      });
      if (!shouldEnterAppAfterLocationSave(saved)) {
        setFormError(locationSetupUserMessage());
        return;
      }

      onComplete();
      router.replace(LOCATION_SETUP_JOBS_HREF as Href);
    } catch {
      setFormError(locationSetupUserMessage());
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenLayout
      title={profileCopy.setupTitle}
      subtitle={profileCopy.setupSubtitle}>
      <View style={styles.form}>
        <AuthTextField
          label={profileCopy.country}
          placeholder={profileCopy.countryPlaceholder}
          autoCapitalize="words"
          textContentType="countryName"
          value={country}
          onChangeText={(value) => {
            setCountry(value);
            if (countryError) {
              setCountryError(null);
            }
          }}
          error={countryError ?? undefined}
        />
        <AuthTextField
          label={profileCopy.city}
          placeholder={profileCopy.cityPlaceholder}
          autoCapitalize="words"
          textContentType="addressCity"
          value={city}
          onChangeText={setCity}
        />
        {formError ? (
          <ThemedText type="meta" style={{ color: theme.danger }}>
            {formError}
          </ThemedText>
        ) : null}
        <AuthSubmitButton
          label={profileCopy.continue}
          loading={isSubmitting}
          onPress={() => {
            void onSubmit();
          }}
        />
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
});
