import { describe, expect, it } from 'vitest';
import {
    buildFitbitWeightCsvFromEntries,
    collectWeightEntries
} from '../../src/garmin/modules/wellness/weight';
import { DateWeight, WeightRangeData } from '../../src/garmin/types/weight';

const entry = (
    calendarDate: string,
    weightKg: number,
    bodyFat: number | null = 14.1
): DateWeight =>
    ({
        calendarDate,
        weight: weightKg * 1000,
        bmi: bodyFat === null ? null : 21.1,
        bodyFat,
        sourceType: 'MANUAL'
    } as DateWeight);

const range = (
    summaries: Array<{
        latestWeight?: DateWeight;
        allWeightMetrics?: DateWeight[];
    }>
): WeightRangeData => ({ dailyWeightSummaries: summaries as never });

describe('collectWeightEntries', () => {
    it('expands every same-day weigh-in instead of only the latest', () => {
        const entries = collectWeightEntries(
            range([
                {
                    latestWeight: entry('2026-09-10', 63.1),
                    allWeightMetrics: [
                        entry('2026-09-10', 63.1),
                        entry('2026-09-10', 62.8),
                        entry('2026-09-10', 62.5)
                    ]
                }
            ])
        );

        expect(entries.map((e) => e.weight)).toEqual([63100, 62800, 62500]);
    });

    it('falls back to latestWeight when allWeightMetrics is missing', () => {
        const entries = collectWeightEntries(
            range([{ latestWeight: entry('2026-09-10', 62.5) }])
        );

        expect(entries).toHaveLength(1);
        expect(entries[0].weight).toBe(62500);
    });

    it('skips days with no weigh-in at all', () => {
        expect(collectWeightEntries(range([{}]))).toEqual([]);
    });
});

describe('buildFitbitWeightCsvFromEntries', () => {
    it('emits one CSV row per same-day weigh-in', () => {
        const csv = buildFitbitWeightCsvFromEntries([
            entry('2026-09-10', 63.1),
            entry('2026-09-10', 62.8)
        ]);

        // 同一天内部不重排（Garmin 按记录自带的时间戳归档），只比较集合
        const rows = csv
            .split('\n')
            .filter((line) => line.startsWith('"'))
            .sort();
        expect(rows).toEqual([
            '"2026年9月10日","62.8","21.1","14.1"',
            '"2026年9月10日","63.1","21.1","14.1"'
        ]);
    });

    it('sorts rows by calendar date ascending', () => {
        const csv = buildFitbitWeightCsvFromEntries([
            entry('2026-09-12', 62.5),
            entry('2026-09-10', 62.6)
        ]);

        const dates = csv
            .split('\n')
            .filter((line) => line.startsWith('"'))
            .map((line) => line.split(',')[0]);
        expect(dates).toEqual(['"2026年9月10日"', '"2026年9月12日"']);
    });

    it('drops manual entries without body fat because Garmin rejects them', () => {
        const csv = buildFitbitWeightCsvFromEntries([
            entry('2026-09-10', 62.5, null),
            entry('2026-09-09', 62.3, 14.1)
        ]);

        const rows = csv.split('\n').filter((line) => line.startsWith('"'));
        expect(rows).toHaveLength(1);
        expect(rows[0]).toContain('2026年9月9日');
    });

    it('keeps the header only when nothing is exportable', () => {
        const csv = buildFitbitWeightCsvFromEntries([
            entry('2026-09-10', 62.5, null)
        ]);
        expect(csv).toBe('身体\n日期,体重,身体质量指数 BMI,脂肪');
    });
});
