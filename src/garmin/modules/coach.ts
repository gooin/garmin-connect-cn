import { toGarminDateString } from '../common/DateUtils';
import {
    ActivityStatsEntry,
    CurrentSportsAbilityOptions,
    CurrentSportsAbilitySummary,
    CyclingAbilitySummary,
    HRVData,
    HRVDailySummary,
    OverviewMetricStatus,
    PersonalInfoResponse,
    PowerCurveResponse,
    RunningAbilitySummary,
    SleepData,
    SportsAbilityType,
    TrainingLoadBalanceResponse,
    TrainingOverview,
    TrainingOverviewOptions,
    TrainingStatusData,
    WellnessOverview,
    WellnessOverviewOptions,
    WellnessSummary,
    WellnessSummaryOptions
} from '../types';
import { ModuleConstructor } from './types';

type CoachApi = {
    getActivityStats(options: {
        startDate: Date | string;
        endDate: Date | string;
        activityType?: string;
    }): Promise<ActivityStatsEntry[]>;
    getCyclingAbility: () => Promise<CyclingAbilitySummary['cyclingAbility']>;
    getHRVData: (date?: Date) => Promise<HRVData>;
    getHRVDailySummary: (
        startDate: Date | string,
        endDate: Date | string
    ) => Promise<HRVDailySummary[]>;
    getLatestPowerToWeight: (
        date?: Date | string
    ) => Promise<CyclingAbilitySummary['latestPowerToWeight']>;
    getMaxMet: (
        date?: Date | string,
        sport?: 'cycling' | 'running'
    ) => Promise<CyclingAbilitySummary['maxMet']>;
    getPersonalInfo: () => Promise<PersonalInfoResponse>;
    getPowerCurve: (
        sport?: 'cycling' | 'running',
        startDate?: Date | string,
        endDate?: Date | string
    ) => Promise<PowerCurveResponse>;
    getPowerToWeightRange: (
        startDate: Date | string,
        endDate: Date | string,
        aggregation?: 'weekly' | 'monthly',
        sport?: 'cycling' | 'running'
    ) => Promise<CyclingAbilitySummary['powerToWeightTrend']>;
    getRacePredictionsMonthly: (
        fromCalendarDate: Date | string,
        toCalendarDate: Date | string
    ) => Promise<RunningAbilitySummary['racePredictions']>;
    getRunningLactateThreshold: (
        startDate: Date | string,
        endDate: Date | string
    ) => Promise<RunningAbilitySummary['lactateThreshold']>;
    getTrainingLoadBalance: (
        date?: Date
    ) => Promise<TrainingLoadBalanceResponse>;
    getTrainingStatus: (
        date?: Date
    ) => Promise<{
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

type SourceErrors = Record<string, string>;

const addDays = (date: Date, days: number): Date => {
    const copy = new Date(date.getTime());
    copy.setDate(copy.getDate() + days);
    return copy;
};

const normalizeDate = (date: Date | string | undefined, fallback: Date): Date =>
    date instanceof Date ? date : date ? new Date(date) : fallback;

const getRange = (
    options:
        | CurrentSportsAbilityOptions
        | WellnessSummaryOptions
        | WellnessOverviewOptions
        | TrainingOverviewOptions,
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

const capture = async <T>(
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

const latestActivityStats = (
    entries: ActivityStatsEntry[]
): ActivityStatsEntry | null => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted[sorted.length - 1] : null;
};

const compactPowerCurve = (
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

const extractUser = (personalInfo: PersonalInfoResponse | null) => {
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

const extractCurrentTrainingStatus = (
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

const extractLoadBalance = (
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

const extractWeeklyTrainingStatus = (
    weeklyTrainingStatus: {
        reportData: Record<string, TrainingStatusData[]>;
    } | null
): TrainingStatusData[] =>
    Object.values(weeklyTrainingStatus?.reportData ?? {})
        .flat()
        .filter((entry) => entry.primaryTrainingDevice)
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));

const round = (value: number | null | undefined, digits = 0): number | null => {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return null;
    }
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
};

const lowerSnake = (value: string | null | undefined): string | null =>
    value ? value.toLowerCase() : null;

const normalizeGender = (gender: string | null | undefined): string | null => {
    if (!gender) return null;
    const normalized = gender.toUpperCase();
    if (normalized.startsWith('M')) return 'M';
    if (normalized.startsWith('F')) return 'F';
    return gender;
};

const normalizeSport = (sport: string | null | undefined): string | null =>
    sport ? sport.toLowerCase() : null;

const normalizeStatus = (
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

const normalizeTrend = (
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

const metricValue = (
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

const buildYearStats = (entry: ActivityStatsEntry | null) => ({
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

const hasSportStats = (entry: ActivityStatsEntry | null): boolean =>
    (entry?.countOfActivities ?? 0) > 0 ||
    (metricValue(entry, 'duration', 'sum') ?? 0) > 0;

const compactRaceTime = (value: string | null | undefined): string | null => {
    if (!value) return null;
    if (value.startsWith('00:')) return value.slice(3);
    if (value.startsWith('0')) return value.slice(1);
    return value;
};

const thresholdPaceFromSpeed = (
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

const metricStatus = (
    value: number | null | undefined,
    min: number | null | undefined,
    max: number | null | undefined
): OverviewMetricStatus => {
    if (value === null || value === undefined) return null;
    if (min !== null && min !== undefined && value < min) return 'low';
    if (max !== null && max !== undefined && value > max) return 'high';
    return 'ok';
};

const compactTrainingStatuses = (
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

const countStatusDays = (
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

const buildTrendLoad = (entries: TrainingStatusData[]) => {
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

const buildAiHints = (overview: TrainingOverview): string[] => {
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

const findPowerToWeight = (
    entries: CyclingAbilitySummary['latestPowerToWeight'] | null,
    sport: string
) =>
    entries?.find(
        (entry) => entry.sport?.toLowerCase() === sport.toLowerCase()
    ) ?? null;

const loadBalanceTuple = (
    value: number | null | undefined,
    min: number | null | undefined,
    max: number | null | undefined
): [number | null, number | null, number | null, OverviewMetricStatus] => [
    round(value),
    round(min),
    round(max),
    metricStatus(value, min, max)
];

const toMinutes = (seconds: number | null | undefined): number | null =>
    typeof seconds === 'number' ? round(seconds / 60) : null;

const compactLower = (value: string | null | undefined): string | null =>
    value ? value.toLowerCase() : null;

const numericValues = (values: Array<number | null | undefined>): number[] =>
    values.filter((value): value is number => typeof value === 'number');

const average = (
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

const minimum = (values: Array<number | null | undefined>): number | null => {
    const numbers = numericValues(values);
    return numbers.length > 0 ? Math.min(...numbers) : null;
};

const maximum = (values: Array<number | null | undefined>): number | null => {
    const numbers = numericValues(values);
    return numbers.length > 0 ? Math.max(...numbers) : null;
};

const availability = (
    hasAny: boolean,
    hasToday: boolean
): 'available' | 'partial' | 'no_data' => {
    if (hasAny && hasToday) return 'available';
    if (hasAny) return 'partial';
    return 'no_data';
};

const buildUnavailableMetrics = (
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

const buildIncludedMetrics = (
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

const statusDaysFromHrv = (
    entries: HRVDailySummary[]
): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const entry of entries) {
        const status = compactLower(entry.status) ?? 'unknown';
        result[status] = (result[status] ?? 0) + 1;
    }
    return result;
};

const hrvTrend = (entries: HRVDailySummary[]): string | null => {
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

const sleepTrend = (
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

const bodyBatteryTrend = (
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

const buildReadiness = (
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

const buildWellnessAiHints = (overview: WellnessOverview): string[] => {
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

export function applyCoachModule(Base: ModuleConstructor) {
    return class CoachModule extends Base {
        /**
         * Build the compact training overview intended for AI coach prompts and
         * future MCP responses. This method always queries running and cycling
         * sources together, validates the token before fan-out, and returns a
         * stable `training_overview_v1` shape instead of Garmin's large raw
         * payloads.
         *
         * Data included:
         * - athlete profile: age, gender, height, weight, observed sports
         * - current training state: status, load trend, acute/chronic load, ACWR
         * - load balance: low aerobic, high aerobic, anaerobic values vs targets
         * - sport summaries: 365-day run/bike volume, key form metrics, VO2,
         *   threshold, race prediction, FTP/power-to-weight, cycling ability
         * - multi-sport interpretation, 90-day training status trend, data
         *   completeness flags, and AI hint tags
         *
         * Missing or unsupported sources are represented as `null`, `false`, or
         * explicit completeness flags; swimming is intentionally marked as not
         * supported because this overview only uses the available Garmin
         * run/bike source endpoints.
         */
        async getTrainingOverview(
            options: TrainingOverviewOptions = {}
        ): Promise<TrainingOverview> {
            await this.client.checkTokenVaild();

            const api = this as unknown as CoachApi;
            const errors: SourceErrors = {};
            const rangeDays = options.rangeDays ?? options.recentDays ?? 365;
            const trendDays = options.trendDays ?? 90;
            const activityRange = getRange(
                { ...options, recentDays: rangeDays },
                365
            );
            const trendRange = getRange(
                { ...options, recentDays: trendDays },
                90
            );
            const snapshotDate = activityRange.endDateString;

            const [
                personalInfo,
                trainingStatus,
                loadBalanceResponse,
                weeklyTrainingStatus,
                runningActivityStats,
                cyclingActivityStats,
                racePredictions,
                lactateThreshold,
                latestPowerToWeight,
                cyclingAbility,
                cyclingMaxMet
            ] = await Promise.all([
                capture('personalInfo', errors, () => api.getPersonalInfo()),
                capture('trainingStatus', errors, () =>
                    api.getTrainingStatus(activityRange.endDate)
                ),
                capture('trainingLoadBalance', errors, () =>
                    api.getTrainingLoadBalance(activityRange.endDate)
                ),
                capture('weeklyTrainingStatus', errors, () =>
                    api.getWeeklyTrainingStatus(
                        trendRange.startDate,
                        trendRange.endDate
                    )
                ),
                capture('runningActivityStats', errors, () =>
                    api.getActivityStats({
                        startDate: activityRange.startDateString,
                        endDate: activityRange.endDateString,
                        activityType: 'running'
                    })
                ),
                capture('cyclingActivityStats', errors, () =>
                    api.getActivityStats({
                        startDate: activityRange.startDateString,
                        endDate: activityRange.endDateString,
                        activityType: 'cycling'
                    })
                ),
                capture('racePredictions', errors, () =>
                    api.getRacePredictionsMonthly(
                        trendRange.startDateString,
                        trendRange.endDateString
                    )
                ),
                capture('lactateThreshold', errors, () =>
                    api.getRunningLactateThreshold(
                        trendRange.startDateString,
                        trendRange.endDateString
                    )
                ),
                capture('latestPowerToWeight', errors, () =>
                    api.getLatestPowerToWeight(activityRange.endDateString)
                ),
                capture('cyclingAbility', errors, () =>
                    api.getCyclingAbility()
                ),
                capture('cyclingMaxMet', errors, () =>
                    api.getMaxMet(activityRange.endDateString, 'cycling')
                )
            ]);

            const user = extractUser(personalInfo);
            const current = extractCurrentTrainingStatus(trainingStatus);
            const loadBalance = extractLoadBalance(loadBalanceResponse);
            const weekly = compactTrainingStatuses(weeklyTrainingStatus);
            const runningStats = latestActivityStats(
                runningActivityStats ?? []
            );
            const cyclingStats = latestActivityStats(
                cyclingActivityStats ?? []
            );
            const runningAvailable = hasSportStats(runningStats);
            const cyclingAvailable = hasSportStats(cyclingStats);
            const observedSports = [
                ...(runningAvailable ? ['running'] : []),
                ...(cyclingAvailable ? ['cycling'] : [])
            ];
            const runningYear = buildYearStats(runningStats);
            const cyclingYear = buildYearStats(cyclingStats);
            const totalDuration =
                (runningYear.durationH ?? 0) + (cyclingYear.durationH ?? 0);
            const durationShare =
                totalDuration > 0
                    ? {
                          running: round(
                              (runningYear.durationH ?? 0) / totalDuration,
                              2
                          )!,
                          cycling: round(
                              (cyclingYear.durationH ?? 0) / totalDuration,
                              2
                          )!
                      }
                    : { running: 0, cycling: 0 };
            const dominantByDuration =
                totalDuration > 0
                    ? durationShare.running >= durationShare.cycling
                        ? 'running'
                        : 'cycling'
                    : null;
            const latestRacePrediction =
                racePredictions
                    ?.slice()
                    .sort((a, b) =>
                        a.calendarDate.localeCompare(b.calendarDate)
                    )
                    .pop() ?? null;
            const latestThresholdByDate = lactateThreshold?.latest
                ?.slice()
                .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
            const latestSpeedThreshold =
                latestThresholdByDate
                    ?.slice()
                    .reverse()
                    .find((entry) => entry.speed !== null) ?? null;
            const latestHrThreshold =
                latestThresholdByDate
                    ?.slice()
                    .reverse()
                    .find(
                        (entry) =>
                            (entry as any).hearRate !== null ||
                            (entry as any).heartRate !== null
                    ) ?? null;
            const cyclingPower = findPowerToWeight(
                latestPowerToWeight,
                'CYCLING'
            );
            const runningPower = findPowerToWeight(
                latestPowerToWeight,
                'RUNNING'
            );
            const acute = current?.acuteTrainingLoadDTO as any;
            const acuteLoad =
                acute?.dailyTrainingLoadAcute ??
                current?.weeklyTrainingLoad ??
                null;
            const chronicLoad =
                acute?.dailyTrainingLoadChronic ??
                current?.loadTunnelMax ??
                null;
            const acwr =
                acute?.dailyAcuteChronicWorkloadRatio ??
                (acuteLoad !== null && chronicLoad
                    ? acuteLoad / chronicLoad
                    : null);

            const overview: TrainingOverview = {
                schema: 'training_overview_v1',
                snapshotDate,
                rangeDays,
                source: {
                    provider: 'garmin',
                    endpointType: 'training_overview',
                    includedSports: ['running', 'cycling'],
                    excludedSports: [
                        {
                            sport: 'swimming',
                            reason: 'not_provided_by_source_endpoint'
                        }
                    ]
                },
                athlete: {
                    age: user.age ?? null,
                    gender: normalizeGender(user.gender),
                    heightCm: user.height ?? null,
                    weightKg:
                        user.weight && user.weight > 500
                            ? round(user.weight / 1000, 1)
                            : round(user.weight, 1),
                    type:
                        runningAvailable && cyclingAvailable
                            ? 'triathlon'
                            : observedSports[0] ?? null,
                    observedSports
                },
                state: {
                    status: normalizeStatus(
                        current?.trainingStatus,
                        current?.trainingStatusFeedbackPhrase
                    ),
                    trend: normalizeTrend(current?.fitnessTrend),
                    statusSport: normalizeSport(current?.sport),
                    fitnessTrendSport: normalizeSport(
                        current?.fitnessTrendSport
                    ),
                    acuteLoad: round(acuteLoad),
                    chronicLoad: round(chronicLoad),
                    acwr: round(acwr, 1),
                    acwrStatus: lowerSnake(acute?.acwrStatus)
                },
                loadBalance: {
                    lowAerobic: loadBalanceTuple(
                        loadBalance?.monthlyLoadAerobicLow,
                        loadBalance?.monthlyLoadAerobicLowTargetMin,
                        loadBalance?.monthlyLoadAerobicLowTargetMax
                    ),
                    highAerobic: loadBalanceTuple(
                        loadBalance?.monthlyLoadAerobicHigh,
                        loadBalance?.monthlyLoadAerobicHighTargetMin,
                        loadBalance?.monthlyLoadAerobicHighTargetMax
                    ),
                    anaerobic: loadBalanceTuple(
                        loadBalance?.monthlyLoadAnaerobic,
                        loadBalance?.monthlyLoadAnaerobicTargetMin,
                        loadBalance?.monthlyLoadAnaerobicTargetMax
                    ),
                    feedback: lowerSnake(
                        loadBalance?.trainingBalanceFeedbackPhrase
                    )
                },
                sports: {
                    running: {
                        available: runningAvailable,
                        vo2Max: user.vo2Max ?? null,
                        threshold: {
                            pace: thresholdPaceFromSpeed(
                                latestSpeedThreshold?.speed
                            ),
                            hr:
                                (latestHrThreshold as any)?.hearRate ??
                                (latestHrThreshold as any)?.heartRate ??
                                user.lactateThresholdHeartRate ??
                                null
                        },
                        power: {
                            ftp:
                                runningPower?.functionalThresholdPower ??
                                user.functionalThresholdPower ??
                                null,
                            wkg: round(runningPower?.powerToWeight, 2),
                            stale: runningPower?.isStale ?? null
                        },
                        year: runningYear,
                        form: {
                            cadence: round(
                                metricValue(
                                    runningStats,
                                    'avgRunCadence',
                                    'avg'
                                )
                            ),
                            strideCm: round(
                                metricValue(
                                    runningStats,
                                    'avgStrideLength',
                                    'avg'
                                )
                            ),
                            gctMs: round(
                                metricValue(
                                    runningStats,
                                    'avgGroundContactTime',
                                    'avg'
                                )
                            ),
                            voCm: round(
                                metricValue(
                                    runningStats,
                                    'avgVerticalOscillation',
                                    'avg'
                                ),
                                1
                            )
                        },
                        prediction: {
                            '5k': compactRaceTime(
                                latestRacePrediction?.time5KFormatted
                            ),
                            '10k': compactRaceTime(
                                latestRacePrediction?.time10KFormatted
                            ),
                            hm: compactRaceTime(
                                latestRacePrediction?.timeHalfMarathonFormatted
                            ),
                            fm: compactRaceTime(
                                latestRacePrediction?.timeMarathonFormatted
                            )
                        }
                    },
                    cycling: {
                        available: cyclingAvailable,
                        vo2Max:
                            cyclingMaxMet?.cycling?.vo2MaxValue ??
                            user.vo2MaxCycling ??
                            null,
                        power: {
                            ftp:
                                cyclingPower?.functionalThresholdPower ??
                                user.functionalThresholdPower ??
                                null,
                            wkg: round(cyclingPower?.powerToWeight, 2),
                            stale: cyclingPower?.isStale ?? null
                        },
                        year: cyclingYear,
                        form: {
                            avgPower: round(
                                metricValue(cyclingStats, 'avgPower', 'avg')
                            ),
                            cadence: round(
                                metricValue(
                                    cyclingStats,
                                    'avgBikeCadence',
                                    'avg'
                                )
                            )
                        },
                        ability: {
                            type: lowerSnake(cyclingAbility?.profileType),
                            aerobicEndurance:
                                cyclingAbility?.aerobicEndurance ?? null,
                            aerobicCapacity:
                                cyclingAbility?.aerobicCapacity ?? null,
                            anaerobicCapacity:
                                cyclingAbility?.anaerobicCapacity ?? null
                        }
                    }
                },
                multiSport: {
                    isMultiSport: observedSports.length > 1,
                    observedSports,
                    durationShare,
                    dominantByDuration,
                    note: 'swimming_not_available_in_this_overview_source'
                },
                trend90d: {
                    statusDays: countStatusDays(weekly),
                    load: buildTrendLoad(weekly)
                },
                dataCompleteness: {
                    profile: personalInfo !== null,
                    trainingStatus: current !== null,
                    loadBalance: loadBalance !== null,
                    runningStats: runningAvailable,
                    cyclingStats: cyclingAvailable,
                    swimmingStats: 'not_supported_by_source',
                    recovery: false,
                    recentActivities: false,
                    subjectiveFeedback: false
                },
                aiHints: []
            };

            overview.aiHints = buildAiHints(overview);
            return overview;
        }

        /**
         * Return the richer raw-ish sport ability aggregation used for debugging
         * and inspection. Unlike `getTrainingOverview`, this method can limit
         * output to `running`, `cycling`, or `all`, and keeps larger Garmin
         * source objects such as activity stats arrays, lactate threshold
         * ranges, race predictions, power curves, and source error details.
         *
         * Prefer `getTrainingOverview()` for AI coach prompts or MCP responses
         * where a compact, stable schema is needed.
         */
        async getCurrentSportsAbility(
            type: SportsAbilityType = 'all',
            options: CurrentSportsAbilityOptions = {}
        ): Promise<CurrentSportsAbilitySummary> {
            if (!['running', 'cycling', 'all'].includes(type)) {
                throw new Error(
                    'getCurrentSportsAbility: type must be running, cycling, or all'
                );
            }

            await this.client.checkTokenVaild();

            const api = this as unknown as CoachApi;
            const errors: SourceErrors = {};
            const activityDays =
                options.activityStatsDays ?? options.recentDays ?? 365;
            const trendDays = options.trendDays ?? 90;
            const activityRange = getRange(
                { ...options, recentDays: activityDays },
                365
            );
            const trendRange = getRange(
                { ...options, recentDays: trendDays },
                90
            );
            const includeRunning = type === 'running' || type === 'all';
            const includeCycling = type === 'cycling' || type === 'all';

            const [
                personalInfo,
                trainingStatus,
                loadBalance,
                weeklyTrainingStatus,
                runningActivityStats,
                racePredictions,
                lactateThreshold,
                cyclingActivityStats,
                latestPowerToWeight,
                powerToWeightTrend,
                cyclingAbility,
                powerCurve,
                maxMet
            ] = await Promise.all([
                capture('personalInfo', errors, () => api.getPersonalInfo()),
                capture('trainingStatus', errors, () =>
                    api.getTrainingStatus(activityRange.endDate)
                ),
                capture('trainingLoadBalance', errors, () =>
                    api.getTrainingLoadBalance(activityRange.endDate)
                ),
                capture('weeklyTrainingStatus', errors, () =>
                    api.getWeeklyTrainingStatus(
                        trendRange.startDate,
                        trendRange.endDate
                    )
                ),
                includeRunning
                    ? capture('runningActivityStats', errors, () =>
                          api.getActivityStats({
                              startDate: activityRange.startDateString,
                              endDate: activityRange.endDateString,
                              activityType: 'running'
                          })
                      )
                    : Promise.resolve(null),
                includeRunning
                    ? capture('racePredictions', errors, () =>
                          api.getRacePredictionsMonthly(
                              trendRange.startDateString,
                              trendRange.endDateString
                          )
                      )
                    : Promise.resolve(null),
                includeRunning
                    ? capture('lactateThreshold', errors, () =>
                          api.getRunningLactateThreshold(
                              trendRange.startDateString,
                              trendRange.endDateString
                          )
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('cyclingActivityStats', errors, () =>
                          api.getActivityStats({
                              startDate: activityRange.startDateString,
                              endDate: activityRange.endDateString,
                              activityType: 'cycling'
                          })
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('latestPowerToWeight', errors, () =>
                          api.getLatestPowerToWeight(
                              activityRange.endDateString
                          )
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('powerToWeightTrend', errors, () =>
                          api.getPowerToWeightRange(
                              trendRange.startDateString,
                              trendRange.endDateString,
                              'weekly',
                              'cycling'
                          )
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('cyclingAbility', errors, () =>
                          api.getCyclingAbility()
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('powerCurve', errors, () =>
                          api.getPowerCurve(
                              'cycling',
                              activityRange.startDateString,
                              activityRange.endDateString
                          )
                      )
                    : Promise.resolve(null),
                includeCycling
                    ? capture('maxMet', errors, () =>
                          api.getMaxMet(activityRange.endDateString, 'cycling')
                      )
                    : Promise.resolve(null)
            ]);

            const summary: CurrentSportsAbilitySummary = {
                type,
                generatedAt: new Date().toISOString(),
                user: extractUser(personalInfo),
                training: {
                    current: extractCurrentTrainingStatus(trainingStatus),
                    loadBalance: extractLoadBalance(loadBalance),
                    weekly: extractWeeklyTrainingStatus(weeklyTrainingStatus)
                },
                sourceErrors: errors
            };

            if (includeRunning) {
                const recent = runningActivityStats ?? [];
                summary.running = {
                    activityStats: {
                        range: {
                            startDate: activityRange.startDateString,
                            endDate: activityRange.endDateString
                        },
                        recent,
                        latest: latestActivityStats(recent)
                    },
                    racePredictions: racePredictions ?? [],
                    lactateThreshold: lactateThreshold ?? null
                };
            }

            if (includeCycling) {
                const recent = cyclingActivityStats ?? [];
                summary.cycling = {
                    activityStats: {
                        range: {
                            startDate: activityRange.startDateString,
                            endDate: activityRange.endDateString
                        },
                        recent,
                        latest: latestActivityStats(recent)
                    },
                    latestPowerToWeight: latestPowerToWeight ?? [],
                    powerToWeightTrend: powerToWeightTrend ?? [],
                    cyclingAbility: cyclingAbility ?? null,
                    powerCurve: compactPowerCurve(powerCurve),
                    maxMet: maxMet ?? null
                };
            }

            return summary;
        }

        /**
         * Build the compact wellness overview intended for daily AI coach
         * readiness prompts. It reuses `getWellnessSummary()` as the source
         * fan-out layer, then normalizes Garmin HRV, sleep, body battery,
         * resting heart rate, respiration, SpO2, and skin temperature signals
         * into a stable `wellness_overview_v1` shape.
         *
         * Data included:
         * - source and availability flags for every recovery metric
         * - today's HRV, sleep stage, sleep quality, body battery, resting HR,
         *   stress, and respiration fields where Garmin provides them
         * - recent range summaries for HRV status, sleep averages, low sleep
         *   score days, and body battery recharge range
         * - readiness status with confidence, positive/caution signals, and AI
         *   hint tags
         *
         * Users often have incomplete wellness data; unavailable metrics are
         * marked as `no_data` or `partial` rather than omitted.
         */
        async getWellnessOverview(
            options: WellnessOverviewOptions = {}
        ): Promise<WellnessOverview> {
            const rangeDays = options.rangeDays ?? options.recentDays ?? 7;
            const summary = await this.getWellnessSummary({
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
            const recentBodyBattery = [...summary.recent.bodyBattery].sort(
                (a, b) => a.calendarDate.localeCompare(b.calendarDate)
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
                    compactLower(
                        todaySleepDto?.sleepScores?.overall?.qualifierKey
                    ),
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

            const sleepScores = recentSleep.map(
                (entry) => entry.values.sleepScore
            );
            const sleepDurations = recentSleep.map((entry) =>
                toMinutes(entry.values.totalSleepTimeInSeconds)
            );
            const sleepNeeds = recentSleep.map(
                (entry) => entry.values.sleepNeed
            );
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
                hasTodayRespiration ||
                numericValues(sleepRespiration).length > 0;
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
                bodyBattery: availability(
                    hasAnyBodyBattery,
                    hasTodayBodyBattery
                ),
                restingHeartRate: availability(
                    hasAnyRestingHr,
                    hasTodayRestingHr
                ),
                respiration: availability(
                    hasAnyRespiration,
                    hasTodayRespiration
                ),
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
                    unavailableMetrics:
                        buildUnavailableMetrics(metricAvailability)
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
        }

        /**
         * Return a compact recovery/wellness aggregation for daily training
         * advice. The response contains today's HRV and sleep summary plus
         * recent HRV, body battery, and sleep trends over the requested range.
         *
         * This method validates the token before parallel requests and records
         * per-source failures in `sourceErrors` so callers can distinguish
         * missing recovery data from a fully populated response.
         */
        async getWellnessSummary(
            options: WellnessSummaryOptions = {}
        ): Promise<WellnessSummary> {
            await this.client.checkTokenVaild();

            const api = this as unknown as CoachApi;
            const errors: SourceErrors = {};
            const range = getRange(options, 7);

            const [todayHrv, recentHrv, bodyBattery, todaySleep, sleepSummary] =
                await Promise.all([
                    capture('todayHrv', errors, () =>
                        api.getHRVData(range.endDate)
                    ),
                    capture('recentHrv', errors, () =>
                        api.getHRVDailySummary(
                            range.startDateString,
                            range.endDateString
                        )
                    ),
                    capture('bodyBattery', errors, () =>
                        api.getBodyBattery(
                            range.startDateString,
                            range.endDateString
                        )
                    ),
                    capture('todaySleep', errors, () =>
                        api.getSleepData(range.endDate)
                    ),
                    capture('sleepSummary', errors, () =>
                        api.getSleepDailySummary(range.startDate, range.endDate)
                    )
                ]);

            return {
                generatedAt: new Date().toISOString(),
                range: {
                    startDate: range.startDateString,
                    endDate: range.endDateString
                },
                today: {
                    date: range.endDateString,
                    hrv: todayHrv?.hrvSummary ?? null,
                    hrvReadingCount: todayHrv?.hrvReadings?.length ?? 0,
                    sleep: todaySleep
                        ? {
                              dailySleepDTO: todaySleep.dailySleepDTO ?? null,
                              avgOvernightHrv: todaySleep.avgOvernightHrv,
                              hrvStatus: todaySleep.hrvStatus,
                              bodyBatteryChange: todaySleep.bodyBatteryChange,
                              restingHeartRate: todaySleep.restingHeartRate
                          }
                        : null
                },
                recent: {
                    hrv: recentHrv ?? [],
                    bodyBattery: bodyBattery ?? [],
                    sleep: {
                        overall: sleepSummary?.overallStats ?? null,
                        daily: sleepSummary?.individualStats ?? []
                    }
                },
                sourceErrors: errors
            };
        }
    };
}
