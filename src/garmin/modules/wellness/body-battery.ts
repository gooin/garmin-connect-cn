import { toGarminDateString } from '../../common/DateUtils';
import { BodyBatteryDailyEntry } from '../../types/body-battery';
import { ModuleConstructor } from '../types';

export function applyBodyBatteryModule(Base: ModuleConstructor) {
    return class BodyBatteryModule extends Base {
        async getBodyBattery(
            startDate: Date | string,
            endDate: Date | string
        ): Promise<BodyBatteryDailyEntry[]> {
            try {
                const startStr = toGarminDateString(startDate);
                const endStr = toGarminDateString(endDate);
                const response = await this.client.get<BodyBatteryDailyEntry[]>(
                    `${this.url.BODY_BATTERY_DAILY}/${startStr}/${endStr}`
                );
                return response;
            } catch (error: any) {
                throw new Error(`Error in getBodyBattery: ${error.message}`);
            }
        }
    };
}
