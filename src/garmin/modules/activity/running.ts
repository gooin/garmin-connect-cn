import { toGarminDateString } from '../../common/DateUtils';
import {
    BiometricStatRangeEntry,
    LatestLactateThresholdEntry,
    RacePredictionMonthly,
    RacePredictionMonthlyReadable,
    RunningLactateThreshold,
    RunningLactateThresholdEntry
} from '../../types/race-prediction';
import { ModuleConstructor } from '../types';

const lactateThresholdSpeedToPace = (speed: number) => {
    const speedMetersPerSecond = speed * 10;
    const paceSecondsPerKilometer = 1000 / speedMetersPerSecond;
    const minutes = Math.floor(paceSecondsPerKilometer / 60);
    const seconds = Math.round(paceSecondsPerKilometer % 60);
    const normalizedMinutes = seconds === 60 ? minutes + 1 : minutes;
    const normalizedSeconds = seconds === 60 ? 0 : seconds;

    return {
        speedMetersPerSecond,
        paceSecondsPerKilometer,
        paceMinutesPerKilometer: `${normalizedMinutes}:${normalizedSeconds
            .toString()
            .padStart(2, '0')}/km`
    };
};

const formatSecondsAsTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds]
        .map((value) => value.toString().padStart(2, '0'))
        .join(':');
};

const formatRacePrediction = (
    prediction: RacePredictionMonthly
): RacePredictionMonthlyReadable => ({
    ...prediction,
    time5KFormatted: formatSecondsAsTime(prediction.time5K),
    time10KFormatted: formatSecondsAsTime(prediction.time10K),
    timeHalfMarathonFormatted: formatSecondsAsTime(prediction.timeHalfMarathon),
    timeMarathonFormatted: formatSecondsAsTime(prediction.timeMarathon)
});

export function applyRunningModule(Base: ModuleConstructor) {
    return class RunningModule extends Base {
        async getRacePredictionsMonthly(
            fromCalendarDate: Date | string,
            toCalendarDate: Date | string
        ): Promise<RacePredictionMonthlyReadable[]> {
            try {
                const profile = await this.getUserProfile();
                const displayName = profile.displayName;
                if (!displayName) {
                    throw new Error(
                        'Could not retrieve display name for race predictions.'
                    );
                }

                const response = await this.client.get<RacePredictionMonthly[]>(
                    this.url.RACE_PREDICTIONS_MONTHLY(displayName),
                    {
                        params: {
                            fromCalendarDate:
                                toGarminDateString(fromCalendarDate),
                            toCalendarDate: toGarminDateString(toCalendarDate)
                        }
                    }
                );
                return response.map(formatRacePrediction);
            } catch (error: any) {
                throw new Error(
                    `Error in getRacePredictionsMonthly: ${error.message}`
                );
            }
        }

        async getLactateThresholdSpeedRange(
            startDate: Date | string,
            endDate: Date | string
        ): Promise<BiometricStatRangeEntry[]> {
            try {
                return this.client.get<BiometricStatRangeEntry[]>(
                    this.url.BIOMETRIC_STAT_RANGE(
                        'lactateThresholdSpeed',
                        toGarminDateString(startDate),
                        toGarminDateString(endDate)
                    ),
                    {
                        params: {
                            aggregation: 'monthly',
                            aggregationStrategy: 'LATEST',
                            sport: 'RUNNING'
                        }
                    }
                );
            } catch (error: any) {
                throw new Error(
                    `Error in getLactateThresholdSpeedRange: ${error.message}`
                );
            }
        }

        async getLactateThresholdHeartRateRange(
            startDate: Date | string,
            endDate: Date | string
        ): Promise<BiometricStatRangeEntry[]> {
            try {
                return this.client.get<BiometricStatRangeEntry[]>(
                    this.url.BIOMETRIC_STAT_RANGE(
                        'lactateThresholdHeartRate',
                        toGarminDateString(startDate),
                        toGarminDateString(endDate)
                    ),
                    {
                        params: {
                            aggregation: 'monthly',
                            aggregationStrategy: 'LATEST',
                            sport: 'RUNNING'
                        }
                    }
                );
            } catch (error: any) {
                throw new Error(
                    `Error in getLactateThresholdHeartRateRange: ${error.message}`
                );
            }
        }

        async getLatestLactateThreshold(): Promise<
            LatestLactateThresholdEntry[]
        > {
            try {
                return this.client.get<LatestLactateThresholdEntry[]>(
                    this.url.LATEST_LACTATE_THRESHOLD
                );
            } catch (error: any) {
                throw new Error(
                    `Error in getLatestLactateThreshold: ${error.message}`
                );
            }
        }

        async getRunningLactateThreshold(
            startDate: Date | string,
            endDate: Date | string
        ): Promise<RunningLactateThreshold> {
            const [speed, heartRate, latest] = await Promise.all([
                this.getLactateThresholdSpeedRange(startDate, endDate),
                this.getLactateThresholdHeartRateRange(startDate, endDate),
                this.getLatestLactateThreshold()
            ]);
            const combinedByMonth = new Map<
                string,
                RunningLactateThresholdEntry
            >();

            for (const entry of speed) {
                const pace = lactateThresholdSpeedToPace(entry.value);
                combinedByMonth.set(entry.from, {
                    from: entry.from,
                    until: entry.until,
                    updatedDate: entry.updatedDate,
                    speed: entry.value,
                    ...pace
                });
            }

            for (const entry of heartRate) {
                const item = combinedByMonth.get(entry.from) ?? {
                    from: entry.from,
                    until: entry.until
                };
                combinedByMonth.set(entry.from, {
                    ...item,
                    updatedDate: item.updatedDate ?? entry.updatedDate,
                    heartRate: entry.value
                });
            }

            return {
                speed,
                heartRate,
                combined: Array.from(combinedByMonth.values()).sort((a, b) =>
                    a.from.localeCompare(b.from)
                ),
                latest
            };
        }
    };
}
