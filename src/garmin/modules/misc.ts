import { ICalendar } from '../types';
import { ModuleConstructor } from './types';

export interface GolfSummary {
    scorecardSummaries: unknown[];
}

export interface GolfScorecard {
    id: number;
}

export function applyMiscModule(Base: ModuleConstructor) {
    return class MiscModule extends Base {
        async getCalendar(
            year = new Date().getFullYear(),
            month = new Date().getMonth()
        ): Promise<ICalendar> {
            return this.client.get<ICalendar>(this.url.CALENDAR(year, month));
        }

        async getGolfSummary(): Promise<GolfSummary> {
            try {
                const golfSummary = await this.client.get<GolfSummary>(
                    `${this.url.GOLF_SCORECARD_SUMMARY}`
                );

                if (!golfSummary) {
                    throw new Error(
                        'Invalid or empty golf summary data response.'
                    );
                }

                return golfSummary;
            } catch (error: any) {
                throw new Error(`Error in getGolfSummary: ${error.message}`);
            }
        }

        async getGolfScorecard(scorecardId: number): Promise<GolfScorecard> {
            try {
                const golfScorecard = await this.client.get<GolfScorecard>(
                    `${this.url.GOLF_SCORECARD_DETAIL}`,
                    { params: { 'scorecard-ids': scorecardId } }
                );

                if (!golfScorecard) {
                    throw new Error(
                        'Invalid or empty golf scorecard data response.'
                    );
                }

                return golfScorecard;
            } catch (error: any) {
                throw new Error(`Error in getGolfScorecard: ${error.message}`);
            }
        }

        async consentGrant(): Promise<void> {
            try {
                const results = await Promise.all([
                    this.client
                        .post<void>(`${this.url.CONSENT_GRANT}`, {
                            consentTypeId: 'DI_CONNECT_UPLOAD',
                            consentLocale: 'en-US',
                            consentVersion: '59'
                        })
                        .catch((error) => {
                            console.warn(
                                'DI_CONNECT_UPLOAD 请求失败:',
                                error.message
                            );
                            return null;
                        }),
                    this.client
                        .post<void>(`${this.url.CONSENT_GRANT}`, {
                            consentTypeId: 'DI_CONNECT_CONNECT-PRIVACY',
                            consentLocale: 'zh-CN',
                            consentVersion: '18'
                        })
                        .catch((error) => {
                            console.warn(
                                'DI_CONNECT_CONNECT-PRIVACY 请求失败:',
                                error.message
                            );
                            return null;
                        }),
                    this.client
                        .post<void>(`${this.url.CONSENT_GRANT}`, {
                            consentTypeId: 'DI_CONNECT_GOLF-PRIVACY',
                            consentLocale: 'zh-CN',
                            consentVersion: '16'
                        })
                        .catch((error) => {
                            console.warn(
                                'DI_CONNECT_GOLF-PRIVACY 请求失败:',
                                error.message
                            );
                            return null;
                        }),
                    this.client
                        .put<void>(`${this.url.ACCOUNT_DEVICE_SYNC}`, {
                            key: 'account.deviceSync',
                            value: true
                        })
                        .catch((error) => {
                            console.warn(
                                'ACCOUNT_DEVICE_SYNC 请求失败:',
                                error.message
                            );
                            return null;
                        })
                ]);

                console.log('consentGrant 请求结果:', results);

                const successfulRequests = results.filter(
                    (result) => result !== null
                ).length;
                console.log(
                    `consentGrant: ${successfulRequests}/${results.length} 个请求成功`
                );
            } catch (error: any) {
                throw new Error(`Error in consenGrant: ${error.message}`);
            }
        }

        async get<T>(url: string, data?: any) {
            const response = await this.client.get(url, data);
            return response as T;
        }

        async post<T>(url: string, data: any) {
            const response = await this.client.post<T>(url, data, {});
            return response as T;
        }

        async put<T>(url: string, data: any) {
            const response = await this.client.put<T>(url, data, {});
            return response as T;
        }
    };
}
