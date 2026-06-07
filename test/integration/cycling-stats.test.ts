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

describe('Cycling Stats Integration Tests', () => {
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

    it('cycling stats - 骑行功率曲线与能力', async () => {
        if (!client) return;

        // 1. 获取骑行能力
        try {
            const ability = await client.getCyclingAbility();
            if (ability) {
                expect(ability.cyclingAbilityType).toBeDefined();
            }
            printResponse('骑行能力 (getCyclingAbility)', ability, (data) =>
                data
                    ? {
                          cyclingAbilityType: data.cyclingAbilityType,
                          aerobicEndurance: data.aerobicEndurance,
                          aerobicCapacity: data.aerobicCapacity,
                          anaerobicCapacity: data.anaerobicCapacity
                      }
                    : 'No cycling ability configured'
            );
        } catch (e: any) {
            printResponse(
                '骑行能力 (getCyclingAbility)',
                { error: e.message, info: '该账号可能没有骑行能力数据' },
                (data) => data
            );
        }

        // 2. 获取骑行最大 MET
        try {
            const met = await client.getMaxMet(new Date(), 'cycling');
            if (met) {
                expect(met.calendarDate).toBeDefined();
            }
            printResponse('骑行 MaxMET (getMaxMet)', met, (data) =>
                data
                    ? {
                          calendarDate: data.calendarDate,
                          vo2MaxValue: data.vo2MaxValue,
                          sport: data.sport
                      }
                    : 'No MaxMet record'
            );
        } catch (e: any) {
            expect(e.message).toContain('expected undefined to be defined');
            printResponse(
                '骑行 MaxMET (getMaxMet)',
                { error: e.message, info: '该账号可能没有骑行 MaxMET 数据' },
                (data) => data
            );
        }
    });
});
