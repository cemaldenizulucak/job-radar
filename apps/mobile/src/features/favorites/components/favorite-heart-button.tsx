import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Radius } from '@/constants/theme';
import { jobsCopy } from '@/features/jobs/copy';
import { useTheme } from '@/hooks/use-theme';

type FavoriteHeartButtonProps = {
  isFavorite: boolean;
  onToggle: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export function FavoriteHeartButton({
  isFavorite,
  onToggle,
  disabled = false,
  style,
}: FavoriteHeartButtonProps) {
  const theme = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const skipAnimation = useRef(true);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (skipAnimation.current) {
      skipAnimation.current = false;
      return;
    }

    Animated.sequence([
      Animated.timing(scale, {
        toValue: 1.16,
        duration: 90,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 220,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [isFavorite, scale]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        isFavorite ? jobsCopy.favoriteRemove : jobsCopy.favoriteAdd
      }
      accessibilityState={{ selected: isFavorite, disabled }}
      disabled={disabled}
      hitSlop={4}
      focusable
      onPress={(event) => {
        event.stopPropagation();
        if (disabled) {
          return;
        }
        onToggle();
      }}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      style={({ pressed }) => [
        styles.button,
        {
          borderColor: isFocused ? theme.accent : 'transparent',
          opacity: disabled ? 0.55 : pressed ? 0.82 : 1,
        },
        style,
        Platform.OS === 'web'
          ? ({
              outlineStyle: 'solid',
              outlineWidth: isFocused ? 2 : 0,
              outlineColor: theme.accent,
              cursor: 'pointer',
            } as ViewStyle)
          : null,
      ]}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <SymbolView
          name={
            isFavorite
              ? { ios: 'heart.fill', android: 'favorite', web: 'favorite' }
              : { ios: 'heart', android: 'favorite_border', web: 'favorite_border' }
          }
          size={22}
          tintColor={isFavorite ? theme.danger : theme.textSecondary}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
});
