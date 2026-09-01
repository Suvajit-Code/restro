import 'express-session';

declare module 'express-session' {
    interface SessionData {
        userId:       number | string;
        role:         string;
        name:         string;
        shopId:       string;
        attendanceId: number | string;
    }
}
