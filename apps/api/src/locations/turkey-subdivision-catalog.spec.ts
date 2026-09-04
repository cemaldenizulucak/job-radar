import { TURKEY_PROVINCES } from './turkey-subdivision-catalog.js';

describe('Turkey province catalog', () => {
  it('contains the 81 official provinces with unique plate codes', () => {
    expect(TURKEY_PROVINCES).toHaveLength(81);

    const codes = TURKEY_PROVINCES.map((item) => item.code);
    expect(new Set(codes).size).toBe(81);
  });

  it('maps plate codes 34, 35, 36, and 52 to the correct provinces', () => {
    expect(TURKEY_PROVINCES).toEqual(
      expect.arrayContaining([
        { code: '34', name: 'İstanbul' },
        { code: '35', name: 'İzmir' },
        { code: '36', name: 'Kars' },
        { code: '52', name: 'Ordu' },
      ]),
    );

    expect(TURKEY_PROVINCES.find((item) => item.code === '36')?.name).toBe(
      'Kars',
    );
    expect(TURKEY_PROVINCES.find((item) => item.code === '52')?.name).toBe(
      'Ordu',
    );
  });
});
