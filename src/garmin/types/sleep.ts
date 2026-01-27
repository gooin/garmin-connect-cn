export interface SleepDTO {
    id: number;
    userProfilePK: number;
    calendarDate: string;
    sleepTimeSeconds: number;
    napTimeSeconds: number;
    sleepWindowConfirmed: boolean;
    sleepWindowConfirmationType: string;
    sleepStartTimestampGMT: number;
    sleepEndTimestampGMT: number;
    sleepStartTimestampLocal: number;
    sleepEndTimestampLocal: number;
    autoSleepStartTimestampGMT: number | null;
    autoSleepEndTimestampGMT: number | null;
    sleepQualityTypePK: number | null;
    sleepResultTypePK: number | null;
    unmeasurableSleepSeconds: number;
    deepSleepSeconds: number;
    lightSleepSeconds: number;
    remSleepSeconds: number;
    awakeSleepSeconds: number;
    deviceRemCapable: boolean;
    retro: boolean;
    sleepFromDevice: boolean;
    averageRespirationValue: number;
    lowestRespirationValue: number;
    highestRespirationValue: number;
    awakeCount: number;
    avgSleepStress: number;
    ageGroup: string;
    sleepScoreFeedback: string;
    sleepScoreInsight: string;
    sleepScores: {
        totalDuration: {
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
        };
        stress: {
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
        };
        awakeCount: {
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
        };
        overall: {
            value: number;
            qualifierKey: string;
        };
        remPercentage: {
            value: number;
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
            idealStartInSeconds: number;
            idealEndInSeconds: number;
        };
        restlessness: {
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
        };
        lightPercentage: {
            value: number;
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
            idealStartInSeconds: number;
            idealEndInSeconds: number;
        };
        deepPercentage: {
            value: number;
            qualifierKey: string;
            optimalStart: number;
            optimalEnd: number;
            idealStartInSeconds: number;
            idealEndInSeconds: number;
        };
    };
    sleepVersion: number;
}

export interface SleepMovement {
    startGMT: string;
    endGMT: string;
    activityLevel: number;
}

export interface SleepLevels {
    startGMT: string;
    endGMT: string;
    activityLevel: number;
}

export interface WellnessEpochRespirationDataDTO {
    startTimeGMT: number;
    respirationValue: number;
}

export interface SleepHeartRate {
    value: number;
    startGMT: number;
}

export interface SleepBodyBattery {
    value: number;
    startGMT: number;
}

export interface SleepData {
    dailySleepDTO: SleepDTO;
    sleepMovement: SleepMovement[];
    remSleepData: boolean;
    sleepLevels: SleepLevels[];
    restlessMomentsCount: number;
    wellnessEpochRespirationDataDTOList: WellnessEpochRespirationDataDTO[];
    sleepHeartRate: SleepHeartRate[];
    sleepBodyBattery: SleepBodyBattery[];
    avgOvernightHrv: number;
    hrvStatus: string;
    bodyBatteryChange: number;
    restingHeartRate: number;
}

export interface SleepOverallStats {
    averageSpO2: number | null;
    meanAvgHeartRate: number | null;
    averageLocalSleepStartTime: number;
    averageRespiration: number;
    averageBodyBatteryChange: number;
    averageSkinTempF: number | null;
    averageSleepScore: number;
    averageLocalSleepEndTime: number;
    averageSkinTempC: number | null;
    averageSleepSeconds: number;
    averageSleepNeed: number;
    averageRestingHeartRate: number;
}

export interface SleepDailyValues {
    remTime: number;
    restingHeartRate: number;
    totalSleepTimeInSeconds: number;
    respiration: number;
    localSleepEndTimeInMillis: number;
    deepTime: number;
    awakeTime: number;
    sleepScoreQuality: string; // e.g., "GOOD", "EXCELLENT"
    spO2: number | null;
    localSleepStartTimeInMillis: number;
    sleepNeed: number;
    bodyBatteryChange: number;
    gmtSleepStartTimeInMillis: number;
    gmtSleepEndTimeInMillis: number;
    hrvStatus: string; // e.g., "BALANCED", "UNBALANCED"
    skinTempF: number | null;
    sleepScore: number;
    skinTempC: number | null;
    lightTime: number;
    avgOvernightHrv: number | null;
    avgHeartRate: number | null;
    hrv7dAverage: number | null;
}

export interface SleepDailyStat {
    calendarDate: string;
    values: SleepDailyValues;
}

export interface SleepDailySummary {
    overallStats: SleepOverallStats;
    individualStats: SleepDailyStat[];
}
