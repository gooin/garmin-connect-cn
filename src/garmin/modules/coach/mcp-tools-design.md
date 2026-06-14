# AI Coach MCP Tools Design Document

该文档旨在总结 `garmin-connect` 中 `coach` 模块提供的核心功能，为后续 AI 代理生成和封装 MCP 工具提供接口说明、场景建议及输入输出规范。

## 1. 长期训练总览 (Training Overview)

**模块**: `training-overview`
**描述**: 获取用户的长期训练状态、训练能力、基本生理信息（身高、体重、性别、年龄）、VO2Max 及个人记录（PR）等。
**使用场景**:

-   首次接触用户时了解其整体画像与运动水平。
-   制定中长期训练计划前的基线评估。
-   分析过去 90 天到 1 年的训练负荷趋势（Acute/Chronic Load）、负荷平衡及运动能力的整体走向。

**输入 (TrainingOverviewOptions)**:

-   `recentDays` (number, 选填): 近期总览的时间跨度，默认 `365`。
-   `rangeDays` (number, 选填): 覆盖天数（等同于 recentDays）。
-   `trendDays` (number, 选填): 趋势数据的天数，默认 `90`。
-   `startDate` / `endDate` (string, 选填): 自定义起止时间。

**输出 (TrainingOverview)**:

-   `athlete`: 用户的生理与画像信息（年龄、性别、身高体重、参与的运动项目）。
-   `state`: 当前训练状态（Training Status）、中文状态、Garmin 原始反馈编码、趋势、短期/长期负荷（Acute/Chronic Load）与急慢性负荷比（ACWR）。
-   `loadBalance`: 有氧低强度、有氧高强度、无氧的负荷分布。
-   `sports`: 跑步和骑行的专属指标（包含 VO2Max、阈值配速/心率、FTP、年累计跑量/骑量、成绩预测、跑步动态数据）。
-   `personalRecords`: 个人最佳成绩记录（如 5k、10k、最远距离等）。
-   `trend90d`: 过去 90 天状态和负荷的趋势数据。
-   `aiHints`: 根据当前状态生成的 AI 提示短语。

---

## 2. 近期生理状态概览 (Wellness Overview)

**模块**: `wellness-overview`
**描述**: 获取用户最近的生理状态摘要，包含睡眠详情、HRV（心率变异性）、身体电量及静息心率等。
**使用场景**:

-   日常打卡及每日状态追踪。
-   决定“今天该练什么”，辅助 AI 精准分析当天的身体疲劳程度和恢复情况。
-   如果用户感觉疲惫，排查是否与近期睡眠或高压力有关。

**输入 (WellnessOverviewOptions)**:

-   `recentDays` / `rangeDays` (number, 选填): 分析最近的天数，默认 `7`。
-   `startDate` / `endDate` (string, 选填): 自定义起止时间。

**输出 (WellnessOverview)**:

-   `today`: 当天具体的生理数据（HRV 状态、睡眠评分及各阶段时长、身体电量消耗及恢复）。
-   `recent7d`: 过去 7 天的核心指标趋势（HRV 均值趋势、睡眠平均分/时长、身体电量高低点均值等）。
-   `readiness`: 综合计算得到的当天“训练准备度”状态和置信度，附带正向与警告信号（Positive/Caution Signals）。
-   `aiHints`: 针对当前疲劳度或恢复情况生成的 AI 提示短语。

---

## 3. 生理指标汇总 (Wellness Summary)

**模块**: `wellness-summary`
**描述**: 获取一段时间内睡眠、HRV、身体电量的原始明细数据结构，为自定义统计提供数据源。
**使用场景**:

-   需要绘制近期生理状态折线图、或需进行复杂自定义分析（不依赖 Overview 的概括计算）时的底层数据获取。

**输入 (WellnessSummaryOptions)**:

-   `recentDays` (number, 选填): 查询天数，默认 `7`。
-   `startDate` / `endDate` (string, 选填): 自定义时间范围。

**输出 (WellnessSummary)**:

-   `range`: 数据的起止时间范围。
-   `today`: 包含今天的 HRV 摘要和睡眠对象结构。
-   `recent`: 包含明细数组，如 `hrv` 列表、`bodyBattery` 列表及 `sleep.daily` 每日睡眠记录。

---

## 4. 运动记录列表 (Activities Summary)

**模块**: `activity-summary` (`buildActivitiesSummary`)
**描述**: 获取用户的历史活动列表及整体概览，支持按照运动类型、日期范围、距离及名称进行过滤检索。
**使用场景**:

-   查看用户最近执行了哪些运动。
-   查询特定类型的运动（例如：搜寻最近的长距离跑、间歇跑、或者超过 10km 的活动）。
-   统计近期运动的累计总负荷、总时长和不同强度（Hard/Easy）的课表占比。

**输入 (ActivitiesSummaryOptions)**:

-   `start` (number, 选填): 分页起点。
-   `limit` (number, 选填): 获取的最大条数，默认 `20`。
-   `activityType` (string, 选填): 主运动类型（如 running, cycling）。
-   `subActivityType` (string, 选填): 子运动类型。
-   `minDistance` / `maxDistance` (number, 选填): 筛选距离范围（单位为米，参考值：全马为 `41000` 到 `43500`）。
-   `startDate` / `endDate` (string, 选填): 筛选日期范围（格式通常为 `YYYY-MM-DD`）。
-   `search` (string, 选填): 根据活动名称的关键字检索。

**输出 (ActivitiesSummary)**:

-   `summary`: 该批次记录的整体统计（活动总数、按运动分类的时长/距离/负荷汇总、Hard/Easy 课表数量）。
-   `activities`: `CompactActivity` 列表。每条记录包含 ID、时间、距离、配速、平均心率、心率区间、训练负荷（Load）、训练效果（TE），并包含计算得出的特性 `flags`（如 `tempo_run`, `quality_session` 等）及关联的 `workout` 结构。
-   `aiHints`: 针对活动列表整体的特征提示。

---

## 5. 单次运动详情 (Activity Detail Summary)

**模块**: `activity-summary` (`buildActivityDetailSummary`)
**描述**: 查看并深度分析某一条指定运动记录的详情。
**使用场景**:

-   专项复盘某条运动记录，了解其训练表现是否达标。
-   对比“计划课表（Workout）”与“实际执行（Laps）”的偏差。
-   深入分析某次训练的跑步动态（步频、垂直振幅、触地时间）、心率变化、及走跑分布。

**输入 (ActivityDetailSummaryOptions)**:

-   `activityId` (number, 必填): 需要查询详情的单次活动 ID。

**输出 (ActivityDetailSummary)**:

-   `id`, `name`, `sport`, `date`: 基础信息。
-   `summary`: 核心指标汇总（总距离、总时长、移动时长、配速、坡度调整配速、平均/最大心率、卡路里、总爬升等）。
-   `trainingImpact`: 训练影响（有氧/无氧 TE 及文字描述、负荷 Load、活动对身体电量的消耗、恢复心率等）。
-   `intensity`: 中等与高强度活动分钟数。
-   `runForm`: 跑步动态数据（步频、步幅、触地时间、垂直振幅、垂直步幅比等）。
-   `laps`: 每圈/分段的实际数据表现，以结构化元组数组提供（包含 schema 定义和数据项）。
-   `workout`: 如果这是一次结构化课表训练，返回原定计划的详细分解步骤。
-   `movementBreakdown`: 按状态拆分走、跑、停站的具体时长及对应心率表现。
-   `weather`: 运动时的环境与天气数据。
-   `aiHints`: 针对单次运动的深度复盘提示（如：刺激强度足够、休息心率偏高、步频优秀等）。

---

## 6. 单日睡眠分析 (Sleep Analysis)

**接口**: `getSleepAnalysis(date?)`
**描述**: 返回单晚睡眠摘要和按时间排列的完整睡眠阶段时间线，适合睡眠卡片和恢复分析。
**使用场景**:

-   分析昨晚深睡、浅睡、REM 和清醒阶段分布。
-   结合 HRV、身体电量和静息心率判断恢复情况。
-   为当天课表强度调整提供恢复依据。

**输入**:

-   `date` (Date, 选填): 睡眠归属日期，默认当天。

**输出 (`SleepAnalysisSummary`)**:

-   `sleepDate`, `startAt`, `endAt`, `durationMin`, `score`, `quality`。
-   `stageSummary`: 各睡眠阶段分钟数。
-   `timeline`: 整晚按时间排序的阶段列表，最多 200 段。
-   `metrics`: 睡眠心率、HRV、静息心率、呼吸和身体电量变化。

---

## 7. 训练准备与跑步能力输入

这些接口用于生成训练建议或课表前的确定性数据准备，不会修改 Garmin。

### 7.1 训练准备度

**接口**:

-   `getTrainingReadiness(date?)`
-   `getMorningTrainingReadiness(date?)`

**用途**:

-   读取 Garmin 训练准备度、恢复时间、睡眠、HRV、压力历史和 ACWR 因子。
-   `getMorningTrainingReadiness` 优先选择 `inputContext=AFTER_WAKEUP_RESET` 的晨间结果。

**注意**: `recoveryTime` 单位为分钟。准备度是课表调整信号，不应单独决定高强度训练。

### 7.2 耐力评分

**接口**: `getEnduranceScore(startDate, endDate?)`

-   只传 `startDate` 时读取单日精确值。
-   同时传入起止日期时返回周聚合趋势。

### 7.3 跑步耐受

**接口**: `getRunningTolerance(startDate, endDate, aggregation?)`

-   `aggregation`: `daily` 或 `weekly`，默认 `weekly`。
-   用于评估用户近期可承受跑量，避免课表增量明显超过历史能力。

---

## 8. 课表与训练计划读取

### 8.1 Workout 模板库

**接口**:

-   `getWorkouts(start?, limit?)`
-   `getWorkoutDetail({ workoutId })`

**用途**:

-   读取用户已有的单次训练模板。
-   分析用户常用的热身、主训练、恢复、冷身、目标配速或功率结构。

### 8.2 已排期课表

**接口**:

-   `getScheduledWorkouts(year?, month?)`
-   `getScheduledWorkoutById(scheduledWorkoutId)`

**用途**:

-   生成新计划前检查日期冲突和已有训练。
-   回答“我本周安排了什么训练”等问题。

**月份约定**: 对调用方使用自然月份 `1-12`；库内部转换为 Garmin 的 `0-11`。

### 8.3 Garmin 官方训练计划

**接口**:

-   `getTrainingPlans()`
-   `getTrainingPlanById(planId)`
-   `getAdaptiveTrainingPlanById(planId)`

**用途**:

-   读取 Garmin 已订阅或可见的阶段训练计划。
-   区分 Garmin 官方计划与 DailySync AI 生成的 `training_plan_draft_v1`。

---

## 9. AI 单次课表草案 (Workout Draft)

**类型**: `WorkoutDraft`
**Schema**: `workout_draft_v1`
**接口**:

-   `validateWorkoutDraft(draft)`
-   `compileWorkoutDraft(draft)`

**设计原则**:

-   AI 只生成公制、用户可读的草案。
-   当前只支持 `running`。
-   距离单位为米，时长单位为秒，配速单位为秒/公里。
-   步频使用完整步频 `spm`，功率使用瓦特。
-   AI 不生成 Garmin ID、`stepOrder`、`childStepId`、`targetValueOne` 或 `targetValueTwo`。

**支持的步骤**:

-   `warmup`, `interval`, `recovery`, `rest`, `cooldown`, `other`
-   `repeat` 重复组

**支持的结束条件**:

-   `time`
-   `distance`
-   `lap_button`

**支持的目标**:

-   `none`
-   `pace`
-   `heart_rate_zone`
-   `power`
-   `cadence`

`compileWorkoutDraft` 只编译并返回 `GarminWorkoutUploadPayload`，不会调用 Garmin 写接口。

---

## 10. 课表写入与安全边界

**写接口**:

-   `addWorkout(payload)`: 创建 Workout 模板。
-   `scheduleWorkout({ workoutId }, date)`: 把模板排入日历。
-   `unscheduleWorkout(scheduledWorkoutId)`: 仅移除日历排期。
-   `deleteWorkout({ workoutId })`: 删除 Workout 模板。

**AI 使用约束**:

-   分析和草案生成阶段不得调用写接口。
-   写入前必须向用户展示确切日期、课表结构和目标 Garmin 账号。
-   用户明确确认后，按 `addWorkout -> scheduleWorkout` 顺序执行。
-   发布和删除必须由后端 Pending Coach Action 提供参数哈希、过期和幂等保护。
-   不要递归删除 Garmin payload 中的 `null`；部分 `null` 是明确协议值。

---

## 11. 训练状态中文映射

`TrainingOverview.state` 同时保留机器字段和中文字段：

-   `status`: 稳定英文机器值，例如 `productive`。
-   `statusZh`: 面向中国大陆用户的中文状态。
-   `feedbackPhrase`: Garmin 原始编码，例如 `PRODUCTIVE_3`。
-   `feedbackZh`: 根据稳定前缀得到的中文反馈。

Garmin 同一状态可能有多个后缀变体。映射时只使用第一个下划线前的稳定前缀，例如 `PRODUCTIVE_3`、`PRODUCTIVE_6` 都映射为“高效训练”。

| Garmin 前缀    | `status`       | 中文     |
| -------------- | -------------- | -------- |
| `PRODUCTIVE`   | `productive`   | 高效训练 |
| `PEAKING`      | `peaking`      | 巅峰状态 |
| `MAINTAINING`  | `maintaining`  | 维持效果 |
| `RECOVERY`     | `recovery`     | 恢复     |
| `STRAINED`     | `strained`     | 紧绷     |
| `UNPRODUCTIVE` | `unproductive` | 效率不佳 |
| `OVERREACHING` | `overreaching` | 过度训练 |
| `DETRAINING`   | `detraining`   | 训练不足 |

未知状态不得由 AI 自行猜测中文含义；中文字段为 `null` 时保留原始编码并说明暂未识别。

---

## 12. 建议的 MCP 能力拆分

```text
training_overview.read
  getTrainingOverview

wellness.read
  getWellnessOverview
  getSleepAnalysis

activity.search
  getActivitiesSummary

activity.read
  getActivityDetailSummary

training_plan.read
  getWorkouts
  getWorkoutDetail
  getScheduledWorkouts
  getScheduledWorkoutById
  getTrainingPlans
  getTrainingPlanById
  getAdaptiveTrainingPlanById

training_plan.draft
  getTrainingReadiness
  getMorningTrainingReadiness
  getEnduranceScore
  getRunningTolerance
  validateWorkoutDraft
  compileWorkoutDraft

training_plan.publish
  addWorkout
  scheduleWorkout

training_plan.delete
  unscheduleWorkout
  deleteWorkout
```

`training_plan.publish` 和 `training_plan.delete` 必须标记为需要用户确认的写能力。读取和草案能力不得间接触发写操作。
