module.exports = {
    apps: [
        {
            name: 'metus_cron',
            script: 'dist/main.js',
            // Phải chạy đúng 1 instance: cron và job hẹn giờ lưu trong bộ nhớ.
            instances: 1,
            exec_mode: 'fork',
            watch: false,
            env: { NODE_ENV: 'production' },
        },
    ],
};
