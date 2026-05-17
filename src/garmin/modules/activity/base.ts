import FormData from 'form-data';
import _ from 'lodash';
import { DateTime } from 'luxon';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { checkIsDirectory, createDirectory, writeToFile } from '../../../utils';
import { toDateString, toGarminDateString } from '../../common/DateUtils';
import {
    ExportFileTypeValue,
    ICountActivities,
    IDailyStepsType
} from '../../types';
import {
    ActivitySubType,
    ActivityType,
    GCActivityId,
    IActivity
} from '../../types/activity';
import {
    ActivityStatsEntry,
    ActivityStatsOptions
} from '../../types/activity-stats';
import { ModuleConstructor } from '../types';

const DEFAULT_ACTIVITY_STATS_METRICS = [
    'duration',
    'distance',
    'movingDuration',
    'splitSummaries.noOfSplits.CLIMB_ACTIVE',
    'splitSummaries.duration.CLIMB_ACTIVE',
    'splitSummaries.totalAscent.CLIMB_ACTIVE',
    'splitSummaries.maxElevationGain.CLIMB_ACTIVE',
    'splitSummaries.numClimbsAttempted.CLIMB_ACTIVE',
    'splitSummaries.numClimbsCompleted.CLIMB_ACTIVE',
    'splitSummaries.numClimbSends.CLIMB_ACTIVE',
    'splitSummaries.numFalls.CLIMB_ACTIVE',
    'calories',
    'elevationGain',
    'elevationLoss',
    'avgSpeed',
    'maxSpeed',
    'avgGradeAdjustedSpeed',
    'avgHr',
    'maxHr',
    'avgRunCadence',
    'maxRunCadence',
    'avgBikeCadence',
    'maxBikeCadence',
    'avgWheelchairCadence',
    'maxWheelchairCadence',
    'avgPower',
    'maxPower',
    'avgVerticalOscillation',
    'avgGroundContactTime',
    'avgStrideLength',
    'avgStress',
    'maxStress',
    'splitSummaries.duration.CLIMB_REST',
    'beginPackWeight',
    'steps'
];

export function applyActivityBaseModule(Base: ModuleConstructor) {
    return class ActivityBaseModule extends Base {
        async getActivities(
            start?: number,
            limit?: number,
            activityType?: ActivityType,
            subActivityType?: ActivitySubType
        ): Promise<IActivity[]> {
            return this.client.get<IActivity[]>(this.url.ACTIVITIES, {
                params: { start, limit, activityType, subActivityType }
            });
        }

        async getActivity(activity: {
            activityId: GCActivityId;
        }): Promise<IActivity> {
            if (!activity.activityId) throw new Error('Missing activityId');
            return this.client.get<IActivity>(
                this.url.ACTIVITY + activity.activityId
            );
        }

        async countActivities(): Promise<ICountActivities> {
            return this.client.get<ICountActivities>(this.url.STAT_ACTIVITIES, {
                params: {
                    aggregation: 'lifetime',
                    startDate: '1970-01-01',
                    endDate: DateTime.now().toFormat('yyyy-MM-dd'),
                    metric: 'duration'
                }
            });
        }

        async getActivityStats(
            options: ActivityStatsOptions
        ): Promise<ActivityStatsEntry[]> {
            try {
                const params = new URLSearchParams();
                params.append('aggregation', 'lifetime');
                params.append('groupByParentActivityType', 'false');
                params.append('groupByEventType', 'false');
                params.append(
                    'startDate',
                    toGarminDateString(options.startDate)
                );
                params.append('endDate', toGarminDateString(options.endDate));
                if (options.activityType) {
                    params.append('activityType', options.activityType);
                }
                for (const metric of options.metrics ??
                    DEFAULT_ACTIVITY_STATS_METRICS) {
                    params.append('metric', metric);
                }
                params.append('standardizedUnits', 'false');

                return this.client.get<ActivityStatsEntry[]>(
                    this.url.STAT_ACTIVITIES,
                    {
                        params
                    }
                );
            } catch (error: any) {
                throw new Error(`Error in getActivityStats: ${error.message}`);
            }
        }

        async downloadWellnessData(date: Date, dir: string) {
            const dateStr = toDateString(date);
            const isDir = await checkIsDirectory(dir);
            if (!isDir) {
                await createDirectory(dir);
            }
            let fileBuffer = await this.client.get<Buffer>(
                this.url.DOWNLOAD_WELLNESS + dateStr,
                {
                    responseType: 'arraybuffer'
                }
            );
            await writeToFile(path.join(dir, `${dateStr}.zip`), fileBuffer);
        }

        async downloadOriginalActivityData(
            activity: { activityId: GCActivityId },
            dir: string,
            type: ExportFileTypeValue = 'zip'
        ): Promise<void> {
            if (!activity.activityId) throw new Error('Missing activityId');
            const isDir = await checkIsDirectory(dir);
            if (!isDir) {
                await createDirectory(dir);
            }
            let fileBuffer: Buffer;
            if (type === 'tcx') {
                fileBuffer = await this.client.get(
                    this.url.DOWNLOAD_TCX + activity.activityId
                );
            } else if (type === 'gpx') {
                fileBuffer = await this.client.get(
                    this.url.DOWNLOAD_GPX + activity.activityId
                );
            } else if (type === 'kml') {
                fileBuffer = await this.client.get(
                    this.url.DOWNLOAD_KML + activity.activityId
                );
            } else if (type === 'zip') {
                fileBuffer = await this.client.get<Buffer>(
                    this.url.DOWNLOAD_ZIP + activity.activityId,
                    {
                        responseType: 'arraybuffer'
                    }
                );
            } else {
                throw new Error(
                    'downloadOriginalActivityData - Invalid type: ' + type
                );
            }
            await writeToFile(
                path.join(dir, `${activity.activityId}.${type}`),
                fileBuffer
            );
        }

        async uploadActivity(
            file: string,
            format: 'tcx' | 'gpx' | 'fit' = 'fit'
        ) {
            const UploadFileType = { tcx: 'tcx', gpx: 'gpx', fit: 'fit' };
            const detectedFormat = (
                format || path.extname(file)
            )?.toLowerCase();
            if (!_.includes(UploadFileType, detectedFormat)) {
                throw new Error('uploadActivity - Invalid format: ' + format);
            }

            const fileBuffer = createReadStream(file);
            const form = new FormData();
            form.append('userfile', fileBuffer);
            const response = await this.client.post(
                this.url.UPLOAD + '.' + format,
                form,
                {
                    headers: {
                        'Content-Type': form.getHeaders()['content-type']
                    }
                }
            );
            fileBuffer.close();
            return response;
        }

        async deleteActivity(activity: {
            activityId: GCActivityId;
        }): Promise<void> {
            if (!activity.activityId) throw new Error('Missing activityId');
            await this.client.delete<void>(
                this.url.ACTIVITY + activity.activityId
            );
        }

        async getSteps(date = new Date()): Promise<number> {
            const dateString = toDateString(date);

            const days = await this.client.get<IDailyStepsType[]>(
                `${this.url.DAILY_STEPS}${dateString}/${dateString}`
            );
            const dayStats = days.find(
                ({ calendarDate }) => calendarDate === dateString
            );

            if (!dayStats) {
                throw new Error("Can't find daily steps for this date.");
            }

            return dayStats.totalSteps;
        }
    };
}
