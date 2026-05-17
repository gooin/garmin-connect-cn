import { toDateString } from '../../common/DateUtils';
import { HRVData } from '../../types/hrv';
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
    };
}
