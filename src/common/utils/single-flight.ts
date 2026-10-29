/** Chặn một cron chạy chồng lên lượt trước khi lượt trước chưa xong. */
export class SingleFlight {
    private running = false;

    /** Trả về false nếu lượt trước vẫn đang chạy (bỏ qua lượt này). */
    async run(task: () => Promise<void>): Promise<boolean> {
        if (this.running) {
            return false;
        }
        this.running = true;
        try {
            await task();
        } finally {
            this.running = false;
        }
        return true;
    }
}
