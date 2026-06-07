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

describe('Workout Integration Tests', () => {
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

    it('workouts - 获取课表列表与详情', async () => {
        if (!client) return;
        const workouts = await client.getWorkouts(0, 5);
        expect(workouts).toBeDefined();
        expect(Array.isArray(workouts)).toBe(true);

        printResponse('课表列表 (getWorkouts)', workouts, (data) => ({
            count: data.length,
            workouts: data.map((w: any) => ({
                workoutId: w.workoutId,
                workoutName: w.workoutName,
                sportType: w.sportType?.sportTypeKey,
                createdDate: w.createdDate
            }))
        }));

        if (workouts.length > 0) {
            const workoutId = workouts[0].workoutId!.toString();
            const detail = await client.getWorkoutDetail({ workoutId });
            expect(detail).toBeDefined();
            expect(detail.workoutId).toBeDefined();

            printResponse(
                '第一条课表详情 (getWorkoutDetail)',
                detail,
                (data) => ({
                    workoutId: data.workoutId,
                    workoutName: data.workoutName,
                    sportType: data.sportType?.sportTypeKey,
                    segmentsCount: data.workoutSegments?.length,
                    firstSegmentStepsCount:
                        data.workoutSegments?.[0]?.workoutSteps?.length
                })
            );
        }
    });
});
