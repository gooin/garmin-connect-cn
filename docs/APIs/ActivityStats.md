# ActivityStats 运动统计接口

用途：查询一个时间范围内的运动汇总统计，用于分析用户整体训练能力。

## 接口

请求网址：
https://connect.garmin.com/gc-api/fitnessstats-service/activity

请求方法：GET

基础参数：

```text
aggregation=lifetime
groupByParentActivityType=false
groupByEventType=false
startDate=2025-05-18
endDate=2026-05-17
standardizedUnits=false
```

可选参数：

```text
activityType=running
activityType=cycling
```

说明：

-   查询所有运动：不传 `activityType`
-   查询跑步：`activityType=running`
-   查询骑行：`activityType=cycling`
-   `startDate`、`endDate`、`activityType` 都作为方法参数传入。

默认 metric：

```text
duration
distance
movingDuration
splitSummaries.noOfSplits.CLIMB_ACTIVE
splitSummaries.duration.CLIMB_ACTIVE
splitSummaries.totalAscent.CLIMB_ACTIVE
splitSummaries.maxElevationGain.CLIMB_ACTIVE
splitSummaries.numClimbsAttempted.CLIMB_ACTIVE
splitSummaries.numClimbsCompleted.CLIMB_ACTIVE
splitSummaries.numClimbSends.CLIMB_ACTIVE
splitSummaries.numFalls.CLIMB_ACTIVE
calories
elevationGain
elevationLoss
avgSpeed
maxSpeed
avgGradeAdjustedSpeed
avgHr
maxHr
avgRunCadence
maxRunCadence
avgBikeCadence
maxBikeCadence
avgWheelchairCadence
maxWheelchairCadence
avgPower
maxPower
avgVerticalOscillation
avgGroundContactTime
avgStrideLength
avgStress
maxStress
splitSummaries.duration.CLIMB_REST
beginPackWeight
steps
```

完整请求示例：

```text
https://connect.garmin.com/gc-api/fitnessstats-service/activity?aggregation=lifetime&groupByParentActivityType=false&groupByEventType=false&startDate=2025-05-18&endDate=2026-05-17&metric=duration&metric=distance&metric=movingDuration&metric=splitSummaries.noOfSplits.CLIMB_ACTIVE&metric=splitSummaries.duration.CLIMB_ACTIVE&metric=splitSummaries.totalAscent.CLIMB_ACTIVE&metric=splitSummaries.maxElevationGain.CLIMB_ACTIVE&metric=splitSummaries.numClimbsAttempted.CLIMB_ACTIVE&metric=splitSummaries.numClimbsCompleted.CLIMB_ACTIVE&metric=splitSummaries.numClimbSends.CLIMB_ACTIVE&metric=splitSummaries.numFalls.CLIMB_ACTIVE&metric=calories&metric=elevationGain&metric=elevationLoss&metric=avgSpeed&metric=maxSpeed&metric=avgGradeAdjustedSpeed&metric=avgHr&metric=maxHr&metric=avgRunCadence&metric=maxRunCadence&metric=avgBikeCadence&metric=maxBikeCadence&metric=avgWheelchairCadence&metric=maxWheelchairCadence&metric=avgPower&metric=maxPower&metric=avgVerticalOscillation&metric=avgGroundContactTime&metric=avgStrideLength&metric=avgStress&metric=maxStress&metric=splitSummaries.duration.CLIMB_REST&metric=beginPackWeight&metric=steps&standardizedUnits=false
```

## 代码方法

查询所有：

```ts
await GCClient.getActivityStats({
    startDate: '2025-05-18',
    endDate: '2026-05-17'
});
```

查询跑步：

```ts
await GCClient.getActivityStats({
    startDate: '2025-05-18',
    endDate: '2026-05-17',
    activityType: 'running'
});
```

查询骑行：

```ts
await GCClient.getActivityStats({
    startDate: '2025-05-18',
    endDate: '2026-05-17',
    activityType: 'cycling'
});
```

可自定义 metric：

```ts
await GCClient.getActivityStats({
    startDate: '2025-05-18',
    endDate: '2026-05-17',
    activityType: 'running',
    metrics: ['duration', 'distance', 'avgHr']
});
```

## 响应结构

```json
[
    {
        "date": "2026-05-17",
        "countOfActivities": 294,
        "stats": {
            "all": {
                "distance": {
                    "count": 293,
                    "min": 0,
                    "max": 4221642.96875,
                    "avg": 762921.9184484904,
                    "sum": 223536122.1054077
                },
                "duration": {
                    "count": 294,
                    "min": 122898.00262451172,
                    "max": 30482824.21875,
                    "avg": 3721660.753652352,
                    "sum": 1094168261.5737915
                }
            }
        }
    }
]
```

字段说明：

-   `countOfActivities`: 范围内活动数量。
-   每个 metric 的结构为 `{ count, min, max, avg, sum }`。
-   `stats.all.distance.sum` 等单位跟 Garmin 返回保持一致；本接口使用 `standardizedUnits=false`。

## 实测结果

账号：`goooinn@gmail.com`

范围：`2025-05-18` 到 `2026-05-17`

### 所有运动

```json
{
    "date": "2026-05-17",
    "countOfActivities": 294,
    "distance": {
        "count": 293,
        "min": 0,
        "max": 4221642.96875,
        "avg": 762921.9184484904,
        "sum": 223536122.1054077
    },
    "duration": {
        "count": 294,
        "min": 122898.00262451172,
        "max": 30482824.21875,
        "avg": 3721660.753652352,
        "sum": 1094168261.5737915
    },
    "movingDuration": {
        "count": 294,
        "sum": 878492619.3269193
    },
    "elevationGain": {
        "count": 250,
        "sum": 3418735.6059322134
    },
    "calories": {
        "count": 292,
        "sum": 706051.89016
    },
    "avgHr": {
        "count": 294,
        "avg": 130.38987970312624
    },
    "maxHr": {
        "count": 294,
        "max": 195
    },
    "steps": {
        "count": 283,
        "sum": 2206546
    }
}
```

### 跑步

```json
{
    "date": "2026-05-17",
    "countOfActivities": 199,
    "distance": {
        "count": 199,
        "min": 40000,
        "max": 4221642.96875,
        "avg": 986716.0161157349,
        "sum": 196356487.20703125
    },
    "duration": {
        "count": 199,
        "sum": 774066061.630249
    },
    "movingDuration": {
        "count": 199,
        "sum": 734275114.2228544
    },
    "elevationGain": {
        "count": 199,
        "sum": 2296285.0619897246
    },
    "calories": {
        "count": 198,
        "sum": 604980.2277199998
    },
    "avgHr": {
        "count": 199,
        "avg": 145.5119613583247
    },
    "maxHr": {
        "count": 199,
        "max": 195
    },
    "steps": {
        "count": 198,
        "sum": 1920668
    }
}
```

### 骑行

```json
{
    "date": "2026-05-17",
    "countOfActivities": 0,
    "distance": {
        "count": 0,
        "sum": 0
    },
    "duration": {
        "count": 0,
        "sum": 0
    },
    "movingDuration": {
        "count": 0,
        "sum": 0
    },
    "elevationGain": {
        "count": 0,
        "sum": 0
    },
    "calories": {
        "count": 0,
        "sum": 0
    },
    "avgHr": {
        "count": 0,
        "avg": null
    },
    "maxHr": {
        "count": 0,
        "max": null
    },
    "steps": {
        "count": 0,
        "sum": 0
    }
}
```
