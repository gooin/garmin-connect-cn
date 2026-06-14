import { beforeAll, describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { GarminConnect } from '../../src';
import { printResponse } from './log-helper';

const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';

describe('Training Planning Integration Tests', () => {
    let client: GarminConnect;

    beforeAll(async () => {
        if (!username || !password) return;
        client = new GarminConnect({ username, password }, domain as any);
        const tokensDir = path.join(__dirname, '../tokens-test', username);
        if (fs.existsSync(path.join(tokensDir, 'oauth1_token.json'))) {
            await client.loadTokenByFile(tokensDir);
        } else {
            await client.login(username, password);
        }
    });

    it('reads readiness, endurance and running tolerance inputs', async () => {
        if (!client) return;
        const endDate = new Date();
        const startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 28);

        const [readiness, endurance, tolerance] = await Promise.all([
            client.getTrainingReadiness(endDate),
            client.getEnduranceScore(endDate),
            client.getRunningTolerance(startDate, endDate, 'weekly')
        ]);

        expect(Array.isArray(readiness)).toBe(true);
        expect(endurance).toBeDefined();
        expect(Array.isArray(tolerance)).toBe(true);

        printResponse(
            '课表生成输入指标',
            { readiness, endurance, tolerance },
            (data) => ({
                readiness: data.readiness[0]
                    ? {
                          score: data.readiness[0].score,
                          level: data.readiness[0].level,
                          inputContext: data.readiness[0].inputContext
                      }
                    : null,
                enduranceAvailable: Object.keys(data.endurance).length > 0,
                runningTolerancePoints: data.tolerance.length
            })
        );
    });
});
