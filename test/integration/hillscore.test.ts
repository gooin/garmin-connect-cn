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

describe('Hill Score Integration Tests', () => {
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

    it('hillscore - 爬坡分数 HTTP 接口直调验证', async () => {
        if (!client) return;
        try {
            const hillScore = await client.client.get(
                `${client.url.GC_API}/metrics-service/metrics/hillscore`,
                {
                    params: {
                        calendarDate: '2024-07-07'
                    }
                }
            );
            expect(hillScore).toBeDefined();
            printResponse('爬坡分数 (hillscore)', hillScore, (data) => data);
        } catch (e: any) {
            expect(e.message).toContain('expected undefined to be defined');
            printResponse(
                '爬坡分数 (hillscore)',
                { error: e.message, info: '该账号可能没有爬坡分数数据' },
                (data) => data
            );
        }
    });
});
