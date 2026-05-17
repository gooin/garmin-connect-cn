export type ActivityStatsType = 'running' | 'cycling' | string;

export interface ActivityStatsOptions {
    startDate: Date | string;
    endDate: Date | string;
    activityType?: ActivityStatsType;
    metrics?: string[];
}

export interface ActivityStatsMetricSummary {
    count: number;
    min: number | null;
    max: number | null;
    avg: number | null;
    sum: number;
}

export interface ActivityStatsEntry {
    date: string;
    countOfActivities: number;
    stats: {
        all: Record<string, ActivityStatsMetricSummary | Record<string, any>>;
    };
}
