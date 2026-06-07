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

describe('Activity Stats Integration Tests', () => {
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

    it('getActivityStats - 获取多日运动统计数据', async () => {
        if (!client) return;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);
        const stats = await client.getActivityStats({
            startDate,
            endDate,
            activityType: 'running'
        });
        expect(stats).toBeDefined();
        expect(Array.isArray(stats)).toBe(true);

        printResponse('多日运动统计 (getActivityStats)', stats, (data) => ({
            count: data.length,
            records: data.map((d: any) => ({
                date: d.date,
                countOfActivities: d.countOfActivities,
                totalDistance:
                    d.stats?.all?.distance?.sum != null
                        ? (d.stats.all.distance.sum / 100000).toFixed(2) + 'km'
                        : 'N/A'
            }))
        }));
    });
});
