import { Image, useWindowDimensions, type ImageStyle, type StyleProp } from 'react-native';

import {
  BRAND_NAME,
  BrandAssets,
  HORIZONTAL_LOGO_ASPECT_RATIO,
} from '@/constants/branding';
import { Spacing } from '@/constants/theme';

type BrandLogoVariant = 'auth' | 'header';

type BrandLogoProps = {
  variant: BrandLogoVariant;
  accessibilityLabel?: string;
  style?: StyleProp<ImageStyle>;
};

export function BrandLogo({
  variant,
  accessibilityLabel = BRAND_NAME,
  style,
}: BrandLogoProps) {
  const { width: windowWidth } = useWindowDimensions();
  const size = logoSize(variant, windowWidth);

  return (
    <Image
      source={BrandAssets.horizontalLogo}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={[{ width: size.width, height: size.height }, style]}
    />
  );
}

function logoSize(
  variant: BrandLogoVariant,
  windowWidth: number,
): { width: number; height: number } {
  if (variant === 'auth') {
    const width = Math.min(windowWidth - Spacing.four * 2, 240);
    return { width, height: width / HORIZONTAL_LOGO_ASPECT_RATIO };
  }

  const height = windowWidth < 360 ? 32 : 36;
  return { width: height * HORIZONTAL_LOGO_ASPECT_RATIO, height };
}
