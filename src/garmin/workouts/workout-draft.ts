import {
    GarminWorkoutEndCondition,
    GarminWorkoutExecutableStep,
    GarminWorkoutRepeatGroup,
    GarminWorkoutSportType,
    GarminWorkoutStepType,
    GarminWorkoutTargetType,
    GarminWorkoutUploadPayload,
    WorkoutDraft,
    WorkoutDraftDuration,
    WorkoutDraftExecutableStep,
    WorkoutDraftStep,
    WorkoutDraftStepType,
    WorkoutDraftTarget,
    WorkoutDraftValidationIssue
} from '../types/workout';

const RUNNING_SPORT: GarminWorkoutSportType = {
    sportTypeId: 1,
    sportTypeKey: 'running',
    displayOrder: 1
};

const STEP_TYPES: Record<WorkoutDraftStepType, GarminWorkoutStepType> = {
    warmup: { stepTypeId: 1, stepTypeKey: 'warmup', displayOrder: 1 },
    cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown', displayOrder: 2 },
    interval: { stepTypeId: 3, stepTypeKey: 'interval', displayOrder: 3 },
    recovery: { stepTypeId: 4, stepTypeKey: 'recovery', displayOrder: 4 },
    rest: { stepTypeId: 5, stepTypeKey: 'rest', displayOrder: 5 },
    other: { stepTypeId: 7, stepTypeKey: 'other', displayOrder: 7 }
};

const REPEAT_STEP_TYPE: GarminWorkoutStepType = {
    stepTypeId: 6,
    stepTypeKey: 'repeat',
    displayOrder: 6
};

const NO_TARGET: GarminWorkoutTargetType = {
    workoutTargetTypeId: 1,
    workoutTargetTypeKey: 'no.target',
    displayOrder: 1
};

const round = (value: number, precision = 7): number => {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
};

const durationCondition = (
    duration: WorkoutDraftDuration
): {
    condition: GarminWorkoutEndCondition;
    value: number | null;
} => {
    if (duration.type === 'time') {
        return {
            condition: {
                conditionTypeId: 2,
                conditionTypeKey: 'time',
                displayOrder: 2,
                displayable: true
            },
            value: duration.seconds
        };
    }
    if (duration.type === 'distance') {
        return {
            condition: {
                conditionTypeId: 3,
                conditionTypeKey: 'distance',
                displayOrder: 3,
                displayable: true
            },
            value: duration.meters
        };
    }
    return {
        condition: {
            conditionTypeId: 1,
            conditionTypeKey: 'lap.button',
            displayOrder: 1,
            displayable: true
        },
        value: null
    };
};

const compileTarget = (
    target: WorkoutDraftTarget | undefined
): Pick<
    GarminWorkoutExecutableStep,
    'targetType' | 'targetValueOne' | 'targetValueTwo' | 'zoneNumber'
> => {
    if (!target || target.type === 'none') {
        return {
            targetType: NO_TARGET,
            targetValueOne: null,
            targetValueTwo: null,
            zoneNumber: null
        };
    }
    if (target.type === 'pace') {
        return {
            targetType: {
                workoutTargetTypeId: 6,
                workoutTargetTypeKey: 'pace.zone',
                displayOrder: 6
            },
            targetValueOne: round(1000 / target.slowestSecPerKm),
            targetValueTwo: round(1000 / target.fastestSecPerKm),
            zoneNumber: null
        };
    }
    if (target.type === 'heart_rate_zone') {
        return {
            targetType: {
                workoutTargetTypeId: 4,
                workoutTargetTypeKey: 'heart.rate.zone',
                displayOrder: 4
            },
            targetValueOne: null,
            targetValueTwo: null,
            zoneNumber: target.zone
        };
    }
    if (target.type === 'power') {
        return {
            targetType: {
                workoutTargetTypeId: 2,
                workoutTargetTypeKey: 'power.zone',
                displayOrder: 2
            },
            targetValueOne: target.minWatts,
            targetValueTwo: target.maxWatts,
            zoneNumber: null
        };
    }
    return {
        targetType: {
            workoutTargetTypeId: 3,
            workoutTargetTypeKey: 'cadence',
            displayOrder: 3
        },
        targetValueOne: target.minSpm,
        targetValueTwo: target.maxSpm,
        zoneNumber: null
    };
};

const timeSeconds = (step: WorkoutDraftStep): number | null => {
    if (step.type === 'repeat') {
        let groupSeconds = 0;
        for (const child of step.steps) {
            const seconds = timeSeconds(child);
            if (seconds === null) return null;
            groupSeconds += seconds;
        }
        return groupSeconds * step.iterations;
    }
    return step.duration.type === 'time' ? step.duration.seconds : null;
};

const validateTarget = (
    target: WorkoutDraftTarget | undefined,
    path: string,
    issues: WorkoutDraftValidationIssue[]
) => {
    if (!target || target.type === 'none') return;
    if (target.type === 'pace') {
        if (
            !Number.isFinite(target.fastestSecPerKm) ||
            !Number.isFinite(target.slowestSecPerKm) ||
            target.fastestSecPerKm < 120 ||
            target.slowestSecPerKm > 1200 ||
            target.fastestSecPerKm > target.slowestSecPerKm
        ) {
            issues.push({
                path,
                code: 'invalid_pace_range',
                message:
                    '配速范围必须为 120-1200 秒/公里，且最快配速不能慢于最慢配速'
            });
        }
        return;
    }
    if (target.type === 'heart_rate_zone') {
        if (
            !Number.isInteger(target.zone) ||
            target.zone < 1 ||
            target.zone > 5
        ) {
            issues.push({
                path,
                code: 'invalid_heart_rate_zone',
                message: '心率区间必须为 1-5'
            });
        }
        return;
    }
    const [minimum, maximum, ceiling] =
        target.type === 'power'
            ? [target.minWatts, target.maxWatts, 3000]
            : [target.minSpm, target.maxSpm, 300];
    if (
        !Number.isFinite(minimum) ||
        !Number.isFinite(maximum) ||
        minimum <= 0 ||
        maximum > ceiling ||
        minimum > maximum
    ) {
        issues.push({
            path,
            code: `invalid_${target.type}_range`,
            message: `${target.type} 目标范围无效`
        });
    }
};

const validateExecutableStep = (
    step: WorkoutDraftExecutableStep,
    path: string,
    issues: WorkoutDraftValidationIssue[]
) => {
    if (step.duration.type === 'time') {
        if (
            !Number.isFinite(step.duration.seconds) ||
            step.duration.seconds < 1 ||
            step.duration.seconds > 86400
        ) {
            issues.push({
                path: `${path}.duration.seconds`,
                code: 'invalid_duration',
                message: '时间必须为 1-86400 秒'
            });
        }
    } else if (step.duration.type === 'distance') {
        if (
            !Number.isFinite(step.duration.meters) ||
            step.duration.meters < 1 ||
            step.duration.meters > 100000
        ) {
            issues.push({
                path: `${path}.duration.meters`,
                code: 'invalid_distance',
                message: '距离必须为 1-100000 米'
            });
        }
    }
    validateTarget(step.target, `${path}.target`, issues);
};

export const validateWorkoutDraft = (
    draft: WorkoutDraft
): WorkoutDraftValidationIssue[] => {
    const issues: WorkoutDraftValidationIssue[] = [];
    if (draft.schema !== 'workout_draft_v1') {
        issues.push({
            path: 'schema',
            code: 'unsupported_schema',
            message: '仅支持 workout_draft_v1'
        });
    }
    if (draft.sport !== 'running') {
        issues.push({
            path: 'sport',
            code: 'unsupported_sport',
            message: '当前草案编译器仅支持 running'
        });
    }
    const nameLength = draft.name?.trim().length ?? 0;
    if (nameLength < 1 || nameLength > 100) {
        issues.push({
            path: 'name',
            code: 'invalid_name',
            message: '课表名称长度必须为 1-100'
        });
    }
    if (
        draft.scheduledDate &&
        !/^\d{4}-\d{2}-\d{2}$/.test(draft.scheduledDate)
    ) {
        issues.push({
            path: 'scheduledDate',
            code: 'invalid_date',
            message: '排期日期必须为 YYYY-MM-DD'
        });
    }
    if (draft.steps.length < 1 || draft.steps.length > 50) {
        issues.push({
            path: 'steps',
            code: 'invalid_step_count',
            message: '顶层步骤数量必须为 1-50'
        });
    }

    let expandedSteps = 0;
    draft.steps.forEach((step, index) => {
        const path = `steps.${index}`;
        if (step.type === 'repeat') {
            if (
                !Number.isInteger(step.iterations) ||
                step.iterations < 2 ||
                step.iterations > 99
            ) {
                issues.push({
                    path: `${path}.iterations`,
                    code: 'invalid_iterations',
                    message: '重复次数必须为 2-99'
                });
            }
            if (step.steps.length < 1 || step.steps.length > 20) {
                issues.push({
                    path: `${path}.steps`,
                    code: 'invalid_repeat_step_count',
                    message: '重复组步骤数量必须为 1-20'
                });
            }
            expandedSteps += step.steps.length * step.iterations;
            step.steps.forEach((child, childIndex) =>
                validateExecutableStep(
                    child,
                    `${path}.steps.${childIndex}`,
                    issues
                )
            );
        } else {
            expandedSteps += 1;
            validateExecutableStep(step, path, issues);
        }
    });
    if (expandedSteps > 200) {
        issues.push({
            path: 'steps',
            code: 'expanded_step_limit',
            message: '展开后的步骤数量不能超过 200'
        });
    }

    const calculatedDuration = draft.steps.reduce<number | null>(
        (total, step) => {
            const seconds = timeSeconds(step);
            return total === null || seconds === null ? null : total + seconds;
        },
        0
    );
    if (
        draft.estimatedDurationSec !== undefined &&
        (!Number.isFinite(draft.estimatedDurationSec) ||
            draft.estimatedDurationSec < 1 ||
            draft.estimatedDurationSec > 172800)
    ) {
        issues.push({
            path: 'estimatedDurationSec',
            code: 'invalid_estimated_duration',
            message: '预计时长必须为 1-172800 秒'
        });
    }
    if (
        calculatedDuration === null &&
        draft.estimatedDurationSec === undefined
    ) {
        issues.push({
            path: 'estimatedDurationSec',
            code: 'estimated_duration_required',
            message: '包含距离或手动圈步骤时必须提供预计总时长'
        });
    }
    return issues;
};

export const compileWorkoutDraft = (
    draft: WorkoutDraft
): GarminWorkoutUploadPayload => {
    const issues = validateWorkoutDraft(draft);
    if (issues.length > 0) {
        throw new Error(
            `Invalid workout draft: ${issues
                .map((issue) => `${issue.path}:${issue.code}`)
                .join(', ')}`
        );
    }

    let nextStepOrder = 1;
    let nextChildStepId = 1;
    const compileStep = (
        step: WorkoutDraftExecutableStep,
        childStepId: number | null
    ): GarminWorkoutExecutableStep => {
        const { condition, value } = durationCondition(step.duration);
        return {
            type: 'ExecutableStepDTO',
            stepId: null,
            stepOrder: nextStepOrder++,
            childStepId,
            description: step.description?.trim() || null,
            stepType: STEP_TYPES[step.stepType],
            endCondition: condition,
            endConditionValue: value,
            ...compileTarget(step.target),
            strokeType: {
                strokeTypeId: 0,
                displayOrder: 0
            },
            equipmentType: {
                equipmentTypeId: 0,
                displayOrder: 0
            }
        };
    };

    const workoutSteps = draft.steps.map(
        (step): GarminWorkoutExecutableStep | GarminWorkoutRepeatGroup => {
            if (step.type === 'step') return compileStep(step, null);
            const childStepId = nextChildStepId++;
            const groupOrder = nextStepOrder++;
            return {
                type: 'RepeatGroupDTO',
                stepId: null,
                stepOrder: groupOrder,
                childStepId,
                stepType: REPEAT_STEP_TYPE,
                numberOfIterations: step.iterations,
                workoutSteps: step.steps.map((child) =>
                    compileStep(child, childStepId)
                ),
                endCondition: {
                    conditionTypeId: 7,
                    conditionTypeKey: 'iterations',
                    displayOrder: 7,
                    displayable: false
                },
                endConditionValue: step.iterations,
                smartRepeat: false
            };
        }
    );

    const calculatedDuration = draft.steps.reduce<number | null>(
        (total, step) => {
            const seconds = timeSeconds(step);
            return total === null || seconds === null ? null : total + seconds;
        },
        0
    );

    return {
        workoutName: draft.name.trim(),
        description: draft.description?.trim() || undefined,
        sportType: RUNNING_SPORT,
        estimatedDurationInSecs:
            draft.estimatedDurationSec ?? calculatedDuration ?? 0,
        workoutSegments: [
            {
                segmentOrder: 1,
                sportType: RUNNING_SPORT,
                workoutSteps
            }
        ]
    };
};
