import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/app-button';
import { useTheme } from '@/hooks/use-theme';

import { jobsCopy } from '../copy';

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
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <AppButton label={jobsCopy.back} variant="ghost" onPress={onBack} />
      <AppButton
        label={isFavorite ? jobsCopy.favoriteRemove : jobsCopy.favoriteAdd}
        variant={isFavorite ? 'secondary' : 'ghost'}
        accessibilityLabel={
          isFavorite ? jobsCopy.favoriteRemove : jobsCopy.favoriteAdd
        }
        accessibilityState={{ selected: isFavorite }}
        onPress={onToggleFavorite}
        style={{
          backgroundColor: isFavorite ? theme.accentMuted : undefined,
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
});
