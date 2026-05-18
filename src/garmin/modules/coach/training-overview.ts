import { TrainingOverview, TrainingOverviewOptions } from '../../types';
import {
    buildAiHints,
    buildTrendLoad,
    buildYearStats,
    capture,
    CoachApi,
    compactRaceTime,
    compactTrainingStatuses,
    countStatusDays,
    extractCurrentTrainingStatus,
    extractLoadBalance,
    extractUser,
    findPowerToWeight,
    getRange,
    hasSportStats,
    latestActivityStats,
    loadBalanceTuple,
    lowerSnake,
    metricValue,
    normalizeGender,
    normalizeSport,
    normalizeStatus,
    normalizeTrend,
    round,
    SourceErrors,
    thresholdPaceFromSpeed
} from './helpers';

export const buildTrainingOverview = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    options: TrainingOverviewOptions = {}
): Promise<TrainingOverview> => {
    await client.checkTokenVaild();

    const errors: SourceErrors = {};
    const rangeDays = options.rangeDays ?? options.recentDays ?? 365;
    const trendDays = options.trendDays ?? 90;
    const activityRange = getRange({ ...options, recentDays: rangeDays }, 365);
    const trendRange = getRange({ ...options, recentDays: trendDays }, 90);
    const snapshotDate = activityRange.endDateString;

    const [
        personalInfo,
        trainingStatus,
        loadBalanceResponse,
        weeklyTrainingStatus,
        runningActivityStats,
        cyclingActivityStats,
        racePredictions,
        lactateThreshold,
        latestPowerToWeight,
        cyclingAbility,
        cyclingMaxMet
    ] = await Promise.all([
        capture('personalInfo', errors, () => api.getPersonalInfo()),
        capture('trainingStatus', errors, () =>
            api.getTrainingStatus(activityRange.endDate)
        ),
        capture('trainingLoadBalance', errors, () =>
            api.getTrainingLoadBalance(activityRange.endDate)
        ),
        capture('weeklyTrainingStatus', errors, () =>
            api.getWeeklyTrainingStatus(
                trendRange.startDate,
                trendRange.endDate
            )
        ),
        capture('runningActivityStats', errors, () =>
            api.getActivityStats({
                startDate: activityRange.startDateString,
                endDate: activityRange.endDateString,
                activityType: 'running'
            })
        ),
        capture('cyclingActivityStats', errors, () =>
            api.getActivityStats({
                startDate: activityRange.startDateString,
                endDate: activityRange.endDateString,
                activityType: 'cycling'
            })
        ),
        capture('racePredictions', errors, () =>
            api.getRacePredictionsMonthly(
                trendRange.startDateString,
                trendRange.endDateString
            )
        ),
        capture('lactateThreshold', errors, () =>
            api.getRunningLactateThreshold(
                trendRange.startDateString,
                trendRange.endDateString
            )
        ),
        capture('latestPowerToWeight', errors, () =>
            api.getLatestPowerToWeight(activityRange.endDateString)
        ),
        capture('cyclingAbility', errors, () => api.getCyclingAbility()),
        capture('cyclingMaxMet', errors, () =>
            api.getMaxMet(activityRange.endDateString, 'cycling')
        )
    ]);

    const user = extractUser(personalInfo);
    const current = extractCurrentTrainingStatus(trainingStatus);
    const loadBalance = extractLoadBalance(loadBalanceResponse);
    const weekly = compactTrainingStatuses(weeklyTrainingStatus);
    const runningStats = latestActivityStats(runningActivityStats ?? []);
    const cyclingStats = latestActivityStats(cyclingActivityStats ?? []);
    const runningAvailable = hasSportStats(runningStats);
    const cyclingAvailable = hasSportStats(cyclingStats);
    const observedSports = [
        ...(runningAvailable ? ['running'] : []),
        ...(cyclingAvailable ? ['cycling'] : [])
    ];
    const runningYear = buildYearStats(runningStats);
    const cyclingYear = buildYearStats(cyclingStats);
    const totalDuration =
        (runningYear.durationH ?? 0) + (cyclingYear.durationH ?? 0);
    const durationShare =
        totalDuration > 0
            ? {
                  running: round(
                      (runningYear.durationH ?? 0) / totalDuration,
                      2
                  )!,
                  cycling: round(
                      (cyclingYear.durationH ?? 0) / totalDuration,
                      2
                  )!
              }
            : { running: 0, cycling: 0 };
    const dominantByDuration =
        totalDuration > 0
            ? durationShare.running >= durationShare.cycling
                ? 'running'
                : 'cycling'
            : null;
    const latestRacePrediction =
        racePredictions
            ?.slice()
            .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))
            .pop() ?? null;
    const latestThresholdByDate = lactateThreshold?.latest
        ?.slice()
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate));
    const latestSpeedThreshold =
        latestThresholdByDate
            ?.slice()
            .reverse()
            .find((entry) => entry.speed !== null) ?? null;
    const latestHrThreshold =
        latestThresholdByDate
            ?.slice()
            .reverse()
            .find(
                (entry) =>
                    (entry as any).hearRate !== null ||
                    (entry as any).heartRate !== null
            ) ?? null;
    const cyclingPower = findPowerToWeight(latestPowerToWeight, 'CYCLING');
    const runningPower = findPowerToWeight(latestPowerToWeight, 'RUNNING');
    const acute = current?.acuteTrainingLoadDTO as any;
    const acuteLoad =
        acute?.dailyTrainingLoadAcute ?? current?.weeklyTrainingLoad ?? null;
    const chronicLoad =
        acute?.dailyTrainingLoadChronic ?? current?.loadTunnelMax ?? null;
    const acwr =
        acute?.dailyAcuteChronicWorkloadRatio ??
        (acuteLoad !== null && chronicLoad ? acuteLoad / chronicLoad : null);

    const overview: TrainingOverview = {
        schema: 'training_overview_v1',
        snapshotDate,
        rangeDays,
        source: {
            provider: 'garmin',
            endpointType: 'training_overview',
            includedSports: ['running', 'cycling'],
            excludedSports: [
                {
                    sport: 'swimming',
                    reason: 'not_provided_by_source_endpoint'
                }
            ]
        },
        athlete: {
            age: user.age ?? null,
            gender: normalizeGender(user.gender),
            heightCm: user.height ?? null,
            weightKg:
                user.weight && user.weight > 500
                    ? round(user.weight / 1000, 1)
                    : round(user.weight, 1),
            type:
                runningAvailable && cyclingAvailable
                    ? 'triathlon'
                    : observedSports[0] ?? null,
            observedSports
        },
        state: {
            status: normalizeStatus(
                current?.trainingStatus,
                current?.trainingStatusFeedbackPhrase
            ),
            trend: normalizeTrend(current?.fitnessTrend),
            statusSport: normalizeSport(current?.sport),
            fitnessTrendSport: normalizeSport(current?.fitnessTrendSport),
            acuteLoad: round(acuteLoad),
            chronicLoad: round(chronicLoad),
            acwr: round(acwr, 1),
            acwrStatus: lowerSnake(acute?.acwrStatus)
        },
        loadBalance: {
            lowAerobic: loadBalanceTuple(
                loadBalance?.monthlyLoadAerobicLow,
                loadBalance?.monthlyLoadAerobicLowTargetMin,
                loadBalance?.monthlyLoadAerobicLowTargetMax
            ),
            highAerobic: loadBalanceTuple(
                loadBalance?.monthlyLoadAerobicHigh,
                loadBalance?.monthlyLoadAerobicHighTargetMin,
                loadBalance?.monthlyLoadAerobicHighTargetMax
            ),
            anaerobic: loadBalanceTuple(
                loadBalance?.monthlyLoadAnaerobic,
                loadBalance?.monthlyLoadAnaerobicTargetMin,
                loadBalance?.monthlyLoadAnaerobicTargetMax
            ),
            feedback: lowerSnake(loadBalance?.trainingBalanceFeedbackPhrase)
        },
        sports: {
            running: {
                available: runningAvailable,
                vo2Max: user.vo2Max ?? null,
                threshold: {
                    pace: thresholdPaceFromSpeed(latestSpeedThreshold?.speed),
                    hr:
                        (latestHrThreshold as any)?.hearRate ??
                        (latestHrThreshold as any)?.heartRate ??
                        user.lactateThresholdHeartRate ??
                        null
                },
                power: {
                    ftp:
                        runningPower?.functionalThresholdPower ??
                        user.functionalThresholdPower ??
                        null,
                    wkg: round(runningPower?.powerToWeight, 2),
                    stale: runningPower?.isStale ?? null
                },
                year: runningYear,
                form: {
                    cadence: round(
                        metricValue(runningStats, 'avgRunCadence', 'avg')
                    ),
                    strideCm: round(
                        metricValue(runningStats, 'avgStrideLength', 'avg')
                    ),
                    gctMs: round(
                        metricValue(runningStats, 'avgGroundContactTime', 'avg')
                    ),
                    voCm: round(
                        metricValue(
                            runningStats,
                            'avgVerticalOscillation',
                            'avg'
                        ),
                        1
                    )
                },
                prediction: {
                    '5k': compactRaceTime(
                        latestRacePrediction?.time5KFormatted
                    ),
                    '10k': compactRaceTime(
                        latestRacePrediction?.time10KFormatted
                    ),
                    hm: compactRaceTime(
                        latestRacePrediction?.timeHalfMarathonFormatted
                    ),
                    fm: compactRaceTime(
                        latestRacePrediction?.timeMarathonFormatted
                    )
                }
            },
            cycling: {
                available: cyclingAvailable,
                vo2Max:
                    cyclingMaxMet?.cycling?.vo2MaxValue ??
                    user.vo2MaxCycling ??
                    null,
                power: {
                    ftp:
                        cyclingPower?.functionalThresholdPower ??
                        user.functionalThresholdPower ??
                        null,
                    wkg: round(cyclingPower?.powerToWeight, 2),
                    stale: cyclingPower?.isStale ?? null
                },
                year: cyclingYear,
                form: {
                    avgPower: round(
                        metricValue(cyclingStats, 'avgPower', 'avg')
                    ),
                    cadence: round(
                        metricValue(cyclingStats, 'avgBikeCadence', 'avg')
                    )
                },
                ability: {
                    type: lowerSnake(cyclingAbility?.profileType),
                    aerobicEndurance: cyclingAbility?.aerobicEndurance ?? null,
                    aerobicCapacity: cyclingAbility?.aerobicCapacity ?? null,
                    anaerobicCapacity: cyclingAbility?.anaerobicCapacity ?? null
                }
            }
        },
        multiSport: {
            isMultiSport: observedSports.length > 1,
            observedSports,
            durationShare,
            dominantByDuration,
            note: 'swimming_not_available_in_this_overview_source'
        },
        trend90d: {
            statusDays: countStatusDays(weekly),
            load: buildTrendLoad(weekly)
        },
        dataCompleteness: {
            profile: personalInfo !== null,
            trainingStatus: current !== null,
            loadBalance: loadBalance !== null,
            runningStats: runningAvailable,
            cyclingStats: cyclingAvailable,
            swimmingStats: 'not_supported_by_source',
            recovery: false,
            recentActivities: false,
            subjectiveFeedback: false
        },
        aiHints: []
    };

    overview.aiHints = buildAiHints(overview);
    return overview;
};
