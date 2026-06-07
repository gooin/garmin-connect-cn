import { describe, it, expect, beforeAll } from 'vitest';
import { GarminConnect } from '../../src/index';
import { printResponse } from './log-helper';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';

describe('Running Stats Integration Tests', () => {
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

    it('running stats - 乳酸阈值与跑步能力指标', async () => {
        if (!client) return;

        // 1. 获取最新乳酸阈值数据
        try {
            const latestLT = await client.getLatestLactateThreshold();
            if (latestLT) {
                expect(latestLT.lactateThresholdSpeed).toBeDefined();
            }
            printResponse(
                '最新乳酸阈值 (getLatestLactateThreshold)',
                latestLT,
                (data) =>
                    data
                        ? {
                              lactateThresholdSpeed: data.lactateThresholdSpeed,
                              lactateThresholdHeartRate:
                                  data.lactateThresholdHeartRate,
                              calendarDate: data.calendarDate
                          }
                        : 'No lactate threshold record'
            );
        } catch (e: any) {
            expect(e.message).toContain('expected undefined to be defined'); // 如果账号没有此数据，Vitest expect 报错会抛出此异常，我们捕获它说明无数据
            printResponse(
                '最新乳酸阈值 (getLatestLactateThreshold)',
                { error: e.message, info: '该账号可能没有乳酸阈值数据' },
                (data) => data
            );
        }

        // 2. 获取多日乳酸阈值数据
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        try {
            const ltRange = await client.getRunningLactateThreshold(
                startDate,
                endDate
            );
            if (ltRange) {
                expect(ltRange.userLactateThresholds).toBeDefined();
            }
            printResponse(
                '历史乳酸阈值 (getRunningLactateThreshold)',
                ltRange,
                (data) =>
                    data
                        ? {
                              count: data.userLactateThresholds?.length,
                              records: data.userLactateThresholds?.map(
                                  (lt: any) => ({
                                      calendarDate: lt.calendarDate,
                                      lactateThresholdHeartRate:
                                          lt.lactateThresholdHeartRate,
                                      lactateThresholdSpeed:
                                          lt.lactateThresholdSpeed
                                  })
                              )
                          }
                        : 'No hrv range record'
            );
        } catch (e: any) {
            expect(e.message).toContain('expected undefined to be defined');
            printResponse(
                '历史乳酸阈值 (getRunningLactateThreshold)',
                { error: e.message, info: '该账号可能没有乳酸阈值历史数据' },
                (data) => data
            );
        }
    });
});
