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

describe('Body Battery Integration Tests', () => {
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

    it('body-battery - 提取身体电量区间数据', async () => {
        if (!client) return;
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const bodyBattery = await client.getBodyBattery(startDate, endDate);
        expect(bodyBattery).toBeDefined();
        expect(Array.isArray(bodyBattery)).toBe(true);

        printResponse(
            '身体电量区间数据 (getBodyBattery)',
            bodyBattery,
            (data) => ({
                count: data.length,
                records: data.map((d: any) => ({
                    date: d.date,
                    charged: d.charged,
                    drained: d.drained,
                    max: d.max,
                    min: d.min
                }))
            })
        );
    });
});
