export interface RacePredictionMonthly {
    userId: number;
    fromCalendarDate: string;
    toCalendarDate: string;
    calendarDate: string;
    time5K: number;
    time10K: number;
    timeHalfMarathon: number;
    timeMarathon: number;
}

export interface RacePredictionMonthlyReadable extends RacePredictionMonthly {
    time5KFormatted: string;
    time10KFormatted: string;
    timeHalfMarathonFormatted: string;
    timeMarathonFormatted: string;
}

export interface BiometricStatRangeEntry {
    from: string;
    until: string;
    series: string;
    value: number;
    updatedDate: string;
}

export interface LatestLactateThresholdEntry {
    userProfilePK: number;
    version: number;
    calendarDate: string;
    sequence: number;
    speed: number | null;
    hearRate: number | null;
    heartRateCycling: number | null;
    rowSpeed: number | null;
    heartRateRowing: number | null;
}

export interface RunningLactateThresholdEntry {
    from: string;
    until: string;
    updatedDate?: string;
    speed?: number;
    speedMetersPerSecond?: number;
    paceSecondsPerKilometer?: number;
    paceMinutesPerKilometer?: string;
    heartRate?: number;
}

export interface RunningLactateThreshold {
    speed: BiometricStatRangeEntry[];
    heartRate: BiometricStatRangeEntry[];
    combined: RunningLactateThresholdEntry[];
    latest: LatestLactateThresholdEntry[];
}
