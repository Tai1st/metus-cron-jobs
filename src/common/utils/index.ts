export * from './env';
export * from './single-flight';

export const delay = (time: number) => new Promise((resolve) => setTimeout(resolve, time));

export function customRound(number: number): number {
    if (Math.abs(number) >= 1) {
        // Làm tròn 1 chữ số sau dấu phẩy nếu số >= 1
        return Math.round(number * 10) / 10;
    }
    // Làm tròn ngay sau chữ số có ý nghĩa đầu tiên
    let factor = 1;
    while (Math.abs(number * factor) < 1) {
        factor *= 10;
    }
    return Math.round(number * factor) / factor;
}

export const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getFBHeaders = (cookie?: string): AnyObject | undefined => {
    if (!cookie) {
        return undefined;
    }
    return {
        authority: 'graph.facebook.com',
        accept: '*/*',
        'accept-language': 'vi,en;q=0.9',
        cookie,
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'none',
        'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/113.0.0.0 Safari/537.36',
    };
};

/** Lấy message lỗi dễ đọc từ lỗi axios / Facebook Graph / Error thường. */
export const getErrorMessage = (error: any): string => {
    const fb = error?.response?.data?.error;
    return (
        fb?.error_user_msg ||
        fb?.error_user_title ||
        fb?.message ||
        error?.response?.data?.message ||
        error?.response?.data?.msg ||
        error?.response?.data?.description ||
        error?.message ||
        'Unknown error'
    );
};
