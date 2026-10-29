const TRUTHY = ['1', 'true', 'yes', 'on'];
const FALSY = ['0', 'false', 'no', 'off'];

/**
 * Đọc cờ bật/tắt từ env. "false" / "0" thực sự là tắt (khác với kiểm tra truthy của chuỗi).
 * Giá trị không nhận diện được -> dùng `fallback`.
 */
export const envFlag = (name: string, fallback: boolean): boolean => {
    const value = process.env[name]?.trim().toLowerCase();
    if (!value) {
        return fallback;
    }
    if (TRUTHY.includes(value)) {
        return true;
    }
    if (FALSY.includes(value)) {
        return false;
    }
    return fallback;
};
