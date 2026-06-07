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

describe('Activity List Integration Tests', () => {
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

    it('getActivities - 基础活动列表获取', async () => {
        if (!client) return;
        const activities = await client.getActivities(0, 3);
        expect(activities).toBeDefined();
        expect(Array.isArray(activities)).toBe(true);

        printResponse('基础活动列表 (getActivities)', activities, (data) => ({
            count: data.length,
            activities: data.map((a: any) => ({
                id: a.activityId,
                name: a.activityName,
                distanceKm: (a.distance / 1000).toFixed(2),
                startTime: a.startTimeLocal
            }))
        }));
    });

    it('getActivities (Filters) - 距离范围与关键字搜索过滤', async () => {
        if (!client) return;

        // 1. 过滤全马 (41km ~ 43.5km 跑步)
        const marathonActs = await client.getActivities(
            0,
            5,
            'running',
            undefined,
            41000,
            43500,
            false
        );
        expect(marathonActs).toBeDefined();
        expect(Array.isArray(marathonActs)).toBe(true);
        for (const act of marathonActs) {
            expect(act.distance).toBeGreaterThanOrEqual(41000);
            expect(act.distance).toBeLessThanOrEqual(43500);
        }

        printResponse(
            '马拉松活动过滤 (Marathon Filter)',
            marathonActs,
            (data) => ({
                count: data.length,
                activities: data.map((a: any) => ({
                    name: a.activityName,
                    distanceKm: (a.distance / 1000).toFixed(2),
                    startTime: a.startTimeLocal
                }))
            })
        );

        // 2. 名字模糊搜索 ("兰州")
        const keyword = '兰州';
        const searchActs = await client.getActivities(
            0,
            5,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            undefined,
            keyword
        );
        expect(searchActs).toBeDefined();
        expect(Array.isArray(searchActs)).toBe(true);
        for (const act of searchActs) {
            expect(act.activityName.toLowerCase()).toContain(
                keyword.toLowerCase()
            );
        }

        printResponse(
            '关键字搜索过滤 (Keyword Search: 兰州)',
            searchActs,
            (data) => ({
                count: data.length,
                activities: data.map((a: any) => ({
                    name: a.activityName,
                    distanceKm: (a.distance / 1000).toFixed(2),
                    startTime: a.startTimeLocal
                }))
            })
        );
    });
});
