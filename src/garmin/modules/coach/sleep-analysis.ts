import {
    SleepAnalysisSummary,
    SleepData,
    SleepStage,
    SleepStageTimelineEntry
} from '../../types';
import { CoachApi, round, toMinutes } from './helpers';

const SLEEP_STAGE_BY_ACTIVITY_LEVEL: Record<number, SleepStage> = {
    0: 'deep',
    1: 'light',
    2: 'rem',
    3: 'awake'
};

const toIsoString = (value: string | number): string => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid sleep timestamp: ${String(value)}`);
    }
    return date.toISOString();
};

export const mergeContiguousSleepStages = (
    timeline: SleepStageTimelineEntry[]
): SleepStageTimelineEntry[] => {
    if (timeline.length <= 1) return timeline;

    const merged: SleepStageTimelineEntry[] = [];
    let current = { ...timeline[0] };
    for (const next of timeline.slice(1)) {
        if (current.stage === next.stage && current.endAt === next.startAt) {
            current.endAt = next.endAt;
        } else {
            merged.push(current);
            current = { ...next };
        }
    }
    merged.push(current);
    return merged;
};

const segmentDuration = (segment: SleepStageTimelineEntry): number =>
    new Date(segment.endAt).getTime() - new Date(segment.startAt).getTime();

export const compressSleepTimeline = (
    timeline: SleepStageTimelineEntry[],
    maxItems = 200
): SleepStageTimelineEntry[] => {
    let segments = mergeContiguousSleepStages(timeline);
    while (segments.length > maxItems) {
        let shortestIndex = 0;
        for (let index = 1; index < segments.length; index += 1) {
            if (
                segmentDuration(segments[index]) <
                segmentDuration(segments[shortestIndex])
            ) {
                shortestIndex = index;
            }
        }

        if (shortestIndex === 0) {
            segments[1] = {
                ...segments[1],
                startAt: segments[0].startAt
            };
        } else if (shortestIndex === segments.length - 1) {
            segments[shortestIndex - 1] = {
                ...segments[shortestIndex - 1],
                endAt: segments[shortestIndex].endAt
            };
        } else if (
            segmentDuration(segments[shortestIndex - 1]) >=
            segmentDuration(segments[shortestIndex + 1])
        ) {
            segments[shortestIndex - 1] = {
                ...segments[shortestIndex - 1],
                endAt: segments[shortestIndex].endAt
            };
        } else {
            segments[shortestIndex + 1] = {
                ...segments[shortestIndex + 1],
                startAt: segments[shortestIndex].startAt
            };
        }
        segments.splice(shortestIndex, 1);
        segments = mergeContiguousSleepStages(segments);
    }
    return segments;
};

export const normalizeSleepAnalysis = (
    sleep: SleepData
): SleepAnalysisSummary => {
    const dto = sleep.dailySleepDTO;
    if (!dto?.calendarDate) {
        throw new Error('Sleep response is missing calendarDate');
    }
    if (!Array.isArray(sleep.sleepLevels) || sleep.sleepLevels.length === 0) {
        throw new Error('Sleep response is missing sleepLevels');
    }

    const timeline = sleep.sleepLevels
        .map((level): SleepStageTimelineEntry => {
            const stage = SLEEP_STAGE_BY_ACTIVITY_LEVEL[level.activityLevel];
            if (!stage) {
                throw new Error(
                    `Unknown Garmin sleep activityLevel: ${level.activityLevel}`
                );
            }
            return {
                startAt: toIsoString(level.startGMT),
                endAt: toIsoString(level.endGMT),
                stage
            };
        })
        .sort((a, b) => a.startAt.localeCompare(b.startAt));
    const mergedTimeline = mergeContiguousSleepStages(timeline);
    const normalizedTimeline = compressSleepTimeline(mergedTimeline);
    const heartRates = (sleep.sleepHeartRate ?? [])
        .map((entry) => entry.value)
        .filter((value) => Number.isFinite(value) && value > 0);

    return {
        schema: 'sleep_analysis_v1',
        sleepDate: dto.calendarDate,
        sleepStartAt: toIsoString(dto.sleepStartTimestampGMT),
        sleepEndAt: toIsoString(dto.sleepEndTimestampGMT),
        timeline: normalizedTimeline,
        timelineSimplified: normalizedTimeline.length < mergedTimeline.length,
        stageSummary: {
            awakeMin: toMinutes(dto.awakeSleepSeconds),
            lightMin: toMinutes(dto.lightSleepSeconds),
            deepMin: toMinutes(dto.deepSleepSeconds),
            remMin: toMinutes(dto.remSleepSeconds)
        },
        metrics: {
            totalSleepMin: toMinutes(dto.sleepTimeSeconds),
            sleepScore: dto.sleepScores?.overall?.value ?? null,
            quality:
                dto.sleepScores?.overall?.qualifierKey?.toLowerCase() ?? null,
            nightlyHrvMs: round(sleep.avgOvernightHrv),
            hrvStatus: sleep.hrvStatus?.toLowerCase() ?? null,
            restingHeartRateBpm: round(sleep.restingHeartRate),
            averageHeartRateBpm:
                heartRates.length > 0
                    ? round(
                          heartRates.reduce((sum, value) => sum + value, 0) /
                              heartRates.length
                      )
                    : null,
            averageRespiration: round(dto.averageRespirationValue, 1),
            bodyBatteryChange: round(sleep.bodyBatteryChange)
        }
    };
};

export const buildSleepAnalysisSummary = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    date = new Date()
): Promise<SleepAnalysisSummary> => {
    await client.checkTokenVaild();
    return normalizeSleepAnalysis(await api.getSleepData(date));
};
