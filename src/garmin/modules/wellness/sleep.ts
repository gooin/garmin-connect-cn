import { toDateString, calculateTimeDifference } from '../../common/DateUtils';
import { SleepData, SleepDailySummary } from '../../types/sleep';
import { ModuleConstructor } from '../types';

export function applySleepModule(Base: ModuleConstructor) {
    return class SleepModule extends Base {
        async getSleepData(date = new Date()): Promise<SleepData> {
            try {
                const dateString = toDateString(date);

                const sleepData = await this.client.get<SleepData>(
                    `${this.url.DAILY_SLEEP}`,
                    { params: { date: dateString } }
                );

                if (!sleepData) {
                    throw new Error('Invalid or empty sleep data response.');
                }

                return sleepData;
            } catch (error: any) {
                throw new Error(`Error in getSleepData: ${error.message}`);
            }
        }

        async getSleepDuration(
            date = new Date()
        ): Promise<{ hours: number; minutes: number }> {
            try {
                const sleepData = await this.getSleepData(date);

                if (
                    !sleepData ||
                    !sleepData.dailySleepDTO ||
                    sleepData.dailySleepDTO.sleepStartTimestampGMT ===
                        undefined ||
                    sleepData.dailySleepDTO.sleepEndTimestampGMT === undefined
                ) {
                    throw new Error(
                        'Invalid or missing sleep data for the specified date.'
                    );
                }

                const sleepStartTimestampGMT =
                    sleepData.dailySleepDTO.sleepStartTimestampGMT;
                const sleepEndTimestampGMT =
                    sleepData.dailySleepDTO.sleepEndTimestampGMT;

                const { hours, minutes } = calculateTimeDifference(
                    sleepStartTimestampGMT,
                    sleepEndTimestampGMT
                );

                return {
                    hours,
                    minutes
                };
            } catch (error: any) {
                throw new Error(`Error in getSleepDuration: ${error.message}`);
            }
        }

        async getSleepDailySummary(
            startDate: Date,
            endDate: Date
        ): Promise<SleepDailySummary> {
            try {
                const startStr = toDateString(startDate);
                const endStr = toDateString(endDate);
                const summary = await this.client.get<SleepDailySummary>(
                    `${this.url.SLEEP_DAILY_SUMMARY}/${startStr}/${endStr}`
                );
                return summary;
            } catch (error: any) {
                throw new Error(
                    `Error in getSleepDailySummary: ${error.message}`
                );
            }
        }
    };
}
