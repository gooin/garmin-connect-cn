import { MFASessionStorage } from './MFASessionStorage';
import { FileMFASessionStorage } from './FileMFASessionStorage';
import { RedisMFASessionStorage } from './RedisMFASessionStorage';
import { MFAConfig } from '../garmin/types';
import path from 'path';

/**
 * MFA管理器，用于处理需要等待外部验证码的登录流程
 * 支持文件系统和Redis两种存储方式
 */
export class MFAManager {
    private static instance: MFAManager;
    private storage: MFASessionStorage;
    private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分钟

    private constructor(config: MFAConfig) {
        // 根据配置创建不同的存储实现
        if (config.type === 'redis') {
            if (config.redis) {
                this.storage = new RedisMFASessionStorage(
                    undefined,
                    undefined,
                    config.redis
                );
            } else if (config.redisUrl && config.redisToken) {
                this.storage = new RedisMFASessionStorage(
                    config.redisUrl,
                    config.redisToken
                );
            } else if (config.redisUrl) {
                this.storage = new RedisMFASessionStorage(config.redisUrl);
            } else {
                throw new Error('Redis配置不完整，需要提供redisUrl或redis实例');
            }
        } else if (config.type === 'file') {
            const storageDir =
                config.dir || path.join(process.cwd(), '.mfa-sessions');
            this.storage = new FileMFASessionStorage(storageDir);
        } else {
            throw new Error(`不支持的MFA存储类型: ${config.type}`);
        }
    }

    /**
     * 获取MFA管理器单例
     */
    public static getInstance(config?: MFAConfig): MFAManager {
        if (!MFAManager.instance) {
            if (!config) {
                throw new Error('首次创建MFAManager实例必须提供配置');
            }
            console.log('创建MFA管理器实例', config);
            MFAManager.instance = new MFAManager(config);
        }
        return MFAManager.instance;
    }

    /**
     * 重置单例实例，用于测试或重新配置
     */
    public static resetInstance(): void {
        MFAManager.instance = undefined as any;
    }

    /**
     * 创建一个等待MFA验证码的Promise
     * @param sessionId 会话ID
     * @param timeout 超时时间（毫秒）
     * @returns Promise<string> 返回验证码
     */
    public async waitForMFACode(
        sessionId: string,
        timeout: number = this.DEFAULT_TIMEOUT
    ): Promise<string> {
        return this.storage.waitForMFACode(sessionId, timeout);
    }

    /**
     * 提交MFA验证码
     * @param sessionId 会话ID
     * @param code 验证码
     * @returns 是否成功提交
     */
    public async submitMFACode(
        sessionId: string,
        code: string
    ): Promise<boolean> {
        return this.storage.submitMFACode(sessionId, code);
    }

    /**
     * 取消MFA验证
     * @param sessionId 会话ID
     * @param reason 取消原因
     * @returns 是否成功取消
     */
    public async cancelMFARequest(
        sessionId: string,
        reason: string = 'MFA验证已取消'
    ): Promise<boolean> {
        return this.storage.cancelMFARequest(sessionId, reason);
    }

    /**
     * 检查会话是否存在
     * @param sessionId 会话ID
     * @returns 是否存在
     */
    public async hasSession(sessionId: string): Promise<boolean> {
        return this.storage.hasSession(sessionId);
    }

    /**
     * 获取所有活跃的会话ID
     * @returns 会话ID列表
     */
    public async getActiveSessions(): Promise<string[]> {
        return this.storage.getActiveSessions();
    }

    /**
     * 清理过期的请求
     * @param maxAge 最大存活时间（毫秒）
     */
    public async cleanupExpiredRequests(
        maxAge: number = this.DEFAULT_TIMEOUT
    ): Promise<void> {
        return this.storage.cleanupExpiredRequests(maxAge);
    }

    /**
     * 定期清理过期请求
     */
    public startCleanupTask(interval: number = 60000): void {
        setInterval(() => {
            this.cleanupExpiredRequests();
        }, interval);
    }

    /**
     * 关闭资源连接（主要用于Redis）
     */
    public async disconnect(): Promise<void> {
        if (this.storage instanceof RedisMFASessionStorage) {
            await this.storage.disconnect();
        }
    }
}
