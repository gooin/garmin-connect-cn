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
| `coach.ts`                    | AI 教练聚合   | `getCurrentSportsAbility`, `getWellnessSummary`                                                                                                                                                                                       |

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
  → TrainingStatus → Device → Workout → Course → Misc → Coach
```

### 公共 API

原模块化拆分阶段公共 API 完全不变。2026-05-18 新增 AI 教练聚合接口后，旧方法签名、返回值、参数仍保持兼容，同时新增以下两个面向 MCP/AI 分析场景的聚合方法：

-   `getCurrentSportsAbility(type, options)`：`type` 支持 `running`、`cycling`、`all`
-   `getWellnessSummary(options)`：返回当天恢复状态和最近一段时间的健康趋势

### 依赖关系

-   `getUserProfile` 被提升至基类 `GarminConnectBase`，因为被多个模块依赖（训练状态、跑步预测、个人资料、饮水记录）
-   跨模块调用（如 `getSleepDuration` 调用 `getSleepData`）通过 mixin 链保证可用

## 2026-05-18 AI Coach 聚合接口补充

### 变更背景

为了给后续 MCP 服务和 AI 教练分析提供更稳定的输入，本次新增聚合层，把 Garmin 原始接口的大响应压缩为训练建议更关心的关键指标。聚合接口在发起多个请求前会先调用 `client.checkTokenVaild()`，确保 token 过期时先刷新；随后使用 `Promise.all` 并行请求各原子接口，减少整体等待时间。

### 涉及模块

| 文件                                 | 变化                                                                                       |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `src/garmin/modules/coach.ts`        | 新增 AI 教练聚合模块，组合运动能力、训练概览和每日恢复数据                                 |
| `src/garmin/types/coach.ts`          | 新增聚合接口入参、返回值类型，包含 `training_overview_v1` 和 `wellness_overview_v1` schema |
| `src/garmin/modules/wellness/hrv.ts` | 新增 `getHRVDailySummary(startDate, endDate)`，并兼容 Garmin 返回对象或数组两种形态        |
| `src/garmin/types/hrv.ts`            | 新增 `HRVDailySummaryResponse`                                                             |
| `src/garmin/GarminConnect.ts`        | 将 `Coach` 模块接入 mixin 链                                                               |
| `test/ai-coach-summary.js`           | 新增 live 验证脚本，覆盖 `running`、`cycling`、`all` 和 wellness 聚合结构                  |
| `test/training-overview.js`          | 新增 live 验证脚本，覆盖 `training_overview_v1` 精简结构                                   |
| `test/wellness-overview.js`          | 新增 live 验证脚本，覆盖 `wellness_overview_v1` 精简结构和缺数据标记                       |

### 结构/接口变化

#### `getTrainingOverview(options)`

用于生成 AI Coach 和 MCP 优先消费的精简训练概览。该接口不再要求调用方区分 `running`、`cycling` 或 `all`，内部固定查询 Garmin 当前可用的跑步和骑行相关来源，并返回稳定 schema：

-   `schema: "training_overview_v1"`
-   `snapshotDate` 和 `rangeDays`
-   `source`：标记 provider、endpointType、包含的跑步/骑行，以及游泳暂不由该来源提供
-   `athlete`：年龄、性别、身高、体重、观察到的运动类型和多项倾向
-   `state`：训练状态、趋势、状态运动项、急性/慢性负荷、ACWR
-   `loadBalance`：低有氧、高有氧、无氧当前值和目标区间，并附带 `low`/`ok`/`high`
-   `sports.running`：跑步 VO2、阈值配速/心率、年度跑量、跑姿指标、比赛预测
-   `sports.cycling`：骑行 VO2、FTP/功体比、年度骑行量、功率/踏频、骑行能力
-   `multiSport`：运动项目覆盖、时长占比和主导运动
-   `trend90d`：近 90 天训练状态天数和负荷趋势
-   `dataCompleteness` 与 `aiHints`：给 AI 判断数据缺口和生成建议使用

默认行为：

-   `rangeDays` 默认 365 天
-   `trendDays` 默认 90 天
-   请求前先执行 `client.checkTokenVaild()`，随后并行请求各来源
-   Garmin 原始统计会做单位压缩，例如距离转 km、时长转小时、体重克转 kg、爬升转 m

#### `getCurrentSportsAbility(type, options)`

用于生成“用户当前综合运动能力”输入。`type` 可传：

-   `running`：返回用户基础体征、训练状态、跑步运动统计、比赛预测、乳酸阈值
-   `cycling`：返回用户基础体征、训练状态、骑行运动统计、FTP/功体比、骑行能力、功率曲线、骑行 VO2/MaxMet
-   `all`：同时返回 `running` 和 `cycling`

默认行为：

-   运动统计默认取最近 365 天
-   趋势类数据默认取最近 90 天
-   每个原子接口失败时记录到 `sourceErrors`，不让单个非关键接口阻断整个聚合结果

#### `getWellnessOverview(options)`

用于生成 AI Coach 和 MCP 优先消费的精简恢复概览。该接口复用 `getWellnessSummary()` 的取数结果，再压缩为稳定 schema：

-   `schema: "wellness_overview_v1"`
-   `snapshotDate` 和 `rangeDays`
-   `source`：标记 Garmin provider、已纳入指标和缺失指标
-   `availability`：逐项标记 `hrv`、`sleep`、`bodyBattery`、`restingHeartRate`、`respiration`、`spo2`、`skinTemp` 是否 `available`、`partial` 或 `no_data`
-   `today.hrv`：状态、昨夜均值、7 日均值、基线范围和读数数量
-   `today.sleep`：睡眠分数、质量、时长、需求、深睡/浅睡/REM/清醒、身体电量变化、静息心率、平均心率、睡眠压力、呼吸
-   `today.bodyBattery`：当天身体电量低点、高点和睡眠期间变化
-   `recent7d`：HRV 状态分布、睡眠均值/低分日、身体电量低高点趋势
-   `readiness` 与 `aiHints`：给 AI 判断训练建议强度和数据质量使用

默认行为：

-   `rangeDays` 默认 7 天
-   不完整用户不会抛错，缺失项保留为 `null` 并在 `availability`/`source.unavailableMetrics` 中标记
-   如只有身体电量而无 HRV/睡眠，接口仍返回完整结构，readiness confidence 会降为 `low`

#### `getWellnessSummary(options)`

用于生成“用户 Wellness 情况综合”输入。默认返回今天和最近 7 天：

-   当天 HRV 摘要和 HRV 读数数量
-   当天睡眠摘要、睡眠 HRV、身体电量变化、静息心率
-   近期 HRV 摘要列表
-   近期身体电量高低值
-   近期睡眠整体统计和每日睡眠指标

### 迁移或后续注意事项

1. MCP 服务应优先调用 `getTrainingOverview()` 和 `getWellnessOverview()`，避免直接消费多个 Garmin 原始大响应。
2. `sourceErrors` 需要透传给 AI 分析层，便于判断某些建议是否缺少数据支撑。
3. `getCurrentSportsAbility()` 仍保留较多原始来源细节，适合调试或检查源数据；生产 AI prompt 优先使用 `training_overview_v1`。
4. `getTrainingOverview()` 不返回 recovery、recentActivities、subjectiveFeedback 的实际数据，只在 `dataCompleteness` 标记为 `false`，后续需要再接入独立来源。
5. `.gitignore` 当前忽略整个 `test/` 目录，`test/ai-coach-summary.js`、`test/training-overview.js` 和 `test/wellness-overview.js` 是本地验证脚本；如需纳入版本管理，需要先调整忽略规则。

## 迁移/后续注意事项

1. **新增功能**：参照已有模块文件模式，创建新的 `modules/` 子文件，在 `GarminConnect.ts` 的 mixin 链中合适位置插入
2. **模块间依赖**：如需跨模块调用，确保被调用方法在链中先于调用者注册
3. **工具函数**：共享函数统一放在 `common/` 目录，模块专属辅助函数保留在模块文件内
4. **类型定义**：模块内部使用的 interface 需 `export` 以避免 TS4023 编译错误
