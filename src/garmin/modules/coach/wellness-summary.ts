import {
    capture,
    CoachApi,
    getRange,
    SourceErrors,
    WellnessSummary,
    WellnessSummaryOptions
} from './helpers';

export const buildWellnessSummary = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    options: WellnessSummaryOptions = {}
): Promise<WellnessSummary> => {
    await client.checkTokenVaild();

    const errors: SourceErrors = {};
    const range = getRange(options, 7);

    const [todayHrv, recentHrv, bodyBattery, todaySleep, sleepSummary] =
        await Promise.all([
            capture('todayHrv', errors, () => api.getHRVData(range.endDate)),
            capture('recentHrv', errors, () =>
                api.getHRVDailySummary(
                    range.startDateString,
                    range.endDateString
                )
            ),
            capture('bodyBattery', errors, () =>
                api.getBodyBattery(range.startDateString, range.endDateString)
            ),
            capture('todaySleep', errors, () =>
                api.getSleepData(range.endDate)
            ),
            capture('sleepSummary', errors, () =>
                api.getSleepDailySummary(range.startDate, range.endDate)
            )
        ]);

    return {
        generatedAt: new Date().toISOString(),
        range: {
            startDate: range.startDateString,
            endDate: range.endDateString
        },
        today: {
            date: range.endDateString,
            hrv: todayHrv?.hrvSummary ?? null,
            hrvReadingCount: todayHrv?.hrvReadings?.length ?? 0,
            sleep: todaySleep
                ? {
                      dailySleepDTO: todaySleep.dailySleepDTO ?? null,
                      avgOvernightHrv: todaySleep.avgOvernightHrv,
                      hrvStatus: todaySleep.hrvStatus,
                      bodyBatteryChange: todaySleep.bodyBatteryChange,
                      restingHeartRate: todaySleep.restingHeartRate
                  }
                : null
        },
        recent: {
            hrv: recentHrv ?? [],
            bodyBattery: bodyBattery ?? [],
            sleep: {
                overall: sleepSummary?.overallStats ?? null,
                daily: sleepSummary?.individualStats ?? []
            }
        },
        sourceErrors: errors
    };
};
