# RacePredictionAndLactateThreshold 比赛预测和乳酸阈值接口

## 月度比赛预测

请求网址：
https://connect.garmin.com/gc-api/metrics-service/metrics/racepredictions/monthly/ca60280f-ade6-4aab-a44c-7853b891f1ca?fromCalendarDate=2025-12-01&toCalendarDate=2026-05-31

请求方法：GET

注意：

-   URL 中的 `ca60280f-ade6-4aab-a44c-7853b891f1ca` 是变量。
-   这个值来自 `getUserProfile().displayName`。

代码方法：

```ts
await GCClient.getRacePredictionsMonthly('2025-12-01', '2026-05-31');
```

响应结构：

```json
[
    {
        "userId": 95368228,
        "fromCalendarDate": "2025-12-01",
        "toCalendarDate": "2026-05-31",
        "calendarDate": "2026-05-17",
        "time5K": 1177,
        "time10K": 2484,
        "timeHalfMarathon": 5463,
        "timeMarathon": 11853,
        "time5KFormatted": "00:19:37",
        "time10KFormatted": "00:41:24",
        "timeHalfMarathonFormatted": "01:31:03",
        "timeMarathonFormatted": "03:17:33"
    }
]
```

字段说明：

-   `time5K`、`time10K`、`timeHalfMarathon`、`timeMarathon` 单位是秒。
-   `time5KFormatted`、`time10KFormatted`、`timeHalfMarathonFormatted`、`timeMarathonFormatted` 是可直接展示的 `HH:mm:ss`。

## 跑步乳酸阈值速度

请求网址：
https://connect.garmin.com/gc-api/biometric-service/stats/lactateThresholdSpeed/range/2025-06-02/2026-05-31?aggregation=monthly&aggregationStrategy=LATEST&sport=RUNNING

请求方法：GET

代码方法：

```ts
await GCClient.getLactateThresholdSpeedRange('2025-06-02', '2026-05-31');
```

响应结构：

```json
[
    {
        "from": "2026-05-01",
        "until": "2026-05-31",
        "series": "running",
        "value": 0.40555442,
        "updatedDate": "2026-05-07"
    }
]
```

配速转换：

-   Garmin 返回的 `value` 按实测需要乘以 10 得到 `m/s`。
-   `speedMetersPerSecond = value * 10`
-   `paceSecondsPerKilometer = 1000 / speedMetersPerSecond`
-   `0.40555442` -> `4.0555442 m/s` -> `246.576 秒/公里` -> `4:07/km`

## 跑步乳酸阈值心率

请求网址：
https://connect.garmin.com/gc-api/biometric-service/stats/lactateThresholdHeartRate/range/2025-06-02/2026-05-31?aggregation=monthly&aggregationStrategy=LATEST&sport=RUNNING

请求方法：GET

代码方法：

```ts
await GCClient.getLactateThresholdHeartRateRange('2025-06-02', '2026-05-31');
```

响应结构：

```json
[
    {
        "from": "2026-05-01",
        "until": "2026-05-31",
        "series": "running",
        "value": 173,
        "updatedDate": "2026-05-07"
    }
]
```

## 最新乳酸阈值

请求网址：
https://connect.garmin.com/gc-api/biometric-service/biometric/latestLactateThreshold

请求方法：GET

代码方法：

```ts
await GCClient.getLatestLactateThreshold();
```

响应结构：

```json
[
    {
        "userProfilePK": 95368228,
        "version": 1778156643137,
        "calendarDate": "2026-05-07T20:24:03.90",
        "sequence": 1778156643137,
        "speed": 0.40555442,
        "hearRate": null,
        "heartRateCycling": null,
        "rowSpeed": null,
        "heartRateRowing": null
    },
    {
        "userProfilePK": 95368228,
        "version": 1778156643137,
        "calendarDate": "2026-05-07T20:24:03.90",
        "sequence": 1778156643137,
        "speed": null,
        "hearRate": 173,
        "heartRateCycling": null,
        "rowSpeed": null,
        "heartRateRowing": null
    }
]
```

## 整合跑步乳酸阈值

代码方法：

```ts
await GCClient.getRunningLactateThreshold('2025-06-02', '2026-05-31');
```

返回：

```ts
{
  speed: BiometricStatRangeEntry[]
  heartRate: BiometricStatRangeEntry[]
  combined: RunningLactateThresholdEntry[]
  latest: LatestLactateThresholdEntry[]
}
```

`combined` 会按月份合并速度和心率，并额外提供配速字段：

-   `speed`: Garmin 原始速度值
-   `speedMetersPerSecond`: 转换后的 m/s
-   `paceSecondsPerKilometer`: 秒/公里
-   `paceMinutesPerKilometer`: `mm:ss/km`
-   `heartRate`: 乳酸阈值心率

实测结果：

```json
[
    {
        "from": "2025-06-01",
        "until": "2025-06-30",
        "updatedDate": "2025-06-18",
        "speed": 0.41388773,
        "speedMetersPerSecond": 4.1388773,
        "paceSecondsPerKilometer": 241.61141476699493,
        "paceMinutesPerKilometer": "4:02/km",
        "heartRate": 178
    },
    {
        "from": "2025-08-01",
        "until": "2025-08-31",
        "updatedDate": "2025-08-24",
        "speed": 0.38611003,
        "speedMetersPerSecond": 3.8611003,
        "paceSecondsPerKilometer": 258.9935309372823,
        "paceMinutesPerKilometer": "4:19/km",
        "heartRate": 178
    },
    {
        "from": "2025-09-01",
        "until": "2025-09-30",
        "updatedDate": "2025-09-21",
        "speed": 0.40555442,
        "speedMetersPerSecond": 4.0555442,
        "paceSecondsPerKilometer": 246.5760328786455,
        "paceMinutesPerKilometer": "4:07/km",
        "heartRate": 182
    },
    {
        "from": "2025-10-01",
        "until": "2025-10-31",
        "updatedDate": "2025-10-09",
        "speed": 0.40555442,
        "speedMetersPerSecond": 4.0555442,
        "paceSecondsPerKilometer": 246.5760328786455,
        "paceMinutesPerKilometer": "4:07/km",
        "heartRate": 184
    },
    {
        "from": "2025-11-01",
        "until": "2025-11-30",
        "updatedDate": "2025-11-24",
        "speed": 0.37777672,
        "speedMetersPerSecond": 3.7777672,
        "paceSecondsPerKilometer": 264.7066235314871,
        "paceMinutesPerKilometer": "4:25/km",
        "heartRate": 178
    },
    {
        "from": "2025-12-01",
        "until": "2025-12-31",
        "updatedDate": "2025-12-03",
        "speed": 0.37777672,
        "speedMetersPerSecond": 3.7777672,
        "paceSecondsPerKilometer": 264.7066235314871,
        "paceMinutesPerKilometer": "4:25/km",
        "heartRate": 171
    },
    {
        "from": "2026-05-01",
        "until": "2026-05-31",
        "updatedDate": "2026-05-07",
        "speed": 0.40555442,
        "speedMetersPerSecond": 4.0555442,
        "paceSecondsPerKilometer": 246.5760328786455,
        "paceMinutesPerKilometer": "4:07/km",
        "heartRate": 173
    }
]
```

## 实测比赛预测结果

账号：`goooinn@gmail.com`

范围：`2025-12-01` 到 `2026-05-31`

```json
[
    {
        "calendarDate": "2025-12-31",
        "time5K": 1249,
        "time10K": 2632,
        "timeHalfMarathon": 5925,
        "timeMarathon": 13068,
        "time5KFormatted": "00:20:49",
        "time10KFormatted": "00:43:52",
        "timeHalfMarathonFormatted": "01:38:45",
        "timeMarathonFormatted": "03:37:48"
    },
    {
        "calendarDate": "2026-01-31",
        "time5K": 1176,
        "time10K": 2487,
        "timeHalfMarathon": 5511,
        "timeMarathon": 12134,
        "time5KFormatted": "00:19:36",
        "time10KFormatted": "00:41:27",
        "timeHalfMarathonFormatted": "01:31:51",
        "timeMarathonFormatted": "03:22:14"
    },
    {
        "calendarDate": "2026-02-28",
        "time5K": 1164,
        "time10K": 2464,
        "timeHalfMarathon": 5441,
        "timeMarathon": 11834,
        "time5KFormatted": "00:19:24",
        "time10KFormatted": "00:41:04",
        "timeHalfMarathonFormatted": "01:30:41",
        "timeMarathonFormatted": "03:17:14"
    },
    {
        "calendarDate": "2026-03-31",
        "time5K": 1156,
        "time10K": 2435,
        "timeHalfMarathon": 5367,
        "timeMarathon": 11878,
        "time5KFormatted": "00:19:16",
        "time10KFormatted": "00:40:35",
        "timeHalfMarathonFormatted": "01:29:27",
        "timeMarathonFormatted": "03:17:58"
    },
    {
        "calendarDate": "2026-04-30",
        "time5K": 1170,
        "time10K": 2473,
        "timeHalfMarathon": 5463,
        "timeMarathon": 11859,
        "time5KFormatted": "00:19:30",
        "time10KFormatted": "00:41:13",
        "timeHalfMarathonFormatted": "01:31:03",
        "timeMarathonFormatted": "03:17:39"
    },
    {
        "calendarDate": "2026-05-17",
        "time5K": 1177,
        "time10K": 2484,
        "timeHalfMarathon": 5463,
        "timeMarathon": 11853,
        "time5KFormatted": "00:19:37",
        "time10KFormatted": "00:41:24",
        "timeHalfMarathonFormatted": "01:31:03",
        "timeMarathonFormatted": "03:17:33"
    }
]
```
