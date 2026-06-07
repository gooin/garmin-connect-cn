import { describe, it, expect, beforeAll } from 'vitest';
import { GarminConnect } from '../../src/index';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// 加载测试环境变量
const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';
const forceLogin = process.env.TEST_GARMIN_FORCE_LOGIN === 'true';

describe('Garmin Connect Integration Tests', () => {
    let client: GarminConnect;

    beforeAll(async () => {
        // 如果未配置测试账号，跳过测试
        if (!username || !password) {
            console.warn(
                '⚠️  未检测到 TEST_GARMIN_USERNAME 或 TEST_GARMIN_PASSWORD 环境变量，集成测试已跳过。'
            );
            return;
        }

        client = new GarminConnect({ username, password }, domain as any);

        const TOKENS_DIR = path.join(__dirname, '../tokens', username);

        if (
            !forceLogin &&
            fs.existsSync(path.join(TOKENS_DIR, 'oauth1_token.json'))
        ) {
            try {
                await client.loadTokenByFile(TOKENS_DIR);
            } catch (err) {
                console.warn('无法加载缓存的 Token，将尝试使用密码登录:', err);
                await client.login(username, password);
                await client.exportTokenToFile(TOKENS_DIR);
            }
        } else {
            await client.login(username, password);
            await client.exportTokenToFile(TOKENS_DIR);
        }
    });

    it('getUserProfile - 应当能够成功获取用户基本资料', async () => {
        if (!client) return;
        const profile = await client.getUserProfile();
        expect(profile).toBeDefined();
        expect(profile.garminGUID).toBeDefined();
        expect(profile.userName).toBeDefined();
    });

    it('getActivities - 应当能够成功获取最邻近活动列表', async () => {
        if (!client) return;
        const activities = await client.getActivities(0, 5);
        expect(activities).toBeDefined();
        expect(Array.isArray(activities)).toBe(true);
        expect(activities.length).toBeLessThanOrEqual(5);
    });

    it('getActivities (Distance Filter) - 应当能够根据最小/最大距离过滤活动', async () => {
        if (!client) return;
        // 过滤 41km 到 43.5km 范围内的全马跑步
        const activities = await client.getActivities(
            0,
            10,
            'running',
            undefined,
            41000,
            43500,
            false
        );
        expect(activities).toBeDefined();
        expect(Array.isArray(activities)).toBe(true);
        for (const act of activities) {
            expect(act.distance).toBeGreaterThanOrEqual(41000);
            expect(act.distance).toBeLessThanOrEqual(43500);
            expect(act.activityType.typeKey).toContain('running');
        }
    });

    it('getActivities (Keyword Search) - 应当能支持按 search 关键字客户端过滤', async () => {
        if (!client) return;
        const keyword = '兰州';
        const activities = await client.getActivities(
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
        expect(activities).toBeDefined();
        expect(Array.isArray(activities)).toBe(true);
        for (const act of activities) {
            expect(act.activityName.toLowerCase()).toContain(
                keyword.toLowerCase()
            );
        }
    });

    it('getActivitiesSummary - AI 摘要功能应当能支持扩展后的搜索过滤参数', async () => {
        if (!client) return;
        const summary = await client.getActivitiesSummary({
            limit: 5,
            minDistance: 41000,
            maxDistance: 43500,
            activityType: 'running'
        });
        expect(summary).toBeDefined();
        expect(summary.schema).toBe('activities_summary_v1');
        expect(summary.activities).toBeDefined();
        expect(Array.isArray(summary.activities)).toBe(true);
        for (const compact of summary.activities) {
            expect(compact.summary.distanceKm).toBeGreaterThanOrEqual(41);
            expect(compact.summary.distanceKm).toBeLessThanOrEqual(43.5);
            expect(compact.sport).toContain('running');
        }
    });
});
