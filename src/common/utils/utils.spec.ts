import { envFlag, escapeRegExp, SingleFlight } from './index';

describe('envFlag', () => {
    afterEach(() => delete process.env.TEST_FLAG);

    it.each([
        ['true', true],
        ['1', true],
        ['false', false],
        ['0', false],
        ['FALSE', false],
    ])('parses %s', (value, expected) => {
        process.env.TEST_FLAG = value;
        expect(envFlag('TEST_FLAG', !expected)).toBe(expected);
    });

    it('uses fallback when unset or unrecognised', () => {
        expect(envFlag('TEST_FLAG', true)).toBe(true);
        process.env.TEST_FLAG = 'maybe';
        expect(envFlag('TEST_FLAG', false)).toBe(false);
    });
});

describe('escapeRegExp', () => {
    it('escapes regex metacharacters', () => {
        expect(new RegExp(escapeRegExp('a.b(c)+')).test('a.b(c)+')).toBe(true);
        expect(new RegExp(escapeRegExp('a.b')).test('axb')).toBe(false);
    });
});

describe('SingleFlight', () => {
    it('skips a run while the previous one is still going', async () => {
        const flight = new SingleFlight();
        let release: () => void;
        const first = flight.run(() => new Promise<void>((resolve) => (release = resolve)));
        expect(await flight.run(async () => undefined)).toBe(false);
        release();
        await first;
        expect(await flight.run(async () => undefined)).toBe(true);
    });

    it('frees the lock when the task throws', async () => {
        const flight = new SingleFlight();
        await expect(flight.run(async () => Promise.reject(new Error('x')))).rejects.toThrow('x');
        expect(await flight.run(async () => undefined)).toBe(true);
    });
});
