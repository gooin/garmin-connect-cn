export interface UserInfo {
    birthDate: string;
    genderType: string;
    email: string;
    locale: string;
    timeZone: string;
    age: number;
    countryCode: string;
}

export interface BiometricProfile {
    userId: number;
    height: number;
    weight: number;
    vo2Max: number;
    vo2MaxCycling: number | null;
    vo2MaxRowing: number | null;
    lactateThresholdHeartRate: number;
    activityClass: number;
    functionalThresholdPower: number | null;
    criticalSwimSpeed: number | null;
}

export interface PersonalInfoResponse {
    userInfo: UserInfo;
    biometricProfile: BiometricProfile;
    timeZone: string;
    locale: string;
    birthDate: string;
    gender: string;
}
