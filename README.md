# metus-cron-jobs

Service NestJS chạy nền cho Metus. Dùng chung MongoDB với `metus-backend` (ghi trực tiếp vào DB, schema nằm ở `src/schemas`, phải giữ đồng bộ với BE).

## Job

| Job | Lịch | Cờ bật/tắt (mặc định) |
|---|---|---|
| `jobs/bank/web2m-bank.job.ts` — nạp tiền qua Web2M (tài khoản ACB của Metus) | 10s | `JOB_BANK_ENABLE` (true) |
| `jobs/bank/acb-direct-bank.job.ts` — nạp tiền theo từng `Site`, gọi thẳng ACB | 10s | `JOB_AUTO_BANK_ENABLE` (**false**) |
| `jobs/smm` — đồng bộ giá panel SMM | 5s | `JOB_CHECK_PRICE_ENABLE` (true) |
| `jobs/smm` — đồng bộ trạng thái đơn, hoàn tiền đơn bị hủy | 10s | `JOB_CHECK_SMM_ORDER` (true) |
| `jobs/plan` — gỡ app Facebook khi gói hết hạn | 00:00 ICT | `JOB_CANCEL_PLAN_ENABLE` (true) |
| `modules/tasks`, `modules/reels` — hẹn giờ đăng bài / Reels (BE gọi `POST/PATCH/DELETE /api/tasks`, `/api/reels` kèm JWT của khách) | theo lịch | — |

Cờ nhận `true|false|1|0`. Mỗi cron có khoá `SingleFlight` nên không chạy chồng lượt trước.

## Nạp tiền: cách đảm bảo không cộng trùng

1. Lọc giao dịch đã thấy (`filterUnseen`).
2. `claim`: upsert nguyên tử vào `acbtransactions` với unique index `transactionNumber`. Chỉ lượt thắng mới được cộng tiền.
3. Cộng tiền (`$inc`) + ghi `Transaction`/`Action` + báo Discord.

Nếu bước 3 lỗi, giao dịch **không** tự thử lại (tránh cộng trùng); service báo Discord kênh transaction để xử lý tay.

### Trước khi triển khai lần đầu

Unique index chỉ tạo được khi collection không có `transactionNumber` trùng. Kiểm tra:

```js
db.acbtransactions.aggregate([
  { $group: { _id: '$transactionNumber', n: { $sum: 1 } } },
  { $match: { n: { $gt: 1 } } },
]);
```

Nếu có kết quả, xử lý các bản ghi trùng trước. Nếu không tạo được index, service ghi log lỗi khi khởi động.

## Cấu hình

Sao chép `.env.example` thành `.env`. Bắt buộc: `DATABASE_URI`, `DATABASE_NAME`, `JWT_CLIENT_SECRET_KEY` (trùng secret của BE, tối thiểu 16 ký tự), `DISCORD_BOT_TOKEN`. Thiếu là service không khởi động.

## Chạy

```bash
yarn install
yarn start:dev      # phát triển
yarn build && yarn start:prod
yarn test
yarn typecheck
```

Triển khai bằng PM2 (`deploy.sh`). **Chỉ chạy 1 instance**: job hẹn giờ lưu trong bộ nhớ và các cron không có khoá phân tán.
