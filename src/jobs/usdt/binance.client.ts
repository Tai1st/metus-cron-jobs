import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import { firstValueFrom } from 'rxjs';

export interface BinanceDeposit {
    txId: string;
    coin: string;
    network: string;
    // Số tiền dạng chuỗi, vd '10.179682'.
    amount: string;
    address: string;
    addressTag?: string;
    // 1 = đã ghi có.
    status: number;
    insertTime: number;
}

export interface BinanceDepositAddress {
    address: string;
    // Memo/tag bắt buộc với một số mạng (vd TON); chuỗi rỗng nếu không cần.
    tag: string;
}

/** Client Binance chỉ-đọc (cần API key có quyền "Enable Reading", nên khóa theo IP server). */
@Injectable()
export class BinanceClient {
    constructor(
        private readonly http: HttpService,
        private readonly config: ConfigService,
    ) {}

    isConfigured(): boolean {
        return !!(this.config.get('BINANCE_API_KEY') && this.config.get('BINANCE_API_SECRET'));
    }

    /** Lịch sử nạp USDT đã ghi có kể từ `sinceMs`. */
    depositHistory(sinceMs: number): Promise<BinanceDeposit[]> {
        return this.signedGet<BinanceDeposit[]>('/sapi/v1/capital/deposit/hisrec', {
            coin: 'USDT',
            status: 1,
            startTime: sinceMs,
            limit: 1000,
        });
    }

    depositAddress(network: string): Promise<BinanceDepositAddress> {
        return this.signedGet<BinanceDepositAddress>('/sapi/v1/capital/deposit/address', { coin: 'USDT', network });
    }

    private async signedGet<T>(path: string, params: Record<string, string | number>): Promise<T> {
        const key = this.config.get<string>('BINANCE_API_KEY');
        const secret = this.config.get<string>('BINANCE_API_SECRET');
        if (!key || !secret) {
            throw new Error('Chưa cấu hình BINANCE_API_KEY / BINANCE_API_SECRET');
        }
        const query = new URLSearchParams(
            Object.entries({ ...params, timestamp: Date.now(), recvWindow: 10000 }).map(([k, v]) => [k, String(v)]),
        ).toString();
        const signature = createHmac('sha256', secret).update(query).digest('hex');
        const base = this.config.get<string>('BINANCE_API_BASE') || 'https://api.binance.com';

        const { data } = await firstValueFrom(
            this.http.get<T>(`${base}${path}?${query}&signature=${signature}`, { headers: { 'X-MBX-APIKEY': key } }),
        );
        return data;
    }
}
