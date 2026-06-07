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

describe('Coach Integration Tests', () => {
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

    it('getTrainingOverview - 应当能正常生成 AI 训练总览大盘 (约包含Vo2Max/阀值/负荷等)', async () => {
        if (!client) return;
        const overview = await client.getTrainingOverview({
            recentDays: 7
        });
        expect(overview).toBeDefined();
        expect(overview.schema).toBe('training_overview_v1');
        expect(overview.athlete).toBeDefined();
        expect(overview.state).toBeDefined();
        expect(overview.sports).toBeDefined();
    });

    it('getWellnessOverview - 应当能正常生成 AI 健康状态 readiness 摘要', async () => {
        if (!client) return;
        const wellness = await client.getWellnessOverview({
            recentDays: 3
        });
        expect(wellness).toBeDefined();
        expect(wellness.schema).toBe('wellness_overview_v1');
        expect(wellness.today).toBeDefined();
        expect(wellness.readiness).toBeDefined();
        expect(wellness.aiHints).toBeDefined();
    });

    it('getActivitiesSummary & getActivityDetailSummary - 应当能成功获取并精简活动列表与详情', async () => {
        if (!client) return;

        // 1. 获取摘要列表
        const summary = await client.getActivitiesSummary({ limit: 3 });
        expect(summary).toBeDefined();
        expect(summary.schema).toBe('activities_summary_v1');
        expect(summary.activities).toBeDefined();

        // 2. 如果存在活动，获取第一个活动详情并测试精简为 activity_detail_v1
        if (summary.activities.length > 0) {
            const activityId = summary.activities[0].id;
            const detail = await client.getActivityDetailSummary(activityId);
            expect(detail).toBeDefined();
            expect(detail.schema).toBe('activity_detail_v1');
            expect(detail.id).toBe(activityId);
            expect(detail.summary).toBeDefined();
            expect(detail.trainingImpact).toBeDefined();
        }
    });
});
