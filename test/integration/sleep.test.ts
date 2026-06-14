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

describe('Sleep Integration Tests', () => {
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

    it('sleep - 睡眠原始数据与多日每日睡眠摘要', async () => {
        if (!client) return;

        // 1. 获取特定日期睡眠
        const sleepData = await client.getSleepData(
            new Date('2026-06-13T12:00:00+08:00')
        );
        expect(sleepData).toBeDefined();
        const stageMinutes = sleepData.sleepLevels.reduce(
            (totals: Record<number, number>, entry) => {
                totals[entry.activityLevel] =
                    (totals[entry.activityLevel] ?? 0) +
                    (new Date(entry.endGMT).getTime() -
                        new Date(entry.startGMT).getTime()) /
                        60000;
                return totals;
            },
            {}
        );
        expect(stageMinutes[0]).toBe(
            sleepData.dailySleepDTO.deepSleepSeconds / 60
        );
        expect(stageMinutes[1]).toBe(
            sleepData.dailySleepDTO.lightSleepSeconds / 60
        );
        expect(stageMinutes[2]).toBe(
            sleepData.dailySleepDTO.remSleepSeconds / 60
        );
        const normalized = await client.getSleepAnalysis(
            new Date('2026-06-13T12:00:00+08:00')
        );
        expect(normalized.timeline.map((entry) => entry.stage)).toContain(
            'deep'
        );
        expect(normalized.timeline.map((entry) => entry.stage)).toContain(
            'light'
        );
        expect(normalized.timeline.map((entry) => entry.stage)).toContain(
            'rem'
        );
        printResponse('睡眠原始数据 (getSleepData)', sleepData, (data) => ({
            calendarDate: data.dailySleepDTO?.calendarDate,
            sleepLevelCount: data.sleepLevels?.length ?? 0,
            sleepActivityLevels: Array.from(
                new Set(
                    (data.sleepLevels ?? []).map(
                        (entry: { activityLevel: number }) =>
                            entry.activityLevel
                    )
                )
            ).sort(),
            sleepActivityLevelMinutes: (data.sleepLevels ?? []).reduce(
                (
                    totals: Record<string, number>,
                    entry: {
                        startGMT: string;
                        endGMT: string;
                        activityLevel: number;
                    }
                ) => {
                    const minutes =
                        (new Date(entry.endGMT).getTime() -
                            new Date(entry.startGMT).getTime()) /
                        60000;
                    totals[entry.activityLevel] =
                        (totals[entry.activityLevel] ?? 0) + minutes;
                    return totals;
                },
                {}
            ),
            dtoStageMinutes: {
                awake: data.dailySleepDTO?.awakeSleepSeconds / 60,
                light: data.dailySleepDTO?.lightSleepSeconds / 60,
                deep: data.dailySleepDTO?.deepSleepSeconds / 60,
                rem: data.dailySleepDTO?.remSleepSeconds / 60
            },
            sleepScore:
                data.dailySleepDTO?.sleepTimeSeconds != null
                    ? data.dailySleepDTO?.score
                    : 'N/A',
            quality:
                data.dailySleepDTO?.sleepTimeSeconds != null
                    ? data.dailySleepDTO?.sleepQualityTypeDTO?.qualityTypeKey
                    : 'N/A',
            durationHours:
                data.dailySleepDTO?.sleepTimeSeconds != null
                    ? (data.dailySleepDTO?.sleepTimeSeconds / 3600).toFixed(2)
                    : 'N/A',
            restingHeartRate: data.dailySleepDTO?.restingHeartRate
        }));

        // 2. 获取多日睡眠摘要
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 3);
        const summary = await client.getSleepDailySummary(startDate, endDate);
        expect(summary).toBeDefined();
        expect(summary.individualStats).toBeDefined();
        expect(Array.isArray(summary.individualStats)).toBe(true);

        printResponse(
            '睡眠多日摘要 (getSleepDailySummary)',
            summary,
            (data) => ({
                overallStats: data.overallStats,
                individualStatsCount: data.individualStats.length,
                firstDayStats: data.individualStats[0]
                    ? {
                          calendarDate: data.individualStats[0].calendarDate,
                          sleepScore: data.individualStats[0].sleepScore,
                          durationMin: data.individualStats[0].durationMin
                      }
                    : 'No individual data'
            })
        );
    });
});
