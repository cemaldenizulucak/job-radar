import { AppButton } from '@/components/app-button';
import { uiCopy } from '@/constants/ui';

type BackButtonProps = {
  onPress: () => void;
  label?: string;
};

export function BackButton({ onPress, label = uiCopy.back }: BackButtonProps) {
  return <AppButton label={label} variant="ghost" onPress={onPress} />;
}
