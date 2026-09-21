/**
 * MFA 日志脱敏：标准验证码仅保留首尾字符，中间统一替换为星号。
 * 极短输入不保留原文，避免两位及以下的秘密被完整暴露。
 */
export function maskMfaCode(code: string): string {
    if (code.length <= 2) {
        return '*'.repeat(code.length);
    }
    return `${code[0]}${'*'.repeat(code.length - 2)}${code[code.length - 1]}`;
}
