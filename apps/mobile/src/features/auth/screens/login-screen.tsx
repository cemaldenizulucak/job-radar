import { zodResolver } from '@hookform/resolvers/zod';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { AuthScreenLayout } from '../components/auth-screen-layout';
import { AuthSubmitButton } from '../components/auth-submit-button';
import { AuthTextField } from '../components/auth-text-field';
import { authCopy } from '../copy';
import { useAuth } from '../hooks/useAuth';
import { getAuthErrorMessage } from '../utils/map-auth-error';
import { loginSchema, type LoginFormValues } from '../validation/auth.schema';

export function LoginScreen() {
  const theme = useTheme();
  const { signIn } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setAuthError(null);

    try {
      await signIn(values);
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, 'signIn'));
    }
  };

  return (
    <AuthScreenLayout title={authCopy.signInTitle} subtitle={authCopy.signInSubtitle}>
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthTextField
              label={authCopy.email}
              placeholder={authCopy.emailPlaceholder}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.email?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthTextField
              label={authCopy.password}
              placeholder={authCopy.passwordPlaceholder}
              textContentType="password"
              autoComplete="password"
              secureTextEntry
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.password?.message}
            />
          )}
        />
        {authError ? (
          <ThemedText type="meta" style={{ color: theme.danger }}>
            {authError}
          </ThemedText>
        ) : null}
        <AuthSubmitButton
          label={authCopy.signIn}
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
        <View style={styles.footer}>
          <ThemedText themeColor="textSecondary">{authCopy.noAccount}</ThemedText>
          <Link href={'/(auth)/register' as Href}>
            <ThemedText type="linkPrimary">{authCopy.createAccount}</ThemedText>
          </Link>
        </View>
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
