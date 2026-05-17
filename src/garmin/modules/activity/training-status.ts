import { toDateString } from '../../common/DateUtils';
import {
    LatestTrainingStatusResponse,
    TrainingLoadBalanceResponse,
    WeeklyTrainingStatusResponse
} from '../../types/training-status';
import { ModuleConstructor } from '../types';

export function applyTrainingStatusModule(Base: ModuleConstructor) {
    return class TrainingStatusModule extends Base {
        async getTrainingStatus(
            date = new Date()
        ): Promise<LatestTrainingStatusResponse> {
            try {
                const dateStr = toDateString(date);
                const response =
                    await this.client.get<LatestTrainingStatusResponse>(
                        `${this.url.TRAINING_STATUS_DAILY}/${dateStr}`
                    );
                return response;
            } catch (error: any) {
                throw new Error(`Error in getTrainingStatus: ${error.message}`);
            }
        }

        async getTrainingLoadBalance(
            date = new Date()
        ): Promise<TrainingLoadBalanceResponse> {
            try {
                const dateStr = toDateString(date);
                const response =
                    await this.client.get<TrainingLoadBalanceResponse>(
                        `${this.url.TRAINING_LOAD_BALANCE}/${dateStr}`
                    );
                return response;
            } catch (error: any) {
                throw new Error(
                    `Error in getTrainingLoadBalance: ${error.message}`
                );
            }
        }

        async getWeeklyTrainingStatus(
            startDate: Date,
            endDate: Date
        ): Promise<WeeklyTrainingStatusResponse> {
            try {
                const profile = await this.getUserProfile();
                const displayName = profile.displayName;
                if (!displayName) {
                    throw new Error(
                        'Could not retrieve display name for weekly training status.'
                    );
                }

                const fromDateStr = toDateString(startDate);
                const toDateStr = toDateString(endDate);

                const response =
                    await this.client.get<WeeklyTrainingStatusResponse>(
                        `${this.url.TRAINING_STATUS_WEEKLY}/${displayName}`,
                        {
                            params: {
                                fromCalendarDate: fromDateStr,
                                toCalendarDate: toDateStr
                            }
                        }
                    );
                return response;
            } catch (error: any) {
                throw new Error(
                    `Error in getWeeklyTrainingStatus: ${error.message}`
                );
            }
        }
    };
}
