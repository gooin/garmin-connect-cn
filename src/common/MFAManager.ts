import { promises as fs } from 'fs';
import path from 'path';

/**
 * MFA管理器，用于处理需要等待外部验证码的登录流程
 * 使用文件系统持久化存储，支持跨进程共享状态
 */
export class MFAManager {
    private static instance: MFAManager;
    private readonly storageDir: string;
    private readonly DEFAULT_TIMEOUT = 5 * 60 * 1000; // 5分钟

    private constructor(storageDir?: string) {
        // 使用提供的目录或默认临时目录
        this.storageDir =
            storageDir || path.join(process.cwd(), '.mfa-sessions');
        this.ensureStorageDir();
    }

    /**
     * 获取MFA管理器单例
     */
    public static getInstance(storageDir?: string): MFAManager {
        if (!MFAManager.instance) {
            console.log('创建MFA管理器实例');
            MFAManager.instance = new MFAManager(storageDir);
        }
        console.log('返回MFA管理器实例');
        return MFAManager.instance;
    }

    /**
     * 确保存储目录存在
     */
    private async ensureStorageDir(): Promise<void> {
        try {
            await fs.mkdir(this.storageDir, { recursive: true });
        } catch (error) {
            console.error('创建MFA存储目录失败:', error);
        }
    }

    /**
     * 获取会话文件路径
     */
    private getSessionFilePath(sessionId: string): string {
        return path.join(this.storageDir, `${sessionId}.json`);
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
        // 确保存储目录存在
        await this.ensureStorageDir();

        // 清理可能存在的旧会话
        await this.cleanupRequest(sessionId);

        // 创建会话文件
        const sessionData = {
            sessionId,
            status: 'waiting',
            createdAt: new Date().toISOString(),
            timeout: timeout
        };

        const sessionFilePath = this.getSessionFilePath(sessionId);
        await fs.writeFile(
            sessionFilePath,
            JSON.stringify(sessionData),
            'utf8'
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

                    // 检查会话文件是否存在
                    try {
                        const data = await fs.readFile(sessionFilePath, 'utf8');
                        const session = JSON.parse(data);

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
                        // 文件不存在或其他错误，继续等待
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
        const sessionFilePath = this.getSessionFilePath(sessionId);

        try {
            // 检查会话文件是否存在
            const data = await fs.readFile(sessionFilePath, 'utf8');
            const session = JSON.parse(data);

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

            await fs.writeFile(
                sessionFilePath,
                JSON.stringify(session),
                'utf8'
            );
            console.log(
                `MFA验证码已提交: code ${code}, sessionId ${sessionId}`
            );
            return true;
        } catch (error) {
            console.log(
                `未找到MFA验证会话: ${sessionId}, 错误: ${
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
        const sessionFilePath = this.getSessionFilePath(sessionId);

        try {
            // 检查会话文件是否存在
            const data = await fs.readFile(sessionFilePath, 'utf8');
            const session = JSON.parse(data);

            // 更新会话状态为已拒绝
            session.status = 'rejected';
            session.error = reason;
            session.rejectedAt = new Date().toISOString();

            await fs.writeFile(
                sessionFilePath,
                JSON.stringify(session),
                'utf8'
            );
            console.log(`MFA验证已取消: ${sessionId}, 原因: ${reason}`);
            return true;
        } catch (error) {
            console.log(
                `未找到MFA验证会话: ${sessionId}, 错误: ${
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
        const sessionFilePath = this.getSessionFilePath(sessionId);
        try {
            await fs.access(sessionFilePath);
            return true;
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
            await this.ensureStorageDir();
            const files = await fs.readdir(this.storageDir);
            return files
                .filter((file) => file.endsWith('.json'))
                .map((file) => file.replace('.json', ''));
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
            await this.ensureStorageDir();
            const files = await fs.readdir(this.storageDir);
            const now = new Date();
            let cleanedCount = 0;

            for (const file of files) {
                if (!file.endsWith('.json')) continue;

                try {
                    const filePath = path.join(this.storageDir, file);
                    const data = await fs.readFile(filePath, 'utf8');
                    const session = JSON.parse(data);
                    const createdAt = new Date(session.createdAt);

                    // 检查是否过期
                    if (now.getTime() - createdAt.getTime() > maxAge) {
                        await fs.unlink(filePath);
                        cleanedCount++;
                    }
                } catch (error) {
                    // 如果文件读取失败，直接删除
                    try {
                        await fs.unlink(path.join(this.storageDir, file));
                        cleanedCount++;
                    } catch (unlinkError) {
                        console.error(
                            `删除过期会话文件失败: ${file}`,
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
        const sessionFilePath = this.getSessionFilePath(sessionId);
        try {
            await fs.unlink(sessionFilePath);
        } catch (error) {
            // 文件不存在，忽略错误
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
