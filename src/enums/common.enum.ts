export enum OtpAction {
    NEW_REGISTRATION = 'NEW_REGISTRATION',
    FORGOT_PASSWORD = 'FORGOT_PASSWORD',
}

export enum CustomerActivity {
    ADD_FACEBOOK = 'ADD_FACEBOOK',
    BUY_PACKAGE = 'BUY_PACKAGE',
    RECHARGE = 'RECHARGE',
}

export enum LoginProvider {
    local = 'local',
    google = 'google',
    facebook = 'facebook',
}

export enum CronName {
    POST_SCHEDULE = 'POST_SCHEDULE',
}

export enum SettingKey {
    BANK_ACCOUNT = 'BANK_ACCOUNT',
    BANK_INFO = 'BANK_INFO',
}

export enum TransactionStatus {
    SUCCESS = 'SUCCESS',
}

export enum TransactionType {
    RECHARGE = 'RECHARGE',
    AFFILIATE = 'AFFILIATE',
}
