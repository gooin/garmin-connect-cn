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

export interface ActivitiesSummaryOptions {
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
    laps?: {
        /** 说明 laps 数组每个索引对应的字段名 */
        schema: string[];
        /** 按顺序的每圈真实数据 */
        data: Array<
            [
                string,
                number,
                number,
                string,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null,
                number | null
            ]
        >;
    };
    /** 课表计划（仅结构化训练有），与 laps 搭配对照计划vs实际 */
    workout?: {
        name: string | null;
        /** steps 各字段含义：intensity, durationType, durationValue, targetType, targetLow, targetHigh */
        schema: string[];
        /**
         * 按顺序的课表步骤（REPEAT 已展开）
         * durationType: time(秒)/distance(米)/hr/calories/lap_button/repeat_until_steps_cmplt
         * targetType: power(w)/heart_rate(bpm)/pace/ speed/cadence/null
         */
        steps: Array<
            [
                string,
                string,
                number,
                string | null,
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
    weather?: {
        tempC: number | null;
        apparentTempC: number | null;
        dewPointC: number | null;
        relativeHumidity: number | null;
        windDirection: number | null;
        windDirectionCompass: string | null;
        windSpeed: number | null;
        condition: string | null;
    };
    aiHints: string[];
}

/** 活动 lap 原始数据 */
export interface ActivityLap {
    startTimeGMT: string;
    distance: number;
    duration: number;
    movingDuration: number;
    elapsedDuration: number;
    elevationGain: number;
    averageSpeed: number;
    maxSpeed: number;
    calories: number;
    averageHR: number;
    maxHR: number;
    averageRunCadence: number;
    maxRunCadence: number;
    averageTemperature: number;
    groundContactTime: number;
    groundContactBalanceLeft: number;
    strideLength: number;
    verticalOscillation: number;
    verticalRatio: number;
    avgGradeAdjustedSpeed: number;
    lapIndex: number;
    wktStepIndex?: number;
    intensityType: string;
    messageIndex: number;
}

/** 活动课表步骤原始数据 */
export interface ActivityWorkoutStep {
    stepIndex: number;
    name: string | null;
    intensity: string | null;
    durationType: string;
    durationValue: number;
    targetType: string | null;
    targetValue: number | null;
    targetValueLow: number | null;
    targetValueHigh: number | null;
    notes: string | null;
}

/** 活动课表原始数据 */
export interface ActivityWorkout {
    index: number;
    workoutName: string;
    timeCreated: string;
    sport: string;
    manufacturer: string;
    steps: ActivityWorkoutStep[];
}

/** 活动天气原始数据（温度单位：华氏度） */
export interface ActivityWeather {
    issueDate: string;
    temp: number;
    apparentTemp: number;
    dewPoint: number;
    relativeHumidity: number;
    windDirection: number;
    windDirectionCompassPoint: string;
    windSpeed: number;
    windGust: number | null;
    latitude: number;
    longitude: number;
    weatherStationDTO: {
        id: string;
        name: string;
    };
    weatherTypeDTO: {
        weatherTypePk: number | null;
        desc: string;
        image: string | null;
    };
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
        personalRecords: boolean;
    };
    /** 个人记录，只包含已达成(maxValue>0)的项目 */
    personalRecords?: PersonalRecordSummary[];
    aiHints: string[];
}

/** Garmin PR 类型定义 API 原始响应项 */
export interface PersonalRecordType {
    id: number;
    key: string;
    visible: boolean;
    sport: string;
    minValue: number;
    maxValue: number;
}

/** Garmin PR 实际记录 API 原始响应项 */
export interface PersonalRecord {
    id: number;
    typeId: number;
    status: string;
    activityId: number;
    activityName: string | null;
    activityType: string | null;
    activityStartDateTimeInGMT: number | null;
    activityStartDateTimeLocalFormatted: string | null;
    value: number;
    prStartTimeGmtFormatted: string | null;
    prStartTimeLocalFormatted: string | null;
}

/** 精简的个人记录摘要（含格式化值和日期） */
export interface PersonalRecordSummary {
    type: string;
    sport: string;
    /** 格式化的值：时间类为 "mm:ss" 或 "h:mm:ss"，距离/步数等为数字 */
    value: string;
    unit: string;
    /** 达成日期 YYYY-MM-DD */
    date: string | null;
}
