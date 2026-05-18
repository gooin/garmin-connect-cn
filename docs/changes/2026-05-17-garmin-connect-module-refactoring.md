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
| `coach.ts`                    | AI 教练聚合   | `getTrainingOverview`, `getWellnessOverview`, `getActivitiesSummary`, `getActivityDetailSummary`                                                                                                                                      |

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

原模块化拆分阶段公共 API 完全不变。2026-05-18 新增 AI 教练聚合接口后，`Coach` 模块对外只保留以下面向 MCP/AI 分析场景的聚合方法：

-   `getTrainingOverview(options)`：返回 `training_overview_v1` 训练能力概览
-   `getWellnessOverview(options)`：返回 `wellness_overview_v1` 恢复状态概览
-   `getActivitiesSummary(options)`：返回 `activities_summary_v1` 精简活动列表
-   `getActivityDetailSummary(options | activityId)`：返回 `activity_detail_v1` 精简单次活动详情

### 依赖关系

-   `getUserProfile` 被提升至基类 `GarminConnectBase`，因为被多个模块依赖（训练状态、跑步预测、个人资料、饮水记录）
-   跨模块调用（如 `getSleepDuration` 调用 `getSleepData`）通过 mixin 链保证可用

## 2026-05-18 AI Coach 聚合接口补充

### 变更背景

为了给后续 MCP 服务和 AI 教练分析提供更稳定的输入，本次新增聚合层，把 Garmin 原始接口的大响应压缩为训练建议更关心的关键指标。聚合接口在发起多个请求前会先调用 `client.checkTokenVaild()`，确保 token 过期时先刷新；随后使用 `Promise.all` 并行请求各原子接口，减少整体等待时间。

### 涉及模块

| 文件                                           | 变化                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `src/garmin/modules/coach.ts`                  | 新增 AI 教练聚合模块，组合运动能力、训练概览、每日恢复数据和活动精简数据                               |
| `src/garmin/modules/coach/`                    | 拆分 AI 教练实现，主 `coach.ts` 只保留 mixin 包装和公开方法                                            |
| `src/garmin/modules/coach/activity-summary.ts` | 新增活动列表和单次活动详情的 AI 精简结构生成逻辑，输出 `activities_summary_v1` 与 `activity_detail_v1` |
| `src/garmin/types/coach.ts`                    | 新增聚合接口入参、返回值类型，包含 AI Coach 四个稳定 schema                                            |
| `src/garmin/modules/wellness/hrv.ts`           | 新增 `getHRVDailySummary(startDate, endDate)`，并兼容 Garmin 返回对象或数组两种形态                    |
| `src/garmin/types/hrv.ts`                      | 新增 `HRVDailySummaryResponse`                                                                         |
| `src/garmin/GarminConnect.ts`                  | 将 `Coach` 模块接入 mixin 链                                                                           |
| `test/coach-public-api.js`                     | 新增公开 API 验证脚本，确保只暴露 AI Coach 当前稳定聚合接口                                            |
| `test/ai-training-overview.js`                 | live 验证脚本，覆盖 `training_overview_v1` 精简结构                                                    |
| `test/ai-wellness-overview.js`                 | live 验证脚本，覆盖 `wellness_overview_v1` 精简结构和缺数据标记                                        |
| `test/ai-activities-summary.js`                | live 验证脚本，覆盖 `activities_summary_v1` 精简活动列表                                               |
| `test/ai-activity-detail-summary.js`           | live 验证脚本，覆盖 `activity_detail_v1` 精简单次活动详情                                              |

### 结构/接口变化

### MCP / AI Coach 调用分层

四个聚合接口按上下文粒度分层使用：

-   `activities_summary_v1`：保留最近训练发生了什么，低 token、高覆盖，适合作为默认近期训练上下文
-   `activity_detail_v1`：只在需要分析单次训练时加载，保留更细的训练影响、强度、跑姿、stamina、主观反馈和传感器指标
-   `training_overview_v1`：提供长期能力和负荷背景，用于判断训练水平、运动专项能力、负荷结构和 90 天趋势
-   `wellness_overview_v1`：提供恢复状态，用于判断当天训练建议的强度上限和风险提示

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

#### `getWellnessOverview(options)`

用于生成 AI Coach 和 MCP 优先消费的精简恢复概览。该接口内部查询 HRV、睡眠、身体电量等来源，再压缩为稳定 schema：

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

#### `getActivitiesSummary(options)`

用于把 Garmin 活动列表压缩为 AI Coach 可直接消费的近期训练摘要。该接口会移除活动列表中的用户、隐私、地图、媒体、原始 split 大对象等字段，仅保留训练建议常用指标：

-   `schema: "activities_summary_v1"`
-   `range`：请求上下文的开始、结束和天数
-   `summary`：活动数量、按运动类型汇总的次数/距离/时长/爬升/负荷、总负荷、总时长、高强度/低强度/其他训练次数
-   `activities`：每次活动的 id、日期时间、运动类型、名称、距离、时长、配速、心率、爬升、热量、训练效果、训练负荷、身体电量变化、跑姿、心率区间和 AI flags
-   `aiHints`：例如近期节奏跑、低负荷有氧、可继续查询详情等提示

默认行为：

-   `rangeDays` 默认 7 天
-   `start` 默认 0，`limit` 默认 20
-   请求前先执行 `client.checkTokenVaild()`
-   `activityType` 和 `subActivityType` 会透传给 Garmin 活动列表接口

#### `getActivityDetailSummary(options | activityId)`

用于把单次 Garmin 活动详情压缩为 AI Coach 深入分析结构。该接口会丢弃图表、轨迹、完整 split 明细、设备冗余元数据等大字段，仅保留：

-   `schema: "activity_detail_v1"`
-   活动 id、日期、运动类型、名称、地点
-   `summary`：距离、时长、移动时长、配速、GAP、心率、热量、爬升/下降、均温
-   `trainingImpact`：训练负荷、有氧/无氧训练效果、训练效果消息、身体电量变化、恢复心率
-   `intensity`：心率区间、moderate/vigorous minutes
-   `runForm`：步频、步幅、触地时间、左右平衡、垂直振幅、垂直比
-   `stamina`、`subjective`、`sensors`、`splits` 和 `aiHints`

默认行为：

-   支持 `getActivityDetailSummary({ activityId })` 或直接传入 `activityId`
-   请求前先执行 `client.checkTokenVaild()`
-   用户缺少跑姿、stamina 或主观反馈时，对应字段返回 `null`，不抛错

### 迁移或后续注意事项

1. MCP 服务应优先调用 AI Coach 聚合接口，避免直接消费多个 Garmin 原始大响应。
2. `getCurrentSportsAbility()` 和 `getWellnessSummary()` 不再作为公开方法保留；如需调试源数据，应直接调用底层 Garmin 原子接口。
3. `getTrainingOverview()` 不返回 recovery、recentActivities、subjectiveFeedback 的实际数据，只在 `dataCompleteness` 标记为 `false`，后续需要再接入独立来源。
4. `.gitignore` 当前忽略整个 `test/` 目录，AI Coach 相关 `test/ai-*.js` 和 `test/coach-public-api.js` 是本地验证脚本；如需纳入版本管理，需要先调整忽略规则。

## 迁移/后续注意事项

1. **新增功能**：参照已有模块文件模式，创建新的 `modules/` 子文件，在 `GarminConnect.ts` 的 mixin 链中合适位置插入
2. **模块间依赖**：如需跨模块调用，确保被调用方法在链中先于调用者注册
3. **工具函数**：共享函数统一放在 `common/` 目录，模块专属辅助函数保留在模块文件内
4. **类型定义**：模块内部使用的 interface 需 `export` 以避免 TS4023 编译错误
