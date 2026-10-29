import { CustomerDocument } from '@/schemas';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { BinanceClient } from './binance.client';
import { USDT_DECIMALS, usdtSuffix } from './usdt-amount';
import { USDT_NETWORKS } from './usdt-deposit.job';
import { UsdtSettingsService } from './usdt-settings.service';

const ADDRESS_CACHE_TTL_MS = 10 * 60 * 1000;

export interface UsdtNetworkInfo {
    network: string;
    address: string;
    /** Memo/tag bắt buộc nhập khi chuyển (TON); null nếu không cần. */
    memo: string | null;
}

export interface UsdtInfo {
    networks: UsdtNetworkInfo[];
    /** VND cho 1 USDT. */
    rate: number;
    /** USDT tối thiểu mỗi lần nạp. */
    minAmount: number;
    decimals: number;
    /** Số lẻ của khách (6 chữ số), FE dùng để đối chiếu với kết quả tự tính; null nếu mã nạp không hợp lệ. */
    suffix: string | null;
}

/** Thông tin để FE hiển thị màn hình nạp USDT: địa chỉ ví từng mạng, tỉ giá, mức tối thiểu. */
@Injectable()
export class UsdtInfoService {
    private readonly logger = new Logger(UsdtInfoService.name);
    private cache: { at: number; networks: UsdtNetworkInfo[] } | null = null;

    constructor(
        private readonly binance: BinanceClient,
        private readonly settings: UsdtSettingsService,
    ) {}

    async getInfo(customer: CustomerDocument): Promise<UsdtInfo> {
        if (!this.binance.isConfigured()) {
            throw new ServiceUnavailableException('Nạp USDT chưa được cấu hình');
        }
        let config;
        try {
            config = await this.settings.getConfig();
        } catch {
            throw new ServiceUnavailableException('Nạp USDT chưa được cấu hình');
        }
        const networks = await this.getNetworks();
        if (!networks.length) {
            throw new ServiceUnavailableException('Chưa lấy được địa chỉ nạp USDT');
        }
        const suffix = usdtSuffix(customer.bankCode);
        return {
            networks,
            rate: config.rate,
            minAmount: config.minAmount,
            decimals: USDT_DECIMALS,
            suffix: suffix === null ? null : String(suffix).padStart(USDT_DECIMALS, '0'),
        };
    }

    private async getNetworks(): Promise<UsdtNetworkInfo[]> {
        if (this.cache && Date.now() - this.cache.at < ADDRESS_CACHE_TTL_MS) {
            return this.cache.networks;
        }
        const networks: UsdtNetworkInfo[] = [];
        for (const network of USDT_NETWORKS) {
            try {
                const { address, tag } = await this.binance.depositAddress(network);
                networks.push({ network, address, memo: tag || null });
            } catch (error) {
                // Một mạng lỗi thì bỏ qua mạng đó, các mạng còn lại vẫn dùng được.
                this.logger.error(`Không lấy được địa chỉ nạp USDT mạng ${network}: ${error?.message}`);
            }
        }
        // Chỉ cache khi lấy đủ cả 4 mạng, tránh giữ lại kết quả thiếu.
        if (networks.length === USDT_NETWORKS.length) {
            this.cache = { at: Date.now(), networks };
        }
        return networks;
    }
}
