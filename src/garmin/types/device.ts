export interface PrimaryTrainingDeviceResponse {
    PrimaryTrainingDevice?: {
        deviceId?: number;
    };
    PrimaryTrainingDevices?: {
        deviceWeights?: DeviceWeight[];
        primaryTrainingDeviceCount?: number;
    };
    WearableDevices?: {
        deviceWeights?: DeviceWeight[];
        wearableDeviceCount?: number;
    };
    TrainingStatusOnlyDevices?: {
        deviceWeights?: DeviceWeight[];
    };
    RegisteredDevices?: unknown[];
}

export interface DeviceWeight {
    displayName?: string;
    deviceId?: number;
    imageUrl?: string;
    weight?: number;
    primaryTrainingCapable?: boolean;
    lhaBackupCapable?: boolean;
    primaryWearableDevice?: boolean;
}

export interface PrimaryWearableDevice {
    primaryWearableDevice: boolean;
    displayName: string;
    deviceId: number;
    imageUrl: string;
}
