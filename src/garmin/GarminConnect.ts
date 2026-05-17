import { promises as fs } from 'node:fs';
import path from 'node:path';
import { HttpClient } from '../common/HttpClient';
import { checkIsDirectory, createDirectory, writeToFile } from '../utils';
import { UrlClass } from './UrlClass';
import {
    GCUserHash,
    GarminDomain,
    IGarminTokens,
    IOauth1Token,
    IOauth2Token,
    ISocialProfile,
    GCConfig,
    Listeners
} from './types';
// 功能模块
import { applyUserModule } from './modules/user';
import { applySleepModule } from './modules/wellness/sleep';
import { applyHRVModule } from './modules/wellness/hrv';
import { applyWeightModule } from './modules/wellness/weight';
import { applyHydrationModule } from './modules/wellness/hydration';
import { applyBodyBatteryModule } from './modules/wellness/body-battery';
import { applyHeartRateModule } from './modules/wellness/heart-rate';
import { applyActivityBaseModule } from './modules/activity/base';
import { applyRunningModule } from './modules/activity/running';
import { applyCyclingModule } from './modules/activity/cycling';
import { applyTrainingStatusModule } from './modules/activity/training-status';
import { applyDeviceModule } from './modules/device';
import { applyWorkoutModule } from './modules/workout';
import { applyCourseModule } from './modules/course';
import { applyMiscModule } from './modules/misc';

export interface Session {}

// 基类：核心状态、认证功能、以及被多个模块依赖的基础方法
class GarminConnectBase {
    client: HttpClient;
    domain: GarminDomain;
    config: GCConfig;
    private _userHash: GCUserHash | undefined;
    private listeners: Listeners;
    url: UrlClass;

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
    ): Promise<this> {
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
        const oauth1 = JSON.parse(oauth1Data);
        this.client.oauth1Token = oauth1;

        let oauth2Data = await fs.readFile(
            path.join(dirPath, 'oauth2_token.json'),
            'utf-8'
        );
        const oauth2 = JSON.parse(oauth2Data);
        this.client.oauth2Token = oauth2;
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

    loadToken(oauth1: IOauth1Token, oauth2: IOauth2Token): void {
        this.client.oauth1Token = oauth1;
        this.client.oauth2Token = oauth2;
    }

    // 被多个模块依赖的基础方法，放在基类中
    async getUserProfile(): Promise<ISocialProfile> {
        return this.client.get<ISocialProfile>(this.url.USER_PROFILE);
    }
}

// 使用 mixin 链式组合所有功能模块
const WithUser = applyUserModule(GarminConnectBase);
const WithSleep = applySleepModule(WithUser);
const WithHRV = applyHRVModule(WithSleep);
const WithWeight = applyWeightModule(WithHRV);
const WithHydration = applyHydrationModule(WithWeight);
const WithBodyBattery = applyBodyBatteryModule(WithHydration);
const WithHeartRate = applyHeartRateModule(WithBodyBattery);
const WithActivityBase = applyActivityBaseModule(WithHeartRate);
const WithRunning = applyRunningModule(WithActivityBase);
const WithCycling = applyCyclingModule(WithRunning);
const WithTrainingStatus = applyTrainingStatusModule(WithCycling);
const WithDevice = applyDeviceModule(WithTrainingStatus);
const WithWorkout = applyWorkoutModule(WithDevice);
const WithCourse = applyCourseModule(WithWorkout);
const WithMisc = applyMiscModule(WithCourse);

export default class GarminConnect extends WithMisc {}
