import {
    PersonalRecord,
    PersonalRecordSummary,
    PersonalRecordType,
    TrainingOverview,
    TrainingOverviewOptions
} from '../../types';
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

/** 合并 PR 类型定义和实际记录，输出精简摘要 */
const compactPersonalRecords = (
    types: PersonalRecordType[] | null,
    records: PersonalRecord[] | null
): PersonalRecordSummary[] | undefined => {
    if (!records?.length || !types?.length) return undefined;

    // 构建 typeId → { key, sport } 映射（prtypes 只用 id,key,sport）
    const typeMeta = new Map<number, { key: string; sport: string }>();
    for (const t of types) {
        typeMeta.set(t.id, { key: t.key, sport: t.sport.toLowerCase() });
    }

    // PR typeKey → 简短名称
    const TYPE_NAME: Record<string, string> = {
        'pr.label.1k.run': '1k',
        'pr.label.1mile.run': '1mile',
        'pr.label.5k.run': '5k',
        'pr.label.10k.run': '10k',
        'pr.label.half.marathon': 'halfMarathon',
        'pr.label.full.marathon': 'fullMarathon',
        'pr.label.farthest.run': 'farthestRun',
        'pr.label.farthest.cycle': 'farthestRide',
        'pr.label.max.elev': 'maxElevation',
        'pr.label.max.power': 'maxPower',
        'pr.label.40k.cycle': '40k',
        'pr.label.steps.best.day': 'bestDay',
        'pr.label.steps.best.week': 'bestWeek',
        'pr.label.steps.best.month': 'bestMonth',
        'pr.label.steps.longest.streak': 'longestStreak',
        'pr.label.steps.current.streak': 'currentStreak',
        'pr.label.longest.poolswim': 'longestSwim',
        'pr.label.100m.poolswim': '100mSwim',
        'pr.label.100yd.poolswim': '100ydSwim',
        'pr.label.400m.poolswim': '400mSwim',
        'pr.label.500yd.poolswim': '500ydSwim',
        'pr.label.750m.poolswim': '750mSwim',
        'pr.label.1000m.poolswim': '1000mSwim',
        'pr.label.1000yd.poolswim': '1000ydSwim',
        'pr.label.1500m.poolswim': '1500mSwim',
        'pr.label.1650yd.poolswim': '1650ydSwim',
        'pr.label.max.rep.weight.bench_press': 'benchPress',
        'pr.label.max.rep.weight.overhead_press': 'overheadPress',
        'pr.label.max.rep.weight.squat': 'squat',
        'pr.label.max.rep.weight.deadlift': 'deadlift',
        'pr.label.max.rep.weight.row': 'row',
        'pr.label.max.rep.weight.barbell_biceps_curl': 'barbellCurl',
        'pr.label.max.rep.weight.dumbbell_squat': 'dbSquat',
        'pr.label.max.rep.weight.dumbbell_row': 'dbRow',
        'pr.label.max.rep.weight.dumbbell_deadlift': 'dbDeadlift',
        'pr.label.max.rep.weight.dumbbell_biceps_curl': 'dbCurl',
        'pr.label.max.rep.weight.dumbbell_bench_press': 'dbBenchPress',
        'pr.label.max.rep.weight.overhead_dumbbell_press': 'dbOverheadPress'
    };

    // 时间格式化
    const formatTime = (sec: number): string => {
        if (sec < 3600) {
            const m = Math.floor(sec / 60);
            const s = Math.round(sec % 60);
            return `${m}:${s.toString().padStart(2, '0')}`;
        }
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = Math.round(sec % 60);
        return `${h}:${m.toString().padStart(2, '0')}:${s
            .toString()
            .padStart(2, '0')}`;
    };

    // 判断 value 是否代表时间（秒）
    const isTimeValue = (key: string): boolean => {
        const lower = key.toLowerCase();
        // 步数/连续天数/力量/功率/海拔/最远/最长 → 不是时间
        if (
            /(steps|streak|max\.rep\.weight|max\.power|max\.elev|farthest|longest)/.test(
                lower
            )
        ) {
            return false;
        }
        // 其余距离类 PR 的 value 都是秒
        return true;
    };

    const result: PersonalRecordSummary[] = [];
    for (const rec of records) {
        // 跳过无效记录
        if (rec.status !== 'ACCEPTED' || rec.value <= 0) continue;
        // activityType 为 null 的记录没有意义，跳过
        if (!rec.activityType) continue;

        const meta = typeMeta.get(rec.typeId);
        if (!meta) continue;

        const type = TYPE_NAME[meta.key] ?? meta.key;
        const date =
            rec.activityStartDateTimeLocalFormatted?.slice(0, 10) ?? null;
        // sport 直接从记录的 activityType 取（已过滤 null）
        const sport = rec.activityType;

        let value: string;
        let unit: string;

        if (isTimeValue(meta.key)) {
            value = formatTime(rec.value);
            unit = '';
        } else if (meta.key.includes('steps')) {
            value = String(Math.round(rec.value));
            unit = 'steps';
        } else if (meta.key.includes('streak')) {
            value = String(Math.round(rec.value));
            unit = 'days';
        } else if (meta.key.includes('max.rep.weight')) {
            value = String(round(rec.value, 1) ?? rec.value);
            unit = 'kg';
        } else if (meta.key.includes('max.power')) {
            value = String(Math.round(rec.value));
            unit = 'w';
        } else if (meta.key.includes('max.elev')) {
            value = String(round(rec.value, 1) ?? rec.value);
            unit = 'm';
        } else {
            // 距离类：farthest/longest，米→km（≥1000时）
            const km = rec.value / 1000;
            value = String(round(km >= 1 ? km : rec.value, 2) ?? rec.value);
            unit = km >= 1 ? 'km' : 'm';
        }

        result.push({ type, sport, value, unit, date });
    }
    return result.length > 0 ? result : undefined;
};

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
        cyclingMaxMet,
        personalRecordTypes,
        personalRecordsRaw
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
        ),
        capture('personalRecordTypes', errors, () =>
            api.getPersonalRecordTypes()
        ),
        capture('personalRecords', errors, () => api.getPersonalRecords())
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
    const personalRecords = compactPersonalRecords(
        personalRecordTypes ?? null,
        personalRecordsRaw ?? null
    );

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
            subjectiveFeedback: false,
            personalRecords:
                Array.isArray(personalRecords) && personalRecords.length > 0
        },
        aiHints: [] as string[]
    };

    if (personalRecords) {
        overview.personalRecords = personalRecords;
    }

    overview.aiHints = buildAiHints(overview);
    return overview;
};
