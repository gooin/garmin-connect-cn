export type WorkoutDraftStepType =
    | 'warmup'
    | 'cooldown'
    | 'interval'
    | 'recovery'
    | 'rest'
    | 'other';

export type WorkoutDraftDuration =
    | {
          type: 'time';
          seconds: number;
      }
    | {
          type: 'distance';
          meters: number;
      }
    | {
          type: 'lap_button';
      };

export type WorkoutDraftTarget =
    | {
          type: 'none';
      }
    | {
          type: 'pace';
          fastestSecPerKm: number;
          slowestSecPerKm: number;
      }
    | {
          type: 'heart_rate_zone';
          zone: number;
      }
    | {
          type: 'power';
          minWatts: number;
          maxWatts: number;
      }
    | {
          type: 'cadence';
          minSpm: number;
          maxSpm: number;
      };

export interface WorkoutDraftExecutableStep {
    type: 'step';
    stepType: WorkoutDraftStepType;
    duration: WorkoutDraftDuration;
    target?: WorkoutDraftTarget;
    description?: string;
}

export interface WorkoutDraftRepeatGroup {
    type: 'repeat';
    iterations: number;
    steps: WorkoutDraftExecutableStep[];
}

export type WorkoutDraftStep =
    | WorkoutDraftExecutableStep
    | WorkoutDraftRepeatGroup;

/**
 * Transport-neutral AI coach draft. Values are metric and user-readable.
 * This object is safe to review and hash before compiling to Garmin fields.
 */
export interface WorkoutDraft {
    schema: 'workout_draft_v1';
    sport: 'running';
    name: string;
    description?: string;
    estimatedDurationSec?: number;
    scheduledDate?: string;
    steps: WorkoutDraftStep[];
}

export interface WorkoutDraftValidationIssue {
    path: string;
    code: string;
    message: string;
}

export interface GarminWorkoutSportType {
    sportTypeId: number;
    sportTypeKey: string;
    displayOrder: number;
}

export interface GarminWorkoutStepType {
    stepTypeId: number;
    stepTypeKey: string;
    displayOrder: number;
}

export interface GarminWorkoutEndCondition {
    conditionTypeId: number;
    conditionTypeKey: string;
    displayOrder: number;
    displayable: boolean;
}

export interface GarminWorkoutTargetType {
    workoutTargetTypeId: number;
    workoutTargetTypeKey: string;
    displayOrder: number;
}

export interface GarminWorkoutExecutableStep {
    type: 'ExecutableStepDTO';
    stepId: null;
    stepOrder: number;
    childStepId: number | null;
    description: string | null;
    stepType: GarminWorkoutStepType;
    endCondition: GarminWorkoutEndCondition;
    endConditionValue: number | null;
    targetType: GarminWorkoutTargetType;
    targetValueOne: number | null;
    targetValueTwo: number | null;
    zoneNumber: number | null;
    strokeType: {
        strokeTypeId: 0;
        displayOrder: 0;
    };
    equipmentType: {
        equipmentTypeId: 0;
        displayOrder: 0;
    };
}

export interface GarminWorkoutRepeatGroup {
    type: 'RepeatGroupDTO';
    stepId: null;
    stepOrder: number;
    childStepId: number;
    stepType: GarminWorkoutStepType;
    numberOfIterations: number;
    workoutSteps: GarminWorkoutExecutableStep[];
    endCondition: GarminWorkoutEndCondition;
    endConditionValue: number;
    smartRepeat: false;
}

export interface GarminWorkoutUploadPayload {
    workoutName: string;
    description?: string;
    sportType: GarminWorkoutSportType;
    estimatedDurationInSecs: number;
    workoutSegments: Array<{
        segmentOrder: number;
        sportType: GarminWorkoutSportType;
        workoutSteps: Array<
            GarminWorkoutExecutableStep | GarminWorkoutRepeatGroup
        >;
    }>;
}

export interface TrainingReadinessEntry {
    userProfilePK?: number | null;
    calendarDate?: string | null;
    timestamp?: string | null;
    timestampLocal?: string | null;
    deviceId?: number | null;
    score?: number | null;
    level?: string | null;
    feedbackLong?: string | null;
    feedbackShort?: string | null;
    sleepScore?: number | null;
    recoveryTime?: number | null;
    recoveryTimeChangePhrase?: string | null;
    acwrFactorPercent?: number | null;
    hrvFactorPercent?: number | null;
    stressHistoryFactorPercent?: number | null;
    inputContext?: string | null;
    [key: string]: unknown;
}

export interface EnduranceScoreResponse {
    [key: string]: unknown;
}

export interface RunningToleranceEntry {
    calendarDate?: string;
    [key: string]: unknown;
}

export interface TrainingPlanSummary {
    trainingPlanId?: number;
    planId?: number;
    name?: string;
    trainingPlanName?: string;
    planType?: string;
    trainingPlanType?: string;
    [key: string]: unknown;
}

export interface TrainingPlansResponse {
    trainingPlanList?: TrainingPlanSummary[];
    [key: string]: unknown;
}

export interface TrainingPlanDetail {
    [key: string]: unknown;
}
