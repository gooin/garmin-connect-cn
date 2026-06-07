import _ from 'lodash';

/**
 * 结构化打印接口响应数据
 * @param title 测试模块或接口标题
 * @param data 接口原始返回数据
 * @param summarizeFn 自定义精简展示函数，当 DEBUG 不为 true 时执行
 */
export function printResponse(
    title: string,
    data: any,
    summarizeFn: (data: any) => any
) {
    console.log(
        `\n=================== [RESPONSE] ${title} ===================`
    );

    if (process.env.DEBUG === 'true') {
        console.log(JSON.stringify(data, null, 2));
    } else {
        try {
            const summary = summarizeFn(data);
            console.log(
                '摘要数据 (提示: 运行 DEBUG=true pnpm test 可看完整大 JSON):'
            );
            console.log(JSON.stringify(summary, null, 2));
        } catch (e: any) {
            // 兜底：直接做截断打印
            const rawStr =
                typeof data === 'string' ? data : JSON.stringify(data);
            console.log(`[截断输出] ${rawStr.substring(0, 400)}...`);
        }
    }

    console.log(`=========================================================\n`);
}
