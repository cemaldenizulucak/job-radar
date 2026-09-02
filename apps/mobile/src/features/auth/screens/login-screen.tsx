import { zodResolver } from '@hookform/resolvers/zod';
import { Link, type Href } from 'expo-router';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

import { AuthScreenLayout } from '../components/auth-screen-layout';
import { AuthSubmitButton } from '../components/auth-submit-button';
import { AuthTextField } from '../components/auth-text-field';
import { useAuth } from '../hooks/useAuth';
import { getAuthErrorMessage } from '../utils/map-auth-error';
import { loginSchema, type LoginFormValues } from '../validation/auth.schema';

export function LoginScreen() {
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
    <AuthScreenLayout title="Sign in" subtitle="Use your email to continue.">
      <View style={styles.form}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, onBlur, value } }) => (
            <AuthTextField
              label="Email"
              placeholder="you@example.com"
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
              label="Password"
              placeholder="At least 8 characters"
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
        {authError ? <ThemedText style={styles.authError}>{authError}</ThemedText> : null}
        <AuthSubmitButton
          label="Sign in"
          loading={isSubmitting}
          onPress={handleSubmit(onSubmit)}
        />
        <View style={styles.footer}>
          <ThemedText themeColor="textSecondary">Don’t have an account? </ThemedText>
          <Link href={'/(auth)/register' as Href}>
            <ThemedText type="linkPrimary">Create account</ThemedText>
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
  authError: {
    color: '#D93025',
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
