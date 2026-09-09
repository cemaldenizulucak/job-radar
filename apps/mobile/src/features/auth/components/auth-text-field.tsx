import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
  type TextInputProps,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import {
  isPasswordMasked,
  passwordVisibilityLabel,
} from '../utils/password-visibility';

type AuthTextFieldProps = TextInputProps & {
  label: string;
  error?: string;
};

export function AuthTextField({
  label,
  error,
  secureTextEntry,
  ...inputProps
}: AuthTextFieldProps) {
  const theme = useTheme();
  const hasError = Boolean(error);
  const isSecureField = secureTextEntry === true;
  const [passwordVisible, setPasswordVisible] = useState(false);
  const masked = isPasswordMasked(isSecureField, passwordVisible);

  const togglePasswordVisibility = (event: GestureResponderEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPasswordVisible((current) => !current);
  };

  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View style={styles.inputWrap}>
        <TextInput
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardAppearance={theme.scheme === 'dark' ? 'dark' : 'light'}
          {...inputProps}
          secureTextEntry={masked}
          style={[
            styles.input,
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: hasError ? theme.danger : theme.border,
            },
            isSecureField ? styles.inputWithToggle : null,
            inputProps.style,
          ]}
        />
        {isSecureField ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisibilityLabel(passwordVisible)}
            hitSlop={0}
            onPressIn={(event) => {
              event.preventDefault();
            }}
            onPress={togglePasswordVisibility}
            style={({ pressed }) => [
              styles.toggle,
              { opacity: pressed ? 0.7 : 1 },
            ]}>
            <SymbolView
              name={
                passwordVisible
                  ? { ios: 'eye', android: 'visibility', web: 'visibility' }
                  : {
                      ios: 'eye.slash',
                      android: 'visibility_off',
                      web: 'visibility_off',
                    }
              }
              size={22}
              tintColor={theme.textSecondary}
            />
          </Pressable>
        ) : null}
      </View>
      {hasError ? (
        <ThemedText type="meta" style={{ color: theme.danger }}>
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: Spacing.one,
  },
  inputWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
    borderWidth: 1,
  },
  inputWithToggle: {
    paddingRight: 52,
  },
  toggle: {
    position: 'absolute',
    right: 2,
    top: 2,
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
});
