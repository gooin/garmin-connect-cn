// 身体电量（Body Battery）类型定义

// 单日身体电量数据
export interface BodyBatteryDailyEntry {
    calendarDate: string;
    values: {
        lowBodyBattery: number;
        highBodyBattery: number;
    };
}
