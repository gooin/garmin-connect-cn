import { ActivityStatsEntry } from './activity-stats';
import { BodyBatteryDailyEntry } from './body-battery';
import {
    CyclingAbility,
    MaxMetResponse,
    PowerCurveResponse,
    PowerToWeightEntry
} from './cycling';
import { HRVData, HRVDailySummary } from './hrv';
import {
    RacePredictionMonthlyReadable,
    RunningLactateThreshold,
    BiometricStatRangeEntry
} from './race-prediction';
import { SleepDailyStat, SleepDailySummary, SleepData } from './sleep';
import {
    TrainingLoadBalanceResponse,
    TrainingStatusData
} from './training-status';

export type SportsAbilityType = 'running' | 'cycling' | 'all';

export interface CoachDateRangeOptions {
    date?: Date | string;
    startDate?: Date | string;
    endDate?: Date | string;
    recentDays?: number;
}

export interface CurrentSportsAbilityOptions extends CoachDateRangeOptions {
    activityStatsDays?: number;
    trendDays?: number;
}

export interface WellnessSummaryOptions extends CoachDateRangeOptions {}

export interface WellnessOverviewOptions extends CoachDateRangeOptions {
    rangeDays?: number;
}

export interface TrainingOverviewOptions extends CoachDateRangeOptions {
    rangeDays?: number;
    trendDays?: number;
}

export interface CoachUserProfile {
    age?: number;
    birthDate?: string;
    gender?: string;
    height?: number;
    weight?: number;
    vo2Max?: number;
    vo2MaxCycling?: number | null;
    lactateThresholdHeartRate?: number;
    activityClass?: number;
    functionalThresholdPower?: number | null;
}

export interface CoachTrainingStatus {
    current: TrainingStatusData | null;
    loadBalance:
        | TrainingLoadBalanceResponse['metricsTrainingLoadBalanceDTOMap'][string]
        | null;
    weekly: TrainingStatusData[];
}

export interface CoachActivityStats {
    range: {
        startDate: string;
        endDate: string;
    };
    recent: ActivityStatsEntry[];
    latest: ActivityStatsEntry | null;
}

export interface RunningAbilitySummary {
    activityStats: CoachActivityStats;
    racePredictions: RacePredictionMonthlyReadable[];
    lactateThreshold: RunningLactateThreshold | null;
}

export interface CyclingAbilitySummary {
    activityStats: CoachActivityStats;
    latestPowerToWeight: PowerToWeightEntry[];
    powerToWeightTrend: BiometricStatRangeEntry[];
    cyclingAbility: CyclingAbility | null;
    powerCurve: PowerCurveResponse | null;
    maxMet: MaxMetResponse | null;
}

export interface CurrentSportsAbilitySummary {
    type: SportsAbilityType;
    generatedAt: string;
    user: CoachUserProfile;
    training: CoachTrainingStatus;
    running?: RunningAbilitySummary;
    cycling?: CyclingAbilitySummary;
    sourceErrors: Record<string, string>;
}

export interface WellnessTodaySummary {
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
}

export interface WellnessSummary {
    generatedAt: string;
    range: {
        startDate: string;
        endDate: string;
    };
    today: WellnessTodaySummary;
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

export type WellnessMetricAvailability = 'available' | 'partial' | 'no_data';

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
