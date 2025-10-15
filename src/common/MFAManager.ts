/**
 * MFA管理器，用于处理需要等待外部验证码的登录流程
 */
export class MFAManager {
    private static instance: MFAManager;
    private pendingMFARequests: Map<
        string,
        {
            resolve: (code: string) => void;
            reject: (error: Error) => void;
            timeout: NodeJS.Timeout;
            createdAt: Date;
        }
    > = new Map();

    // 默认超时时间：5分钟
    private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000;

    private constructor() {}

    /**
     * 获取MFA管理器单例
     */
    public static getInstance(): MFAManager {
        if (!MFAManager.instance) {
            MFAManager.instance = new MFAManager();
        }
        return MFAManager.instance;
    }

    /**
     * 创建一个等待MFA验证码的Promise
     * @param sessionId 会话ID
     * @param timeout 超时时间（毫秒）
     * @returns Promise<string> 返回验证码
     */
    public waitForMFACode(
        sessionId: string,
        timeout: number = this.DEFAULT_TIMEOUT
    ): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            // 如果已经存在该会话，先清理
            if (this.pendingMFARequests.has(sessionId)) {
                this.cleanupRequest(sessionId);
            }

            // 设置超时处理
            const timeoutHandle = setTimeout(() => {
                this.cleanupRequest(sessionId);
                reject(new Error('MFA验证超时，请重新登录'));
            }, timeout);

            // 存储请求
            this.pendingMFARequests.set(sessionId, {
                resolve,
                reject,
                timeout: timeoutHandle,
                createdAt: new Date()
            });

            console.log(`MFA验证会话已创建: ${sessionId}`);
        });
    }

    /**
     * 提交MFA验证码
     * @param sessionId 会话ID
     * @param code 验证码
     * @returns 是否成功提交
     */
    public submitMFACode(sessionId: string, code: string): boolean {
        const request = this.pendingMFARequests.get(sessionId);
        if (!request) {
            console.log(`未找到MFA验证会话: ${sessionId}`);
            return false;
        }

        // 清理请求
        this.cleanupRequest(sessionId);

        // 解决Promise
        request.resolve(code);
        console.log(`MFA验证码已提交: ${sessionId}`);
        return true;
    }

    /**
     * 取消MFA验证
     * @param sessionId 会话ID
     * @param reason 取消原因
     * @returns 是否成功取消
     */
    public cancelMFARequest(
        sessionId: string,
        reason: string = 'MFA验证已取消'
    ): boolean {
        const request = this.pendingMFARequests.get(sessionId);
        if (!request) {
            return false;
        }

        // 清理请求
        this.cleanupRequest(sessionId);

        // 拒绝Promise
        request.reject(new Error(reason));
        console.log(`MFA验证已取消: ${sessionId}, 原因: ${reason}`);
        return true;
    }

    /**
     * 检查会话是否存在
     * @param sessionId 会话ID
     * @returns 是否存在
     */
    public hasSession(sessionId: string): boolean {
        return this.pendingMFARequests.has(sessionId);
    }

    /**
     * 获取所有活跃的会话ID
     * @returns 会话ID列表
     */
    public getActiveSessions(): string[] {
        return Array.from(this.pendingMFARequests.keys());
    }

    /**
     * 清理过期的请求
     * @param maxAge 最大存活时间（毫秒）
     */
    public cleanupExpiredRequests(maxAge: number = this.DEFAULT_TIMEOUT): void {
        const now = new Date();
        const expiredSessions: string[] = [];

        this.pendingMFARequests.forEach((request, sessionId) => {
            const age = now.getTime() - request.createdAt.getTime();
            if (age > maxAge) {
                expiredSessions.push(sessionId);
            }
        });

        expiredSessions.forEach((sessionId) => {
            this.cancelMFARequest(sessionId, 'MFA验证会话已过期');
        });

        if (expiredSessions.length > 0) {
            console.log(`清理了 ${expiredSessions.length} 个过期的MFA验证会话`);
        }
    }

    /**
     * 清理指定会话的资源
     * @param sessionId 会话ID
     */
    private cleanupRequest(sessionId: string): void {
        const request = this.pendingMFARequests.get(sessionId);
        if (request) {
            clearTimeout(request.timeout);
            this.pendingMFARequests.delete(sessionId);
        }
    }

    /**
     * 定期清理过期请求
     */
    public startCleanupTask(interval: number = 60000): void {
        setInterval(() => {
            this.cleanupExpiredRequests();
        }, interval);
    }
}
