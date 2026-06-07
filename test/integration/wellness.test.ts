import { describe, it, expect, beforeAll } from 'vitest';
import { GarminConnect } from '../../src/index';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';

describe('Wellness & Device Integration Tests', () => {
    let client: GarminConnect;

    beforeAll(async () => {
        if (!username || !password) return;
        client = new GarminConnect({ username, password }, domain as any);
        const TOKENS_DIR = path.join(__dirname, '../tokens-test', username);
        if (fs.existsSync(path.join(TOKENS_DIR, 'oauth1_token.json'))) {
            await client.loadTokenByFile(TOKENS_DIR);
        } else {
            await client.login(username, password);
        }
    });

    it('sleep - 睡眠原始数据与多日每日睡眠摘要', async () => {
        if (!client) return;

        // 1. 获取特定日期睡眠
        const sleepData = await client.getSleepData(new Date());
        expect(sleepData).toBeDefined();

        // 2. 获取多日睡眠摘要
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const summary = await client.getSleepDailySummary(startDate, endDate);
        expect(summary).toBeDefined();
        expect(summary.individualStats).toBeDefined();
        expect(Array.isArray(summary.individualStats)).toBe(true);
    });

    it('hrv - HRV 原始数据与多日 HRV 每日摘要', async () => {
        if (!client) return;

        // 1. 获取特定日期 HRV
        const hrv = await client.getHRVData(new Date());
        expect(hrv).toBeDefined();

        // 2. 获取多日 HRV 摘要
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const summaries = await client.getHRVDailySummary(startDate, endDate);
        expect(summaries).toBeDefined();
        expect(Array.isArray(summaries)).toBe(true);
    });

    it('body-battery - 提取身体电量区间数据', async () => {
        if (!client) return;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const bodyBattery = await client.getBodyBattery(startDate, endDate);
        expect(bodyBattery).toBeDefined();
        expect(Array.isArray(bodyBattery)).toBe(true);
    });

    it('hydration - 获取单日水分日志数据', async () => {
        if (!client) return;
        try {
            const hydrationVal = await client.getDailyHydration(new Date());
            expect(typeof hydrationVal).toBe('number');
        } catch (e: any) {
            expect(e.message).toContain(
                'Invalid or empty hydration data response'
            );
        }
    });

    it('device - 获取主可穿戴设备数据', async () => {
        if (!client) return;
        const device = await client.getPrimaryWearableDevice();
        // 因为用户可能没有绑定支持该特性的穿戴设备，可以为 null
        if (device !== null) {
            expect(device.deviceId).toBeDefined();
            expect(device.displayName).toBeDefined();
        }
    });
});
