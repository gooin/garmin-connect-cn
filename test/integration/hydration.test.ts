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

describe('Hydration Integration Tests', () => {
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

    it('hydration - 获取单日水分日志数据', async () => {
        if (!client) return;
        try {
            const hydrationVal = await client.getDailyHydration(new Date());
            expect(typeof hydrationVal).toBe('number');
            printResponse(
                '水分日志数据 (getDailyHydration)',
                { valueInOz: hydrationVal },
                (data) => data
            );
        } catch (e: any) {
            expect(e.message).toContain(
                'Invalid or empty hydration data response'
            );
            printResponse(
                '水分日志数据 (getDailyHydration)',
                { error: e.message, info: '当天可能无水分数据' },
                (data) => data
            );
        }
    });
});
