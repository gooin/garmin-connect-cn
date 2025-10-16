# MFA 配置使用指南

本指南介绍如何使用重构后的 MFA 配置功能，支持文件和 Redis 两种存储方式。

## 概述

MFA（多因素认证）配置已从仅支持文件目录配置扩展为同时支持文件和 Redis 配置。这使得 MFA Manager 能够通过配置直接获取会话信息，提高了灵活性和可扩展性。

## 配置方式

### 1. 文件存储配置

```javascript
const client = new GarminConnect({
    username: 'your_username',
    password: 'your_password',
    timeout: 30000,
    mfa: {
        type: 'file',
        dir: './mfa-sessions' // MFA会话文件存储目录
    }
});
```

### 2. Redis 存储配置

#### 2.2 Upstash Redis 配置

```javascript
const client = new GarminConnect({
    username: 'your_username',
    password: 'your_password',
    timeout: 30000,
    mfa: {
        type: 'redis',
        redisUrl:
            process.env.UPSTASH_REDIS_REST_URL ||
            'https://your-redis-url.upstash.io',
        redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || 'your-redis-token'
    }
});
```

## 使用示例

### 基本使用

```javascript
const { GarminConnect } = require('garmin-connect-cn');

// 创建客户端
const client = new GarminConnect({
    username: 'your_username',
    password: 'your_password',
    mfa: {
        type: 'file',
        dir: './mfa-sessions'
    }
});

// 登录
try {
    await client.login();
    console.log('登录成功');
} catch (error) {
    console.error('登录失败:', error.message);
}
```

### 分步登录（适用于需要 MFA 验证的场景）

#### 使用 Upstash Redis

```javascript
const { GarminConnect } = require('garmin-connect-cn');

// 创建客户端
const client = new GarminConnect({
    username: 'your_username',
    password: 'your_password',
    mfa: {
        type: 'redis',
        redisUrl: process.env.UPSTASH_REDIS_REST_URL,
        redisToken: process.env.UPSTASH_REDIS_REST_TOKEN
    }
});

// 生成唯一会话ID
const sessionId = 'unique-session-id';

try {
    // 启动登录流程
    const loginPromise = client.login(username, password, sessionId);

    // 在另一个进程中获取MFA验证码
    // ...

    // 等待登录完成
    await loginPromise;
    console.log('登录成功');
} catch (error) {
    console.error('登录失败:', error.message);
}
```

### 在另一个进程中提交 MFA 验证码

#### 使用 Upstash Redis

```javascript
const { MFAManager } = require('garmin-connect-cn');

// 使用相同的配置初始化MFAManager
const mfaManager = MFAManager.getInstance({
    type: 'redis',
    redisUrl: process.env.UPSTASH_REDIS_REST_URL,
    redisToken: process.env.UPSTASH_REDIS_REST_TOKEN
});

// 提交MFA验证码
const success = await mfaManager.submitMFACode(sessionId, '123456');
if (success) {
    console.log('MFA验证码提交成功');
} else {
    console.log('MFA验证码提交失败');
}
```
