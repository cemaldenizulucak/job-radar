import { describe, expect, it } from 'vitest';

import { resolveApiBaseUrl } from './api-base-url';

describe('resolveApiBaseUrl', () => {
  it('uses the configured LAN API URL without a trailing slash', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: 'http://192.168.1.6:3000/',
        extraUrl: null,
        platform: 'android',
        isPhysicalDevice: true,
        metroHost: '192.168.1.6:8081',
      }),
    ).toBe('http://192.168.1.6:3000');
  });

  it('does not use localhost on a physical Android device', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: 'http://localhost:3000',
        extraUrl: null,
        platform: 'android',
        isPhysicalDevice: true,
        metroHost: '192.168.1.6:8081',
      }),
    ).toBe('http://192.168.1.6:3000');
  });

  it('prefers extra.apiBaseUrl over a localhost env fallback', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: 'http://localhost:3000',
        extraUrl: 'http://192.168.1.6:3000',
        platform: 'android',
        isPhysicalDevice: true,
        metroHost: null,
      }),
    ).toBe('http://192.168.1.6:3000');
  });

  it('keeps localhost for the iOS simulator and web', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: null,
        extraUrl: null,
        platform: 'web',
        isPhysicalDevice: false,
        metroHost: null,
      }),
    ).toBe('http://localhost:3000');
    expect(
      resolveApiBaseUrl({
        envUrl: 'http://localhost:3000',
        extraUrl: null,
        platform: 'ios',
        isPhysicalDevice: false,
        metroHost: '127.0.0.1:8081',
      }),
    ).toBe('http://localhost:3000');
  });

  it('does not use localhost on a physical iOS device', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: 'http://localhost:3000',
        extraUrl: null,
        platform: 'ios',
        isPhysicalDevice: true,
        metroHost: '192.168.1.6:8081',
      }),
    ).toBe('http://192.168.1.6:3000');
  });

  it('uses EXPO_PUBLIC_API_BASE_URL as-is when it is not loopback', () => {
    expect(
      resolveApiBaseUrl({
        envUrl: 'https://api.example.com',
        extraUrl: null,
        platform: 'ios',
        isPhysicalDevice: true,
        metroHost: '192.168.1.6:8081',
      }),
    ).toBe('https://api.example.com');
  });
});
