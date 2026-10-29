import { DepositService } from './deposit.service';

describe('DepositService.extractBankCode', () => {
    const service = new DepositService(null, null, null, null, null);

    it('extracts prefix + code, case-insensitive', () => {
        expect(service.extractBankCode('NGUYEN VAN A chuyen tien METUS12AB', 'metus')).toBe('metus12ab');
    });

    it('returns null when there is no code or prefix', () => {
        expect(service.extractBankCode('chuyen tien an trua', 'metus')).toBeNull();
        expect(service.extractBankCode('metus123', '')).toBeNull();
    });

    it('does not treat the prefix as a regex', () => {
        expect(service.extractBankCode('abc xyz123', 'a.c')).toBeNull();
        expect(service.extractBankCode('a.c xyz', '(')).toBeNull();
    });
});
