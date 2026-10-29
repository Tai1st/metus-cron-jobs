import { formatUsdtAmount, parseUsdtAmount, usdtSuffix, usdtToVnd } from './usdt-amount';

describe('usdtSuffix', () => {
    it('takes the last 6 digits of the decimal value of the 7 hex characters', () => {
        expect(usdtSuffix('71a89a2')).toBe(179682); // 0x71a89a2 = 119179682
        expect(usdtSuffix('metus71a89a2')).toBe(179682);
        expect(usdtSuffix('METUS71A89A2')).toBe(179682);
    });

    it('collides for codes that differ by a multiple of 1,000,000 (known limitation)', () => {
        expect(usdtSuffix('729cbe2')).toBe(179682);
    });

    it('shifts "round" suffixes by 1 so they do not look like human amounts', () => {
        expect(usdtSuffix('00003e8')).toBe(1001); // 0x3e8 = 1000
        expect(usdtSuffix('0000000')).toBe(1);
    });

    it('returns null when the last 7 characters are not hex', () => {
        expect(usdtSuffix('metusxyz1234')).toBeNull();
        expect(usdtSuffix('abc')).toBeNull();
        expect(usdtSuffix('')).toBeNull();
    });
});

describe('formatUsdtAmount', () => {
    it('pads the suffix to 6 decimals', () => {
        expect(formatUsdtAmount(10, 179682)).toBe('10.179682');
        expect(formatUsdtAmount(5, 1001)).toBe('5.001001');
    });
});

describe('parseUsdtAmount', () => {
    it('extracts the suffix and total in micro USDT', () => {
        expect(parseUsdtAmount('10.179682')).toEqual({ suffix: 179682, micro: 10179682 });
        expect(parseUsdtAmount('5.001001')).toEqual({ suffix: 1001, micro: 5001001 });
    });

    it('accepts trailing zeros beyond 6 decimals but rejects extra precision', () => {
        expect(parseUsdtAmount('10.17968200')).toEqual({ suffix: 179682, micro: 10179682 });
        expect(parseUsdtAmount('10.1796821')).toBeNull();
    });

    it('treats whole amounts as suffix 0 and rejects malformed values', () => {
        expect(parseUsdtAmount('10')).toEqual({ suffix: 0, micro: 10000000 });
        expect(parseUsdtAmount('1e-7')).toBeNull();
        expect(parseUsdtAmount('abc')).toBeNull();
        expect(parseUsdtAmount('-5.000001')).toBeNull();
    });

    it('round-trips with formatUsdtAmount', () => {
        const suffix = usdtSuffix('71a89a2');
        expect(parseUsdtAmount(formatUsdtAmount(25, suffix)).suffix).toBe(suffix);
    });
});

describe('usdtToVnd', () => {
    it('converts micro USDT to VND, rounding down', () => {
        expect(usdtToVnd(10179682, 26000)).toBe(264671); // 264671.732
        expect(usdtToVnd(5000000, 26000)).toBe(130000);
    });

    it('is not affected by floating point noise', () => {
        expect(usdtToVnd(5000000, 25500.5)).toBe(127502);
    });
});
