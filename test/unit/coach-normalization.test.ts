import { describe, expect, it } from 'vitest';
import { buildRoutePreview } from '../../src/garmin/modules/coach/activity-summary';
import {
    fullRunningCadence,
    normalizeStatus,
    normalizeStatusZh
} from '../../src/garmin/modules/coach/helpers';
import {
    compressSleepTimeline,
    normalizeSleepAnalysis
} from '../../src/garmin/modules/coach/sleep-analysis';
import { SleepData, SleepStageTimelineEntry } from '../../src/garmin/types';

describe('coach interface normalization', () => {
    it('normalizes mixed Garmin cadence semantics to full steps per minute', () => {
        expect(fullRunningCadence(85)).toBe(170);
        expect(fullRunningCadence(95.4)).toBe(190);
        expect(fullRunningCadence(155)).toBe(155);
        expect(fullRunningCadence(180)).toBe(180);
        expect(fullRunningCadence(null)).toBeNull();
    });

    it('maps Garmin training status variants to stable Chinese labels', () => {
        expect(normalizeStatus(7, 'PRODUCTIVE_3')).toBe('productive');
        expect(normalizeStatusZh(7, 'PRODUCTIVE_3')).toBe('高效训练');
        expect(normalizeStatusZh(7, 'PRODUCTIVE_6')).toBe('高效训练');
        expect(normalizeStatusZh(6, 'PEAKING_1')).toBe('巅峰状态');
        expect(normalizeStatusZh(4, 'MAINTAINING_2')).toBe('维持效果');
        expect(normalizeStatusZh(4, 'MAINTAINING_AER_HIGH_SHORT')).toBe(
            '维持效果'
        );
        expect(normalizeStatusZh(5, 'RECOVERY_1')).toBe('恢复');
        expect(normalizeStatusZh(8, 'STRAINED_4')).toBe('紧绷');
        expect(normalizeStatusZh(2, 'UNPRODUCTIVE_4')).toBe('效率不佳');
        expect(normalizeStatusZh(3, 'OVERREACHING_1')).toBe('过度训练');
        expect(normalizeStatusZh(1, 'DETRAINING')).toBe('训练不足');
        expect(normalizeStatusZh(7)).toBe('高效训练');
        expect(normalizeStatusZh(null, 'UNKNOWN_1')).toBeNull();
    });

    it('maps verified Garmin sleep activity levels to stages', () => {
        const sleep = {
            dailySleepDTO: {
                calendarDate: '2026-06-13',
                sleepStartTimestampGMT: 1781308800000,
                sleepEndTimestampGMT: 1781329440000,
                awakeSleepSeconds: 0,
                lightSleepSeconds: 6840,
                deepSleepSeconds: 7980,
                remSleepSeconds: 5820,
                sleepTimeSeconds: 20640,
                averageRespirationValue: 14.5,
                sleepScores: {
                    overall: {
                        value: 81,
                        qualifierKey: 'GOOD'
                    }
                }
            },
            sleepLevels: [
                {
                    startGMT: '2026-06-12T16:00:00.000Z',
                    endGMT: '2026-06-12T18:13:00.000Z',
                    activityLevel: 0
                },
                {
                    startGMT: '2026-06-12T18:13:00.000Z',
                    endGMT: '2026-06-12T20:07:00.000Z',
                    activityLevel: 1
                },
                {
                    startGMT: '2026-06-12T20:07:00.000Z',
                    endGMT: '2026-06-12T21:44:00.000Z',
                    activityLevel: 2
                }
            ],
            sleepHeartRate: [{ value: 50 }, { value: 54 }],
            avgOvernightHrv: 48,
            hrvStatus: 'BALANCED',
            restingHeartRate: 45,
            bodyBatteryChange: 57
        } as unknown as SleepData;

        const result = normalizeSleepAnalysis(sleep);

        expect(result.schema).toBe('sleep_analysis_v1');
        expect(result.timeline.map((entry) => entry.stage)).toEqual([
            'deep',
            'light',
            'rem'
        ]);
        expect(result.stageSummary).toEqual({
            awakeMin: 0,
            lightMin: 114,
            deepMin: 133,
            remMin: 97
        });
        expect(result.metrics.averageHeartRateBpm).toBe(52);
    });

    it('compresses sleep timelines while preserving full-night bounds', () => {
        const timeline: SleepStageTimelineEntry[] = Array.from(
            { length: 220 },
            (_, index) => ({
                startAt: new Date(index * 60_000).toISOString(),
                endAt: new Date((index + 1) * 60_000).toISOString(),
                stage: index % 2 === 0 ? 'light' : 'deep'
            })
        );

        const result = compressSleepTimeline(timeline, 200);

        expect(result.length).toBeLessThanOrEqual(200);
        expect(result[0].startAt).toBe(timeline[0].startAt);
        expect(result[result.length - 1].endAt).toBe(
            timeline[timeline.length - 1].endAt
        );
    });

    it('creates a coordinate-free route shape with no more than 300 points', () => {
        const route = Array.from(
            { length: 400 },
            (_, index): [number, number] => [
                30 + Math.sin(index / 10),
                120 + index / 10
            ]
        );

        const result = buildRoutePreview(route);

        expect(result?.points.length).toBeLessThanOrEqual(300);
        expect(result?.points.length).toBeGreaterThanOrEqual(2);
        for (const [x, y] of result?.points ?? []) {
            expect(x).toBeGreaterThanOrEqual(0);
            expect(x).toBeLessThanOrEqual(1);
            expect(y).toBeGreaterThanOrEqual(0);
            expect(y).toBeLessThanOrEqual(1);
        }
    });
});
