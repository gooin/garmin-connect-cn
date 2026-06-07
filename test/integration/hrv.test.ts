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

describe('HRV Integration Tests', () => {
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

    it('hrv - HRV 原始数据与多日 HRV 每日摘要', async () => {
        if (!client) return;

        // 1. 获取特定日期 HRV
        const hrv = await client.getHRVData(new Date());
        expect(hrv).toBeDefined();
        printResponse('HRV 原始数据 (getHRVData)', hrv, (data) => ({
            userProfileId: data.userProfileId,
            hrvSummary: data.hrvSummary
                ? {
                      lastNightAvg: data.hrvSummary.lastNightAvg,
                      weeklyAvg: data.hrvSummary.weeklyAvg,
                      status: data.hrvSummary.status,
                      baselineMitAvg: data.hrvSummary.baselineMitAvg
                  }
                : 'No HRV Summary for today'
        }));

        // 2. 获取多日 HRV 摘要
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const summaries = await client.getHRVDailySummary(startDate, endDate);
        expect(summaries).toBeDefined();
        expect(Array.isArray(summaries)).toBe(true);

        printResponse(
            'HRV 多日摘要 (getHRVDailySummary)',
            summaries,
            (data) => ({
                count: data.length,
                days: data.map((d: any) => ({
                    calendarDate: d.calendarDate,
                    lastNightAvg: d.lastNightAvg,
                    weeklyAvg: d.weeklyAvg,
                    status: d.status
                }))
            })
        );
    });
});
