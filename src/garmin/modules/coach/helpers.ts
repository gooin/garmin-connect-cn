import { toGarminDateString } from '../../common/DateUtils';
import {
    ActivityStatsEntry,
    ActivitySubType,
    ActivityType,
    BodyBatteryDailyEntry,
    CyclingAbility,
    IActivity,
    MaxMetResponse,
    PowerCurveResponse,
    PowerToWeightEntry,
    HRVData,
    HRVDailySummary,
    OverviewMetricStatus,
    PersonalInfoResponse,
    RacePredictionMonthlyReadable,
    RunningLactateThreshold,
    SleepDailyStat,
    SleepDailySummary,
    SleepData,
    TrainingLoadBalanceResponse,
    TrainingOverview,
    TrainingOverviewOptions,
    TrainingStatusData,
    WellnessOverview,
    WellnessOverviewOptions
} from '../../types';

export interface CoachDateRangeOptions {
    date?: Date | string;
    startDate?: Date | string;
    endDate?: Date | string;
    recentDays?: number;
}

export interface WellnessSummaryOptions extends CoachDateRangeOptions {}

export interface WellnessSummary {
    generatedAt: string;
    range: {
        startDate: string;
        endDate: string;
    };
    today: {
        date: string;
        hrv: HRVData['hrvSummary'] | null;
        hrvReadingCount: number;
        sleep:
            | (Pick<
                  SleepData,
                  | 'avgOvernightHrv'
                  | 'hrvStatus'
                  | 'bodyBatteryChange'
                  | 'restingHeartRate'
              > & {
                  dailySleepDTO: SleepData['dailySleepDTO'] | null;
              })
            | null;
    };
    recent: {
        hrv: HRVDailySummary[];
        bodyBattery: BodyBatteryDailyEntry[];
        sleep: {
            overall: SleepDailySummary['overallStats'] | null;
            daily: SleepDailyStat[];
        };
    };
    sourceErrors: Record<string, string>;
}

export type CoachApi = {
    getActivityStats(options: {
        startDate: Date | string;
        endDate: Date | string;
        activityType?: string;
    }): Promise<ActivityStatsEntry[]>;
    getActivities(
        start?: number,
        limit?: number,
        activityType?: ActivityType,
        subActivityType?: ActivitySubType
    ): Promise<IActivity[]>;
    getActivity(activity: { activityId: number }): Promise<IActivity>;
    getCyclingAbility: () => Promise<CyclingAbility | null>;
    getHRVData: (date?: Date) => Promise<HRVData>;
    getHRVDailySummary: (
        startDate: Date | string,
        endDate: Date | string
    ) => Promise<HRVDailySummary[]>;
    getLatestPowerToWeight: (
        date?: Date | string
    ) => Promise<PowerToWeightEntry[]>;
    getMaxMet: (
        date?: Date | string,
        sport?: 'cycling' | 'running'
    ) => Promise<MaxMetResponse | null>;
    getPersonalInfo: () => Promise<PersonalInfoResponse>;
    getPersonalRecordTypes: () => Promise<
        import('../../types').PersonalRecordType[]
    >;
    getPersonalRecords: () => Promise<import('../../types').PersonalRecord[]>;
    getActivityLaps: (activity: { activityId: number }) => Promise<{
        activityId: number;
        lapDTOs: import('../../types').ActivityLap[];
    }>;
    getActivityWeather: (activity: {
        activityId: number;
    }) => Promise<import('../../types').ActivityWeather>;
    getActivityWorkouts: (activity: {
        activityId: number;
    }) => Promise<import('../../types').ActivityWorkout[]>;
    getRacePredictionsMonthly: (
        fromCalendarDate: Date | string,
        toCalendarDate: Date | string
    ) => Promise<RacePredictionMonthlyReadable[]>;
    getRunningLactateThreshold: (
        startDate: Date | string,
        endDate: Date | string
    ) => Promise<RunningLactateThreshold | null>;
    getTrainingLoadBalance: (
        date?: Date
    ) => Promise<TrainingLoadBalanceResponse>;
    getTrainingStatus: (date?: Date) => Promise<{
        latestTrainingStatusData: Record<string, TrainingStatusData>;
    }>;
    getWeeklyTrainingStatus: (
        startDate: Date,
        endDate: Date
    ) => Promise<{ reportData: Record<string, TrainingStatusData[]> }>;
    getBodyBattery: (
        startDate: Date | string,
        endDate: Date | string
    ) => Promise<WellnessSummary['recent']['bodyBattery']>;
    getSleepData: (date?: Date) => Promise<SleepData>;
    getSleepDailySummary: (
        startDate: Date,
        endDate: Date
    ) => Promise<{
        overallStats: WellnessSummary['recent']['sleep']['overall'];
        individualStats: WellnessSummary['recent']['sleep']['daily'];
    }>;
};

export type SourceErrors = Record<string, string>;

export const addDays = (date: Date, days: number): Date => {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
};

export const normalizeDate = (
    date: Date | string | undefined,
    fallback: Date
): Date => (date instanceof Date ? date : date ? new Date(date) : fallback);

export const getRange = (
    options:
        | WellnessSummaryOptions
        | WellnessOverviewOptions
        | TrainingOverviewOptions
        | CoachDateRangeOptions,
    defaultDays: number
) => {
    const endDate = normalizeDate(options.endDate ?? options.date, new Date());
    const days = options.recentDays ?? defaultDays;
    const startDate = normalizeDate(
        options.startDate,
        addDays(endDate, -(days - 1))
    );

    return {
        startDate,
        endDate,
        startDateString: toGarminDateString(startDate),
        endDateString: toGarminDateString(endDate)
    };
};

export const capture = async <T>(
    name: string,
    errors: SourceErrors,
    request: () => Promise<T>
): Promise<T | null> => {
    try {
        return await request();
    } catch (error: any) {
        errors[name] = error?.message ?? String(error);
        return null;
    }
};

export const latestActivityStats = (
    entries: ActivityStatsEntry[]
): ActivityStatsEntry | null => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted[sorted.length - 1] : null;
};

export const compactPowerCurve = (
    powerCurve: PowerCurveResponse | null
): PowerCurveResponse | null => {
    if (!powerCurve || !Array.isArray(powerCurve.entries)) {
        return powerCurve;
    }
    const targetDurations = new Set([
        5, 10, 30, 60, 300, 600, 1200, 1800, 3600, 7200, 14400
    ]);
    const keyEntries = powerCurve.entries.filter((entry) =>
        targetDurations.has(entry.duration)
    );
    return {
        ...powerCurve,
        entries:
            keyEntries.length > 0
                ? keyEntries
                : [...powerCurve.entries]
                      .sort((a, b) => a.duration - b.duration)
                      .slice(0, 20)
    };
};

export const extractUser = (personalInfo: PersonalInfoResponse | null) => {
    const userInfo = personalInfo?.userInfo;
    const biometric = personalInfo?.biometricProfile;
    return {
        age: userInfo?.age,
        birthDate: personalInfo?.birthDate ?? userInfo?.birthDate,
        gender: personalInfo?.gender ?? userInfo?.genderType,
        height: biometric?.height,
        weight: biometric?.weight,
        vo2Max: biometric?.vo2Max,
        vo2MaxCycling: biometric?.vo2MaxCycling,
        lactateThresholdHeartRate: biometric?.lactateThresholdHeartRate,
        activityClass: biometric?.activityClass,
        functionalThresholdPower: biometric?.functionalThresholdPower
    };
};

export const extractCurrentTrainingStatus = (
    trainingStatus: {
        latestTrainingStatusData: Record<string, TrainingStatusData>;
    } | null
): TrainingStatusData | null => {
    const values = Object.values(
        trainingStatus?.latestTrainingStatusData ?? {}
    );
    return (
        values.find((entry) => entry.primaryTrainingDevice) ?? values[0] ?? null
    );
};

export const extractLoadBalance = (
    loadBalance: TrainingLoadBalanceResponse | null
):
    | TrainingLoadBalanceResponse['metricsTrainingLoadBalanceDTOMap'][string]
    | null => {
    const values = Object.values(
        loadBalance?.metricsTrainingLoadBalanceDTOMap ?? {}
    );
    return (
        values.find((entry) => entry.primaryTrainingDevice) ?? values[0] ?? null
    );
};

export const extractWeeklyTrainingStatus = (
    weeklyTrainingStatus: {
        reportData: Record<string, TrainingStatusData[]>;
    } | null
): TrainingStatusData[] =>
    Object.values(weeklyTrainingStatus?.reportData ?? {})
        .flat()
        .filter((entry) => entry.primaryTrainingDevice)
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));

export const round = (
    value: number | null | undefined,
    digits = 0
): number | null => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

export const lowerSnake = (value: string | null | undefined): string | null =>
    value ? value.toLowerCase() : null;

export const normalizeGender = (
    gender: string | null | undefined
): string | null => {
    if (!gender) return null;
    const normalized = gender.toUpperCase();
    if (normalized.startsWith('M')) return 'M';
    if (normalized.startsWith('F')) return 'F';
    return gender;
};

export const normalizeSport = (
    sport: string | null | undefined
): string | null => (sport ? sport.toLowerCase() : null);

export const normalizeStatus = (
    status: string | number | null | undefined,
    phrase?: string | null
): string | null => {
    if (phrase) {
        return phrase.split('_')[0].toLowerCase();
    }
    const statusMap: Record<number, string> = {
        2: 'unproductive',
        3: 'overreaching',
        4: 'maintaining',
        5: 'recovery',
        6: 'peaking',
        7: 'productive',
        8: 'strained'
    };
    return typeof status === 'number' ? statusMap[status] ?? null : null;
};

export const normalizeTrend = (
    trend: number | string | null | undefined
): string | null => {
    if (typeof trend === 'string') {
        return trend.toLowerCase();
    }
    const trendMap: Record<number, string> = {
        1: 'declining',
        2: 'stable',
        3: 'improving'
    };
    return typeof trend === 'number' ? trendMap[trend] ?? null : null;
};

export const metricValue = (
    entry: ActivityStatsEntry | null,
    metric: string,
    field: 'count' | 'sum' | 'avg' | 'max'
): number | null => {
    const stat = entry?.stats?.all?.[metric] as
        | Record<string, number | null>
        | undefined;
    const value = stat?.[field];
    return typeof value === 'number' ? value : null;
};

export const buildYearStats = (entry: ActivityStatsEntry | null) => ({
    activities:
        entry?.countOfActivities ??
        metricValue(entry, 'duration', 'count') ??
        0,
    distanceKm: round((metricValue(entry, 'distance', 'sum') ?? 0) / 100000),
    durationH: round((metricValue(entry, 'duration', 'sum') ?? 0) / 3600000),
    elevGainM: round((metricValue(entry, 'elevationGain', 'sum') ?? 0) / 100),
    avgHr: round(metricValue(entry, 'avgHr', 'avg')),
    maxHr: round(metricValue(entry, 'maxHr', 'max'))
});

export const hasSportStats = (entry: ActivityStatsEntry | null): boolean =>
    (entry?.countOfActivities ?? 0) > 0 ||
    (metricValue(entry, 'duration', 'sum') ?? 0) > 0;

export const compactRaceTime = (
    value: string | null | undefined
): string | null => {
    if (!value) return null;
    if (value.startsWith('00:')) return value.slice(3);
    if (value.startsWith('0')) return value.slice(1);
    return value;
};

export const thresholdPaceFromSpeed = (
    speed: number | null | undefined
): string | null => {
    if (!speed) return null;
    const metersPerSecond = speed * 10;
    const paceSeconds = 1000 / metersPerSecond;
    const minutes = Math.floor(paceSeconds / 60);
    const seconds = Math.round(paceSeconds % 60);
    return `${seconds === 60 ? minutes + 1 : minutes}:${(seconds === 60
        ? 0
        : seconds
    )
        .toString()
        .padStart(2, '0')}/km`;
};

export const metricStatus = (
    value: number | null | undefined,
    min: number | null | undefined,
    max: number | null | undefined
): OverviewMetricStatus => {
    if (value === null || value === undefined) return null;
    if (min !== null && min !== undefined && value < min) return 'low';
    if (max !== null && max !== undefined && value > max) return 'high';
    return 'ok';
};

export const compactTrainingStatuses = (
    weeklyTrainingStatus: {
        reportData: Record<string, TrainingStatusData[]>;
    } | null
): TrainingStatusData[] => {
    const byDate = new Map<string, TrainingStatusData>();
    const entries = Object.values(weeklyTrainingStatus?.reportData ?? {})
        .flat()
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));

    for (const entry of entries) {
        const existing = byDate.get(entry.calendarDate);
        if (!existing || entry.primaryTrainingDevice) {
            byDate.set(entry.calendarDate, entry);
        }
    }

    return Array.from(byDate.values()).sort((a, b) =>
        a.calendarDate.localeCompare(b.calendarDate)
    );
};

export const countStatusDays = (
    entries: TrainingStatusData[]
): Record<string, number> => {
    const initial: Record<string, number> = {
        productive: 0,
        maintaining: 0,
        recovery: 0,
        peaking: 0,
        unproductive: 0,
        overreaching: 0
    };

    for (const entry of entries) {
        const status = normalizeStatus(
            entry.trainingStatus,
            entry.trainingStatusFeedbackPhrase
        );
        if (status) {
            initial[status] = (initial[status] ?? 0) + 1;
        }
    }

    return initial;
};

export const buildTrendLoad = (entries: TrainingStatusData[]) => {
    const loadValues = entries
        .map((entry) => {
            const acute = entry.acuteTrainingLoadDTO as any;
            return {
                chronic:
                    acute?.dailyTrainingLoadChronic ??
                    entry.weeklyTrainingLoad ??
                    null,
                acute:
                    acute?.dailyTrainingLoadAcute ??
                    entry.weeklyTrainingLoad ??
                    null,
                acwr: acute?.dailyAcuteChronicWorkloadRatio ?? null
            };
        })
        .filter(
            (entry) =>
                entry.chronic !== null ||
                entry.acute !== null ||
                entry.acwr !== null
        );

    return {
        chronicStart: round(loadValues[0]?.chronic ?? null),
        chronicEnd: round(loadValues[loadValues.length - 1]?.chronic ?? null),
        maxAcute: round(
            loadValues.reduce<number | null>(
                (max, entry) =>
                    entry.acute === null
                        ? max
                        : max === null
                        ? entry.acute
                        : Math.max(max, entry.acute),
                null
            )
        ),
        maxAcwr: round(
            loadValues.reduce<number | null>(
                (max, entry) =>
                    entry.acwr === null
                        ? max
                        : max === null
                        ? entry.acwr
                        : Math.max(max, entry.acwr),
                null
            ),
            1
        )
    };
};

export const buildAiHints = (overview: TrainingOverview): string[] => {
    const hints: string[] = ['overview_excludes_swimming_by_source'];
    if (overview.multiSport.isMultiSport) hints.push('triathlon_candidate');
    if (
        (overview.sports.running.vo2Max ?? 0) >= 50 &&
        (overview.sports.cycling.vo2Max ?? 0) >= 50
    ) {
        hints.push('strong_run_bike_vo2');
    }
    if ((overview.state.chronicLoad ?? 0) >= 900)
        hints.push('high_chronic_load');
    if (overview.loadBalance.lowAerobic[3] === 'high') {
        hints.push('low_aerobic_high');
    }
    if (overview.loadBalance.highAerobic[3] === 'low') {
        hints.push('high_aerobic_low');
    }
    if (overview.state.status && overview.state.acwrStatus) {
        hints.push(
            `current_${overview.state.status}_${overview.state.acwrStatus}_acwr`
        );
    }
    return hints;
};

export const findPowerToWeight = (
    entries: PowerToWeightEntry[] | null,
    sport: string
) =>
    entries?.find(
        (entry) => entry.sport?.toLowerCase() === sport.toLowerCase()
    ) ?? null;

export const loadBalanceTuple = (
    value: number | null | undefined,
    min: number | null | undefined,
    max: number | null | undefined
): [number | null, number | null, number | null, OverviewMetricStatus] => [
    round(value),
    round(min),
    round(max),
    metricStatus(value, min, max)
];

export const toMinutes = (seconds: number | null | undefined): number | null =>
    typeof seconds === 'number' ? round(seconds / 60) : null;

export const compactLower = (value: string | null | undefined): string | null =>
    value ? value.toLowerCase() : null;

export const numericValues = (
    values: Array<number | null | undefined>
): number[] =>
    values.filter((value): value is number => typeof value === 'number');

export const average = (
    values: Array<number | null | undefined>,
    digits = 0
): number | null => {
    const numbers = numericValues(values);
    if (numbers.length === 0) return null;
    return round(
        numbers.reduce((sum, value) => sum + value, 0) / numbers.length,
        digits
    );
};

export const minimum = (
    values: Array<number | null | undefined>
): number | null => {
    const numbers = numericValues(values);
    return numbers.length > 0 ? Math.min(...numbers) : null;
};

export const maximum = (
    values: Array<number | null | undefined>
): number | null => {
    const numbers = numericValues(values);
    return numbers.length > 0 ? Math.max(...numbers) : null;
};

export const availability = (
    hasAny: boolean,
    hasToday: boolean
): 'available' | 'partial' | 'no_data' => {
    if (hasAny && hasToday) return 'available';
    if (hasAny) return 'partial';
    return 'no_data';
};

export const buildUnavailableMetrics = (
    metricAvailability: WellnessOverview['availability']
): string[] => {
    const metricNames: Record<string, string> = {
        hrv: 'hrv',
        sleep: 'sleep',
        bodyBattery: 'body_battery',
        restingHeartRate: 'resting_hr',
        respiration: 'respiration',
        spo2: 'spo2',
        skinTemp: 'skin_temp'
    };
    return Object.entries(metricAvailability)
        .filter(([, status]) => status !== 'available')
        .map(([metric]) => metricNames[metric] ?? metric);
};

export const buildIncludedMetrics = (
    metricAvailability: WellnessOverview['availability']
): string[] => {
    const metricNames: Record<string, string> = {
        hrv: 'hrv',
        sleep: 'sleep',
        bodyBattery: 'body_battery',
        restingHeartRate: 'resting_hr',
        respiration: 'respiration'
    };
    return Object.entries(metricNames)
        .filter(
            ([metric]) =>
                metricAvailability[
                    metric as keyof WellnessOverview['availability']
                ] === 'available'
        )
        .map(([, name]) => name);
};

export const statusDaysFromHrv = (
    entries: HRVDailySummary[]
): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const entry of entries) {
        const status = compactLower(entry.status) ?? 'unknown';
        result[status] = (result[status] ?? 0) + 1;
    }
    return result;
};

export const hrvTrend = (entries: HRVDailySummary[]): string | null => {
    if (entries.length === 0) return null;
    const statuses = statusDaysFromHrv(entries);
    const dominantStatus =
        Object.entries(statuses).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        'unknown';
    const first = entries[0]?.lastNightAvg;
    const last = entries[entries.length - 1]?.lastNightAvg;
    const direction =
        typeof first === 'number' && typeof last === 'number'
            ? last - first >= 4
                ? 'improving'
                : first - last >= 4
                ? 'declining'
                : 'stable'
            : 'stable';
    return `${direction}_${dominantStatus}`;
};

export const sleepTrend = (
    avgScore: number | null,
    todayDurationMin: number | null,
    todayNeedMin: number | null,
    todayQuality: string | null
): string | null => {
    const base =
        avgScore === null
            ? null
            : avgScore >= 80
            ? 'good_overall'
            : avgScore >= 70
            ? 'fair_overall'
            : 'poor_overall';
    if (!base) return null;
    const short =
        todayDurationMin !== null &&
        todayNeedMin !== null &&
        todayDurationMin < todayNeedMin * 0.9;
    if (short) return `${base}_last_night_short`;
    if (todayQuality && ['fair', 'poor'].includes(todayQuality)) {
        return `${base}_last_night_${todayQuality}`;
    }
    return base;
};

export const bodyBatteryTrend = (
    avgHigh: number | null,
    minLow: number | null,
    latestLow: number | null
): string | null => {
    if (avgHigh === null && minLow === null) return null;
    const recharge =
        avgHigh !== null && avgHigh >= 85
            ? 'high_recharge'
            : 'moderate_recharge';
    const lowPoint =
        latestLow !== null && minLow !== null && latestLow > minLow
            ? 'improving_low_point'
            : 'low_point_watch';
    return `${recharge}_${lowPoint}`;
};

export const buildReadiness = (
    overview: WellnessOverview
): WellnessOverview['readiness'] => {
    const positiveSignals: string[] = [];
    const cautionSignals: string[] = [];

    if (overview.today.hrv.status === 'balanced') {
        positiveSignals.push('hrv_balanced');
    } else if (overview.today.hrv.status) {
        cautionSignals.push(`hrv_${overview.today.hrv.status}`);
    }
    if ((overview.today.bodyBattery.high ?? 0) >= 80) {
        positiveSignals.push('body_battery_high');
    }
    if (
        overview.today.sleep.restingHr !== null &&
        overview.today.sleep.restingHr <= 50
    ) {
        positiveSignals.push('resting_hr_low');
    }
    if (
        overview.today.sleep.avgStress !== null &&
        overview.today.sleep.avgStress <= 15
    ) {
        positiveSignals.push('sleep_stress_low');
    }
    if (
        overview.today.sleep.durationMin !== null &&
        overview.today.sleep.needMin !== null &&
        overview.today.sleep.durationMin < overview.today.sleep.needMin * 0.9
    ) {
        cautionSignals.push('last_night_sleep_short');
    }
    if (
        overview.today.sleep.quality &&
        ['fair', 'poor'].includes(overview.today.sleep.quality)
    ) {
        cautionSignals.push(`sleep_score_${overview.today.sleep.quality}`);
    }
    if (
        overview.today.sleep.remMin !== null &&
        overview.today.sleep.durationMin !== null &&
        overview.today.sleep.remMin < overview.today.sleep.durationMin * 0.18
    ) {
        cautionSignals.push('rem_low');
    }

    const completeCore =
        overview.availability.hrv === 'available' &&
        overview.availability.sleep === 'available' &&
        overview.availability.bodyBattery === 'available';
    const confidence = completeCore
        ? 'high'
        : overview.availability.sleep !== 'no_data' ||
          overview.availability.hrv !== 'no_data'
        ? 'medium'
        : 'low';
    const status =
        cautionSignals.length === 0 && positiveSignals.length >= 3
            ? 'good'
            : positiveSignals.length >= cautionSignals.length
            ? 'moderate_good'
            : 'caution';

    return {
        status,
        confidence,
        positiveSignals,
        cautionSignals
    };
};

export const buildWellnessAiHints = (overview: WellnessOverview): string[] => {
    const hints: string[] = [];
    if (
        overview.availability.hrv === 'available' &&
        overview.availability.sleep === 'available' &&
        overview.availability.bodyBattery === 'available'
    ) {
        hints.push('recovery_data_complete');
    } else {
        hints.push('recovery_data_partial');
    }
    if (overview.today.hrv.status)
        hints.push(`hrv_${overview.today.hrv.status}`);
    if ((overview.recent7d.sleep.avgScore ?? 0) >= 80) {
        hints.push('good_7d_sleep_average');
    }
    for (const signal of overview.readiness.cautionSignals) {
        hints.push(signal);
    }
    if ((overview.today.bodyBattery.high ?? 0) >= 80) {
        hints.push('body_battery_high');
    }
    hints.push(`${overview.readiness.status}_readiness`);
    return Array.from(new Set(hints));
};
