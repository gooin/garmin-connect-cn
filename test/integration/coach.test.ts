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

    it('getTrainingOverview - 训练大盘总览获取与精炼', async () => {
        if (!client) return;
        const overview = await client.getTrainingOverview({
            recentDays: 7
        });
        expect(overview).toBeDefined();
        expect(overview.schema).toBe('training_overview_v1');
        expect(overview.athlete).toBeDefined();
        expect(overview.state).toBeDefined();
        expect(overview.sports).toBeDefined();
        if (overview.state.status) {
            expect(overview.state.statusZh).toBeTruthy();
        }
        if (overview.state.feedbackPhrase) {
            expect(overview.state.feedbackZh).toBeTruthy();
        }
        if (overview.sports.running.form.cadence !== null) {
            expect(overview.sports.running.form.cadence).toBeLessThan(250);
        }

        printResponse(
            '训练大盘总览 (getTrainingOverview)',
            overview,
            (data) => ({
                snapshotDate: data.snapshotDate,
                athlete: {
                    age: data.athlete?.age,
                    gender: data.athlete?.gender,
                    weightKg: data.athlete?.weightKg
                },
                state: {
                    status: data.state?.status,
                    statusZh: data.state?.statusZh,
                    feedbackPhrase: data.state?.feedbackPhrase,
                    feedbackZh: data.state?.feedbackZh,
                    acuteLoad: data.state?.acuteLoad,
                    chronicLoad: data.state?.chronicLoad,
                    acwr: data.state?.acwr
                },
                sportsRunning: data.sports?.running
                    ? {
                          vo2Max: data.sports.running.vo2Max,
                          threshold: data.sports.running.threshold,
                          cadence: data.sports.running.form?.cadence
                      }
                    : 'No running info',
                aiHintsCount: data.aiHints?.length
            })
        );
    });

    it('getWellnessOverview - 健康指数大盘 readiness 数据生成', async () => {
        if (!client) return;
        const wellness = await client.getWellnessOverview({
            recentDays: 3
        });
        expect(wellness).toBeDefined();
        expect(wellness.schema).toBe('wellness_overview_v1');
        expect(wellness.today).toBeDefined();
        expect(wellness.readiness).toBeDefined();

        printResponse(
            '健康大盘 readiness (getWellnessOverview)',
            wellness,
            (data) => ({
                snapshotDate: data.snapshotDate,
                readiness: {
                    status: data.readiness?.status,
                    confidence: data.readiness?.confidence,
                    cautionSignals: data.readiness?.cautionSignals,
                    positiveSignals: data.readiness?.positiveSignals
                },
                todaySleep: {
                    sleepScore: data.today?.sleep?.score,
                    quality: data.today?.sleep?.quality,
                    durationMin: data.today?.sleep?.durationMin
                },
                todayBodyBattery: data.today?.bodyBattery,
                aiHintsCount: data.aiHints?.length
            })
        );
    });

    it('getActivitiesSummary & getActivityDetailSummary - 活动摘要列表与单项详情分析', async () => {
        if (!client) return;

        // 1. 获取摘要列表
        const summary = await client.getActivitiesSummary({ limit: 3 });
        expect(summary).toBeDefined();
        expect(summary.schema).toBe('activities_summary_v1');
        expect(summary.activities).toBeDefined();

        printResponse(
            'AI 活动摘要列表 (getActivitiesSummary)',
            summary,
            (data) => ({
                overallSummary: data.summary,
                activitiesCount: data.activities?.length,
                activitiesSummary: data.activities?.map((a: any) => ({
                    id: a.id,
                    date: a.date,
                    name: a.name,
                    sport: a.sport,
                    distanceKm: a.summary?.distanceKm,
                    load: a.impact?.load
                }))
            })
        );

        // 2. 获取第一个活动的单项深度详情精炼 (activity_detail_v1)
        const runningActivity = summary.activities.find(
            (activity) =>
                activity.sport === 'running' &&
                (activity.summary.distanceKm ?? 0) >= 1
        );
        if (runningActivity) {
            const activityId = runningActivity.id;
            const rawActivity = await client.getActivity({ activityId });
            const rawDetails = await client.getActivityDetails({ activityId });
            const rawPolyline = (
                rawDetails as unknown as {
                    geoPolylineDTO?: Record<string, unknown> & {
                        polyline?: Array<Record<string, unknown>>;
                    };
                }
            ).geoPolylineDTO;
            const rawSummary = (
                rawActivity as unknown as {
                    summaryDTO?: {
                        averageRunCadence?: number;
                        maxRunCadence?: number;
                    };
                }
            ).summaryDTO;
            const detail = await client.getActivityDetailSummary(activityId);
            expect(detail).toBeDefined();
            expect(detail.schema).toBe('activity_detail_v1');
            expect(detail.id).toBe(activityId);

            printResponse(
                `AI 单项活动详情 (getActivityDetailSummary id=${activityId})`,
                detail,
                (data) => ({
                    id: data.id,
                    date: data.date,
                    name: data.name,
                    sport: data.sport,
                    summary: data.summary,
                    trainingImpact: {
                        label: data.trainingImpact?.label,
                        load: data.trainingImpact?.load,
                        recoveryHr: data.trainingImpact?.recoveryHr
                    },
                    runForm: data.runForm,
                    rawCadence: rawSummary?.averageRunCadence,
                    routePreviewPoints: data.routePreview?.points?.length,
                    detailKeys: Object.keys(rawDetails),
                    geoPolylineKeys: rawPolyline
                        ? Object.keys(rawPolyline)
                        : [],
                    polylineCount: rawPolyline?.polyline?.length,
                    polylinePointKeys: rawPolyline?.polyline?.[0]
                        ? Object.keys(rawPolyline.polyline[0])
                        : []
                })
            );
            if (rawSummary?.averageRunCadence) {
                expect(detail.runForm?.cadence).toBe(
                    rawSummary.averageRunCadence < 120
                        ? Math.round(rawSummary.averageRunCadence) * 2
                        : Math.round(rawSummary.averageRunCadence)
                );
            }
            if (rawPolyline?.polyline?.length) {
                expect(detail.routePreview?.points.length).toBeGreaterThan(1);
                expect(detail.routePreview?.points.length).toBeLessThanOrEqual(
                    300
                );
            }
        }
    });
});
