import { describe, expect, it } from 'vitest';
import {
    compileWorkoutDraft,
    validateWorkoutDraft
} from '../../src/garmin/workouts/workout-draft';
import { WorkoutDraft } from '../../src/garmin/types/workout';

const intervalDraft = (): WorkoutDraft => ({
    schema: 'workout_draft_v1',
    sport: 'running',
    name: '阈值间歇',
    description: '热身后完成 4 组阈值跑。',
    scheduledDate: '2026-06-16',
    steps: [
        {
            type: 'step',
            stepType: 'warmup',
            duration: { type: 'time', seconds: 600 },
            target: {
                type: 'pace',
                fastestSecPerKm: 330,
                slowestSecPerKm: 360
            }
        },
        {
            type: 'repeat',
            iterations: 4,
            steps: [
                {
                    type: 'step',
                    stepType: 'interval',
                    duration: { type: 'distance', meters: 1000 },
                    target: {
                        type: 'heart_rate_zone',
                        zone: 4
                    }
                },
                {
                    type: 'step',
                    stepType: 'recovery',
                    duration: { type: 'time', seconds: 120 },
                    target: { type: 'none' }
                }
            ]
        },
        {
            type: 'step',
            stepType: 'cooldown',
            duration: { type: 'time', seconds: 600 },
            target: {
                type: 'cadence',
                minSpm: 165,
                maxSpm: 180
            }
        }
    ],
    estimatedDurationSec: 3600
});

describe('workout draft compiler', () => {
    it('compiles a metric running draft to verified Garmin workout fields', () => {
        const result = compileWorkoutDraft(intervalDraft());
        const [warmup, repeat, cooldown] =
            result.workoutSegments[0].workoutSteps;

        expect(result.workoutName).toBe('阈值间歇');
        expect(result.sportType).toEqual({
            sportTypeId: 1,
            sportTypeKey: 'running',
            displayOrder: 1
        });
        expect(warmup).toMatchObject({
            type: 'ExecutableStepDTO',
            stepOrder: 1,
            stepType: {
                stepTypeId: 1,
                stepTypeKey: 'warmup'
            },
            endCondition: {
                conditionTypeId: 2,
                conditionTypeKey: 'time'
            },
            endConditionValue: 600,
            targetType: {
                workoutTargetTypeId: 6,
                workoutTargetTypeKey: 'pace.zone'
            },
            targetValueOne: 2.7777778,
            targetValueTwo: 3.030303
        });
        expect(repeat).toMatchObject({
            type: 'RepeatGroupDTO',
            stepOrder: 2,
            childStepId: 1,
            numberOfIterations: 4,
            endCondition: {
                conditionTypeId: 7,
                conditionTypeKey: 'iterations'
            },
            endConditionValue: 4
        });
        if (repeat.type !== 'RepeatGroupDTO') {
            throw new Error('Expected repeat group');
        }
        expect(repeat.workoutSteps[0]).toMatchObject({
            stepOrder: 3,
            childStepId: 1,
            endCondition: {
                conditionTypeId: 3,
                conditionTypeKey: 'distance'
            },
            endConditionValue: 1000,
            targetType: {
                workoutTargetTypeId: 4,
                workoutTargetTypeKey: 'heart.rate.zone'
            },
            zoneNumber: 4
        });
        expect(cooldown).toMatchObject({
            stepOrder: 5,
            targetType: {
                workoutTargetTypeId: 3,
                workoutTargetTypeKey: 'cadence'
            },
            targetValueOne: 165,
            targetValueTwo: 180
        });
    });

    it('calculates duration for time-only workouts', () => {
        const result = compileWorkoutDraft({
            schema: 'workout_draft_v1',
            sport: 'running',
            name: '恢复跑',
            steps: [
                {
                    type: 'step',
                    stepType: 'warmup',
                    duration: { type: 'time', seconds: 300 }
                },
                {
                    type: 'repeat',
                    iterations: 3,
                    steps: [
                        {
                            type: 'step',
                            stepType: 'interval',
                            duration: { type: 'time', seconds: 60 }
                        },
                        {
                            type: 'step',
                            stepType: 'recovery',
                            duration: { type: 'time', seconds: 120 }
                        }
                    ]
                }
            ]
        });

        expect(result.estimatedDurationInSecs).toBe(840);
    });

    it('rejects unsafe or ambiguous drafts before Garmin compilation', () => {
        const draft = intervalDraft();
        draft.estimatedDurationSec = undefined;
        draft.steps[1] = {
            type: 'repeat',
            iterations: 100,
            steps: [
                {
                    type: 'step',
                    stepType: 'interval',
                    duration: { type: 'distance', meters: 1000 },
                    target: {
                        type: 'pace',
                        fastestSecPerKm: 400,
                        slowestSecPerKm: 300
                    }
                }
            ]
        };

        expect(validateWorkoutDraft(draft).map((issue) => issue.code)).toEqual(
            expect.arrayContaining([
                'invalid_iterations',
                'invalid_pace_range',
                'estimated_duration_required'
            ])
        );
        expect(() => compileWorkoutDraft(draft)).toThrow(
            'Invalid workout draft'
        );
    });
});
