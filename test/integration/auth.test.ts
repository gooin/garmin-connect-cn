import { describe, it, expect, beforeAll } from 'vitest';
import { GarminConnect } from '../../src/index';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.join(__dirname, '../../.env.test');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const username = process.env.TEST_GARMIN_USERNAME;
const password = process.env.TEST_GARMIN_PASSWORD;
const domain = process.env.TEST_GARMIN_DOMAIN || 'garmin.cn';

describe('Auth Integration Tests', () => {
    // 检查是否有测试凭证，如无则跳过所有测试
    if (!username || !password) {
        it.skip('未配置凭证，跳过认证测试', () => {});
        return;
    }

    const TOKENS_DIR = path.join(__dirname, '../tokens-test', username);

    beforeAll(() => {
        if (!fs.existsSync(TOKENS_DIR)) {
            fs.mkdirSync(TOKENS_DIR, { recursive: true });
        }
    });

    it('login & exportToken & loadToken - 密码登录、导出与加载 Token', async () => {
        const client = new GarminConnect({ username, password }, domain as any);
        await client.login(username, password);

        // 导出 Token
        const tokens = client.exportToken();
        expect(tokens.oauth1).toBeDefined();
        expect(tokens.oauth2).toBeDefined();

        // 导出至文件
        await client.exportTokenToFile(TOKENS_DIR);
        expect(fs.existsSync(path.join(TOKENS_DIR, 'oauth1_token.json'))).toBe(
            true
        );
        expect(fs.existsSync(path.join(TOKENS_DIR, 'oauth2_token.json'))).toBe(
            true
        );

        // 用新客户端从文件加载 Token
        const client2 = new GarminConnect(
            { username, password },
            domain as any
        );
        await client2.loadTokenByFile(TOKENS_DIR);
        expect(client2.client.oauth1Token).toEqual(tokens.oauth1);
        expect(client2.client.oauth2Token).toEqual(tokens.oauth2);
    });

    it('onSessionChange - 登录状态变更事件监听', async () => {
        const client = new GarminConnect({ username, password }, domain as any);
        let eventTriggered = false;

        client.onSessionChange((tokens) => {
            expect(tokens.oauth1).toBeDefined();
            expect(tokens.oauth2).toBeDefined();
            eventTriggered = true;
        });

        await client.login(username, password);
        expect(eventTriggered).toBe(true);
    });
});
