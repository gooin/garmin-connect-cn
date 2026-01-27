// Daily Training Status (Latest)
export interface AcuteTrainingLoadDTO {
    acwrPercent: number;
    acwrStatus: string; // e.g., "LOW", "OPTIMAL", "HIGH"
    acwrStatusFeedback: string;
    dailyTrainingLoadAcute: number;
    maxTrainingLoadChronic: number;
    minTrainingLoadChronic: number;
    dailyTrainingLoadChronic: number;
    dailyAcuteChronicWorkloadRatio: number;
}

export interface TrainingStatusData {
    calendarDate: string;
    sinceDate: string | null;
    weeklyTrainingLoad: number | null;
    trainingStatus: number;
    timestamp: number;
    deviceId: number;
    loadTunnelMin: number | null;
    loadTunnelMax: number | null;
    loadLevelTrend: string | null;
    sport: string; // e.g., "RUNNING"
    subSport: string; // e.g., "GENERIC"
    fitnessTrendSport: string;
    fitnessTrend: number;
    trainingStatusFeedbackPhrase: string; // e.g., "PRODUCTIVE_5"
    trainingPaused: boolean;
    acuteTrainingLoadDTO: AcuteTrainingLoadDTO;
    primaryTrainingDevice: boolean;
}

export interface LatestTrainingStatusResponse {
    userId: number;
    latestTrainingStatusData: Record<string, TrainingStatusData>; // deviceId as key
    recordedDevices: RecordedDevice[];
    showSelector: boolean;
    lastPrimarySyncDate: string;
}

export interface RecordedDevice {
    deviceId: number;
    imageURL: string;
    deviceName: string;
    category: number;
}

// Training Load Balance
export interface TrainingLoadBalanceDTO {
    calendarDate: string;
    deviceId: number;
    monthlyLoadAerobicLow: number;
    monthlyLoadAerobicHigh: number;
    monthlyLoadAnaerobic: number;
    monthlyLoadAerobicLowTargetMin: number;
    monthlyLoadAerobicLowTargetMax: number;
    monthlyLoadAerobicHighTargetMin: number;
    monthlyLoadAerobicHighTargetMax: number;
    monthlyLoadAnaerobicTargetMin: number;
    monthlyLoadAnaerobicTargetMax: number;
    trainingBalanceFeedbackPhrase: string; // e.g., "AEROBIC_HIGH_FOCUS"
    primaryTrainingDevice: boolean;
}

export interface TrainingLoadBalanceResponse {
    userId: number;
    metricsTrainingLoadBalanceDTOMap: Record<string, TrainingLoadBalanceDTO>; // deviceId as key
    recordedDevices: RecordedDevice[];
}

// Weekly Training Status
export interface WeeklyTrainingStatusResponse {
    userId: number;
    fromCalendarDate: string;
    toCalendarDate: string;
    showSelector: boolean;
    recordedDevices: RecordedDevice[];
    reportData: Record<string, TrainingStatusData[]>; // deviceId as key, array of daily data
}
