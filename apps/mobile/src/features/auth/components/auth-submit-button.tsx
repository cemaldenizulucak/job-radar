import { AppButton } from '@/components/app-button';
import type { PressableProps } from 'react-native';

type AuthSubmitButtonProps = PressableProps & {
  label: string;
  loading?: boolean;
};

export function AuthSubmitButton({
  label,
  loading = false,
  disabled,
  onPress,
}: AuthSubmitButtonProps) {
  return (
    <AppButton
      label={label}
      loading={loading}
      disabled={disabled}
      onPress={onPress}
    />
  );
}
