import { parseBooleanFlag } from '../scheduler/scheduler-config.service.js';

import { areDevEndpointsEnabled } from './dev-endpoints.guard.js';

describe('areDevEndpointsEnabled', () => {
  it('defaults to disabled', () => {
    expect(areDevEndpointsEnabled(undefined)).toBe(false);
    expect(areDevEndpointsEnabled('')).toBe(false);
    expect(parseBooleanFlag(undefined, false)).toBe(false);
  });

  it('enables only explicit true flags', () => {
    expect(areDevEndpointsEnabled('true')).toBe(true);
    expect(areDevEndpointsEnabled('1')).toBe(true);
    expect(areDevEndpointsEnabled('false')).toBe(false);
  });
});
