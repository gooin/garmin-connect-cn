export interface HydrationData {
    userId: number;
    calendarDate: string;
    lastEntryTimestampLocal: string;
    valueInML: number;
    goalInML: number;
    baseGoalInML: number;
    sweatLossInML: number;
    activityIntakeInML: number;
    hydrationMeasurementUnit: string;
    hydrationContainers: HydrationContainer[];
    hydrationAutoGoalEnabled: boolean;
}

export interface HydrationContainer {
    name: string | null;
    volume: number;
    unit: string;
}

// hydration/log
export interface WaterIntake {
    userId: number;
    calendarDate: string;
    valueInML: number;
    goalInML: number;
    dailyAverageinML: number | null;
    lastEntryTimestampLocal: string;
    sweatLossInML: number | null;
    activityIntakeInML: number;
}
