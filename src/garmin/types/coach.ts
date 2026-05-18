export interface CoachDateRangeOptions {
    date?: Date | string;
    startDate?: Date | string;
    endDate?: Date | string;
    recentDays?: number;
}

export interface WellnessOverviewOptions extends CoachDateRangeOptions {
    rangeDays?: number;
}

export interface TrainingOverviewOptions extends CoachDateRangeOptions {
    rangeDays?: number;
    trendDays?: number;
}

export interface ActivitiesSummaryOptions extends CoachDateRangeOptions {
    rangeDays?: number;
    start?: number;
    limit?: number;
    activityType?: string;
    subActivityType?: string;
}

export interface ActivityDetailSummaryOptions {
    activityId: number;
}

export type WellnessMetricAvailability = 'available' | 'partial' | 'no_data';

export interface CompactTrainingEffect {
    aerobic: number | null;
    anaerobic: number | null;
    label: string;
}

export interface CompactActivity {
    id: number;
    date: string | null;
    time: string | null;
    sport: string | null;
    subSport: string | null;
    name: string | null;
    summary: {
        distanceKm: number | null;
        durationMin: number | null;
        pace: string | null;
        avgHr: number | null;
        maxHr: number | null;
        elevGainM: number | null;
    };
    impact: {
        label: string;
        load: number | null;
        aerobicTE: number | null;
        anaerobicTE: number | null;
        bodyBatteryDelta: number | null;
    };
    intensity: {
        hrZonesSec: number[];
    };
    workout?: {
        structured: boolean;
        workoutId: number | null;
        type: string | null;
        /** 说明 segments 数组每个索引对应的字段名 */
        segmentSchema: string[];
        segments: Array<
            [string, number, number | null, number | null, string | null]
        >;
    };
    flags: string[];
}

export interface ActivitiesSummary {
    schema: 'activities_summary_v1';
    range: {
        start: string;
        end: string;
        days: number;
    };
    summary: {
        activities: number;
        sports: Record<
            string,
            {
                count: number;
                distanceKm?: number;
                durationMin: number;
                elevGainM?: number;
                load: number;
            }
        >;
        totalLoad: number;
        totalDurationMin: number;
        hardSessions: number;
        easySessions: number;
        otherSessions: number;
    };
    activities: CompactActivity[];
    aiHints: string[];
}

export interface ActivityDetailSummary {
    schema: 'activity_detail_v1';
    id: number;
    date: string | null;
    startTime: string | null;
    sport: string | null;
    subSport: string | null;
    name: string | null;
    location: string | null;
    isStructuredWorkout: boolean;
    workoutId: number | null;
    summary: {
        distanceKm: number | null;
        durationMin: number | null;
        movingMin: number | null;
        elapsedMin: number | null;
        pace: string | null;
        gapPace: string | null;
        avgHr: number | null;
        maxHr: number | null;
        calories: number | null;
        elevGainM: number | null;
        elevLossM: number | null;
        avgTempC: number | null;
    };
    trainingImpact: {
        label: string;
        load: number | null;
        aerobicTE: number | null;
        anaerobicTE: number | null;
        aerobicMessage: string | null;
        anaerobicMessage: string | null;
        bodyBatteryDelta: number | null;
        recoveryHr: number | null;
    };
    intensity: {
        moderateMin: number | null;
        vigorousMin: number | null;
    };
    runForm?: {
        cadence: number | null;
        maxCadence: number | null;
        strideCm: number | null;
        gctMs: number | null;
        gctBalanceLeft: number | null;
        verticalOscCm: number | null;
        verticalRatio: number | null;
    };
    stamina?: {
        begin: number | null;
        end: number | null;
        minAvailable: number | null;
    };
    subjective?: {
        feel: number | null;
        rpe: number | null;
        complianceScore: number | null;
    };
    sensors?: {
        heartRate: boolean;
        runPower: boolean;
        stryd: boolean;
    };
    workoutStructure?: {
        available: boolean;
        type: string | null;
        /** 说明 segments 数组每个索引对应的字段名 */
        segmentSchema: string[];
        /** 按训练顺序展开的每个分段，将聚合数据平摊到每个子段 */
        segments: Array<
            [
                string,
                number,
                number,
                string,
                number | null,
                number | null,
                number | null
            ]
        >;
    };
    movementBreakdown?: Record<
        string,
        {
            distanceKm: number | null;
            durationMin?: number | null;
            durationSec?: number | null;
            avgHr: number | null;
        }
    >;
    aiHints: string[];
}

export interface WellnessOverview {
    schema: 'wellness_overview_v1';
    snapshotDate: string;
    rangeDays: number;
    source: {
        provider: 'garmin';
        includedMetrics: string[];
        unavailableMetrics: string[];
    };
    availability: {
        hrv: WellnessMetricAvailability;
        sleep: WellnessMetricAvailability;
        bodyBattery: WellnessMetricAvailability;
        restingHeartRate: WellnessMetricAvailability;
        respiration: WellnessMetricAvailability;
        spo2: WellnessMetricAvailability;
        skinTemp: WellnessMetricAvailability;
    };
    today: {
        date: string;
        hrv: {
            status: string | null;
            lastNightAvg: number | null;
            weeklyAvg: number | null;
            baseline: [number | null, number | null];
            readings: number;
        };
        sleep: {
            score: number | null;
            quality: string | null;
            durationMin: number | null;
            needMin: number | null;
            deepMin: number | null;
            lightMin: number | null;
            remMin: number | null;
            awakeMin: number | null;
            bodyBatteryChange: number | null;
            restingHr: number | null;
            avgHr: number | null;
            avgStress: number | null;
            respiration: number | null;
        };
        bodyBattery: {
            low: number | null;
            high: number | null;
            changeDuringSleep: number | null;
        };
    };
    recent7d: {
        hrv: {
            statusDays: Record<string, number>;
            avgLastNight: number | null;
            minLastNight: number | null;
            maxLastNight: number | null;
            trend: string | null;
        };
        sleep: {
            avgScore: number | null;
            avgDurationMin: number | null;
            avgNeedMin: number | null;
            avgBodyBatteryChange: number | null;
            avgRestingHr: number | null;
            avgRespiration: number | null;
            lowScoreDays: Array<[string, number]>;
            trend: string | null;
        };
        bodyBattery: {
            avgLow: number | null;
            avgHigh: number | null;
            minLow: number | null;
            maxHigh: number | null;
            trend: string | null;
        };
    };
    readiness: {
        status: string;
        confidence: 'low' | 'medium' | 'high';
        positiveSignals: string[];
        cautionSignals: string[];
    };
    aiHints: string[];
}

export type OverviewMetricStatus = 'low' | 'ok' | 'high' | null;

export interface TrainingOverviewSportYear {
    activities: number;
    distanceKm: number | null;
    durationH: number | null;
    elevGainM: number | null;
    avgHr: number | null;
    maxHr: number | null;
}

export interface TrainingOverview {
    schema: 'training_overview_v1';
    snapshotDate: string;
    rangeDays: number;
    source: {
        provider: 'garmin';
        endpointType: 'training_overview';
        includedSports: Array<'running' | 'cycling'>;
        excludedSports: Array<{
            sport: string;
            reason: string;
        }>;
    };
    athlete: {
        age: number | null;
        gender: string | null;
        heightCm: number | null;
        weightKg: number | null;
        type: string | null;
        observedSports: string[];
    };
    state: {
        status: string | null;
        trend: string | null;
        statusSport: string | null;
        fitnessTrendSport: string | null;
        acuteLoad: number | null;
        chronicLoad: number | null;
        acwr: number | null;
        acwrStatus: string | null;
    };
    loadBalance: {
        lowAerobic: [
            number | null,
            number | null,
            number | null,
            OverviewMetricStatus
        ];
        highAerobic: [
            number | null,
            number | null,
            number | null,
            OverviewMetricStatus
        ];
        anaerobic: [
            number | null,
            number | null,
            number | null,
            OverviewMetricStatus
        ];
        feedback: string | null;
    };
    sports: {
        running: {
            available: boolean;
            vo2Max: number | null;
            threshold: {
                pace: string | null;
                hr: number | null;
            };
            power: {
                ftp: number | null;
                wkg: number | null;
                stale: boolean | null;
            };
            year: TrainingOverviewSportYear;
            form: {
                cadence: number | null;
                strideCm: number | null;
                gctMs: number | null;
                voCm: number | null;
            };
            prediction: {
                '5k': string | null;
                '10k': string | null;
                hm: string | null;
                fm: string | null;
            };
        };
        cycling: {
            available: boolean;
            vo2Max: number | null;
            power: {
                ftp: number | null;
                wkg: number | null;
                stale: boolean | null;
            };
            year: TrainingOverviewSportYear;
            form: {
                avgPower: number | null;
                cadence: number | null;
            };
            ability: {
                type: string | null;
                aerobicEndurance: number | null;
                aerobicCapacity: number | null;
                anaerobicCapacity: number | null;
            };
        };
    };
    multiSport: {
        isMultiSport: boolean;
        observedSports: string[];
        durationShare: Record<string, number>;
        dominantByDuration: string | null;
        note: string;
    };
    trend90d: {
        statusDays: Record<string, number>;
        load: {
            chronicStart: number | null;
            chronicEnd: number | null;
            maxAcute: number | null;
            maxAcwr: number | null;
        };
    };
    dataCompleteness: {
        profile: boolean;
        trainingStatus: boolean;
        loadBalance: boolean;
        runningStats: boolean;
        cyclingStats: boolean;
        swimmingStats: 'not_supported_by_source';
        recovery: boolean;
        recentActivities: boolean;
        subjectiveFeedback: boolean;
    };
    aiHints: string[];
}
