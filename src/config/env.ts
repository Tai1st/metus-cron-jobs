const REQUIRED = ['DATABASE_URI', 'DATABASE_NAME', 'JWT_CLIENT_SECRET_KEY', 'TELEGRAM_BOT_TOKEN'];

export function validateEnv(config: Record<string, any>): Record<string, any> {
    const missing = REQUIRED.filter((key) => !config[key]);
    if (missing.length) {
        throw new Error(`Thiếu biến môi trường bắt buộc: ${missing.join(', ')}`);
    }
    if (String(config.JWT_CLIENT_SECRET_KEY).length < 16) {
        throw new Error('JWT_CLIENT_SECRET_KEY quá ngắn (tối thiểu 16 ký tự)');
    }
    return config;
}
