import { GCCourseId, GCWorkoutId, GarminDomain } from './types';

export class UrlClass {
    domain: GarminDomain;
    GC_MODERN: string;
    GARMIN_SSO_ORIGIN: string;
    GC_API: string;
    constructor(domain: GarminDomain = 'garmin.com') {
        this.domain = domain;
        this.GC_MODERN = `https://connect.${this.domain}/modern`;
        this.GARMIN_SSO_ORIGIN = `https://sso.${this.domain}`;
        this.GC_API = `https://connectapi.${this.domain}`;
    }
    get GARMIN_SSO() {
        return `${this.GARMIN_SSO_ORIGIN}/sso`;
    }
    get GARMIN_SSO_EMBED() {
        return `${this.GARMIN_SSO_ORIGIN}/sso/embed`;
    }
    get BASE_URL() {
        return `${this.GC_MODERN}/proxy`;
    }
    get SIGNIN_URL() {
        return `${this.GARMIN_SSO}/signin`;
    }
    get LOGIN_URL() {
        return `${this.GARMIN_SSO}/login`;
    }
    get OAUTH_URL() {
        return `${this.GC_API}/oauth-service/oauth`;
    }
    get USER_SETTINGS() {
        return `${this.GC_API}/userprofile-service/userprofile/user-settings/`;
    }
    get USER_PROFILE() {
        return `${this.GC_API}/userprofile-service/socialProfile`;
    }
    get ACTIVITIES() {
        return `${this.GC_API}/activitylist-service/activities/search/activities`;
    }
    get ACTIVITY() {
        return `${this.GC_API}/activity-service/activity/`;
    }
    get STAT_ACTIVITIES() {
        return `${this.GC_API}/fitnessstats-service/activity`;
    }
    get DOWNLOAD_ZIP() {
        return `${this.GC_API}/download-service/files/activity/`;
    }
    get DOWNLOAD_GPX() {
        return `${this.GC_API}/download-service/export/gpx/activity/`;
    }
    get DOWNLOAD_TCX() {
        return `${this.GC_API}/download-service/export/tcx/activity/`;
    }
    get DOWNLOAD_KML() {
        return `${this.GC_API}/download-service/export/kml/activity/`;
    }
    get UPLOAD() {
        return `${this.GC_API}/upload-service/upload/`;
    }
    get DOWNLOAD_WELLNESS() {
        return `${this.GC_API}/download-service/files/wellness/`;
    }
    get IMPORT_DATA() {
        return `${this.GC_API}/modern/import-data`;
    }
    get DAILY_STEPS() {
        return `${this.GC_API}/usersummary-service/stats/steps/daily/`;
    }
    get DAILY_SLEEP() {
        return `${this.GC_API}/sleep-service/sleep/dailySleepData`;
    }
    get SLEEP_DAILY_SUMMARY() {
        return `${this.GC_API}/sleep-service/stats/sleep/daily`;
    }
    get HRV() {
        return `${this.GC_API}/hrv-service/hrv`;
    }
    get HRV_DAILY_SUMMARY() {
        return `${this.GC_API}/hrv-service/hrv/daily`;
    }
    get TRAINING_STATUS_DAILY() {
        return `${this.GC_API}/metrics-service/metrics/trainingstatus/daily`;
    }
    get TRAINING_STATUS_WEEKLY() {
        return `${this.GC_API}/metrics-service/metrics/trainingstatus/weekly`;
    }
    get TRAINING_LOAD_BALANCE() {
        return `${this.GC_API}/metrics-service/metrics/trainingloadbalance/latest`;
    }
    get PERSONAL_INFO() {
        return `${this.GC_API}/userprofile-service/userprofile/personal-information`;
    }
    get DAILY_WEIGHT() {
        return `${this.GC_API}/weight-service/weight/dayview`;
    }
    get UPDATE_WEIGHT() {
        return `${this.GC_API}/weight-service/user-weight`;
    }
    get DAILY_HYDRATION() {
        return `${this.GC_API}/usersummary-service/usersummary/hydration/allData`;
    }
    get HYDRATION_LOG() {
        return `${this.GC_API}/usersummary-service/usersummary/hydration/log`;
    }
    get GOLF_SCORECARD_SUMMARY() {
        return `${this.GC_API}/gcs-golfcommunity/api/v2/scorecard/summary`;
    }
    get GOLF_SCORECARD_DETAIL() {
        return `${this.GC_API}/gcs-golfcommunity/api/v2/scorecard/detail`;
    }
    get DAILY_HEART_RATE() {
        return `${this.GC_API}/wellness-service/wellness/dailyHeartRate`;
    }
    WORKOUT(id?: GCWorkoutId) {
        if (id) {
            return `${this.GC_API}/workout-service/workout/${id}`;
        }
        return `${this.GC_API}/workout-service/workout`;
    }
    get WORKOUTS() {
        return `${this.GC_API}/workout-service/workouts`;
    }
    get SCHEDULE_WORKOUTS() {
        return `${this.GC_API}/workout-service/schedule/`;
    }

    // Garmin use month 0-11, not real month.
    CALENDAR(yaer: number, month: number) {
        return `${this.GC_API}/calendar-service/year/${yaer}/month/${month}`;
    }
    COURSE(id?: GCCourseId) {
        if (id) {
            return `${this.GC_API}/course-service/course/${id}`;
        }
        return `${this.GC_API}/course-service/course`;
    }
    COURSE_FIT(id: GCCourseId, elevation = true) {
        return `${this.GC_API}/course-service/course/fit/${id}/0?elevation=${elevation}`;
    }
    COURSE_GPX(id: GCCourseId) {
        return `${this.GC_API}/course-service/course/gpx/${id}`;
    }

    get COURSE_IMPORT() {
        return `${this.GC_API}/course-service/course/import`;
    }

    get COURSE_FAVORITE() {
        return `${this.GC_API}/course-service/course/favorites`;
    }
    get COURSE_OWNER() {
        return `${this.GC_API}/web-gateway/course/owner/`;
    }

    get CONSENT_GRANT() {
        return `${this.GC_API}/gdprconsent-service/consent/grant`;
    }
    get ACCOUNT_DEVICE_SYNC() {
        return `${this.GC_API}/userpreference-service/account.deviceSync`;
    }
}
