import FormData from 'form-data';
import _ from 'lodash';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { checkIsDirectory, createDirectory, writeToFile } from '../../utils';
import { GCCourseId } from '../types';
import { ICourse, ICourseDetail, ICoursesForUser } from '../types/course';
import { ModuleConstructor } from './types';

export function applyCourseModule(Base: ModuleConstructor) {
    return class CourseModule extends Base {
        async getCourses(): Promise<ICourse[]> {
            try {
                const coursesForUser = await this.client.get<ICoursesForUser>(
                    `${this.url.COURSE_OWNER}`
                );
                const courses_favorite = await this.client.get<ICourse[]>(
                    `${this.url.COURSE_FAVORITE}`
                );
                const course = [
                    ...coursesForUser.coursesForUser,
                    ...courses_favorite
                ];
                const uniqCourse = _.uniqBy(course, 'courseId');
                return uniqCourse;
            } catch (error: any) {
                throw new Error(`Error in getCourses: ${error.message}`);
            }
        }

        async getCourse(course: {
            courseId: GCCourseId;
        }): Promise<ICourseDetail> {
            try {
                if (!course.courseId) {
                    throw new Error('Missing courseId');
                }

                const courseDetail = await this.client.get<ICourseDetail>(
                    `${this.url.COURSE(course.courseId)}`
                );
                return courseDetail;
            } catch (error: any) {
                throw new Error(`Error in getCourse: ${error.message}`);
            }
        }

        async downloadCourseFit(
            course: { courseId: GCCourseId },
            dir: string,
            elevation = true
        ): Promise<void> {
            try {
                if (!course.courseId) {
                    throw new Error('Missing courseId');
                }
                const isDir = await checkIsDirectory(dir);
                if (!isDir) {
                    await createDirectory(dir);
                }
                const fileBuffer = await this.client.get<Buffer>(
                    this.url.COURSE_FIT(course.courseId, elevation),
                    {
                        responseType: 'arraybuffer'
                    }
                );
                await writeToFile(
                    path.join(dir, `${course.courseId}.fit`),
                    fileBuffer
                );
            } catch (error: any) {
                throw new Error(`Error in downloadCourseFit: ${error.message}`);
            }
        }

        async downloadCourseGpx(
            course: { courseId: GCCourseId },
            dir: string
        ): Promise<void> {
            try {
                if (!course.courseId) {
                    throw new Error('Missing courseId');
                }
                const isDir = await checkIsDirectory(dir);
                if (!isDir) {
                    await createDirectory(dir);
                }
                const fileBuffer = await this.client.get<Buffer>(
                    this.url.COURSE_GPX(course.courseId),
                    {
                        responseType: 'arraybuffer'
                    }
                );
                await writeToFile(
                    path.join(dir, `${course.courseId}.gpx`),
                    fileBuffer
                );
            } catch (error: any) {
                throw new Error(`Error in downloadCourseGpx: ${error.message}`);
            }
        }

        async importCourse(file: string): Promise<unknown> {
            let fileBuffer: ReturnType<typeof createReadStream> | null = null;
            try {
                await fs.stat(file);
                await this.client.checkTokenVaild();
                fileBuffer = createReadStream(file);
                const form = new FormData();
                form.append('file', fileBuffer);
                const response = await this.client.post(
                    this.url.COURSE_IMPORT,
                    form,
                    {
                        headers: {
                            'Content-Type': form.getHeaders()['content-type']
                        }
                    }
                );
                return response;
            } catch (error: any) {
                throw new Error(`Error in importCourse: ${error.message}`);
            } finally {
                fileBuffer?.close();
            }
        }

        async confirmCourseImport(course: unknown): Promise<ICourseDetail> {
            try {
                if (!course || typeof course !== 'object') {
                    throw new Error('Missing course import data');
                }
                const courseData = course as Record<string, unknown>;
                const geoPoints = Array.isArray(courseData.geoPoints)
                    ? courseData.geoPoints
                    : [];
                const firstGeoPoint =
                    geoPoints.length > 0 &&
                    typeof geoPoints[0] === 'object' &&
                    geoPoints[0] !== null
                        ? (geoPoints[0] as Record<string, unknown>)
                        : {};
                const payload = {
                    ...courseData,
                    activityTypePk: courseData.activityTypePk ?? 6,
                    rulePK: courseData.rulePK ?? 2,
                    sourceTypeId: courseData.sourceTypeId ?? 3,
                    coursePoints: courseData.coursePoints ?? [],
                    startPoint: courseData.startPoint ?? {
                        latitude: firstGeoPoint.latitude,
                        longitude: firstGeoPoint.longitude,
                        elevation: firstGeoPoint.elevation ?? null,
                        distance: firstGeoPoint.distance ?? null,
                        timestamp: firstGeoPoint.timestamp ?? null
                    },
                    favorite: courseData.favorite ?? false,
                    hasPaceBand: courseData.hasPaceBand ?? false,
                    hasPowerGuide: courseData.hasPowerGuide ?? false,
                    hasTurnDetectionDisabled:
                        courseData.hasTurnDetectionDisabled ?? false,
                    includeLaps: courseData.includeLaps ?? false,
                    matchedToSegments: courseData.matchedToSegments ?? false,
                    openStreetMap: courseData.openStreetMap ?? false,
                    elapsedSeconds: courseData.elapsedSeconds ?? null
                };
                const createdCourse = await this.client.post<ICourseDetail>(
                    `${this.url.COURSE()}`,
                    payload
                );
                return createdCourse;
            } catch (error: any) {
                throw new Error(
                    `Error in confirmCourseImport: ${error.message}`
                );
            }
        }

        async deleteCourse(course: { courseId: GCCourseId }): Promise<void> {
            try {
                if (!course.courseId) {
                    throw new Error('Missing courseId');
                }
                await this.client.client.delete<void>(
                    `${this.url.COURSE(course.courseId)}`
                );
            } catch (error: any) {
                throw new Error(`Error in deleteCourse: ${error.message}`);
            }
        }

        async createCourse(course: ICourseDetail): Promise<ICourseDetail> {
            try {
                const createdCourse = await this.client.post<ICourseDetail>(
                    `${this.url.COURSE()}`,
                    _.omit(course, [
                        'courseId',
                        'matchedToSegments',
                        'userProfilePk',
                        'userGroupPk',
                        'firstName',
                        'lastName',
                        'displayName',
                        'geoRoutePk',
                        'sourcePk',
                        'hasShareableEvent',
                        'virtualPartnerId',
                        'includeLaps',
                        'speedMeterPerSecond',
                        'createDate',
                        'updateDate',
                        'targetCoordinateSystem',
                        'originalCoordinateSystem',
                        'consumer',
                        'elevationSource',
                        'hasPaceBand',
                        'hasPowerGuide',
                        'favorite',
                        'curatedCoursePk'
                    ])
                );
                return createdCourse;
            } catch (error: any) {
                throw new Error(`Error in createCourse: ${error.message}`);
            }
        }
    };
}
