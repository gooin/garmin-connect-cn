import { toDateString, toGarminDateString } from '../../common/DateUtils';
import {
    HRVData,
    HRVDailySummary,
    HRVDailySummaryResponse
} from '../../types/hrv';
import { ModuleConstructor } from '../types';

export function applyHRVModule(Base: ModuleConstructor) {
    return class HRVModule extends Base {
        async getHRVData(date = new Date()): Promise<HRVData> {
            try {
                const dateStr = toDateString(date);
                const hrvData = await this.client.get<HRVData>(
                    `${this.url.HRV}/${dateStr}`
                );
                return hrvData;
            } catch (error: any) {
                throw new Error(`Error in getHRVData: ${error.message}`);
            }
        }

        async getHRVDailySummary(
            startDate: Date | string,
            endDate: Date | string
        ): Promise<HRVDailySummary[]> {
            try {
                const startStr = toGarminDateString(startDate);
                const endStr = toGarminDateString(endDate);
                const response = await this.client.get<
                    HRVDailySummary[] | HRVDailySummaryResponse
                >(`${this.url.HRV_DAILY_SUMMARY}/${startStr}/${endStr}`);
                return Array.isArray(response)
                    ? response
                    : response.hrvSummaries ?? [];
            } catch (error: any) {
                throw new Error(
                    `Error in getHRVDailySummary: ${error.message}`
                );
            }
        }
    };
}
