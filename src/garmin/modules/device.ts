import {
    PrimaryTrainingDeviceResponse,
    PrimaryWearableDevice
} from '../types/device';
import { ModuleConstructor } from './types';

export function applyDeviceModule(Base: ModuleConstructor) {
    return class DeviceModule extends Base {
        async getPrimaryWearableDevice(): Promise<PrimaryWearableDevice | null> {
            try {
                const response =
                    await this.client.get<PrimaryTrainingDeviceResponse>(
                        this.url.PRIMARY_TRAINING_DEVICE
                    );
                const devices =
                    response.PrimaryTrainingDevices?.deviceWeights ?? [];
                const primaryWearableDevice = devices.find(
                    (device) => device.primaryWearableDevice
                );

                if (
                    !primaryWearableDevice?.displayName ||
                    !primaryWearableDevice.deviceId ||
                    !primaryWearableDevice.imageUrl
                ) {
                    return null;
                }

                return {
                    primaryWearableDevice:
                        primaryWearableDevice.primaryWearableDevice === true,
                    displayName: primaryWearableDevice.displayName,
                    deviceId: primaryWearableDevice.deviceId,
                    imageUrl: primaryWearableDevice.imageUrl
                };
            } catch (error: any) {
                throw new Error(
                    `Error in getPrimaryWearableDevice: ${error.message}`
                );
            }
        }
    };
}
