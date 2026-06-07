import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        // 佳明网络 API 请求可能较慢，将单用例超时时间设为 60 秒
        testTimeout: 60000,
        include: ['test/**/*.test.ts'],
        globals: true
    }
});
