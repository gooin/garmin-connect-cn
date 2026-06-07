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

describe('Activity & Stats Integration Tests', () => {
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

    it('getActivities - 获取最邻近活动列表', async () => {
        if (!client) return;
        const activities = await client.getActivities(0, 5);
        expect(activities).toBeDefined();
        expect(Array.isArray(activities)).toBe(true);
    });

    it('getActivities (Filters) - 距离与关键字搜索过滤', async () => {
        if (!client) return;

        // 1. 距离和运动类型过滤 (41km ~ 43.5km 全马)
        const distanceActs = await client.getActivities(
            0,
            10,
            'running',
            undefined,
            41000,
            43500,
            false
        );
        expect(distanceActs).toBeDefined();
        expect(Array.isArray(distanceActs)).toBe(true);
        for (const act of distanceActs) {
            expect(act.distance).toBeGreaterThanOrEqual(41000);
            expect(act.distance).toBeLessThanOrEqual(43500);
            expect(act.activityType.typeKey).toContain('running');
        }

        // 2. 名字关键字模糊搜索
        const keyword = '兰州';
        const searchActs = await client.getActivities(
            0,
            10,
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
    });

    it('running stats - 乳酸阈值与跑步能力指标', async () => {
        if (!client) return;

        // 1. 获取最近的乳酸阈值数据
        try {
            const latestLT = await client.getLatestLactateThreshold();
            if (latestLT) {
                expect(latestLT.lactateThresholdSpeed).toBeDefined();
            }
        } catch (e: any) {
            console.warn(
                '获取最新乳酸阈值数据失败 (用户可能无此数据):',
                e.message
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
        } catch (e: any) {
            console.warn(
                '获取乳酸阈值范围数据失败 (用户可能无此数据):',
                e.message
            );
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
        } catch (e: any) {
            console.warn('获取骑行能力数据失败 (用户可能无此数据):', e.message);
        }

        // 2. 获取骑行最大 MET
        try {
            const met = await client.getMaxMet(new Date(), 'cycling');
            if (met) {
                expect(met.calendarDate).toBeDefined();
            }
        } catch (e: any) {
            console.warn(
                '获取骑行最大 MET 失败 (用户可能无此数据):',
                e.message
            );
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
        } catch (e: any) {
            console.warn('获取爬坡分数接口失败 (用户可能无此数据):', e.message);
        }
    });
});
