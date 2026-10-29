import { Customer, CustomerDocument } from '@/schemas';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { usdtSuffix } from './usdt-amount';

export interface CustomerRef {
    id: Types.ObjectId;
    bankCode: string;
    email?: string;
}

export type CustomerLookup =
    { status: 'none' } | { status: 'one'; customer: CustomerRef } | { status: 'many'; customers: CustomerRef[] };

const CACHE_TTL_MS = 60 * 1000;
// Gặp số lẻ chưa có thì tải lại chỉ mục (bắt kịp khách mới đăng ký), nhưng không quá thường xuyên.
const MIN_REBUILD_INTERVAL_MS = 10 * 1000;

/** Tra ngược từ số lẻ ra khách: chỉ mục `suffix -> khách` dựng từ bankCode của toàn bộ khách. */
@Injectable()
export class UsdtCustomerIndex {
    private bySuffix = new Map<number, CustomerRef[]>();
    private builtAt = 0;

    constructor(@InjectModel(Customer.name) private readonly customerModel: Model<CustomerDocument>) {}

    async find(suffix: number): Promise<CustomerLookup> {
        if (Date.now() - this.builtAt > CACHE_TTL_MS) {
            await this.rebuild();
        }
        let found = this.bySuffix.get(suffix);
        if (!found && Date.now() - this.builtAt > MIN_REBUILD_INTERVAL_MS) {
            await this.rebuild();
            found = this.bySuffix.get(suffix);
        }
        if (!found?.length) {
            return { status: 'none' };
        }
        return found.length === 1 ? { status: 'one', customer: found[0] } : { status: 'many', customers: found };
    }

    private async rebuild(): Promise<void> {
        const customers = await this.customerModel.find({}, { bankCode: 1, email: 1 }).lean();
        const next = new Map<number, CustomerRef[]>();
        for (const customer of customers) {
            const suffix = usdtSuffix(customer.bankCode);
            if (suffix === null) {
                continue;
            }
            const ref: CustomerRef = { id: customer._id, bankCode: customer.bankCode, email: customer.email };
            next.set(suffix, [...(next.get(suffix) ?? []), ref]);
        }
        this.bySuffix = next;
        this.builtAt = Date.now();
    }
}
