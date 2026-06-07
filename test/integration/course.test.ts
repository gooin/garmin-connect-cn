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

describe('Course Integration Tests', () => {
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

    it('courses - 获取路书列表与详情', async () => {
        if (!client) return;
        const courses = await client.getCourses();
        expect(courses).toBeDefined();
        expect(Array.isArray(courses)).toBe(true);

        printResponse('路书列表 (getCourses)', courses, (data) => ({
            count: data.length,
            courses: data.map((c: any) => ({
                courseId: c.courseId,
                courseName: c.courseName,
                distance: c.distance,
                activityType: c.activityType?.activityTypeKey
            }))
        }));

        if (courses.length > 0) {
            const courseId = courses[0].courseId;
            const courseDetail = await client.getCourse({ courseId });
            expect(courseDetail).toBeDefined();
            expect(courseDetail.courseId).toBe(courseId);

            printResponse(
                '第一条路书详情 (getCourse)',
                courseDetail,
                (data) => ({
                    courseId: data.courseId,
                    courseName: data.courseName,
                    distance: data.distance,
                    elevationGain: data.elevationGain,
                    elevationLoss: data.elevationLoss,
                    geoPointsCount: data.geoPoints?.length
                })
            );
        }
    });
});
