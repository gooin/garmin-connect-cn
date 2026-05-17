import _ from 'lodash';
import { DateTime } from 'luxon';
import { IScheduleWorkout, IWorkout, IWorkoutDetail } from '../types';
import Running from '../workouts/Running';
import { ModuleConstructor } from './types';

export function applyWorkoutModule(Base: ModuleConstructor) {
    return class WorkoutModule extends Base {
        async getWorkouts(start: number, limit: number): Promise<IWorkout[]> {
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
            workout: IWorkoutDetail | Running
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
    };
}
