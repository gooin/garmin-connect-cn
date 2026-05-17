import { toDateString } from '../../common/DateUtils';
import {
    convertMLToOunces,
    convertOuncesToML
} from '../../common/HydrationUtils';
import { HydrationData, WaterIntake } from '../../types/hydration';
import { ModuleConstructor } from '../types';

export function applyHydrationModule(Base: ModuleConstructor) {
    return class HydrationModule extends Base {
        async getDailyHydration(date = new Date()): Promise<number> {
            try {
                const dateString = toDateString(date);
                const hydrationData = await this.client.get<HydrationData>(
                    `${this.url.DAILY_HYDRATION}/${dateString}`
                );

                if (!hydrationData || !hydrationData.valueInML) {
                    throw new Error(
                        'Invalid or empty hydration data response.'
                    );
                }

                return convertMLToOunces(hydrationData.valueInML);
            } catch (error: any) {
                throw new Error(`Error in getDailyHydration: ${error.message}`);
            }
        }

        async updateHydrationLogOunces(
            date = new Date(),
            valueInOz: number
        ): Promise<WaterIntake> {
            try {
                const dateString = toDateString(date);
                const hydrationData = await this.client.put<WaterIntake>(
                    `${this.url.HYDRATION_LOG}`,
                    {
                        calendarDate: dateString,
                        valueInML: convertOuncesToML(valueInOz),
                        userProfileId: (await this.getUserProfile()).profileId,
                        timestampLocal: date.toISOString().substring(0, 23)
                    }
                );

                return hydrationData;
            } catch (error: any) {
                throw new Error(
                    `Error in updateHydrationLogOunces: ${error.message}`
                );
            }
        }
    };
}
