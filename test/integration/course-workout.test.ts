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

describe('Course & Workout Integration Tests', () => {
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

    it('courses - 应当能获取路书列表', async () => {
        if (!client) return;
        const courses = await client.getCourses();
        expect(courses).toBeDefined();
        expect(Array.isArray(courses)).toBe(true);

        // 如果用户有路书，尝试读取其中一个详情
        if (courses.length > 0) {
            const courseId = courses[0].courseId;
            const courseDetail = await client.getCourse({ courseId });
            expect(courseDetail).toBeDefined();
            expect(courseDetail.courseId).toBe(courseId);
        }
    });

    it('workouts - 应当能获取课表列表', async () => {
        if (!client) return;
        const workouts = await client.getWorkouts(0, 10);
        expect(workouts).toBeDefined();
        expect(Array.isArray(workouts)).toBe(true);

        // 如果用户有课表，尝试读取详情
        if (workouts.length > 0) {
            const workoutId = workouts[0].workoutId!.toString();
            const detail = await client.getWorkoutDetail({ workoutId });
            expect(detail).toBeDefined();
            expect(detail.workoutId).toBeDefined();
        }
    });
});
