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
            capture('todayHrv', errors, async () => {
                const res = await api.getHRVData(range.endDate);
                return {
                    hrvSummary: res?.hrvSummary ?? null,
                    hrvReadingCount: res?.hrvReadings?.length ?? 0
                };
            }),
            capture('recentHrv', errors, () =>
                api.getHRVDailySummary(
                    range.startDateString,
                    range.endDateString
                )
            ),
            capture('bodyBattery', errors, () =>
                api.getBodyBattery(range.startDateString, range.endDateString)
            ),
            capture('todaySleep', errors, async () => {
                const res = await api.getSleepData(range.endDate);
                if (!res) return null;
                return {
                    dailySleepDTO: res.dailySleepDTO ?? null,
                    avgOvernightHrv: res.avgOvernightHrv,
                    hrvStatus: res.hrvStatus,
                    bodyBatteryChange: res.bodyBatteryChange,
                    restingHeartRate: res.restingHeartRate
                };
            }),
            capture('sleepSummary', errors, async () => {
                const res = await api.getSleepDailySummary(
                    range.startDate,
                    range.endDate
                );
                if (!res) return null;
                return {
                    overallStats: res.overallStats ?? null,
                    individualStats: res.individualStats ?? []
                };
            })
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
            hrvReadingCount: todayHrv?.hrvReadingCount ?? 0,
            sleep: todaySleep
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
