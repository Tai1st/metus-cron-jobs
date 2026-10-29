import { of, throwError } from 'rxjs';
import { TelegramProvider } from './telegram.provider';

jest.mock('@/common/utils', () => ({ delay: () => Promise.resolve() }));

const makeProvider = (env: Record<string, string>, post: jest.Mock) =>
    new TelegramProvider({ post } as any, { get: (key: string) => env[key] } as any);

// Cho hàng đợi gửi (chạy nền) xử lý xong.
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe('TelegramProvider', () => {
    const env = { TELEGRAM_BOT_TOKEN: 'TOKEN', TELEGRAM_CHAT_TRANSACTION: '-100123', TELEGRAM_THREAD_TRANSACTION: '7' };

    it('posts plain text to the configured chat and topic', async () => {
        const post = jest.fn().mockReturnValue(of({}));
        await makeProvider(env, post).sendToTransaction('xin chào');
        await flush();

        expect(post).toHaveBeenCalledTimes(1);
        const [url, body] = post.mock.calls[0];
        expect(url).toBe('https://api.telegram.org/botTOKEN/sendMessage');
        expect(body).toMatchObject({ chat_id: '-100123', text: 'xin chào', message_thread_id: 7 });
        expect(body.parse_mode).toBeUndefined();
    });

    it('skips channels that are not configured', async () => {
        const post = jest.fn();
        await makeProvider(env, post).sendToSMM('x');
        await flush();
        expect(post).not.toHaveBeenCalled();
    });

    it('drops identical messages sent again within the window', async () => {
        const post = jest.fn().mockReturnValue(of({}));
        const provider = makeProvider(env, post);
        await provider.sendToTransaction('lỗi A');
        await provider.sendToTransaction('lỗi A');
        await provider.sendToTransaction('lỗi B');
        await flush();
        expect(post).toHaveBeenCalledTimes(2);
    });

    it('truncates messages longer than 4096 characters', async () => {
        const post = jest.fn().mockReturnValue(of({}));
        await makeProvider(env, post).sendToTransaction('a'.repeat(5000));
        await flush();
        expect(post.mock.calls[0][1].text).toHaveLength(4096);
    });

    it('retries after HTTP 429 and never throws on failure', async () => {
        const rateLimited = { response: { status: 429, data: { parameters: { retry_after: 1 } } } };
        const post = jest
            .fn()
            .mockReturnValueOnce(throwError(() => rateLimited))
            .mockReturnValueOnce(of({}));
        await expect(makeProvider(env, post).sendToTransaction('retry me')).resolves.toBeUndefined();
        await flush();
        expect(post).toHaveBeenCalledTimes(2);

        const failing = jest.fn().mockReturnValue(throwError(() => new Error('boom')));
        await expect(makeProvider(env, failing).sendToTransaction('fail')).resolves.toBeUndefined();
        await flush();
    });
});
