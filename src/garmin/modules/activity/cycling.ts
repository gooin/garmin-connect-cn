import { toGarminDateString } from '../../common/DateUtils';
import {
    CyclingAbility,
    MaxMetResponse,
    PowerCurveResponse,
    PowerToWeightEntry
} from '../../types/cycling';
import { BiometricStatRangeEntry } from '../../types/race-prediction';
import { ModuleConstructor } from '../types';

export function applyCyclingModule(Base: ModuleConstructor) {
    return class CyclingModule extends Base {
        async getLatestPowerToWeight(
            date: Date | string = new Date()
        ): Promise<PowerToWeightEntry[]> {
            try {
                const dateStr = toGarminDateString(date);
                const response = await this.client.get<PowerToWeightEntry[]>(
                    this.url.LATEST_POWER_TO_WEIGHT(dateStr)
                );
                return response;
            } catch (error: any) {
                throw new Error(
                    `Error in getLatestPowerToWeight: ${error.message}`
                );
            }
        }

        async getPowerToWeightRange(
            startDate: Date | string,
            endDate: Date | string,
            aggregation: 'weekly' | 'monthly' = 'weekly',
            sport: 'cycling' | 'running' = 'cycling'
        ): Promise<BiometricStatRangeEntry[]> {
            try {
                return this.client.get<BiometricStatRangeEntry[]>(
                    this.url.BIOMETRIC_STAT_RANGE(
                        'powerToWeight',
                        toGarminDateString(startDate),
                        toGarminDateString(endDate)
                    ),
                    { params: { aggregation, sport } }
                );
            } catch (error: any) {
                throw new Error(
                    `Error in getPowerToWeightRange: ${error.message}`
                );
            }
        }

        async getCyclingAbility(): Promise<CyclingAbility | null> {
            try {
                const response = await this.client.get<CyclingAbility>(
                    this.url.CYCLING_ABILITY
                );
                if (!response || typeof response !== 'object') {
                    return null;
                }
                return response;
            } catch (error: any) {
                throw new Error(`Error in getCyclingAbility: ${error.message}`);
            }
        }

        async getPowerCurve(
            sport: 'cycling' | 'running' = 'cycling',
            startDate?: Date | string,
            endDate?: Date | string
        ): Promise<PowerCurveResponse> {
            try {
                const params: Record<string, string> = { sport };
                if (startDate) {
                    params.startDate = toGarminDateString(startDate);
                }
                if (endDate) {
                    params.endDate = toGarminDateString(endDate);
                }
                const response = await this.client.get<PowerCurveResponse>(
                    this.url.POWER_CURVE,
                    { params }
                );
                return response;
            } catch (error: any) {
                throw new Error(`Error in getPowerCurve: ${error.message}`);
            }
        }

        async getMaxMet(
            date: Date | string = new Date(),
            sport?: 'cycling' | 'running'
        ): Promise<MaxMetResponse | null> {
            try {
                const dateStr = toGarminDateString(date);
                const params: Record<string, string> = {};
                if (sport) {
                    params.sport = sport;
                }
                const response = await this.client.get<MaxMetResponse>(
                    this.url.MAX_MET_LATEST(dateStr),
                    { params }
                );
                return response;
            } catch (error: any) {
                if (error.message?.includes('404')) {
                    return null;
                }
                throw new Error(`Error in getMaxMet: ${error.message}`);
            }
        }
    };
}
