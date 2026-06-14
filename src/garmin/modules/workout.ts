import _ from 'lodash';
import { DateTime } from 'luxon';
import {
    GarminWorkoutUploadPayload,
    ICalendar,
    IScheduleWorkout,
    IWorkout,
    IWorkoutDetail,
    TrainingPlanDetail,
    TrainingPlansResponse
} from '../types';
import Running from '../workouts/Running';
import { ModuleConstructor } from './types';

export function applyWorkoutModule(Base: ModuleConstructor) {
    return class WorkoutModule extends Base {
        async getWorkouts(start = 0, limit = 100): Promise<IWorkout[]> {
            if (!Number.isInteger(start) || start < 0) {
                throw new Error('start must be a non-negative integer');
            }
            if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
                throw new Error('limit must be an integer between 1 and 100');
            }
            return this.client.get<IWorkout[]>(this.url.WORKOUTS, {
                params: {
                    start,
                    limit
                }
            });
        }

        async getWorkoutDetail(workout: {
            workoutId: string;
        }): Promise<IWorkoutDetail> {
            if (!workout.workoutId) throw new Error('Missing workoutId');
            return this.client.get<IWorkoutDetail>(
                this.url.WORKOUT(workout.workoutId)
            );
        }

        async addWorkout(
            workout: IWorkoutDetail | GarminWorkoutUploadPayload | Running
        ): Promise<IWorkoutDetail> {
            if (!workout) throw new Error('Missing workout');

            if (workout instanceof Running) {
                if (workout.isValid()) {
                    const data = { ...workout.toJson() };
                    if (!data.description) {
                        data.description =
                            'Added by garmin-connect for Node.js';
                    }
                    return this.client.post<IWorkoutDetail>(
                        this.url.WORKOUT(),
                        data
                    );
                }
            }
            if (!(workout as IWorkoutDetail).workoutSegments)
                throw new Error(
                    'Missing workoutSegments, please use WorkoutDetail, not Workout.'
                );

            const newWorkout = _.omit(workout, [
                'workoutId',
                'ownerId',
                'updatedDate',
                'createdDate',
                'author'
            ]);
            if (!newWorkout.description) {
                newWorkout.description = 'Added by garmin-connect for Node.js';
            }
            return this.client.post<IWorkoutDetail>(
                this.url.WORKOUT(),
                newWorkout
            );
        }

        async addRunningWorkout(
            name: string,
            meters: number,
            description: string
        ): Promise<IWorkoutDetail> {
            const running = new Running();
            running.name = name;
            running.distance = meters;
            running.description = description;
            return this.addWorkout(running);
        }

        async deleteWorkout(workout: { workoutId: string }) {
            if (!workout.workoutId) throw new Error('Missing workout');
            return this.client.delete(this.url.WORKOUT(workout.workoutId));
        }

        async scheduleWorkout(
            workout: { workoutId: string },
            date = new Date()
        ): Promise<IScheduleWorkout> {
            if (!workout.workoutId) throw new Error('Missing workoutId');
            const formatedDate =
                DateTime.fromJSDate(date).toFormat('yyyy-MM-dd');
            return this.client.post<IScheduleWorkout>(
                `${this.url.SCHEDULE_WORKOUTS}${workout.workoutId}`,
                {
                    date: formatedDate
                }
            );
        }

        async getScheduledWorkouts(
            year = new Date().getFullYear(),
            month = new Date().getMonth() + 1
        ): Promise<ICalendar> {
            if (!Number.isInteger(year) || year < 2000) {
                throw new Error('year must be an integer greater than 1999');
            }
            if (!Number.isInteger(month) || month < 1 || month > 12) {
                throw new Error('month must be an integer between 1 and 12');
            }
            return this.client.get<ICalendar>(
                this.url.CALENDAR(year, month - 1)
            );
        }

        async getScheduledWorkoutById(
            scheduledWorkoutId: number | string
        ): Promise<IScheduleWorkout> {
            if (!scheduledWorkoutId) {
                throw new Error('Missing scheduledWorkoutId');
            }
            return this.client.get<IScheduleWorkout>(
                `${this.url.SCHEDULE_WORKOUTS}${scheduledWorkoutId}`
            );
        }

        async unscheduleWorkout(scheduledWorkoutId: number | string) {
            if (!scheduledWorkoutId) {
                throw new Error('Missing scheduledWorkoutId');
            }
            return this.client.delete(
                `${this.url.SCHEDULE_WORKOUTS}${scheduledWorkoutId}`
            );
        }

        async getTrainingPlans(): Promise<TrainingPlansResponse> {
            return this.client.get<TrainingPlansResponse>(
                this.url.TRAINING_PLANS
            );
        }

        async getTrainingPlanById(
            planId: number | string
        ): Promise<TrainingPlanDetail> {
            if (!planId) throw new Error('Missing planId');
            return this.client.get<TrainingPlanDetail>(
                this.url.TRAINING_PLAN(planId)
            );
        }

        async getAdaptiveTrainingPlanById(
            planId: number | string
        ): Promise<TrainingPlanDetail> {
            if (!planId) throw new Error('Missing planId');
            return this.client.get<TrainingPlanDetail>(
                this.url.ADAPTIVE_TRAINING_PLAN(planId)
            );
        }
    };
}
