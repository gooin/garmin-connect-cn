import { WellnessOverview, WellnessOverviewOptions } from '../../types';
import {
    availability,
    average,
    bodyBatteryTrend,
    buildIncludedMetrics,
    buildReadiness,
    buildUnavailableMetrics,
    buildWellnessAiHints,
    compactLower,
    hrvTrend,
    maximum,
    minimum,
    numericValues,
    sleepTrend,
    statusDaysFromHrv,
    toMinutes
} from './helpers';
import { buildWellnessSummary } from './wellness-summary';
import { CoachApi } from './helpers';

export const buildWellnessOverview = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    options: WellnessOverviewOptions = {}
): Promise<WellnessOverview> => {
    const rangeDays = options.rangeDays ?? options.recentDays ?? 7;
    const summary = await buildWellnessSummary(api, client, {
        ...options,
        recentDays: rangeDays
    });
    const snapshotDate = summary.range.endDate;
    const todayHrv = summary.today.hrv;
    const recentHrv = [...summary.recent.hrv].sort((a, b) =>
        a.calendarDate.localeCompare(b.calendarDate)
    );
    const recentSleep = [...summary.recent.sleep.daily].sort((a, b) =>
        a.calendarDate.localeCompare(b.calendarDate)
    );
    const todaySleepDaily = recentSleep.find(
        (entry) => entry.calendarDate === snapshotDate
    );
    const todaySleepValues = todaySleepDaily?.values;
    const todaySleepDto = summary.today.sleep?.dailySleepDTO;
    const recentBodyBattery = [...summary.recent.bodyBattery].sort((a, b) =>
        a.calendarDate.localeCompare(b.calendarDate)
    );
    const todayBodyBattery = recentBodyBattery.find(
        (entry) => entry.calendarDate === snapshotDate
    );

    const todaySleep = {
        score:
            todaySleepValues?.sleepScore ??
            todaySleepDto?.sleepScores?.overall?.value ??
            null,
        quality:
            compactLower(todaySleepValues?.sleepScoreQuality) ??
            compactLower(todaySleepDto?.sleepScores?.overall?.qualifierKey),
        durationMin:
            toMinutes(todaySleepValues?.totalSleepTimeInSeconds) ??
            toMinutes(todaySleepDto?.sleepTimeSeconds),
        needMin: todaySleepValues?.sleepNeed ?? null,
        deepMin:
            toMinutes(todaySleepValues?.deepTime) ??
            toMinutes(todaySleepDto?.deepSleepSeconds),
        lightMin:
            toMinutes(todaySleepValues?.lightTime) ??
            toMinutes(todaySleepDto?.lightSleepSeconds),
        remMin:
            toMinutes(todaySleepValues?.remTime) ??
            toMinutes(todaySleepDto?.remSleepSeconds),
        awakeMin:
            toMinutes(todaySleepValues?.awakeTime) ??
            toMinutes(todaySleepDto?.awakeSleepSeconds),
        bodyBatteryChange:
            todaySleepValues?.bodyBatteryChange ??
            summary.today.sleep?.bodyBatteryChange ??
            null,
        restingHr:
            todaySleepValues?.restingHeartRate ??
            summary.today.sleep?.restingHeartRate ??
            null,
        avgHr: todaySleepValues?.avgHeartRate ?? null,
        avgStress: todaySleepDto?.avgSleepStress ?? null,
        respiration:
            todaySleepValues?.respiration ??
            todaySleepDto?.averageRespirationValue ??
            null
    };

    const sleepScores = recentSleep.map((entry) => entry.values.sleepScore);
    const sleepDurations = recentSleep.map((entry) =>
        toMinutes(entry.values.totalSleepTimeInSeconds)
    );
    const sleepNeeds = recentSleep.map((entry) => entry.values.sleepNeed);
    const sleepBatteryChanges = recentSleep.map(
        (entry) => entry.values.bodyBatteryChange
    );
    const sleepRestingHr = recentSleep.map(
        (entry) => entry.values.restingHeartRate
    );
    const sleepRespiration = recentSleep.map(
        (entry) => entry.values.respiration
    );
    const bodyBatteryLows = recentBodyBattery.map(
        (entry) => entry.values.lowBodyBattery
    );
    const bodyBatteryHighs = recentBodyBattery.map(
        (entry) => entry.values.highBodyBattery
    );

    const hasTodayHrv = todayHrv !== null;
    const hasAnyHrv = hasTodayHrv || recentHrv.length > 0;
    const hasTodaySleep =
        todaySleep.score !== null || todaySleep.durationMin !== null;
    const hasAnySleep = hasTodaySleep || recentSleep.length > 0;
    const hasTodayBodyBattery = todayBodyBattery !== undefined;
    const hasAnyBodyBattery =
        hasTodayBodyBattery || recentBodyBattery.length > 0;
    const hasTodayRestingHr = todaySleep.restingHr !== null;
    const hasAnyRestingHr =
        hasTodayRestingHr || numericValues(sleepRestingHr).length > 0;
    const hasTodayRespiration = todaySleep.respiration !== null;
    const hasAnyRespiration =
        hasTodayRespiration || numericValues(sleepRespiration).length > 0;
    const hasAnySpo2 = recentSleep.some(
        (entry) => typeof entry.values.spO2 === 'number'
    );
    const hasAnySkinTemp = recentSleep.some(
        (entry) =>
            typeof entry.values.skinTempC === 'number' ||
            typeof entry.values.skinTempF === 'number'
    );

    const metricAvailability: WellnessOverview['availability'] = {
        hrv: availability(hasAnyHrv, hasTodayHrv),
        sleep: availability(hasAnySleep, hasTodaySleep),
        bodyBattery: availability(hasAnyBodyBattery, hasTodayBodyBattery),
        restingHeartRate: availability(hasAnyRestingHr, hasTodayRestingHr),
        respiration: availability(hasAnyRespiration, hasTodayRespiration),
        spo2: availability(hasAnySpo2, false),
        skinTemp: availability(hasAnySkinTemp, false)
    };

    const avgSleepScore = average(sleepScores);
    const avgBodyBatteryHigh = average(bodyBatteryHighs);
    const minBodyBatteryLow = minimum(bodyBatteryLows);
    const latestBodyBatteryLow =
        recentBodyBattery[recentBodyBattery.length - 1]?.values
            .lowBodyBattery ?? null;

    const overview: WellnessOverview = {
        schema: 'wellness_overview_v1',
        snapshotDate,
        rangeDays,
        source: {
            provider: 'garmin',
            includedMetrics: buildIncludedMetrics(metricAvailability),
            unavailableMetrics: buildUnavailableMetrics(metricAvailability)
        },
        availability: metricAvailability,
        today: {
            date: snapshotDate,
            hrv: {
                status: compactLower(todayHrv?.status),
                lastNightAvg: todayHrv?.lastNightAvg ?? null,
                weeklyAvg: todayHrv?.weeklyAvg ?? null,
                baseline: [
                    todayHrv?.baseline?.balancedLow ?? null,
                    todayHrv?.baseline?.balancedUpper ?? null
                ],
                readings: summary.today.hrvReadingCount
            },
            sleep: todaySleep,
            bodyBattery: {
                low: todayBodyBattery?.values.lowBodyBattery ?? null,
                high: todayBodyBattery?.values.highBodyBattery ?? null,
                changeDuringSleep: todaySleep.bodyBatteryChange
            }
        },
        recent7d: {
            hrv: {
                statusDays: statusDaysFromHrv(recentHrv),
                avgLastNight: average(
                    recentHrv.map((entry) => entry.lastNightAvg)
                ),
                minLastNight: minimum(
                    recentHrv.map((entry) => entry.lastNightAvg)
                ),
                maxLastNight: maximum(
                    recentHrv.map((entry) => entry.lastNightAvg)
                ),
                trend: hrvTrend(recentHrv)
            },
            sleep: {
                avgScore: avgSleepScore,
                avgDurationMin: average(sleepDurations),
                avgNeedMin: average(sleepNeeds),
                avgBodyBatteryChange: average(sleepBatteryChanges),
                avgRestingHr: average(sleepRestingHr),
                avgRespiration: average(sleepRespiration, 1),
                lowScoreDays: recentSleep
                    .filter((entry) => entry.values.sleepScore < 75)
                    .map((entry) => [
                        entry.calendarDate,
                        entry.values.sleepScore
                    ]),
                trend: sleepTrend(
                    avgSleepScore,
                    todaySleep.durationMin,
                    todaySleep.needMin,
                    todaySleep.quality
                )
            },
            bodyBattery: {
                avgLow: average(bodyBatteryLows),
                avgHigh: avgBodyBatteryHigh,
                minLow: minBodyBatteryLow,
                maxHigh: maximum(bodyBatteryHighs),
                trend: bodyBatteryTrend(
                    avgBodyBatteryHigh,
                    minBodyBatteryLow,
                    latestBodyBatteryLow
                )
            }
        },
        readiness: {
            status: 'moderate_good',
            confidence: 'low',
            positiveSignals: [],
            cautionSignals: []
        },
        aiHints: []
    };

    overview.readiness = buildReadiness(overview);
    overview.aiHints = buildWellnessAiHints(overview);
    return overview;
};
