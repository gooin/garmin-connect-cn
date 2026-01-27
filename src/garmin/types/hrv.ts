export interface HRVBaseline {
    lowUpper: number;
    balancedLow: number;
    balancedUpper: number;
    markerValue: number;
}

export interface HRVSummary {
    calendarDate: string;
    weeklyAvg: number;
    lastNightAvg: number;
    lastNight5MinHigh: number;
    baseline: HRVBaseline;
    status: string;
    feedbackPhrase: string;
    createTimeStamp: string;
}

export interface HRVReading {
    hrvValue: number;
    readingTimeGMT: string;
    readingTimeLocal: string;
}

export interface HRVData {
    userProfilePk: number;
    hrvSummary: HRVSummary;
    hrvReadings: HRVReading[];
    startTimestampGMT: string;
    endTimestampGMT: string; // "2026-01-27T00:18:40.0"
    startTimestampLocal: string;
    endTimestampLocal: string;
    sleepStartTimestampGMT: string;
    sleepEndTimestampGMT: string;
    sleepStartTimestampLocal: string;
    sleepEndTimestampLocal: string;
}

export interface HRVDailySummary {
    calendarDate: string;
    weeklyAvg: number;
    lastNightAvg: number;
    lastNight5MinHigh: number;
    baseline: HRVBaseline;
    status: string;
    feedbackPhrase: string;
    createTimeStamp: string;
}
