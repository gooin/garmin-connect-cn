import FormData from 'form-data';
import _ from 'lodash';
import { DateTime } from 'luxon';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { HttpClient } from '../common/HttpClient';
import { checkIsDirectory, createDirectory, writeToFile } from '../utils';
import { UrlClass } from './UrlClass';
import {
    calculateTimeDifference,
    getLocalTimestamp,
    toDateString
} from './common/DateUtils';
import { convertMLToOunces, convertOuncesToML } from './common/HydrationUtils';
import { gramsToPounds } from './common/WeightUtils';
import {
    ExportFileTypeValue,
    GCUserHash,
    GarminDomain,
    ICalendar,
    ICountActivities,
    IDailyStepsType,
    IGarminTokens,
    IOauth1Token,
    IOauth2Token,
    IScheduleWorkout,
    ISocialProfile,
    IUserSettings,
    IWorkout,
    IWorkoutDetail,
    UploadFileType,
    UploadFileTypeTypeValue,
    GCConfig,
    Listeners
} from './types';
import {
    ActivitySubType,
    ActivityType,
    GCActivityId,
    IActivity
} from './types/activity';
import { ICourse, ICourseDetail, ICoursesForUser } from './types/course';
import { SleepData, SleepDailySummary } from './types/sleep';
import { HRVData } from './types/hrv';
import {
    LatestTrainingStatusResponse,
    TrainingLoadBalanceResponse,
    WeeklyTrainingStatusResponse
} from './types/training-status';
import { PersonalInfoResponse } from './types/personal-info';
import Running from './workouts/Running';

export interface Session {}

export default class GarminConnect {
    client: HttpClient;
    domain: GarminDomain;
    config: GCConfig;
    private _userHash: GCUserHash | undefined;
    private listeners: Listeners;
    url: UrlClass;

    // private oauth1: OAuth;
    constructor(config: GCConfig, domain: GarminDomain = 'garmin.com') {
        const { username, password } = config;
        if (!username || !password) {
            throw new Error('Missing credentials');
        }
        this.config = config;
        this.url = new UrlClass(config?.domain ?? domain);
        this.domain = config?.domain ?? domain;
        this._userHash = undefined;
        this.listeners = {};

        this.client = new HttpClient(this.url, config);
    }

    async login(
        username?: string,
        password?: string,
        sessionId?: string
    ): Promise<GarminConnect> {
        if (username && password) {
            this.config.username = username;
            this.config.password = password;
        }
        await this.client.login(
            this.config.username,
            this.config.password,
            sessionId
        );
        return this;
    }
    async exportTokenToFile(dirPath: string): Promise<void> {
        const isDir = await checkIsDirectory(dirPath);
        if (!isDir) {
            await createDirectory(dirPath);
        }
        // save oauth1 to json
        if (this.client.oauth1Token) {
            await writeToFile(
                path.join(dirPath, 'oauth1_token.json'),
                JSON.stringify(this.client.oauth1Token)
            );
        }
        if (this.client.oauth2Token) {
            await writeToFile(
                path.join(dirPath, 'oauth2_token.json'),
                JSON.stringify(this.client.oauth2Token)
            );
        }
    }
    async loadTokenByFile(dirPath: string): Promise<void> {
        const isDir = await checkIsDirectory(dirPath);
        if (!isDir) {
            throw new Error('loadTokenByFile: Directory not found: ' + dirPath);
        }
        let oauth1Data = await fs.readFile(
            path.join(dirPath, 'oauth1_token.json'),
            'utf-8'
        );
        // console.log('loadTokenByFile - oauth1Data:', oauth1Data);
        const oauth1 = JSON.parse(oauth1Data);
        // console.log('loadTokenByFile - oauth1:', oauth1);
        this.client.oauth1Token = oauth1;

        let oauth2Data = await fs.readFile(
            path.join(dirPath, 'oauth2_token.json'),
            'utf-8'
        );
        // console.log('loadTokenByFile - oauth2Data:', oauth2Data);
        const oauth2 = JSON.parse(oauth2Data);
        // console.log('loadTokenByFile - oauth2:', oauth2);
        this.client.oauth2Token = oauth2;
        // console.log('loadTokenByFile - oauth2Token:', this);
        // console.log('loadTokenByFile - oauth2Token:', this.client.oauth2Token);
    }
    exportToken(): IGarminTokens {
        if (!this.client.oauth1Token || !this.client.oauth2Token) {
            throw new Error('exportToken: Token not found');
        }
        return {
            oauth1: this.client.oauth1Token,
            oauth2: this.client.oauth2Token
        };
    }
    // from db or localstorage etc
    loadToken(oauth1: IOauth1Token, oauth2: IOauth2Token): void {
        this.client.oauth1Token = oauth1;
        this.client.oauth2Token = oauth2;
    }

    async getUserSettings(): Promise<IUserSettings> {
        return this.client.get<IUserSettings>(this.url.USER_SETTINGS);
    }

    async getUserProfile(): Promise<ISocialProfile> {
        return this.client.get<ISocialProfile>(this.url.USER_PROFILE);
    }

    async getActivities(
        start?: number,
        limit?: number,
        activityType?: ActivityType,
        subActivityType?: ActivitySubType
    ): Promise<IActivity[]> {
        return this.client.get<IActivity[]>(this.url.ACTIVITIES, {
            params: { start, limit, activityType, subActivityType }
        });
    }

    async getActivity(activity: {
        activityId: GCActivityId;
    }): Promise<IActivity> {
        if (!activity.activityId) throw new Error('Missing activityId');
        return this.client.get<IActivity>(
            this.url.ACTIVITY + activity.activityId
        );
    }

    async countActivities(): Promise<ICountActivities> {
        return this.client.get<ICountActivities>(this.url.STAT_ACTIVITIES, {
            params: {
                aggregation: 'lifetime',
                startDate: '1970-01-01',
                endDate: DateTime.now().toFormat('yyyy-MM-dd'),
                metric: 'duration'
            }
        });
    }

    async downloadWellnessData(date: Date, dir: string) {
        const dateStr = toDateString(date);
        const isDir = await checkIsDirectory(dir);
        if (!isDir) {
            await createDirectory(dir);
        }
        let fileBuffer = await this.client.get<Buffer>(
            this.url.DOWNLOAD_WELLNESS + dateStr,
            {
                responseType: 'arraybuffer'
            }
        );
        await writeToFile(path.join(dir, `${dateStr}.zip`), fileBuffer);
    }

    async downloadOriginalActivityData(
        activity: { activityId: GCActivityId },
        dir: string,
        type: ExportFileTypeValue = 'zip'
    ): Promise<void> {
        if (!activity.activityId) throw new Error('Missing activityId');
        const isDir = await checkIsDirectory(dir);
        if (!isDir) {
            await createDirectory(dir);
        }
        let fileBuffer: Buffer;
        if (type === 'tcx') {
            fileBuffer = await this.client.get(
                this.url.DOWNLOAD_TCX + activity.activityId
            );
        } else if (type === 'gpx') {
            fileBuffer = await this.client.get(
                this.url.DOWNLOAD_GPX + activity.activityId
            );
        } else if (type === 'kml') {
            fileBuffer = await this.client.get(
                this.url.DOWNLOAD_KML + activity.activityId
            );
        } else if (type === 'zip') {
            fileBuffer = await this.client.get<Buffer>(
                this.url.DOWNLOAD_ZIP + activity.activityId,
                {
                    responseType: 'arraybuffer'
                }
            );
        } else {
            throw new Error(
                'downloadOriginalActivityData - Invalid type: ' + type
            );
        }
        await writeToFile(
            path.join(dir, `${activity.activityId}.${type}`),
            fileBuffer
        );
    }

    async uploadActivity(
        file: string,
        format: UploadFileTypeTypeValue = 'fit'
    ) {
        const detectedFormat = (format || path.extname(file))?.toLowerCase();
        if (!_.includes(UploadFileType, detectedFormat)) {
            throw new Error('uploadActivity - Invalid format: ' + format);
        }

        // const fh = await fs.open(file);
        const fileBuffer = createReadStream(file);
        // console.log('fileBuffer:', fileBuffer);
        const form = new FormData();
        form.append('userfile', fileBuffer);
        const response = await this.client.post(
            this.url.UPLOAD + '.' + format,
            form,
            {
                headers: {
                    'Content-Type': form.getHeaders()['content-type']
                }
            }
        );
        fileBuffer.close();
        return response;
    }

    async deleteActivity(activity: {
        activityId: GCActivityId;
    }): Promise<void> {
        if (!activity.activityId) throw new Error('Missing activityId');
        await this.client.delete<void>(this.url.ACTIVITY + activity.activityId);
    }

    async getWorkouts(start: number, limit: number): Promise<IWorkout[]> {
        return this.client.get<IWorkout[]>(this.url.WORKOUTS, {
            params: {
                start,
                limit
            }
        });
    }
    async getWorkoutDetail(workout: {
        workoutId: string;
    }): Promise<IWorkoutDetail> {
        if (!workout.workoutId) throw new Error('Missing workoutId');
        return this.client.get<IWorkoutDetail>(
            this.url.WORKOUT(workout.workoutId)
        );
    }

    async addWorkout(
        workout: IWorkoutDetail | Running
    ): Promise<IWorkoutDetail> {
        if (!workout) throw new Error('Missing workout');

        if (workout instanceof Running) {
            if (workout.isValid()) {
                const data = { ...workout.toJson() };
                if (!data.description) {
                    data.description = 'Added by garmin-connect for Node.js';
                }
                return this.client.post<IWorkoutDetail>(
                    this.url.WORKOUT(),
                    data
                );
            }
        }
        if (!(workout as IWorkoutDetail).workoutSegments)
            throw new Error(
                'Missing workoutSegments, please use WorkoutDetail, not Workout.'
            );

        const newWorkout = _.omit(workout, [
            'workoutId',
            'ownerId',
            'updatedDate',
            'createdDate',
            'author'
        ]);
        if (!newWorkout.description) {
            newWorkout.description = 'Added by garmin-connect for Node.js';
        }
        // console.log('addWorkout - newWorkout:', newWorkout)
        return this.client.post<IWorkoutDetail>(this.url.WORKOUT(), newWorkout);
    }

    async addRunningWorkout(
        name: string,
        meters: number,
        description: string
    ): Promise<IWorkoutDetail> {
        const running = new Running();
        running.name = name;
        running.distance = meters;
        running.description = description;
        return this.addWorkout(running);
    }

    async deleteWorkout(workout: { workoutId: string }) {
        if (!workout.workoutId) throw new Error('Missing workout');
        return this.client.delete(this.url.WORKOUT(workout.workoutId));
    }

    async scheduleWorkout(
        workout: { workoutId: string },
        date = new Date()
    ): Promise<IScheduleWorkout> {
        if (!workout.workoutId) throw new Error('Missing workoutId');
        const formatedDate = DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
        return this.client.post<IScheduleWorkout>(
            `${this.url.SCHEDULE_WORKOUTS}${workout.workoutId}`,
            {
                date: formatedDate
            }
        );
    }

    // Garmin use month 0-11, not real month.
    async getCalendar(
        year = new Date().getFullYear(),
        month = new Date().getMonth()
    ): Promise<ICalendar> {
        return this.client.get<ICalendar>(this.url.CALENDAR(year, month));
    }

    async getSteps(date = new Date()): Promise<number> {
        const dateString = toDateString(date);

        const days = await this.client.get<IDailyStepsType[]>(
            `${this.url.DAILY_STEPS}${dateString}/${dateString}`
        );
        const dayStats = days.find(
            ({ calendarDate }) => calendarDate === dateString
        );

        if (!dayStats) {
            throw new Error("Can't find daily steps for this date.");
        }

        return dayStats.totalSteps;
    }

    async getSleepData(date = new Date()): Promise<SleepData> {
        try {
            const dateString = toDateString(date);

            const sleepData = await this.client.get<SleepData>(
                `${this.url.DAILY_SLEEP}`,
                { params: { date: dateString } }
            );

            if (!sleepData) {
                throw new Error('Invalid or empty sleep data response.');
            }

            return sleepData;
        } catch (error: any) {
            throw new Error(`Error in getSleepData: ${error.message}`);
        }
    }

    async getSleepDuration(
        date = new Date()
    ): Promise<{ hours: number; minutes: number }> {
        try {
            const sleepData = await this.getSleepData(date);

            if (
                !sleepData ||
                !sleepData.dailySleepDTO ||
                sleepData.dailySleepDTO.sleepStartTimestampGMT === undefined ||
                sleepData.dailySleepDTO.sleepEndTimestampGMT === undefined
            ) {
                throw new Error(
                    'Invalid or missing sleep data for the specified date.'
                );
            }

            const sleepStartTimestampGMT =
                sleepData.dailySleepDTO.sleepStartTimestampGMT;
            const sleepEndTimestampGMT =
                sleepData.dailySleepDTO.sleepEndTimestampGMT;

            const { hours, minutes } = calculateTimeDifference(
                sleepStartTimestampGMT,
                sleepEndTimestampGMT
            );

            return {
                hours,
                minutes
            };
        } catch (error: any) {
            throw new Error(`Error in getSleepDuration: ${error.message}`);
        }
    }

    async getSleepDailySummary(
        startDate: Date,
        endDate: Date
    ): Promise<SleepDailySummary> {
        try {
            const startStr = toDateString(startDate);
            const endStr = toDateString(endDate);
            // URL pattern: /sleep-service/stats/sleep/daily/2026-01-21/2026-01-27
            const summary = await this.client.get<SleepDailySummary>(
                `${this.url.SLEEP_DAILY_SUMMARY}/${startStr}/${endStr}`
            );
            return summary;
        } catch (error: any) {
            throw new Error(`Error in getSleepDailySummary: ${error.message}`);
        }
    }

    async getHRVData(date = new Date()): Promise<HRVData> {
        try {
            const dateStr = toDateString(date);
            // URL pattern: /hrv-service/hrv/2026-01-27
            const hrvData = await this.client.get<HRVData>(
                `${this.url.HRV}/${dateStr}`
            );
            return hrvData;
        } catch (error: any) {
            throw new Error(`Error in getHRVData: ${error.message}`);
        }
    }

    async getTrainingStatus(
        date = new Date()
    ): Promise<LatestTrainingStatusResponse> {
        try {
            const dateStr = toDateString(date);
            // URL pattern: /metrics-service/metrics/trainingstatus/daily/2026-01-27
            // This returns the *latest* status for that day (or generally latest if date is today)
            const response =
                await this.client.get<LatestTrainingStatusResponse>(
                    `${this.url.TRAINING_STATUS_DAILY}/${dateStr}`
                );
            return response;
        } catch (error: any) {
            throw new Error(`Error in getTrainingStatus: ${error.message}`);
        }
    }

    async getTrainingLoadBalance(
        date = new Date()
    ): Promise<TrainingLoadBalanceResponse> {
        try {
            const dateStr = toDateString(date);
            // URL pattern: /metrics-service/metrics/trainingloadbalance/latest/2026-01-27
            const response = await this.client.get<TrainingLoadBalanceResponse>(
                `${this.url.TRAINING_LOAD_BALANCE}/${dateStr}`
            );
            return response;
        } catch (error: any) {
            throw new Error(
                `Error in getTrainingLoadBalance: ${error.message}`
            );
        }
    }

    async getWeeklyTrainingStatus(
        startDate: Date,
        endDate: Date
    ): Promise<WeeklyTrainingStatusResponse> {
        try {
            const profile = await this.getUserProfile();
            const displayName = profile.displayName;
            if (!displayName) {
                throw new Error(
                    'Could not retrieve display name for weekly training status.'
                );
            }

            const fromDateStr = toDateString(startDate);
            const toDateStr = toDateString(endDate);

            // URL pattern: /metrics-service/metrics/trainingstatus/weekly/{displayName}
            const response =
                await this.client.get<WeeklyTrainingStatusResponse>(
                    `${this.url.TRAINING_STATUS_WEEKLY}/${displayName}`,
                    {
                        params: {
                            fromCalendarDate: fromDateStr,
                            toCalendarDate: toDateStr
                        }
                    }
                );
            return response;
        } catch (error: any) {
            throw new Error(
                `Error in getWeeklyTrainingStatus: ${error.message}`
            );
        }
    }

    async getPersonalInfo(): Promise<PersonalInfoResponse> {
        try {
            const profile = await this.getUserProfile();
            const displayName = profile.displayName;
            if (!displayName) {
                throw new Error(
                    'Could not retrieve display name for personal info.'
                );
            }

            // URL pattern: /userprofile-service/userprofile/personal-information/{displayName}
            const response = await this.client.get<PersonalInfoResponse>(
                `${this.url.PERSONAL_INFO}/${displayName}`
            );
            return response;
        } catch (error: any) {
            throw new Error(`Error in getPersonalInfo: ${error.message}`);
        }
    }

    async getDailyWeightData(date = new Date()): Promise<WeightData> {
        try {
            const dateString = toDateString(date);
            const weightData = await this.client.get<WeightData>(
                `${this.url.DAILY_WEIGHT}/${dateString}`
            );

            if (!weightData) {
                throw new Error('Invalid or empty weight data response.');
            }

            return weightData;
        } catch (error: any) {
            throw new Error(`Error in getDailyWeightData: ${error.message}`);
        }
    }

    async getDailyWeightInPounds(date = new Date()): Promise<number> {
        const weightData = await this.getDailyWeightData(date);

        if (
            weightData.totalAverage &&
            typeof weightData.totalAverage.weight === 'number'
        ) {
            return gramsToPounds(weightData.totalAverage.weight);
        } else {
            throw new Error("Can't find valid daily weight for this date.");
        }
    }

    async getDailyHydration(date = new Date()): Promise<number> {
        try {
            const dateString = toDateString(date);
            const hydrationData = await this.client.get<HydrationData>(
                `${this.url.DAILY_HYDRATION}/${dateString}`
            );

            if (!hydrationData || !hydrationData.valueInML) {
                throw new Error('Invalid or empty hydration data response.');
            }

            return convertMLToOunces(hydrationData.valueInML);
        } catch (error: any) {
            throw new Error(`Error in getDailyHydration: ${error.message}`);
        }
    }

    async updateWeight(
        date = new Date(),
        lbs: number,
        timezone: string
    ): Promise<UpdateWeight> {
        try {
            const weightData = await this.client.post<UpdateWeight>(
                `${this.url.UPDATE_WEIGHT}`,
                {
                    dateTimestamp: getLocalTimestamp(date, timezone),
                    gmtTimestamp: date.toISOString().substring(0, 23),
                    unitKey: 'lbs',
                    value: lbs
                }
            );

            return weightData;
        } catch (error: any) {
            throw new Error(`Error in updateWeight: ${error.message}`);
        }
    }

    async updateHydrationLogOunces(
        date = new Date(),
        valueInOz: number
    ): Promise<WaterIntake> {
        try {
            const dateString = toDateString(date);
            const hydrationData = await this.client.put<WaterIntake>(
                `${this.url.HYDRATION_LOG}`,
                {
                    calendarDate: dateString,
                    valueInML: convertOuncesToML(valueInOz),
                    userProfileId: (await this.getUserProfile()).profileId,
                    timestampLocal: date.toISOString().substring(0, 23)
                }
            );

            return hydrationData;
        } catch (error: any) {
            throw new Error(
                `Error in updateHydrationLogOunces: ${error.message}`
            );
        }
    }

    async getGolfSummary(): Promise<GolfSummary> {
        try {
            const golfSummary = await this.client.get<GolfSummary>(
                `${this.url.GOLF_SCORECARD_SUMMARY}`
            );

            if (!golfSummary) {
                throw new Error('Invalid or empty golf summary data response.');
            }

            return golfSummary;
        } catch (error: any) {
            throw new Error(`Error in getGolfSummary: ${error.message}`);
        }
    }

    async getGolfScorecard(scorecardId: number): Promise<GolfScorecard> {
        try {
            const golfScorecard = await this.client.get<GolfScorecard>(
                `${this.url.GOLF_SCORECARD_DETAIL}`,
                { params: { 'scorecard-ids': scorecardId } }
            );

            if (!golfScorecard) {
                throw new Error(
                    'Invalid or empty golf scorecard data response.'
                );
            }

            return golfScorecard;
        } catch (error: any) {
            throw new Error(`Error in getGolfScorecard: ${error.message}`);
        }
    }

    async getHeartRate(date = new Date()): Promise<HeartRate> {
        try {
            const dateString = toDateString(date);
            const heartRate = await this.client.get<HeartRate>(
                `${this.url.DAILY_HEART_RATE}`,
                { params: { date: dateString } }
            );

            return heartRate;
        } catch (error: any) {
            throw new Error(`Error in getHeartRate: ${error.message}`);
        }
    }

    async getCourses(): Promise<ICourse[]> {
        try {
            const coursesForUser = await this.client.get<ICoursesForUser>(
                `${this.url.COURSE_OWNER}`
            );
            const courses_favorite = await this.client.get<ICourse[]>(
                `${this.url.COURSE_FAVORITE}`
            );
            const course = [
                ...coursesForUser.coursesForUser,
                ...courses_favorite
            ];
            const uniqCourse = _.uniqBy(course, 'courseId');
            return uniqCourse;
        } catch (error: any) {
            throw new Error(`Error in getHeartRate: ${error.message}`);
        }
    }

    async getCourse(course: { courseId: number }): Promise<ICourseDetail> {
        try {
            if (!course.courseId) {
                throw new Error('Missing courseId');
            }

            const courseDetail = await this.client.get<ICourseDetail>(
                `${this.url.COURSE(course.courseId)}`
            );
            return courseDetail;
        } catch (error: any) {
            throw new Error(`Error in getHeartRate: ${error.message}`);
        }
    }

    async createCourse(course: ICourseDetail): Promise<ICourseDetail> {
        try {
            const createdCourse = await this.client.post<ICourseDetail>(
                `${this.url.COURSE()}`,
                _.omit(course, [
                    'courseId',
                    // 'description',
                    'matchedToSegments',
                    'userProfilePk',
                    'userGroupPk',
                    'firstName',
                    'lastName',
                    'displayName',
                    'geoRoutePk',
                    'sourcePk',
                    'hasShareableEvent',
                    'virtualPartnerId',
                    'includeLaps',
                    'speedMeterPerSecond',
                    'createDate',
                    'updateDate',
                    'targetCoordinateSystem',
                    'originalCoordinateSystem',
                    'consumer',
                    'elevationSource',
                    'hasPaceBand',
                    'hasPowerGuide',
                    'favorite',
                    'curatedCoursePk'
                ])
            );
            return createdCourse;
        } catch (error: any) {
            throw new Error(`Error in getHeartRate: ${error.message}`);
        }
    }

    async consentGrant(): Promise<void> {
        try {
            // 为每个请求添加单独的错误处理，确保即使有请求失败，其他请求也能继续执行
            const results = await Promise.all([
                this.client
                    .post<void>(`${this.url.CONSENT_GRANT}`, {
                        consentTypeId: 'DI_CONNECT_UPLOAD',
                        consentLocale: 'en-US',
                        consentVersion: '59'
                    })
                    .catch((error) => {
                        console.warn(
                            'DI_CONNECT_UPLOAD 请求失败:',
                            error.message
                        );
                        return null;
                    }),
                this.client
                    .post<void>(`${this.url.CONSENT_GRANT}`, {
                        consentTypeId: 'DI_CONNECT_CONNECT-PRIVACY',
                        consentLocale: 'zh-CN',
                        consentVersion: '18'
                    })
                    .catch((error) => {
                        console.warn(
                            'DI_CONNECT_CONNECT-PRIVACY 请求失败:',
                            error.message
                        );
                        return null;
                    }),
                this.client
                    .post<void>(`${this.url.CONSENT_GRANT}`, {
                        consentTypeId: 'DI_CONNECT_GOLF-PRIVACY',
                        consentLocale: 'zh-CN',
                        consentVersion: '16'
                    })
                    .catch((error) => {
                        console.warn(
                            'DI_CONNECT_GOLF-PRIVACY 请求失败:',
                            error.message
                        );
                        return null;
                    }),
                this.client
                    .put<void>(`${this.url.ACCOUNT_DEVICE_SYNC}`, {
                        key: 'account.deviceSync',
                        value: true
                    })
                    .catch((error) => {
                        console.warn(
                            'ACCOUNT_DEVICE_SYNC 请求失败:',
                            error.message
                        );
                        return null;
                    })
            ]);

            console.log('consentGrant 请求结果:', results);

            // 检查有多少请求成功
            const successfulRequests = results.filter(
                (result) => result !== null
            ).length;
            console.log(
                `consentGrant: ${successfulRequests}/${results.length} 个请求成功`
            );
        } catch (error: any) {
            throw new Error(`Error in consenGrant: ${error.message}`);
        }
    }

    async get<T>(url: string, data?: any) {
        const response = await this.client.get(url, data);
        return response as T;
    }

    async post<T>(url: string, data: any) {
        const response = await this.client.post<T>(url, data, {});
        return response as T;
    }

    async put<T>(url: string, data: any) {
        const response = await this.client.put<T>(url, data, {});
        return response as T;
    }
}
