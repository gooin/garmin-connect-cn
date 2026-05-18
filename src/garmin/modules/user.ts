import { IUserSettings, PersonalRecord, PersonalRecordType } from '../types';
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

        /** 获取 PR 类型定义（用于 typeId 映射） */
        async getPersonalRecordTypes(): Promise<PersonalRecordType[]> {
            const displayName = await this.getDisplayName();
            return this.client.get<PersonalRecordType[]>(
                this.url.PERSONAL_RECORD_TYPES(displayName)
            );
        }

        /** 获取实际 PR 记录（含成绩值和达成日期） */
        async getPersonalRecords(): Promise<PersonalRecord[]> {
            const displayName = await this.getDisplayName();
            return this.client.get<PersonalRecord[]>(
                this.url.PERSONAL_RECORDS(displayName)
            );
        }

        async getDisplayName(): Promise<string> {
            const profile = await this.getUserProfile();
            if (!profile.displayName) {
                throw new Error('Could not retrieve display name.');
            }
            return profile.displayName;
        }
    };
}
