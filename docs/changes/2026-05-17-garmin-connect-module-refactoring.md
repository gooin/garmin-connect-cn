# GarminConnect.ts 模块化拆分重构

## 变更背景

`src/garmin/GarminConnect.ts` 随功能持续增加已达 ~1600 行，难以维护和定位。按功能领域拆分为独立模块，每个模块只暴露一个 mixin 函数组合到主类中。

## 涉及模块

### 新增模块文件 `src/garmin/modules/`

| 模块文件                      | 类别          | 包含方法                                                                                                                                                                                                                              |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `user.ts`                     | 用户信息      | `getUserSettings`, `getPersonalInfo`                                                                                                                                                                                                  |
| `wellness/sleep.ts`           | 健康-睡眠     | `getSleepData`, `getSleepDuration`, `getSleepDailySummary`                                                                                                                                                                            |
| `wellness/hrv.ts`             | 健康-HRV      | `getHRVData`                                                                                                                                                                                                                          |
| `wellness/weight.ts`          | 健康-体重     | `getDailyWeightData`, `getDailyWeightInPounds`, `getWeightRange`, `buildFitbitWeightCsv`, `getFitbitWeightCsv`, `downloadFitbitWeightCsv`, `uploadFitbitWeightCsv`, `getFitbitWeightUploadStatus`, `updateWeight`, `getUploadFeature` |
| `wellness/hydration.ts`       | 健康-饮水     | `getDailyHydration`, `updateHydrationLogOunces`                                                                                                                                                                                       |
| `wellness/body-battery.ts`    | 健康-身体电量 | `getBodyBattery`                                                                                                                                                                                                                      |
| `wellness/heart-rate.ts`      | 健康-心率     | `getHeartRate`                                                                                                                                                                                                                        |
| `activity/base.ts`            | 运动-基础     | `getActivities`, `getActivity`, `countActivities`, `getActivityStats`, `downloadWellnessData`, `downloadOriginalActivityData`, `uploadActivity`, `deleteActivity`, `getSteps`                                                         |
| `activity/running.ts`         | 运动-跑步     | `getRacePredictionsMonthly`, `getLactateThresholdSpeedRange`, `getLactateThresholdHeartRateRange`, `getLatestLactateThreshold`, `getRunningLactateThreshold`                                                                          |
| `activity/cycling.ts`         | 运动-骑行     | `getLatestPowerToWeight`, `getPowerToWeightRange`, `getCyclingAbility`, `getPowerCurve`, `getMaxMet`                                                                                                                                  |
| `activity/training-status.ts` | 运动-训练状态 | `getTrainingStatus`, `getTrainingLoadBalance`, `getWeeklyTrainingStatus`                                                                                                                                                              |
| `device.ts`                   | 设备          | `getPrimaryWearableDevice`                                                                                                                                                                                                            |
| `workout.ts`                  | 训练计划      | `getWorkouts`, `getWorkoutDetail`, `addWorkout`, `addRunningWorkout`, `deleteWorkout`, `scheduleWorkout`                                                                                                                              |
| `course.ts`                   | 课程          | `getCourses`, `getCourse`, `downloadCourseFit`, `downloadCourseGpx`, `importCourse`, `confirmCourseImport`, `deleteCourse`, `createCourse`                                                                                            |
| `misc.ts`                     | 其他          | `getCalendar`, `getGolfSummary`, `getGolfScorecard`, `consentGrant`, `get`/`post`/`put`                                                                                                                                               |

### 修改的文件

| 文件                             | 变化                                                    |
| -------------------------------- | ------------------------------------------------------- |
| `src/garmin/GarminConnect.ts`    | ~1600 → ~156 行，只保留基类和 mixin 组合链              |
| `src/garmin/common/DateUtils.ts` | 新增 `toGarminDateString` 共享工具函数                  |
| `src/garmin/modules/types.ts`    | 新增 mixin 共享类型：`IModuleBase`, `ModuleConstructor` |

## 结构/接口变化

### 架构模式

使用 TypeScript **mixin 模式**：每个模块文件导出一个 `applyXxxModule(Base)` 函数，接收基类构造函数并返回扩展后的匿名类。GarminConnect.ts 中以链式方式组合：

```
GarminConnectBase
  → User → Sleep → HRV → Weight → Hydration → BodyBattery
  → HeartRate → ActivityBase → Running → Cycling
  → TrainingStatus → Device → Workout → Course → Misc
```

### 公共 API

**完全不变。** 所有方法签名、返回值、参数保持一致。对外调用方式无变化。

### 依赖关系

-   `getUserProfile` 被提升至基类 `GarminConnectBase`，因为被多个模块依赖（训练状态、跑步预测、个人资料、饮水记录）
-   跨模块调用（如 `getSleepDuration` 调用 `getSleepData`）通过 mixin 链保证可用

## 迁移/后续注意事项

1. **新增功能**：参照已有模块文件模式，创建新的 `modules/` 子文件，在 `GarminConnect.ts` 的 mixin 链中合适位置插入
2. **模块间依赖**：如需跨模块调用，确保被调用方法在链中先于调用者注册
3. **工具函数**：共享函数统一放在 `common/` 目录，模块专属辅助函数保留在模块文件内
4. **类型定义**：模块内部使用的 interface 需 `export` 以避免 TS4023 编译错误
