# metus-cron-jobs

Service NestJS chạy nền cho Metus. Dùng chung MongoDB với `metus-backend` (ghi trực tiếp vào DB, schema nằm ở `src/schemas`, phải giữ đồng bộ với BE).

## Job

| Job | Lịch | Cờ bật/tắt (mặc định) |
|---|---|---|
| `jobs/bank/web2m-bank.job.ts` — nạp tiền qua Web2M (tài khoản ACB của Metus) | 10s | `JOB_BANK_ENABLE` (true) |
| `jobs/bank/acb-direct-bank.job.ts` — nạp tiền theo từng `Site`, gọi thẳng ACB | 10s | `JOB_AUTO_BANK_ENABLE` (**false**) |
| `jobs/usdt` — nạp tiền USDT qua ví Binance (BSC, ETH, TON, TRX) | 30s | `JOB_USDT_ENABLE` (**false**) |
| `jobs/smm` — đồng bộ giá panel SMM | 5s | `JOB_CHECK_PRICE_ENABLE` (true) |
| `jobs/smm` — đồng bộ trạng thái đơn, hoàn tiền đơn bị hủy | 10s | `JOB_CHECK_SMM_ORDER` (true) |
| `jobs/plan` — gỡ app Facebook khi gói hết hạn | 00:00 ICT | `JOB_CANCEL_PLAN_ENABLE` (true) |
| `modules/tasks`, `modules/reels` — hẹn giờ đăng bài / Reels (BE gọi `POST/PATCH/DELETE /api/tasks`, `/api/reels` kèm JWT của khách) | theo lịch | — |

Cờ nhận `true|false|1|0`. Mỗi cron có khoá `SingleFlight` nên không chạy chồng lượt trước.

## Nạp tiền: cách đảm bảo không cộng trùng

1. Lọc giao dịch đã thấy (`filterUnseen`).
2. `claim`: upsert nguyên tử vào `acbtransactions` với unique index `transactionNumber`. Chỉ lượt thắng mới được cộng tiền.
3. Cộng tiền (`$inc`) + ghi `Transaction`/`Action` + báo Telegram.

Nếu bước 3 lỗi, giao dịch **không** tự thử lại (tránh cộng trùng); service báo Telegram kênh transaction để xử lý tay.

### Trước khi triển khai lần đầu

Unique index chỉ tạo được khi collection không có `transactionNumber` trùng. Kiểm tra:

```js
db.acbtransactions.aggregate([
  { $group: { _id: '$transactionNumber', n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
]);
```

Nếu có kết quả, xử lý các bản ghi trùng trước. Nếu không tạo được index, service ghi log lỗi khi khởi động.

## Nạp USDT

Khách chuyển USDT vào **một ví Binance chung**. Khách được nhận diện bằng **số lẻ** của số tiền, suy ra từ mã nạp:

```js
// mã nạp = prefix + 7 ký tự hex, vd 'metus71a89a2'
const hex = bankCode.slice(-7);              // '71a89a2'
let s = parseInt(hex, 16) % 1000000;         // 119179682 -> 179682
if (s % 1000 === 0) s += 1;                  // tránh số lẻ "tròn"
const amount = `${N}.${String(s).padStart(6, '0')}`;   // nạp N=10 USDT -> '10.179682'
```

FE và cron dùng cùng quy tắc (`src/jobs/usdt/usdt-amount.ts`, file thuần để FE sao chép). Số lẻ chỉ có 1 triệu giá trị nên **hai khách có thể trùng số lẻ**: khi đó giao dịch không được cộng tự động mà báo Telegram để xử lý tay.

- Mạng nhận: `BSC`, `ETH`, `TON`, `TRX`. Tối thiểu mặc định 5 USDT (`USDT_INFO.minAmount`).
- `VND = floor(USDT × USDT_INFO.rate)`; khuyến mại và hoa hồng giới thiệu giống nạp ngân hàng.
- Chống cộng trùng theo `txId` (unique, collection `usdt_transactions`). Giao dịch không tự cộng được có trạng thái `UNMATCHED` / `AMBIGUOUS` / `ERROR` và được báo Telegram.
- Setting cần tạo trong DB: `{ key: 'USDT_INFO', value: { rate: 26000, minAmount: 5 } }`.
- Env: `BINANCE_API_KEY`, `BINANCE_API_SECRET` (key chỉ-đọc, khóa theo IP server), `JOB_USDT_ENABLE=true`.
- FE lấy địa chỉ ví từng mạng, memo (bắt buộc với TON), tỉ giá, mức tối thiểu và số lẻ của khách từ `GET /api/usdt/info` (JWT của khách). Origin của FE khai báo trong `USDT_CORS_ORIGINS`.

## Cấu hình

Sao chép `.env.example` thành `.env`. Bắt buộc: `DATABASE_URI`, `DATABASE_NAME`, `JWT_CLIENT_SECRET_KEY` (trùng secret của BE, tối thiểu 16 ký tự), `TELEGRAM_BOT_TOKEN`. Thiếu là service không khởi động.

## Chạy

```bash
yarn install
yarn start:dev      # phát triển
yarn build && yarn start:prod
yarn test
yarn typecheck
```

Triển khai bằng PM2 (`deploy.sh`). **Chỉ chạy 1 instance**: job hẹn giờ lưu trong bộ nhớ và các cron không có khoá phân tán.
