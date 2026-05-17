import { IUserSettings } from '../types';
import { PersonalInfoResponse } from '../types/personal-info';
import { ModuleConstructor } from './types';

export function applyUserModule(Base: ModuleConstructor) {
    return class UserModule extends Base {
        async getUserSettings(): Promise<IUserSettings> {
            return this.client.get<IUserSettings>(this.url.USER_SETTINGS);
        }

        async getPersonalInfo(): Promise<PersonalInfoResponse> {
            try {
                const profile = await this.getUserProfile();
                const displayName = profile.displayName;
                if (!displayName) {
                    throw new Error(
                        'Could not retrieve display name for personal info.'
                    );
                }

                const response = await this.client.get<PersonalInfoResponse>(
                    `${this.url.PERSONAL_INFO}/${displayName}`
                );
                return response;
            } catch (error: any) {
                throw new Error(`Error in getPersonalInfo: ${error.message}`);
            }
        }
    };
}
