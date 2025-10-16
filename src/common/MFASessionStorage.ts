/**
 * MFA存储接口，定义了MFA会话存储的基本操作
 */
export interface MFASessionStorage {
    /**
     * 创建一个等待MFA验证码的会话
     * @param sessionId 会话ID
     * @param timeout 超时时间（毫秒）
     * @returns Promise<string> 返回验证码
     */
    waitForMFACode(sessionId: string, timeout?: number): Promise<string>;

    /**
     * 提交MFA验证码
     * @param sessionId 会话ID
     * @param code 验证码
     * @returns 是否成功提交
     */
    submitMFACode(sessionId: string, code: string): Promise<boolean>;

    /**
     * 取消MFA验证
     * @param sessionId 会话ID
     * @param reason 取消原因
     * @returns 是否成功取消
     */
    cancelMFARequest(sessionId: string, reason?: string): Promise<boolean>;

    /**
     * 检查会话是否存在
     * @param sessionId 会话ID
     * @returns 是否存在
     */
    hasSession(sessionId: string): Promise<boolean>;

    /**
     * 获取所有活跃的会话ID
     * @returns 会话ID列表
     */
    getActiveSessions(): Promise<string[]>;

    /**
     * 清理过期的请求
     * @param maxAge 最大存活时间（毫秒）
     */
    cleanupExpiredRequests(maxAge?: number): Promise<void>;
}
