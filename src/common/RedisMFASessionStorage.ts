import { MFASessionStorage } from './MFASessionStorage';

/**
 * Redis实现的MFA会话存储
 */
export class RedisMFASessionStorage implements MFASessionStorage {
    private redis: any;
    private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分钟
    private readonly KEY_PREFIX = 'mfa:session:';

    constructor(redisUrl?: string, redisToken?: string, redisClient?: any) {
        if (redisClient) {
            this.redis = redisClient;
        } else if (redisUrl && redisToken) {
            // 使用Upstash Redis
            try {
                const { Redis } = require('@upstash/redis');
                this.redis = new Redis({
                    url: redisUrl,
                    token: redisToken
                });
            } catch (error) {
                throw new Error(
                    'Upstash Redis module not found. Please install @upstash/redis: npm install @upstash/redis'
                );
            }
        } else if (redisUrl) {
            // 动态导入redis模块
            try {
                const Redis = require('ioredis');
                this.redis = new Redis(redisUrl);
            } catch (error) {
                throw new Error(
                    'Redis module not found. Please install ioredis: npm install ioredis'
                );
            }
        } else {
            throw new Error(
                'Either redisUrl with redisToken (for Upstash) or redisClient must be provided'
            );
        }
    }

    /**
     * 获取会话键名
     */
    private getSessionKey(sessionId: string): string {
        return `${this.KEY_PREFIX}${sessionId}`;
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
        // 清理可能存在的旧会话
        await this.cleanupRequest(sessionId);

        // 创建会话数据
        const sessionData = {
            sessionId,
            status: 'waiting',
            createdAt: new Date().toISOString(),
            timeout: timeout
        };

        const sessionKey = this.getSessionKey(sessionId);

        // 使用Redis的SET命令存储会话数据，并设置过期时间
        await this.redis.setex(
            sessionKey,
            Math.ceil(timeout / 1000), // Redis的TTL是秒
            JSON.stringify(sessionData)
        );

        console.log(`MFA验证会话已创建: ${sessionId}`);

        // 轮询检查验证码是否已提交
        return new Promise<string>((resolve, reject) => {
            const startTime = Date.now();
            const checkInterval = setInterval(async () => {
                try {
                    // 检查是否超时
                    if (Date.now() - startTime > timeout) {
                        clearInterval(checkInterval);
                        await this.cleanupRequest(sessionId);
                        reject(new Error('MFA验证超时，请重新登录'));
                        return;
                    }

                    // 检查会话状态
                    const data = await this.redis.get(sessionKey);
                    if (!data) {
                        clearInterval(checkInterval);
                        reject(new Error('MFA验证会话已过期'));
                        return;
                    }

                    // 确保data是字符串，如果是对象则先转换为字符串
                    const dataStr =
                        typeof data === 'string' ? data : JSON.stringify(data);
                    const session = JSON.parse(dataStr);

                    // 如果状态已更新为resolved，则返回验证码
                    if (session.status === 'resolved' && session.code) {
                        clearInterval(checkInterval);
                        await this.cleanupRequest(sessionId);
                        resolve(session.code);
                        return;
                    }

                    // 如果状态已更新为rejected，则抛出错误
                    if (session.status === 'rejected' && session.error) {
                        clearInterval(checkInterval);
                        await this.cleanupRequest(sessionId);
                        reject(new Error(session.error));
                        return;
                    }
                } catch (error) {
                    clearInterval(checkInterval);
                    await this.cleanupRequest(sessionId);
                    reject(
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    );
                }
            }, 1000); // 每秒检查一次
        });
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
        const sessionKey = this.getSessionKey(sessionId);

        try {
            // 获取会话数据
            const data = await this.redis.get(sessionKey);
            if (!data) {
                console.log(`未找到MFA验证会话: ${sessionId}`);
                return false;
            }

            // 确保data是字符串，如果是对象则先转换为字符串
            const dataStr =
                typeof data === 'string' ? data : JSON.stringify(data);
            const session = JSON.parse(dataStr);

            if (session.status !== 'waiting') {
                console.log(
                    `MFA验证会话状态不正确: ${sessionId}, 状态: ${session.status}`
                );
                return false;
            }

            // 更新会话状态为已解决
            session.status = 'resolved';
            session.code = code;
            session.resolvedAt = new Date().toISOString();

            await this.redis.set(sessionKey, JSON.stringify(session));
            console.log(
                `MFA验证码已提交: code ${code}, sessionId ${sessionId}`
            );
            return true;
        } catch (error) {
            console.log(
                `提交MFA验证码失败: ${sessionId}, 错误: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
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
        const sessionKey = this.getSessionKey(sessionId);

        try {
            // 获取会话数据
            const data = await this.redis.get(sessionKey);
            if (!data) {
                console.log(`未找到MFA验证会话: ${sessionId}`);
                return false;
            }

            // 确保data是字符串，如果是对象则先转换为字符串
            const dataStr =
                typeof data === 'string' ? data : JSON.stringify(data);
            const session = JSON.parse(dataStr);

            // 更新会话状态为已拒绝
            session.status = 'rejected';
            session.error = reason;
            session.rejectedAt = new Date().toISOString();

            await this.redis.set(sessionKey, JSON.stringify(session));
            console.log(`MFA验证已取消: ${sessionId}, 原因: ${reason}`);
            return true;
        } catch (error) {
            console.log(
                `取消MFA验证失败: ${sessionId}, 错误: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            return false;
        }
    }

    /**
     * 检查会话是否存在
     * @param sessionId 会话ID
     * @returns 是否存在
     */
    public async hasSession(sessionId: string): Promise<boolean> {
        const sessionKey = this.getSessionKey(sessionId);
        try {
            const exists = await this.redis.exists(sessionKey);
            return exists === 1;
        } catch {
            return false;
        }
    }

    /**
     * 获取所有活跃的会话ID
     * @returns 会话ID列表
     */
    public async getActiveSessions(): Promise<string[]> {
        try {
            const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
            return keys.map((key: string) => key.replace(this.KEY_PREFIX, ''));
        } catch (error) {
            console.error(
                '获取活跃会话失败:',
                error instanceof Error ? error : String(error)
            );
            return [];
        }
    }

    /**
     * 清理过期的请求
     * @param maxAge 最大存活时间（毫秒）
     */
    public async cleanupExpiredRequests(
        maxAge: number = this.DEFAULT_TIMEOUT
    ): Promise<void> {
        try {
            const keys = await this.redis.keys(`${this.KEY_PREFIX}*`);
            const now = new Date();
            let cleanedCount = 0;

            for (const key of keys) {
                try {
                    const data = await this.redis.get(key);
                    if (!data) continue;

                    // 确保data是字符串，如果是对象则先转换为字符串
                    const dataStr =
                        typeof data === 'string' ? data : JSON.stringify(data);
                    const session = JSON.parse(dataStr);
                    const createdAt = new Date(session.createdAt);

                    // 检查是否过期
                    if (now.getTime() - createdAt.getTime() > maxAge) {
                        await this.redis.del(key);
                        cleanedCount++;
                    }
                } catch (error) {
                    // 如果处理失败，直接删除
                    try {
                        await this.redis.del(key);
                        cleanedCount++;
                    } catch (unlinkError) {
                        console.error(
                            `删除过期会话失败: ${key}`,
                            unlinkError instanceof Error
                                ? unlinkError
                                : String(unlinkError)
                        );
                    }
                }
            }

            if (cleanedCount > 0) {
                console.log(`清理了 ${cleanedCount} 个过期的MFA验证会话`);
            }
        } catch (error) {
            console.error(
                '清理过期请求失败:',
                error instanceof Error ? error : String(error)
            );
        }
    }

    /**
     * 清理指定会话的资源
     * @param sessionId 会话ID
     */
    private async cleanupRequest(sessionId: string): Promise<void> {
        const sessionKey = this.getSessionKey(sessionId);
        try {
            await this.redis.del(sessionKey);
        } catch (error) {
            // 忽略错误
        }
    }

    /**
     * 关闭Redis连接
     */
    public async disconnect(): Promise<void> {
        if (this.redis && typeof this.redis.disconnect === 'function') {
            await this.redis.disconnect();
        } else if (this.redis && typeof this.redis.quit === 'function') {
            await this.redis.quit();
        }
    }
}
