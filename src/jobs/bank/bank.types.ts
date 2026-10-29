/** Giao dịch ngân hàng đã chuẩn hoá, dùng chung cho Web2M và ACB trực tiếp. */
export interface BankTransaction {
    transactionNumber: number;
    amount: number;
    description: string;
    postingDate?: number;
    type?: string;
    account?: number;
    [key: string]: any;
}

/** Chỉ xử lý tiền VÀO tài khoản. */
export const isIncoming = (tx: BankTransaction): boolean =>
    Number.isFinite(tx.amount) && tx.amount > 0 && String(tx.type ?? '').toUpperCase() !== 'OUT';
