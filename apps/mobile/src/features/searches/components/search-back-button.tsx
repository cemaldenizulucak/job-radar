import { BackButton } from '@/components/back-button';

type SearchBackButtonProps = {
  onPress: () => void;
};

export function SearchBackButton({ onPress }: SearchBackButtonProps) {
  return <BackButton onPress={onPress} />;
}
