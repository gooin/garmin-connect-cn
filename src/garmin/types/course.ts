export interface ICoursesForUser {
    coursesForUser: ICourse[];
}
export interface ICourse {
    courseId: number;
    userProfileId: number;
    displayName: string;
    userGroupId: any;
    geoRoutePk: any;
    activityType: CourseActivityType;
    courseName: string;
    courseDescription: any;
    createdDate: number;
    updatedDate: number;
    privacyRule: PrivacyRule;
    distanceInMeters: number;
    elevationGainInMeters: number;
    elevationLossInMeters: number;
    startLatitude: number;
    startLongitude: number;
    speedInMetersPerSecond: number;
    sourceTypeId: number;
    sourcePk: any;
    elapsedSeconds: any;
    coordinateSystem: string;
    originalCoordinateSystem: string;
    consumer?: string;
    elevationSource: number;
    hasShareableEvent: boolean;
    hasPaceBand: boolean;
    hasPowerGuide: boolean;
    favorite: boolean;
    hasTurnDetectionDisabled: boolean;
    curatedCourseId: any;
    createdDateFormatted: string;
    updatedDateFormatted: string;
    public: boolean;
    activityTypeId: CourseActivityType;
    applicationName?: string;
    companyName?: string;
    companyWebsite?: string;
    imageURL?: string;
}

export interface CourseActivityType {
    typeId: number;
    typeKey: string;
    parentTypeId: number;
    isHidden: boolean;
    restricted: boolean;
    trimmable: boolean;
}

export interface PrivacyRule {
    typeId: number;
    typeKey: string;
}

export interface ICourseDetail {
    courseId: number;
    courseName: string;
    description: string;
    openStreetMap: boolean;
    matchedToSegments: boolean;
    userProfilePk: number;
    userGroupPk: any;
    rulePK: number;
    firstName: string;
    lastName: any;
    displayName: string;
    geoRoutePk: number;
    sourceTypeId: number;
    sourcePk: any;
    distanceMeter: number;
    elevationGainMeter: number;
    elevationLossMeter: number;
    startPoint: StartPoint;
    geoPoints: GeoPoint[];
    coursePoints: any;
    boundingBox: BoundingBox;
    hasShareableEvent: boolean;
    hasTurnDetectionDisabled: boolean;
    activityTypePk: number;
    virtualPartnerId: number;
    includeLaps: boolean;
    elapsedSeconds: any;
    speedMeterPerSecond: any;
    createDate: string;
    updateDate: string;
    courseLines: CourseLine[];
    coordinateSystem: string;
    targetCoordinateSystem: string;
    originalCoordinateSystem: string;
    consumer: any;
    elevationSource: number;
    hasPaceBand: boolean;
    hasPowerGuide: boolean;
    favorite: boolean;
    curatedCoursePk: any;
}

export interface StartPoint {
    latitude: number;
    longitude: number;
    elevation: number;
    distance: any;
    timestamp: any;
}

export interface GeoPoint {
    latitude: number;
    longitude: number;
    elevation: number;
    distance: number;
    timestamp: number;
}

export interface BoundingBox {
    center: any;
    lowerLeft: LowerLeft;
    upperRight: UpperRight;
    lowerLeftLatIsSet: boolean;
    lowerLeftLongIsSet: boolean;
    upperRightLatIsSet: boolean;
    upperRightLongIsSet: boolean;
}

export interface LowerLeft {
    latitude: number;
    longitude: number;
}

export interface UpperRight {
    latitude: number;
    longitude: number;
}

export interface CourseLine {
    courseId: number;
    sortOrder: number;
    numberOfPoints: number;
    distanceInMeters: number;
    bearing: number;
    points: any;
    coordinateSystem: any;
    originalCoordinateSystem: any;
}
