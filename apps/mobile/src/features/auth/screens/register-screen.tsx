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
import { useAuthStore } from '../stores/auth.store';
import { getAuthErrorMessage } from '../utils/map-auth-error';
import { registerSchema, type RegisterFormValues } from '../validation/auth.schema';

export function RegisterScreen() {
  const theme = useTheme();
  const { signUp } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [confirmationMessage, setConfirmationMessage] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: RegisterFormValues) => {
    setAuthError(null);
    setConfirmationMessage(null);

    try {
      await signUp({
        name: values.name,
        email: values.email,
        password: values.password,
      });

      if (!useAuthStore.getState().isAuthenticated) {
        setConfirmationMessage(authCopy.confirmation);
      }
    } catch (error) {
      setAuthError(getAuthErrorMessage(error, 'signUp'));
    }
  };

  return (
    <AuthScreenLayout
      title={authCopy.createAccountTitle}
      subtitle={authCopy.createAccountSubtitle}>
      <View style={styles.form}>
        <Controller
          control={control}
          name="name"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthTextField
              label={authCopy.name}
              placeholder={authCopy.namePlaceholder}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              value={value}
              onBlur={onBlur}
              onChangeText={onChange}
              error={errors.name?.message}
            />
          )}
        />
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
              textContentType="newPassword"
              autoComplete="new-password"
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
        {confirmationMessage ? (
          <ThemedText themeColor="textSecondary">{confirmationMessage}</ThemedText>
        ) : null}
        <AuthSubmitButton
          label={authCopy.createAccount}
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
        <View style={styles.footer}>
          <ThemedText themeColor="textSecondary">{authCopy.hasAccount}</ThemedText>
          <Link href={'/(auth)/login' as Href}>
            <ThemedText type="linkPrimary">{authCopy.signIn}</ThemedText>
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
