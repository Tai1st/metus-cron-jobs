/**
 * Quy tắc số lẻ nạp USDT. File này KHÔNG phụ thuộc gì khác để FE có thể sao chép nguyên vẹn.
 * FE và cron phải tính giống hệt nhau, nếu không giao dịch sẽ không khớp khách.
 *
 * Mã nạp = prefix + 7 ký tự hex ngẫu nhiên. Số lẻ = 6 chữ số cuối của giá trị thập phân của 7 ký tự hex đó.
 *   '71a89a2' -> 119179682 -> 179682   (khách nạp 10 USDT chuyển 10.179682)
 */

export const USDT_DECIMALS = 6;
const SUFFIX_SPACE = 10 ** USDT_DECIMALS;
const HEX_LENGTH = 7;

/** Số lẻ (0 < s < 1.000.000) của một mã nạp, hoặc null nếu 7 ký tự cuối không phải hex. */
export function usdtSuffix(bankCode: string): number | null {
    const hex = bankCode?.slice(-HEX_LENGTH);
    if (!hex || hex.length !== HEX_LENGTH || !/^[0-9a-f]+$/i.test(hex)) {
        return null;
    }
    let suffix = parseInt(hex, 16) % SUFFIX_SPACE;
    // Tránh số lẻ "tròn" (.25, .5, .125...) vì người lạ hay chuyển các số này.
    if (suffix % 1000 === 0) {
        suffix += 1;
    }
    return suffix;
}

/** Số USDT khách phải chuyển: phần nguyên `whole` + số lẻ của mã nạp, vd (10, 179682) -> '10.179682'. */
export function formatUsdtAmount(whole: number, suffix: number): string {
    return `${whole}.${String(suffix).padStart(USDT_DECIMALS, '0')}`;
}

export interface ParsedUsdtAmount {
    /** Số lẻ 6 chữ số, vd 179682. */
    suffix: number;
    /** Tổng số USDT theo đơn vị 1e-6, là số nguyên để tính tiền không sai số. */
    micro: number;
}

/**
 * Tách số lẻ từ chuỗi số tiền Binance (vd '10.179682' hoặc '10.17968200').
 * Trả về null nếu số tiền không "sạch" 6 chữ số thập phân (còn chữ số khác 0 phía sau) hoặc không hợp lệ.
 */
export function parseUsdtAmount(amount: string): ParsedUsdtAmount | null {
    if (typeof amount !== 'string' || !/^\d+(\.\d+)?$/.test(amount)) {
        return null;
    }
    const [whole, fraction = ''] = amount.split('.');
    if (/[1-9]/.test(fraction.slice(USDT_DECIMALS))) {
        return null;
    }
    const suffix = Number(fraction.slice(0, USDT_DECIMALS).padEnd(USDT_DECIMALS, '0'));
    return { suffix, micro: Number(whole) * SUFFIX_SPACE + suffix };
}

/** Quy đổi USDT (đơn vị 1e-6) sang VND, làm tròn xuống. */
export function usdtToVnd(micro: number, rate: number): number {
    // Làm tròn về số nguyên trước khi chia để loại sai số dấu phẩy động.
    return Math.floor(Math.round(micro * rate) / SUFFIX_SPACE);
}
