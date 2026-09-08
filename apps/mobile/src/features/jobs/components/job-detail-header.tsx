import { StyleSheet, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { FavoriteHeartButton } from '@/features/favorites/components/favorite-heart-button';

type JobDetailHeaderProps = {
  onBack: () => void;
  isFavorite: boolean;
  onToggleFavorite: () => void;
};

export function JobDetailHeader({
  onBack,
  isFavorite,
  onToggleFavorite,
}: JobDetailHeaderProps) {
  return (
    <View style={styles.row}>
      <BackButton onPress={onBack} />
      <FavoriteHeartButton isFavorite={isFavorite} onToggle={onToggleFavorite} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
});
