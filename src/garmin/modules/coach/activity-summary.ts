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

const buildRunForm = (activity: LooseRecord) => {
    const cadence = roundNumber(
        activity.averageRunningCadenceInStepsPerMinute ??
            activity.averageRunCadence
    );
    const strideCm = roundNumber(activity.avgStrideLength);
    const gctMs = roundNumber(activity.avgGroundContactTime);
    const verticalOscCm = roundNumber(activity.avgVerticalOscillation, 1);

    if (
        cadence === null &&
        strideCm === null &&
        gctMs === null &&
        verticalOscCm === null
    ) {
        return undefined;
    }

    return {
        cadence,
        strideCm,
        gctMs,
        verticalOscCm
    };
};

const compactActivity = (activity: IActivity): CompactActivity => {
    const source = activity as unknown as LooseRecord;
    const sport = sportKey(source);
    const date = compactDate(activity.startTimeLocal);
    const distanceKm = roundNumber(activity.distance / 1000, 2);
    const durationMin = toMinutes(activity.duration);
    const movingMin = toMinutes(activity.movingDuration);
    const elevGainM = roundNumber(activity.elevationGain);
    const effect = buildTrainingEffect(source);
    const load = roundNumber(source.activityTrainingLoad);
    const avgHr = roundNumber(activity.averageHR);
    const flags = buildActivityFlags(
        sport,
        distanceKm,
        elevGainM,
        avgHr,
        load,
        effect
    );
    const result: CompactActivity = {
        id: activity.activityId,
        date,
        time: compactTime(activity.startTimeLocal),
        sport,
        name: activity.activityName ?? null,
        durationMin,
        distanceKm,
        avgHr,
        maxHr: roundNumber(activity.maxHR),
        calories: roundNumber(activity.calories),
        trainingEffect: effect,
        load,
        bodyBatteryDelta: roundNumber(source.differenceBodyBattery),
        hrZonesSec: hrZones(source),
        flags
    };

    if (movingMin !== null) result.movingMin = movingMin;
    if (hasDistance(distanceKm)) {
        result.pace = paceFromDistance(activity.distance, activity.duration);
        result.gapPace = paceFromSpeed(source.avgGradeAdjustedSpeed);
    }
    if (elevGainM !== null) result.elevGainM = elevGainM;

    const runForm = buildRunForm(source);
    if (runForm) result.runForm = runForm;

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
        const distance = activity.distanceKm ?? 0;
        const elevation = activity.elevGainM ?? 0;

        existing.count += 1;
        existing.durationMin += activity.durationMin ?? 0;
        existing.load += activity.load ?? 0;
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

const splitTypes = (detail: LooseRecord): string[] =>
    Array.from(
        new Set(
            (detail.splitSummaries ?? [])
                .map((summary: LooseRecord) => summary.splitType)
                .filter(
                    (value: unknown): value is string =>
                        typeof value === 'string'
                )
        )
    );

const buildSensors = (detail: LooseRecord, summary: LooseRecord) => {
    const sensors = detail.metadataDTO?.sensors ?? [];
    const hasStryd = sensors.some(
        (sensor: LooseRecord) =>
            typeof sensor.manufacturer === 'string' &&
            sensor.manufacturer.toLowerCase() === 'stryd'
    );

    return {
        heartRate:
            detail.metadataDTO?.hasHrTimeInZones === true ||
            numeric(summary.averageHR) !== null,
        runPower:
            detail.metadataDTO?.hasPowerTimeInZones === true ||
            detail.metadataDTO?.hasRunPowerWindData === true ||
            hasStryd,
        stryd: hasStryd
    };
};

const buildDetailAiHints = (
    label: string,
    aerobicTE: number | null,
    anaerobicTE: number | null,
    runForm: ActivityDetailSummary['runForm'],
    bodyBatteryDelta: number | null
): string[] => {
    const hints: string[] = [];
    if (label && label !== 'unknown') hints.push(`${label}_run`);
    if ((aerobicTE ?? 0) >= 2.5) hints.push('meaningful_aerobic_stimulus');
    if ((anaerobicTE ?? 0) > 0 && (anaerobicTE ?? 0) < 2) {
        hints.push('minor_anaerobic_stimulus');
    }
    if ((runForm.cadence ?? 0) >= 170) hints.push('good_cadence');
    if ((bodyBatteryDelta ?? 0) <= -8 && (bodyBatteryDelta ?? 0) > -20) {
        hints.push('body_battery_moderate_drain');
    }
    return hints;
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
                (sum, activity) => sum + (activity.load ?? 0),
                0
            )
        ) ?? 0;
    const totalDurationMin =
        round(
            compactActivities.reduce(
                (sum, activity) => sum + (activity.durationMin ?? 0),
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
                (activity) => (activity.load ?? 0) >= 150
            ).length,
            easySessions: compactActivities.filter(
                (activity) =>
                    (activity.load ?? 0) > 0 && (activity.load ?? 0) < 50
            ).length,
            otherSessions: compactActivities.filter(
                (activity) => (activity.load ?? 0) === 0
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
    const summaryTypes = splitTypes(detail);

    return {
        schema: 'activity_detail_v1',
        id: detail.activityId,
        date: compactDate(startTime),
        sport: sportKey(detail),
        name: detail.activityName ?? null,
        location: detail.locationName ?? null,
        summary: {
            distanceKm: roundNumber(summary.distance / 1000, 2),
            durationMin: toMinutes(summary.duration),
            movingMin: toMinutes(summary.movingDuration),
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
            hrZonesSec: hrZones(summary),
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
            rpe: roundNumber(summary.directWorkoutRpe)
        },
        sensors: buildSensors(detail, summary),
        splits: {
            available:
                detail.metadataDTO?.hasSplits === true ||
                summaryTypes.length > 0,
            summaryTypes
        },
        aiHints: buildDetailAiHints(
            label,
            effect.aerobic,
            effect.anaerobic,
            runForm,
            bodyBatteryDelta
        )
    };
};
