import type { ConfigContext, ExpoConfig } from 'expo/config';

function isProductionBuild(): boolean {
  return process.env.EAS_BUILD_PROFILE === 'production';
}

function allowCleartextLocalApi(): boolean {
  return !isProductionBuild();
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];

  plugins.push([
    'expo-build-properties',
    {
      android: {
        usesCleartextTraffic: allowCleartextLocalApi(),
      },
    },
  ]);

  const ios = {
    ...(config.ios ?? {}),
    bundleIdentifier:
      config.ios?.bundleIdentifier ?? 'com.ulucakcemaldeniz.jobradar',
    infoPlist: {
      ...(config.ios?.infoPlist ?? {}),
      ...(allowCleartextLocalApi()
        ? {
            NSAppTransportSecurity: {
              NSAllowsLocalNetworking: true,
            },
          }
        : {}),
    },
  };

  return {
    ...config,
    name: config.name ?? 'JobRadar',
    plugins,
    ios,
    extra: {
      ...(config.extra ?? {}),
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL?.trim() ?? '',
    },
  } as ExpoConfig;
};
