import { describe, it, expect, beforeAll } from 'vitest';
import { GarminConnect } from '../../src/index';
import { printResponse } from './log-helper';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';

describe('Device Integration Tests', () => {
    let client: GarminConnect;

    beforeAll(async () => {
        if (!username || !password) return;
        client = new GarminConnect({ username, password }, domain as any);
        const TOKENS_DIR = path.join(__dirname, '../tokens-test', username);
        if (fs.existsSync(path.join(TOKENS_DIR, 'oauth1_token.json'))) {
            await client.loadTokenByFile(TOKENS_DIR);
        } else {
            await client.login(username, password);
        }
    });

    it('device - 获取主可穿戴设备数据', async () => {
        if (!client) return;
        const device = await client.getPrimaryWearableDevice();
        // 因为用户可能没有绑定支持该特性的穿戴设备，可以为 null
        if (device !== null) {
            expect(device.deviceId).toBeDefined();
            expect(device.displayName).toBeDefined();
        }
        printResponse(
            '主可穿戴设备数据 (getPrimaryWearableDevice)',
            device,
            (data) =>
                data
                    ? {
                          displayName: data.displayName,
                          deviceId: data.deviceId,
                          primaryWearableDevice: data.primaryWearableDevice
                      }
                    : 'No wearable device configured'
        );
    });
});
