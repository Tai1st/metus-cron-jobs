export enum POST_SCHEDULE_STATUS {
    CREATE = 'CREATE',
    BUY_PACKAGE = 'BUY_PACKAGE',
    WAIT_PUBLISH = 'WAIT_PUBLISH',
    FAILURE = 'FAILURE',
    SUCCESS = 'SUCCESS',
}

export enum PostReelStatus {
    WAIT_PUBLISH = 'WAIT_PUBLISH',
    SCHEDULED = 'SCHEDULED', // trạng thái đã lên lịch và chờ đăng
    PROCESSING = 'PROCESSING',
    FAILURE = 'FAILURE',
    SUCCESS = 'SUCCESS',
}
