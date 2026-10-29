import { Types } from 'mongoose';
import { UsdtDepositJob } from './usdt-deposit.job';

const deposit = (overrides = {}) => ({
    txId: 'tx1',
    coin: 'USDT',
    network: 'TRX',
    amount: '10.179682',
    address: 'Taddr',
    status: 1,
    insertTime: 1,
    ...overrides,
});

const customer = (bankCode: string) => ({ id: new Types.ObjectId(), bankCode, email: `${bankCode}@x.com` });

function setup({
    deposits = [deposit()],
    claimed = true,
    lookup = { status: 'one', customer: customer('metus71a89a2') } as any,
    config = { rate: 26000, minAmount: 5 },
    configError = null as Error | null,
} = {}) {
    const binance = { depositHistory: jest.fn().mockResolvedValue(deposits) };
    const settings = {
        getConfig: configError ? jest.fn().mockRejectedValue(configError) : jest.fn().mockResolvedValue(config),
    };
    const customers = { find: jest.fn().mockResolvedValue(lookup) };
    const credit = { credit: jest.fn().mockResolvedValue(264671) };
    const telegram = { sendToTransaction: jest.fn(), sendToError: jest.fn() };
    const ledger = {
        find: jest.fn().mockReturnValue({ select: () => ({ lean: () => Promise.resolve([]) }) }),
        updateOne: jest.fn().mockResolvedValue({ upsertedCount: claimed ? 1 : 0 }),
    };
    const job = new UsdtDepositJob(
        binance as any,
        settings as any,
        customers as any,
        credit as any,
        telegram as any,
        ledger as any,
    );
    return { job, binance, settings, customers, credit, telegram, ledger };
}

describe('UsdtDepositJob', () => {
    beforeEach(() => {
        process.env.JOB_USDT_ENABLE = 'true';
    });
    afterEach(() => {
        delete process.env.JOB_USDT_ENABLE;
    });

    it('does nothing when the job flag is off', async () => {
        process.env.JOB_USDT_ENABLE = 'false';
        const { job, binance } = setup();
        await job.run();
        expect(binance.depositHistory).not.toHaveBeenCalled();
    });

    it('credits the matching customer', async () => {
        const { job, credit, ledger } = setup();
        await job.run();
        expect(credit.credit).toHaveBeenCalledWith(
            expect.objectContaining({ micro: 10179682, network: 'TRX', txId: 'tx1', rate: 26000 }),
        );
        expect(ledger.updateOne).toHaveBeenLastCalledWith(
            { txId: 'tx1' },
            { $set: expect.objectContaining({ status: 'CREDITED', vndAmount: 264671 }) },
        );
    });

    it('ignores networks other than BSC/ETH/TON/TRX and deposits not yet credited by Binance', async () => {
        const { job, credit, ledger } = setup({
            deposits: [deposit({ network: 'SOL' }), deposit({ txId: 'tx2', status: 0 })],
        });
        await job.run();
        expect(ledger.updateOne).not.toHaveBeenCalled();
        expect(credit.credit).not.toHaveBeenCalled();
    });

    it('does not credit twice when another run already claimed the transaction', async () => {
        const { job, credit } = setup({ claimed: false });
        await job.run();
        expect(credit.credit).not.toHaveBeenCalled();
    });

    it('does not credit below the minimum amount', async () => {
        const { job, credit, telegram } = setup({ deposits: [deposit({ amount: '4.179682' })] });
        await job.run();
        expect(credit.credit).not.toHaveBeenCalled();
        expect(telegram.sendToTransaction).toHaveBeenCalledWith(expect.stringContaining('UNMATCHED'));
    });

    it('does not credit when the suffix belongs to no customer', async () => {
        const { job, credit } = setup({ lookup: { status: 'none' } });
        await job.run();
        expect(credit.credit).not.toHaveBeenCalled();
    });

    it('does not credit when several customers share the suffix', async () => {
        const lookup = { status: 'many', customers: [customer('metus71a89a2'), customer('metus729cbe2')] };
        const { job, credit, telegram, ledger } = setup({ lookup });
        await job.run();
        expect(credit.credit).not.toHaveBeenCalled();
        expect(ledger.updateOne).toHaveBeenLastCalledWith(
            { txId: 'tx1' },
            { $set: expect.objectContaining({ status: 'AMBIGUOUS' }) },
        );
        expect(telegram.sendToTransaction).toHaveBeenCalledWith(expect.stringContaining('metus729cbe2'));
    });

    it('does not credit a whole-number amount', async () => {
        const { job, credit } = setup({ deposits: [deposit({ amount: '10' })], lookup: { status: 'none' } });
        await job.run();
        expect(credit.credit).not.toHaveBeenCalled();
    });

    it('does not claim any transaction when the rate is not configured', async () => {
        const { job, ledger, telegram } = setup({ configError: new Error('Chưa cấu hình tỉ giá') });
        await job.run();
        expect(ledger.updateOne).not.toHaveBeenCalled();
        expect(telegram.sendToError).toHaveBeenCalled();
    });

    it('marks the transaction ERROR (no retry) when crediting fails', async () => {
        const { job, credit, ledger, telegram } = setup();
        credit.credit.mockRejectedValue(new Error('db down'));
        await job.run();
        expect(credit.credit).toHaveBeenCalledTimes(1);
        expect(ledger.updateOne).toHaveBeenLastCalledWith(
            { txId: 'tx1' },
            { $set: expect.objectContaining({ status: 'ERROR' }) },
        );
        expect(telegram.sendToTransaction).toHaveBeenCalledWith(expect.stringContaining('db down'));
    });
});
