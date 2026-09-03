export const BRAND_NAME = 'JobRadar';

export const BrandAssets = {
  appIcon: require('../../assets/jobradar-app-icon.png'),
  horizontalLogo: require('../../assets/jobradar-horizontal-logo.png'),
} as const;

/** Native pixel size of `jobradar-horizontal-logo.png`. */
export const HORIZONTAL_LOGO_SIZE = {
  width: 440,
  height: 130,
} as const;

export const HORIZONTAL_LOGO_ASPECT_RATIO =
  HORIZONTAL_LOGO_SIZE.width / HORIZONTAL_LOGO_SIZE.height;
