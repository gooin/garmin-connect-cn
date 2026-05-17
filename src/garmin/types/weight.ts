// weight-service/weight/dayview/2023-12-28

export interface DateWeight {
    samplePk: number;
    date: number;
    calendarDate: string;
    weight: number;
    bmi: number | null;
    bodyFat: number | null;
    bodyWater: number | null;
    boneMass: number | null;
    muscleMass: number | null;
    physiqueRating: number | null;
    visceralFat: number | null;
    metabolicAge: number | null;
    sourceType: string;
    timestampGMT: number;
    weightDelta: number;
}

export interface TotalAverage {
    from: number;
    until: number;
    weight: number;
    bmi: number | null;
    bodyFat: number | null;
    bodyWater: number | null;
    boneMass: number | null;
    muscleMass: number | null;
    physiqueRating: number | null;
    visceralFat: number | null;
    metabolicAge: number | null;
}

export interface WeightData {
    startDate: string;
    endDate: string;
    dateWeightList: DateWeight[];
    totalAverage: TotalAverage;
}

export interface WeightRangeDailySummary {
    summaryDate: string;
    numOfWeightEntries: number;
    minWeight: number;
    maxWeight: number;
    latestWeight: DateWeight;
    allWeightMetrics: DateWeight[];
}

export interface WeightRangeData {
    dailyWeightSummaries: WeightRangeDailySummary[];
}

export interface UpdateWeight {
    dateTimestamp: string; // Format: "2023-12-31T12:39:00.00"
    gmtTimestamp: string; // Format: "2023-12-31T20:39:00.00"
    unitKey: string; // Example: "lbs"
    value: number; // Example: 202.9
}

export interface UploadMessage {
    code: number;
    content: string;
}

export interface UploadSuccess {
    internalId: number | null;
    externalId: string | null;
    messages: UploadMessage[];
}

export interface UploadFailure {
    internalId?: number | null;
    externalId?: string | null;
    messages?: UploadMessage[];
}

export interface FitbitCsvUploadResponse {
    detailedImportResult: {
        uploadId: number;
        uploadUuid: {
            uuid: string;
        } | null;
        owner: number;
        fileSize: number | string;
        processingTime: number | string;
        creationDate: string;
        ipAddress: string | null;
        fileName: string | null;
        report: unknown;
        successes: UploadSuccess[];
        failures: UploadFailure[];
    };
}
