import { SettingKey } from '@/enums/common.enum';
import { Setting } from '@/schemas';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';

export const DEFAULT_USDT_MIN_AMOUNT = 5;

export interface UsdtConfig {
    /** VND cho 1 USDT. */
    rate: number;
    /** USDT tối thiểu mỗi lần nạp. */
    minAmount: number;
}

@Injectable()
export class UsdtSettingsService {
    constructor(@InjectModel(Setting.name) private readonly settingModel: Model<Setting>) {}

    /** Đọc setting USDT_INFO. Ném lỗi nếu chưa cấu hình tỉ giá hợp lệ (không được tự đoán tỉ giá). */
    async getConfig(): Promise<UsdtConfig> {
        const setting = await this.settingModel.findOne({ key: SettingKey.USDT_INFO });
        const rate = Number(setting?.value?.rate);
        if (!Number.isFinite(rate) || rate <= 0) {
            throw new Error('Chưa cấu hình tỉ giá USDT (setting USDT_INFO.rate)');
        }
        const minAmount = Number(setting?.value?.minAmount);
        return { rate, minAmount: Number.isFinite(minAmount) && minAmount > 0 ? minAmount : DEFAULT_USDT_MIN_AMOUNT };
    }
}
