// 骑行相关类型定义

// 当前FTP功率（功率体重比）
export interface PowerToWeightEntry {
    userProfilePk: number;
    calendarDate: string;
    origin: string;
    sport: string;
    functionalThresholdPower: number;
    weight: number;
    powerToWeight: number;
    ftpCreateTime: string;
    weightCreateTime: string;
    isStale: boolean;
}

// 骑行能力
export interface CyclingAbility {
    userProfilePk: number;
    deviceId: number;
    calendarDate: string;
    timestamp: string;
    primaryTrainingDevice: boolean;
    aerobicEndurance: number;
    aerobicCapacity: number;
    anaerobicCapacity: number;
    profileType: string;
    profileTypeFeedback: string;
    aerobicEnduranceFeedback: string;
    aerobicCapacityFeedback: string;
    anaerobicCapacityFeedback: string;
}

// 功率曲线条目
export interface PowerCurveEntry {
    duration: number;
    power: number;
    activityId: number;
    activityDate: string;
}

// 功率曲线响应
export interface PowerCurveResponse {
    startDate: string | null;
    endDate: string | null;
    entries: PowerCurveEntry[];
}

// 最大摄氧量 - 运动项
export interface MaxMetSportEntry {
    calendarDate: string;
    vo2MaxPreciseValue: number;
    vo2MaxValue: number;
    fitnessAge: number | null;
    fitnessAgeDescription: string | null;
    maxMetCategory: number;
}

// 热适应/高海拔适应
export interface HeatAltitudeAcclimation {
    calendarDate: string;
    altitudeAcclimationDate: string;
    previousAltitudeAcclimationDate: string;
    heatAcclimationDate: string;
    previousHeatAcclimationDate: string;
    altitudeAcclimation: number;
    previousAltitudeAcclimation: number;
    heatAcclimationPercentage: number;
    previousHeatAcclimationPercentage: number;
    heatTrend: string;
    altitudeTrend: string | null;
    currentAltitude: number;
    previousAltitude: number;
    acclimationPercentage: number;
    previousAcclimationPercentage: number;
    altitudeAcclimationLocalTimestamp: string;
}

// 最大摄氧量响应
export interface MaxMetResponse {
    userId: number;
    generic: MaxMetSportEntry | null;
    cycling: MaxMetSportEntry | null;
    heatAltitudeAcclimation: HeatAltitudeAcclimation;
}
