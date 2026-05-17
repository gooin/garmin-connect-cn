import { toDateString } from '../../common/DateUtils';
import { ModuleConstructor } from '../types';

export interface HeartRate {
    userProfilePK: number;
    calendarDate: string;
    maxHeartRate: number;
    minHeartRate: number;
    restingHeartRate: number;
    lastSevenDaysAvgRestingHeartRate: number;
}

export function applyHeartRateModule(Base: ModuleConstructor) {
    return class HeartRateModule extends Base {
        async getHeartRate(date = new Date()): Promise<HeartRate> {
            try {
                const dateString = toDateString(date);
                const heartRate = await this.client.get<HeartRate>(
                    `${this.url.DAILY_HEART_RATE}`,
                    { params: { date: dateString } }
                );

                return heartRate;
            } catch (error: any) {
                throw new Error(`Error in getHeartRate: ${error.message}`);
            }
        }
    };
}
