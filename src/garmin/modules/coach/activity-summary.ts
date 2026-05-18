import {
    ActivitiesSummary,
    ActivitiesSummaryOptions,
    ActivityDetailSummary,
    ActivityDetailSummaryOptions,
    ActivitySubType,
    ActivityType,
    CompactActivity,
    CompactTrainingEffect,
    IActivity
} from '../../types';
import {
    CoachApi,
    compactLower,
    getRange,
    lowerSnake,
    round,
    toMinutes
} from './helpers';

type LooseRecord = Record<string, any>;

const numeric = (value: unknown): number | null =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;

const roundNumber = (value: unknown, digits = 0): number | null =>
    round(numeric(value), digits);

const compactDate = (value: string | null | undefined): string | null =>
    value ? value.slice(0, 10) : null;

const compactTime = (value: string | null | undefined): string | null => {
    if (!value) return null;
    const timePart = value.includes('T')
        ? value.split('T')[1]
        : value.split(' ')[1];
    return timePart ? timePart.slice(0, 5) : null;
};

const formatPace = (paceSeconds: number | null): string | null => {
    if (!paceSeconds || !Number.isFinite(paceSeconds)) return null;
    const totalSeconds = Math.round(paceSeconds);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
};

const paceFromDistance = (
    distanceM: unknown,
    durationSec: unknown
): string | null => {
    const distance = numeric(distanceM);
    const duration = numeric(durationSec);
    if (!distance || !duration || distance <= 0) return null;
    return formatPace(duration / (distance / 1000));
};

const paceFromSpeed = (speedMps: unknown): string | null => {
    const speed = numeric(speedMps);
    if (!speed || speed <= 0) return null;
    return formatPace(1000 / speed);
};

const normalizeMessage = (value: string | null | undefined): string | null => {
    const normalized = lowerSnake(value);
    return normalized?.replace(/_\d+$/, '') ?? null;
};

const trainingLabel = (value: unknown): string =>
    compactLower(typeof value === 'string' ? value : undefined) ?? 'unknown';

const buildTrainingEffect = (source: LooseRecord): CompactTrainingEffect => ({
    aerobic: roundNumber(
        source.aerobicTrainingEffect ?? source.trainingEffect,
        1
    ),
    anaerobic: roundNumber(source.anaerobicTrainingEffect, 1),
    label: trainingLabel(source.trainingEffectLabel)
});

const hrZones = (source: LooseRecord): number[] => {
    const zones = [1, 2, 3, 4, 5].map((zone) =>
        roundNumber(source[`hrTimeInZone_${zone}`], 1)
    );
    return zones.some((value) => value !== null)
        ? zones.map((value) => value ?? 0)
        : [];
};

const sportKey = (activity: LooseRecord): string | null =>
    activity.activityType?.typeKey ?? activity.activityTypeDTO?.typeKey ?? null;

const primarySport = (activity: LooseRecord): string | null => {
    const sport = sportKey(activity);
    if (!sport) return null;
    if (sport.includes('running')) return 'running';
    if (sport.includes('cycling') || sport.includes('biking')) return 'cycling';
    return sport;
};

const workoutId = (activity: LooseRecord): number | null =>
    roundNumber(
        activity.workoutId ??
            activity.metadataDTO?.associatedWorkoutId ??
            activity.associatedWorkoutId
    );

const hasDistance = (distanceKm: number | null): boolean =>
    distanceKm !== null && distanceKm > 0;

const buildActivityFlags = (
    sport: string | null,
    distanceKm: number | null,
    elevGainM: number | null,
    avgHr: number | null,
    load: number | null,
    effect: CompactTrainingEffect
): string[] => {
    const flags: string[] = [];
    if ((load ?? 0) < 10) flags.push('very_low_load');
    if (load !== null && load >= 100) flags.push('quality_session');
    if (load !== null && load >= 150) flags.push('hard_session');
    if (load !== null && load >= 150) flags.push('moderate_high_load');
    if (load !== null && load >= 250) flags.push('high_load');
    if (sport === 'indoor_cardio') flags.push('non_endurance_training');
    if (sport?.includes('trail')) flags.push('trail_or_hike_like');
    if ((elevGainM ?? 0) >= 300) flags.push('steep_climb');
    if (
        sport?.includes('running') &&
        (effect.label === 'tempo' || (effect.aerobic ?? 0) >= 3)
    ) {
        flags.push('tempo_run');
    }
    if ((effect.aerobic ?? 0) >= 3) flags.push('aerobic_improving');
    if (hasDistance(distanceKm) && distanceKm! < 2 && (avgHr ?? 0) >= 140) {
        flags.push('high_hr_for_low_distance');
    }
    return Array.from(new Set(flags));
};

const splitSummaries = (source: LooseRecord): LooseRecord[] =>
    Array.isArray(source.splitSummaries) ? source.splitSummaries : [];

const normalizeSegmentType = (
    splitType: string | null | undefined
): string | null => {
    if (!splitType) return null;
    const normalized = splitType.toLowerCase();
    if (normalized === 'interval_warmup') return 'warmup';
    if (normalized === 'interval_cooldown') return 'cooldown';
    if (normalized === 'interval_recovery' || normalized === 'interval_rest') {
        return 'rest';
    }
    if (normalized === 'interval_active') return 'active';
    return null;
};

const inferWorkoutType = (
    name: string | null | undefined,
    label: string | null | undefined
): string | null => {
    const source = `${name ?? ''} ${label ?? ''}`.toLowerCase();
    const parts: string[] = [];
    if (source.includes('threshold')) parts.push('threshold');
    if (source.includes('vo2')) parts.push('vo2max');
    if (source.includes('tempo')) parts.push('tempo');
    if (source.includes('base')) parts.push('base');
    return parts.length > 0 ? parts.join('_') : null;
};

const splitCount = (split: LooseRecord): number =>
    roundNumber(split.noOfSplits) ?? 1;

const weightedAverage = (
    entries: LooseRecord[],
    field: string,
    weightField = 'duration',
    digits = 0
): number | null => {
    let weighted = 0;
    let totalWeight = 0;
    for (const entry of entries) {
        const value = numeric(entry[field]);
        const weight = numeric(entry[weightField]) ?? 0;
        if (value !== null && weight > 0) {
            weighted += value * weight;
            totalWeight += weight;
        }
    }
    return totalWeight > 0 ? round(weighted / totalWeight, digits) : null;
};

const groupSplits = (splits: LooseRecord[], splitType: string): LooseRecord[] =>
    splits.filter(
        (split) => normalizeSegmentType(split.splitType) === splitType
    );

const summarizeWorkoutSegment = (
    type: string,
    entries: LooseRecord[],
    detailed: boolean
) => {
    const distanceM = entries.reduce(
        (sum, entry) => sum + (numeric(entry.distance) ?? 0),
        0
    );
    const durationSec = entries.reduce(
        (sum, entry) => sum + (numeric(entry.duration) ?? 0),
        0
    );
    const count = entries.reduce((sum, entry) => sum + splitCount(entry), 0);
    const base = {
        type,
        count,
        distanceKm: round(distanceM / 1000, 2),
        durationMin: round(durationSec / 60, 1),
        pace: paceFromDistance(distanceM, durationSec)
    };

    return {
        ...base,
        avgHr: detailed ? weightedAverage(entries, 'averageHR') : null,
        maxHr: detailed
            ? round(
                  entries.reduce<number | null>(
                      (max, entry) =>
                          numeric(entry.maxHR) === null
                              ? max
                              : max === null
                              ? numeric(entry.maxHR)
                              : Math.max(max, numeric(entry.maxHR)!),
                      null
                  )
              )
            : null,
        avgCadence: detailed
            ? weightedAverage(entries, 'averageRunCadence')
            : null
    };
};

const workoutSegments = (source: LooseRecord, detailed: false) =>
    (['warmup', 'active', 'rest', 'cooldown'] as const)
        .map((type) => {
            const entries = groupSplits(splitSummaries(source), type);
            return entries.length > 0
                ? summarizeWorkoutSegment(type, entries, detailed)
                : null;
        })
        .filter((segment): segment is Exclude<typeof segment, null> =>
            Boolean(segment)
        );

const expandWorkoutSegments = (
    detail: LooseRecord
): NonNullable<ActivityDetailSummary['workoutStructure']>['segments'] => {
    // 按类型分组（保持聚合数据不变）
    const types = ['warmup', 'active', 'rest', 'cooldown'] as const;
    const byType = new Map<
        string,
        {
            noOfSplits: number;
            distanceM: number;
            durationSec: number;
            avgHr: number | null;
            maxHr: number | null;
            avgCadence: number | null;
        }
    >();
    for (const type of types) {
        const entries = groupSplits(splitSummaries(detail), type);
        if (entries.length === 0) continue;
        const distanceM = entries.reduce(
            (sum, e) => sum + (numeric(e.distance) ?? 0),
            0
        );
        const durationSec = entries.reduce(
            (sum, e) => sum + (numeric(e.duration) ?? 0),
            0
        );
        byType.set(type, {
            noOfSplits: entries.reduce((sum, e) => sum + splitCount(e), 0),
            distanceM,
            durationSec,
            avgHr: weightedAverage(entries, 'averageHR'),
            maxHr: round(
                entries.reduce<number | null>(
                    (max, e) =>
                        numeric(e.maxHR) === null
                            ? max
                            : max === null
                            ? numeric(e.maxHR)
                            : Math.max(max, numeric(e.maxHR)!),
                    null
                )
            ),
            avgCadence: weightedAverage(entries, 'averageRunCadence')
        });
    }

    // 确认训练序列：是否有 active/rest 对
    const active = byType.get('active');
    const rest = byType.get('rest');
    const hasIntervals = active && rest && active.noOfSplits > 0;

    const result: ReturnType<typeof expandWorkoutSegments> = [];

    const pushIfValid = (tuple: ReturnType<typeof makeSegmentTuple>) => {
        if (tuple) result.push(tuple);
    };

    // warmup
    const warmup = byType.get('warmup');
    if (warmup && warmup.durationSec > 0) {
        pushIfValid(makeSegmentTuple('warmup', warmup, 1));
    }

    // active ↔ rest 交替展开
    if (hasIntervals) {
        const repeats = Math.max(active!.noOfSplits, rest!.noOfSplits);
        for (let i = 0; i < repeats; i++) {
            pushIfValid(
                makeSegmentTuple('active', active!, active!.noOfSplits)
            );
            pushIfValid(makeSegmentTuple('rest', rest!, rest!.noOfSplits));
        }
    } else {
        // 没有 interval 对的单个 active 段
        if (active && active.durationSec > 0) {
            pushIfValid(makeSegmentTuple('active', active, active.noOfSplits));
        }
    }

    // cooldown
    const cooldown = byType.get('cooldown');
    if (cooldown && cooldown.durationSec > 0) {
        pushIfValid(makeSegmentTuple('cooldown', cooldown, 1));
    }

    return result;
};

/** 将聚合段数据平摊为单个分段的 tuple */
const makeSegmentTuple = (
    type: string,
    agg: {
        noOfSplits: number;
        distanceM: number;
        durationSec: number;
        avgHr: number | null;
        maxHr: number | null;
        avgCadence: number | null;
    },
    totalSplits: number
):
    | [
          string,
          number,
          number,
          string,
          number | null,
          number | null,
          number | null
      ]
    | null => {
    if (totalSplits <= 0 || agg.durationSec <= 0) return null;
    const perDistanceM = agg.distanceM / totalSplits;
    const perDurationSec = agg.durationSec / totalSplits;
    return [
        type,
        round(perDistanceM / 1000, 2) ?? 0,
        round(perDurationSec / 60, 1) ?? 0,
        paceFromDistance(perDistanceM, perDurationSec) ?? '',
        agg.avgHr,
        agg.maxHr,
        agg.avgCadence
    ];
};

const WORKOUT_SEGMENT_SCHEMA = [
    'type',
    'distanceKm',
    'durationMin',
    'pace',
    'avgHr',
    'maxHr',
    'avgCadence'
] as const;

const buildWorkoutStructure = (
    detail: LooseRecord,
    label: string
): NonNullable<ActivityDetailSummary['workoutStructure']> => {
    const segments = expandWorkoutSegments(detail);
    return {
        available: workoutId(detail) !== null || segments.length > 0,
        type: inferWorkoutType(detail.activityName, label),
        segmentSchema: [...WORKOUT_SEGMENT_SCHEMA],
        segments
    };
};

const LIST_WORKOUT_SEGMENT_SCHEMA = [
    'type',
    'count',
    'distanceKm',
    'durationMin',
    'pace'
] as const;

const buildWorkout = (source: LooseRecord, label: string) => {
    const id = workoutId(source);
    const segments = workoutSegments(source, false);
    return {
        structured: id !== null || segments.length > 0,
        workoutId: id,
        type: inferWorkoutType(source.activityName, label),
        segmentSchema: [...LIST_WORKOUT_SEGMENT_SCHEMA],
        segments: segments.map(
            (segment) =>
                [
                    segment.type,
                    segment.count,
                    segment.distanceKm,
                    segment.durationMin,
                    segment.pace
                ] as [
                    string,
                    number,
                    number | null,
                    number | null,
                    string | null
                ]
        )
    };
};

const compactActivity = (activity: IActivity): CompactActivity => {
    const source = activity as unknown as LooseRecord;
    const sport = primarySport(source);
    const subSport = sportKey(source);
    const date = compactDate(activity.startTimeLocal);
    const distanceKm = roundNumber(activity.distance / 1000, 2);
    const durationMin = toMinutes(activity.duration);
    const elevGainM = roundNumber(activity.elevationGain);
    const effect = buildTrainingEffect(source);
    const load = roundNumber(source.activityTrainingLoad);
    const avgHr = roundNumber(activity.averageHR);
    const workout = buildWorkout(source, effect.label);
    const flags = buildActivityFlags(
        sport,
        distanceKm,
        elevGainM,
        avgHr,
        load,
        effect
    );
    if (workout.structured) flags.unshift('structured');

    const result: CompactActivity = {
        id: activity.activityId,
        date,
        time: compactTime(activity.startTimeLocal),
        sport,
        subSport,
        name: activity.activityName ?? null,
        summary: {
            distanceKm,
            durationMin:
                durationMin ??
                roundNumber((numeric(activity.duration) ?? 0) / 60, 1),
            pace: paceFromDistance(activity.distance, activity.duration),
            avgHr,
            maxHr: roundNumber(activity.maxHR),
            elevGainM
        },
        impact: {
            label: effect.label,
            load,
            aerobicTE: effect.aerobic,
            anaerobicTE: effect.anaerobic,
            bodyBatteryDelta: roundNumber(source.differenceBodyBattery)
        },
        intensity: {
            hrZonesSec: hrZones(source)
        },
        flags
    };

    // 仅结构化训练才附加 workout 字段，节省 token
    if (workout.structured) {
        result.workout = workout;
    }

    return result;
};

const summarizeSports = (
    activities: CompactActivity[]
): ActivitiesSummary['summary']['sports'] => {
    const sports: ActivitiesSummary['summary']['sports'] = {};
    for (const activity of activities) {
        const sport = activity.sport ?? 'unknown';
        const existing = sports[sport] ?? {
            count: 0,
            durationMin: 0,
            load: 0
        };
        const distance = activity.summary.distanceKm ?? 0;
        const elevation = activity.summary.elevGainM ?? 0;

        existing.count += 1;
        existing.durationMin += activity.summary.durationMin ?? 0;
        existing.load += activity.impact.load ?? 0;
        if (distance > 0) {
            existing.distanceKm = (existing.distanceKm ?? 0) + distance;
        }
        if (elevation > 0) {
            existing.elevGainM = (existing.elevGainM ?? 0) + elevation;
        }
        sports[sport] = existing;
    }

    for (const sport of Object.keys(sports)) {
        const item = sports[sport];
        item.distanceKm = round(item.distanceKm ?? null, 2) ?? undefined;
        item.durationMin = round(item.durationMin) ?? 0;
        item.elevGainM = round(item.elevGainM ?? null) ?? undefined;
        item.load = round(item.load) ?? 0;
    }

    return sports;
};

const buildActivitiesAiHints = (activities: CompactActivity[]): string[] => {
    const hints: string[] = [];
    if (
        activities.some(
            (activity) =>
                activity.sport?.includes('running') &&
                activity.flags.includes('tempo_run')
        )
    ) {
        hints.push('recent_running_tempo_session');
    }
    if (
        activities.some(
            (activity) =>
                activity.sport === 'indoor_cardio' &&
                activity.flags.includes('very_low_load')
        )
    ) {
        hints.push('one_low_load_cardio_session');
    }
    if (activities.length > 0) {
        hints.push('activity_detail_available_for_deeper_analysis');
    }
    return hints;
};

const detailSummary = (detail: LooseRecord): LooseRecord =>
    detail.summaryDTO ?? detail;

const buildDetailRunForm = (summary: LooseRecord) => ({
    cadence: roundNumber(summary.averageRunCadence),
    maxCadence: roundNumber(summary.maxRunCadence),
    strideCm: roundNumber(summary.strideLength),
    gctMs: roundNumber(summary.groundContactTime),
    gctBalanceLeft: roundNumber(summary.groundContactBalanceLeft, 1),
    verticalOscCm: roundNumber(summary.verticalOscillation, 1),
    verticalRatio: roundNumber(summary.verticalRatio, 1)
});

const buildSensors = (detail: LooseRecord) => {
    const sensors = detail.metadataDTO?.sensors ?? [];
    const hasStryd = sensors.some(
        (sensor: LooseRecord) =>
            typeof sensor.manufacturer === 'string' &&
            sensor.manufacturer.toLowerCase() === 'stryd'
    );
    const hasHeartRateSensor = sensors.some((sensor: LooseRecord) => {
        const source = [
            sensor.manufacturer,
            sensor.sourceType,
            sensor.antplusDeviceType
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
        return source.includes('heart') || source.includes('hrm');
    });

    return {
        heartRate: hasHeartRateSensor,
        runPower:
            detail.metadataDTO?.hasPowerTimeInZones === true ||
            detail.metadataDTO?.hasRunPowerWindData === true ||
            hasStryd,
        stryd: hasStryd
    };
};

const normalizeMovementType = (
    splitType: string | null | undefined
): string | null => {
    if (!splitType) return null;
    const normalized = splitType.toLowerCase();
    if (normalized === 'rwd_run') return 'run';
    if (normalized === 'rwd_walk') return 'walk';
    if (normalized === 'rwd_stand') return 'stand';
    return null;
};

const buildMovementBreakdown = (
    detail: LooseRecord
): ActivityDetailSummary['movementBreakdown'] => {
    const result: NonNullable<ActivityDetailSummary['movementBreakdown']> = {};
    for (const type of ['run', 'walk', 'stand']) {
        const entries = splitSummaries(detail).filter(
            (split) => normalizeMovementType(split.splitType) === type
        );
        if (entries.length === 0) continue;

        const distanceM = entries.reduce(
            (sum, entry) => sum + (numeric(entry.distance) ?? 0),
            0
        );
        const durationSec = entries.reduce(
            (sum, entry) => sum + (numeric(entry.duration) ?? 0),
            0
        );
        const item: NonNullable<
            ActivityDetailSummary['movementBreakdown']
        >[string] = {
            distanceKm: round(distanceM / 1000, 2),
            avgHr: weightedAverage(entries, 'averageHR')
        };
        if (durationSec >= 60) {
            item.durationMin = round(durationSec / 60, 1);
        } else {
            item.durationSec = round(durationSec, 1);
        }
        result[type] = item;
    }
    return result;
};

const buildDetailAiHints = (
    label: string,
    aerobicTE: number | null,
    anaerobicTE: number | null,
    runForm: ActivityDetailSummary['runForm'],
    bodyBatteryDelta: number | null,
    workoutStructure: NonNullable<ActivityDetailSummary['workoutStructure']>,
    movementBreakdown: NonNullable<ActivityDetailSummary['movementBreakdown']>
): string[] => {
    const hints: string[] = [];
    if (workoutStructure.available) hints.push('structured_workout');
    if (workoutStructure.type) hints.push(`${workoutStructure.type}_workout`);
    // tuple: [type, distanceKm, durationMin, pace, avgHr, maxHr, avgCadence]
    const activeCount = workoutStructure.segments.filter(
        (seg) => seg[0] === 'active'
    ).length;
    if (activeCount > 1) hints.push(`${activeCount}_active_intervals`);
    if (label && label !== 'unknown') hints.push(`${label}_run`);
    if ((aerobicTE ?? 0) >= 4) hints.push('high_aerobic_stimulus');
    else if ((aerobicTE ?? 0) >= 2.5) {
        hints.push('meaningful_aerobic_stimulus');
    }
    if (label === 'vo2max') hints.push('vo2max_training_effect');
    if ((anaerobicTE ?? 0) > 0 && (anaerobicTE ?? 0) < 2) {
        hints.push('minor_anaerobic_stimulus');
    }
    if ((runForm?.cadence ?? 0) >= 170) hints.push('good_cadence');
    if ((bodyBatteryDelta ?? 0) <= -8 && (bodyBatteryDelta ?? 0) > -20) {
        hints.push('body_battery_moderate_drain');
    }
    const totalActiveMin = workoutStructure.segments
        .filter((seg) => seg[0] === 'active')
        .reduce((sum, seg) => sum + (seg[2] as number), 0);
    if (totalActiveMin >= 20) hints.push('meaningful_training_load');
    const restSeg = workoutStructure.segments.find((seg) => seg[0] === 'rest');
    const restHr = restSeg?.[4];
    const runHr = movementBreakdown.run?.avgHr;
    if (restHr !== null && restHr !== undefined && (runHr ?? 0) > 0) {
        if (restHr >= (runHr ?? 0)) {
            hints.push(
                'rest_hr_high_indicates_incomplete_recovery_between_reps'
            );
        }
    }
    return Array.from(new Set(hints));
};

/**
 * Fetch recent Garmin activities and compact them into an AI-ready list.
 * The result keeps only workout load, duration, distance, heart-rate,
 * training-effect, running-form, and simple flag signals that are useful for
 * coach reasoning.
 */
export const buildActivitiesSummary = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    options: ActivitiesSummaryOptions = {}
): Promise<ActivitiesSummary> => {
    await client.checkTokenVaild();

    const rangeDays = options.rangeDays ?? options.recentDays ?? 7;
    const range = getRange({ ...options, recentDays: rangeDays }, 7);
    const activities = await api.getActivities(
        options.start ?? 0,
        options.limit ?? 20,
        options.activityType as ActivityType | undefined,
        options.subActivityType as ActivitySubType | undefined
    );
    const compactActivities = activities.map(compactActivity);
    const totalLoad =
        round(
            compactActivities.reduce(
                (sum, activity) => sum + (activity.impact.load ?? 0),
                0
            )
        ) ?? 0;
    const totalDurationMin =
        round(
            compactActivities.reduce(
                (sum, activity) => sum + (activity.summary.durationMin ?? 0),
                0
            )
        ) ?? 0;

    return {
        schema: 'activities_summary_v1',
        range: {
            start: range.startDateString,
            end: range.endDateString,
            days: rangeDays
        },
        summary: {
            activities: compactActivities.length,
            sports: summarizeSports(compactActivities),
            totalLoad,
            totalDurationMin,
            hardSessions: compactActivities.filter(
                (activity) => (activity.impact.load ?? 0) >= 150
            ).length,
            easySessions: compactActivities.filter(
                (activity) =>
                    (activity.impact.load ?? 0) > 0 &&
                    (activity.impact.load ?? 0) < 50
            ).length,
            otherSessions: compactActivities.filter(
                (activity) => (activity.impact.load ?? 0) === 0
            ).length
        },
        activities: compactActivities,
        aiHints: buildActivitiesAiHints(compactActivities)
    };
};

/**
 * Fetch one Garmin activity detail and compact it into an AI-ready structure.
 * This drops charts, maps, laps, raw device metadata, and large split payloads
 * while preserving the training impact, intensity, form, stamina, subjective
 * feedback, sensor availability, and split availability needed by an AI coach.
 */
export const buildActivityDetailSummary = async (
    api: CoachApi,
    client: { checkTokenVaild(): Promise<void> },
    options: ActivityDetailSummaryOptions
): Promise<ActivityDetailSummary> => {
    await client.checkTokenVaild();

    const detail = (await api.getActivity({
        activityId: options.activityId
    })) as unknown as LooseRecord;
    const summary = detailSummary(detail);
    const startTime = summary.startTimeLocal ?? detail.startTimeLocal;
    const effect = buildTrainingEffect(summary);
    const label = effect.label;
    const load = roundNumber(summary.activityTrainingLoad);
    const bodyBatteryDelta = roundNumber(summary.differenceBodyBattery);
    const runForm = buildDetailRunForm(summary);
    const id = workoutId(detail);
    const workoutStructure = buildWorkoutStructure(detail, label);
    const movementBreakdown = buildMovementBreakdown(detail);

    return {
        schema: 'activity_detail_v1',
        id: detail.activityId,
        date: compactDate(startTime),
        startTime: compactTime(startTime),
        sport: primarySport(detail),
        subSport: sportKey(detail),
        name: detail.activityName ?? null,
        location: detail.locationName ?? null,
        isStructuredWorkout: workoutStructure.available,
        workoutId: id,
        summary: {
            distanceKm: roundNumber(summary.distance / 1000, 2),
            durationMin: roundNumber((numeric(summary.duration) ?? 0) / 60, 1),
            movingMin: roundNumber(
                (numeric(summary.movingDuration) ?? 0) / 60,
                1
            ),
            elapsedMin: roundNumber(
                (numeric(summary.elapsedDuration) ?? 0) / 60,
                1
            ),
            pace: paceFromDistance(summary.distance, summary.duration),
            gapPace: paceFromSpeed(summary.avgGradeAdjustedSpeed),
            avgHr: roundNumber(summary.averageHR),
            maxHr: roundNumber(summary.maxHR),
            calories: roundNumber(summary.calories),
            elevGainM: roundNumber(summary.elevationGain),
            elevLossM: roundNumber(summary.elevationLoss),
            avgTempC: roundNumber(summary.averageTemperature)
        },
        trainingImpact: {
            label,
            load,
            aerobicTE: effect.aerobic,
            anaerobicTE: effect.anaerobic,
            aerobicMessage: normalizeMessage(
                summary.aerobicTrainingEffectMessage
            ),
            anaerobicMessage: normalizeMessage(
                summary.anaerobicTrainingEffectMessage
            ),
            bodyBatteryDelta,
            recoveryHr: roundNumber(summary.recoveryHeartRate)
        },
        intensity: {
            moderateMin: roundNumber(summary.moderateIntensityMinutes),
            vigorousMin: roundNumber(summary.vigorousIntensityMinutes)
        },
        runForm,
        stamina: {
            begin: roundNumber(summary.beginPotentialStamina),
            end: roundNumber(summary.endPotentialStamina),
            minAvailable: roundNumber(summary.minAvailableStamina)
        },
        subjective: {
            feel: roundNumber(summary.directWorkoutFeel),
            rpe: roundNumber(summary.directWorkoutRpe),
            complianceScore: roundNumber(
                summary.directWorkoutComplianceScore ??
                    summary.workoutComplianceScore
            )
        },
        sensors: buildSensors(detail),
        workoutStructure,
        movementBreakdown,
        aiHints: buildDetailAiHints(
            label,
            effect.aerobic,
            effect.anaerobic,
            runForm,
            bodyBatteryDelta,
            workoutStructure!,
            movementBreakdown!
        )
    };
};
