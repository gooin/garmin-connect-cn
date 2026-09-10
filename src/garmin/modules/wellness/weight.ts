import FormData from 'form-data';
import { createReadStream, promises as fs } from 'node:fs';
import { toGarminDateString, getLocalTimestamp } from '../../common/DateUtils';
import { gramsToPounds } from '../../common/WeightUtils';
import {
    DateWeight,
    FitbitCsvUploadResponse,
    UpdateWeight,
    WeightData,
    WeightRangeData
} from '../../types/weight';
import { ModuleConstructor } from '../types';

const formatFitbitChineseDate = (dateString: string): string => {
    const [year, month, day] = dateString.split('-');
    return `${Number(year)}年${Number(month)}月${Number(day)}日`;
};

const formatFitbitNumber = (value: number | null | undefined): string => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return '';
    }
    return value.toFixed(1);
};

const escapeCsvValue = (value: string): string => {
    return `"${value.replace(/"/g, '""')}"`;
};

const buildFitbitWeightCsvRow = (weight: DateWeight): string => {
    const values = [
        formatFitbitChineseDate(weight.calendarDate),
        formatFitbitNumber(weight.weight / 1000),
        formatFitbitNumber(weight.bmi),
        formatFitbitNumber(weight.bodyFat)
    ];
    return values.map(escapeCsvValue).join(',');
};

/**
 * 展开范围内的全部称重记录。
 * 体重秤用户一天可能称多次，只有 allWeightMetrics 含当天全部记录；
 * 只看 latestWeight 会把当天其余称重丢掉。
 */
export function collectWeightEntries(
    weightData: WeightRangeData
): DateWeight[] {
    const entries: DateWeight[] = [];
    for (const summary of weightData.dailyWeightSummaries ?? []) {
        const metrics = summary.allWeightMetrics?.length
            ? summary.allWeightMetrics
            : summary.latestWeight
            ? [summary.latestWeight]
            : [];
        entries.push(...metrics);
    }
    return entries;
}

/**
 * 生成 Fitbit 体重 CSV。
 * 只导出 weight/bmi/bodyFat 齐全的记录：Garmin 导入对体脂为空的行走不通，
 * 手动录入且未填体脂的记录需要改用 updateWeight() 逐条补写。
 */
export function buildFitbitWeightCsvFromEntries(entries: DateWeight[]): string {
    const rows = entries
        .filter(
            (weight): weight is DateWeight =>
                Boolean(weight) &&
                typeof weight.weight === 'number' &&
                typeof weight.bmi === 'number' &&
                typeof weight.bodyFat === 'number'
        )
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))
        .map(buildFitbitWeightCsvRow);

    return ['身体', '日期,体重,身体质量指数 BMI,脂肪', ...rows].join('\n');
}

export function applyWeightModule(Base: ModuleConstructor) {
    return class WeightModule extends Base {
        async getDailyWeightData(date = new Date()): Promise<WeightData> {
            try {
                const dateString = toGarminDateString(date);
                const weightData = await this.client.get<WeightData>(
                    `${this.url.DAILY_WEIGHT}/${dateString}`
                );

                if (!weightData) {
                    throw new Error('Invalid or empty weight data response.');
                }

                return weightData;
            } catch (error: any) {
                throw new Error(
                    `Error in getDailyWeightData: ${error.message}`
                );
            }
        }

        async getDailyWeightInPounds(date = new Date()): Promise<number> {
            const weightData = await this.getDailyWeightData(date);

            if (
                weightData.totalAverage &&
                typeof weightData.totalAverage.weight === 'number'
            ) {
                return gramsToPounds(weightData.totalAverage.weight);
            } else {
                throw new Error("Can't find valid daily weight for this date.");
            }
        }

        async getWeightRange(
            startDate: Date | string,
            endDate: Date | string,
            includeAll = true
        ): Promise<WeightRangeData> {
            try {
                const startDateString = toGarminDateString(startDate);
                const endDateString = toGarminDateString(endDate);
                const weightData = await this.client.get<WeightRangeData>(
                    this.url.WEIGHT_RANGE(startDateString, endDateString),
                    {
                        params: {
                            includeAll
                        }
                    }
                );

                if (!weightData) {
                    throw new Error('Invalid or empty weight range response.');
                }

                return weightData;
            } catch (error: any) {
                throw new Error(`Error in getWeightRange: ${error.message}`);
            }
        }

        buildFitbitWeightCsv(weightData: WeightRangeData): string {
            return buildFitbitWeightCsvFromEntries(
                collectWeightEntries(weightData)
            );
        }

        async getFitbitWeightCsv(
            startDate: Date | string,
            endDate: Date | string,
            includeAll = true
        ): Promise<string> {
            const weightData = await this.getWeightRange(
                startDate,
                endDate,
                includeAll
            );
            return this.buildFitbitWeightCsv(weightData);
        }

        async downloadFitbitWeightCsv(
            startDate: Date | string,
            endDate: Date | string,
            file: string,
            includeAll = true
        ): Promise<void> {
            const csv = await this.getFitbitWeightCsv(
                startDate,
                endDate,
                includeAll
            );
            const { writeToFile } = await import('../../../utils');
            await writeToFile(file, csv);
        }

        async getUploadFeature(feature = 'UPLOAD'): Promise<unknown> {
            try {
                return this.client.get<unknown>(
                    this.url.UPLOAD_FEATURE(feature),
                    {
                        params: {
                            _: Date.now()
                        }
                    }
                );
            } catch (error: any) {
                throw new Error(`Error in getUploadFeature: ${error.message}`);
            }
        }

        async uploadFitbitWeightCsv(
            file: string
        ): Promise<FitbitCsvUploadResponse> {
            let fileBuffer: ReturnType<typeof createReadStream> | null = null;
            try {
                await fs.stat(file);
                await this.client.checkTokenVaild();
                fileBuffer = createReadStream(file);
                const form = new FormData();
                form.append('file', fileBuffer);
                const headers = form.getHeaders();
                const response =
                    await this.client.post<FitbitCsvUploadResponse>(
                        this.url.UPLOAD_FITBIT_CSV,
                        form,
                        {
                            headers: {
                                ...headers,
                                Dateformat: 'YEAR_CHINESE',
                                Decimalseparator: '.',
                                Language: 'ZH_CN',
                                Length: 'KM',
                                Weight: 'KGS',
                                Origin: `https://connect.${this.domain}`,
                                'X-Requested-With': 'XMLHttpRequest'
                            }
                        }
                    );

                return response;
            } catch (error: any) {
                throw new Error(
                    `Error in uploadFitbitWeightCsv: ${error.message}`
                );
            } finally {
                fileBuffer?.close();
            }
        }

        async getFitbitWeightUploadStatus(
            owner: number,
            date: Date | string,
            uploadUuid: string
        ): Promise<FitbitCsvUploadResponse> {
            try {
                const dateString = toGarminDateString(date);
                const normalizedUploadUuid = uploadUuid.replace(/-/g, '');
                return this.client.get<FitbitCsvUploadResponse>(
                    this.url.WELLNESS_UPLOAD_STATUS(
                        owner,
                        dateString,
                        normalizedUploadUuid
                    )
                );
            } catch (error: any) {
                throw new Error(
                    `Error in getFitbitWeightUploadStatus: ${error.message}`
                );
            }
        }

        async updateWeight(
            date = new Date(),
            lbs: number,
            timezone: string
        ): Promise<UpdateWeight> {
            try {
                const weightData = await this.client.post<UpdateWeight>(
                    `${this.url.UPDATE_WEIGHT}`,
                    {
                        dateTimestamp: getLocalTimestamp(date, timezone),
                        gmtTimestamp: date.toISOString().substring(0, 23),
                        unitKey: 'lbs',
                        value: lbs
                    }
                );

                return weightData;
            } catch (error: any) {
                throw new Error(`Error in updateWeight: ${error.message}`);
            }
        }
    };
}
