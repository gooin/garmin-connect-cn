import axios, {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
    RawAxiosRequestHeaders
} from 'axios';
import FormData from 'form-data';
import _ from 'lodash';
import { DateTime } from 'luxon';
import OAuth from 'oauth-1.0a';
import qs from 'qs';
import { MFAManager } from './MFAManager';
import { UrlClass } from '../garmin/UrlClass';
import {
    GCConfig,
    IOauth1,
    IOauth1Consumer,
    IOauth1Token,
    IOauth2Token
} from '../garmin/types';
import crypto from 'node:crypto';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';

// 正则表达式常量
const CSRF_RE = new RegExp('name="_csrf"\\s+value="(.+?)"');
const TICKET_RE = new RegExp('ticket=([^"]+)"');
const ACCOUNT_LOCKED_RE = new RegExp('var statuss*=s*"([^"]*)"');
const PAGE_TITLE_RE = new RegExp('<title>([^<]*)</title>');

// 用户代理常量
const USER_AGENT_CONNECTMOBILE = 'com.garmin.android.apps.connectmobile';
const USER_AGENT_BROWSER =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';
const USER_AGENT_BROWSER_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// URL常量
const OAUTH_CONSUMER_URL =
    'https://thegarth.s3.amazonaws.com/oauth_consumer.json';

// HTTP状态码常量
const HTTP_STATUS = {
    UNAUTHORIZED: 401
} as const;

// 类型定义
interface RefreshSubscriber {
    resolve: (token: string) => void;
    reject: (error: any) => void;
}

interface LoginStepParams {
    step1Params: Record<string, any>;
    step2Params: Record<string, any>;
    step3Params: Record<string, any>;
}

// 全局变量
let tokenRefreshPromise: Promise<void> | null = null;
let refreshSubscribers: RefreshSubscriber[] = [];

export class HttpClient {
    client: AxiosInstance;
    url: UrlClass;
    config: GCConfig;
    oauth1Token: IOauth1Token | undefined;
    oauth2Token: IOauth2Token | undefined;
    OAUTH_CONSUMER: IOauth1Consumer | undefined;
    mfaManager: MFAManager;

    constructor(url: UrlClass, config: GCConfig) {
        const jar = new CookieJar();
        this.url = url;
        this.client = wrapper(
            axios.create({
                timeout: config?.timeout ?? 5000,
                timeoutErrorMessage: `Request Timeout: > ${
                    config?.timeout ?? 5000
                } ms`,
                maxRedirects: 10,
                validateStatus: function (status) {
                    return status >= 200 && status < 400;
                },
                withCredentials: true, // 启用cookie自动处理
                jar: jar
            })
        );
        this.config = config;

        // 使用新的MFA配置初始化MFAManager
        const mfaConfig = config.mfa || {
            type: 'file',
            dir: config.mfaStorageDir || '/tmp'
        };
        this.mfaManager = MFAManager.getInstance(mfaConfig);
        this.setupInterceptors();
    }

    /**
     * 设置请求和响应拦截器
     */
    private setupInterceptors(): void {
        // 响应拦截器
        this.client.interceptors.response.use(
            (response) => {
                // this.logResponseTracking(response);
                return response;
            },
            async (error) => {
                return this.handleResponseError(error);
            }
        );

        // 请求拦截器
        this.client.interceptors.request.use(async (config) => {
            if (this.oauth2Token) {
                config.headers.Authorization =
                    'Bearer ' + this.oauth2Token.access_token;
            }
            return config;
        });
    }

    /**
     * 记录响应跟踪信息
     */
    private logResponseTracking(response: AxiosResponse): void {
        if (
            response.config.url?.includes('signin') ||
            response.config.url?.includes('verifyMFA')
        ) {
            console.log('> 响应跟踪 - URL:', response.config.url);
            console.log('响应跟踪 - 状态码:', response.status);
            console.log(
                '响应跟踪 - 最终URL:',
                response.request?.responseURL || response.config.url
            );
            console.log(
                '响应跟踪 - 重定向次数:',
                response.request?.redirectCount || 0
            );

            if (response.headers.location) {
                console.log(
                    '响应跟踪 - Location头:',
                    response.headers.location
                );
            }

            if (response.status >= 300 && response.status < 400) {
                console.log('响应跟踪 - 检测到重定向状态码:', response.status);
            }
        }
    }

    /**
     * 处理响应错误
     */
    private async handleResponseError(error: any): Promise<AxiosResponse> {
        if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
            throw new Error(error.message || 'Request Timeout');
        }

        const originalRequest = error.config;

        if (
            error?.response?.status === HTTP_STATUS.UNAUTHORIZED &&
            !originalRequest?._retry
        ) {
            if (!this.oauth2Token) {
                throw new Error('No OAuth2 token available');
            }

            originalRequest._retry = true;

            try {
                if (!tokenRefreshPromise) {
                    tokenRefreshPromise = this.refreshOauth2Token().finally(
                        () => {
                            tokenRefreshPromise = null;
                        }
                    );
                }

                await tokenRefreshPromise;

                originalRequest.headers.Authorization = `Bearer ${this.oauth2Token.access_token}`;
                return this.client(originalRequest);
            } catch (err) {
                console.error('Token refresh failed:', err);
                throw err;
            }
        }

        if (axios.isAxiosError(error) && error.response) {
            this.handleError(error.response);
        } else {
            throw new Error('Network error or unknown error occurred');
        }
        throw error;
    }

    /**
     * 获取OAuth消费者信息
     */
    async fetchOauthConsumer(): Promise<void> {
        const response = await axios.get(OAUTH_CONSUMER_URL);
        this.OAUTH_CONSUMER = {
            key: response.data.consumer_key,
            secret: response.data.consumer_secret
        };
    }

    /**
     * 检查令牌有效性
     */
    async checkTokenVaild(): Promise<void> {
        if (this.oauth2Token) {
            if (this.oauth2Token.expires_at < DateTime.now().toSeconds()) {
                console.error('Token expired!');
                await this.refreshOauth2Token();
            }
        }
    }

    /**
     * GET请求
     */
    async get<T>(url: string, config?: AxiosRequestConfig<any>): Promise<T> {
        const response = await this.client.get<T>(url, config);
        return response?.data;
    }

    /**
     * POST请求
     */
    async post<T>(
        url: string,
        data: any,
        config?: AxiosRequestConfig<any>
    ): Promise<T> {
        const response = await this.client.post<T>(url, data, config);
        return response?.data;
    }

    /**
     * PUT请求
     */
    async put<T>(
        url: string,
        data: any,
        config?: AxiosRequestConfig<any>
    ): Promise<T> {
        const response = await this.client.put<T>(url, data, config);
        return response?.data;
    }

    /**
     * DELETE请求
     */
    async delete<T>(url: string, config?: AxiosRequestConfig<any>): Promise<T> {
        const response = await this.client.post<T>(url, null, {
            ...config,
            headers: {
                ...config?.headers,
                'X-Http-Method-Override': 'DELETE'
            }
        });
        return response?.data;
    }

    /**
     * 设置通用请求头
     */
    setCommonHeader(headers: RawAxiosRequestHeaders): void {
        _.each(headers, (headerValue, key) => {
            this.client.defaults.headers.common[key] = headerValue;
        });
    }

    /**
     * 处理错误
     */
    handleError(response: AxiosResponse): void {
        this.handleHttpError(response);
    }

    /**
     * 处理HTTP错误
     */
    handleHttpError(response: AxiosResponse): void {
        const { status, statusText, data } = response;
        const errorMessage = {
            status,
            statusText,
            data: typeof data === 'object' ? JSON.stringify(data) : data
        };

        console.error('HTTP Error:', errorMessage);
        throw new Error(`HTTP Error (${status}): ${statusText}`);
    }

    /**
     * 登录到Garmin Connect
     * @param username 用户名
     * @param password 密码
     * @param mfaCallback MFA验证回调函数
     * @param sessionId 会话ID，用于分步登录
     * @returns Promise<HttpClient>
     */
    async login(
        username: string,
        password: string,
        sessionId?: string
    ): Promise<HttpClient> {
        try {
            // 准备登录
            await this.fetchOauthConsumer();

            // 获取登录票据
            const ticket = await this.getLoginTicket(
                username,
                password,
                sessionId
            );

            // 获取OAuth1令牌
            const oauth1 = await this.getOauth1Token(ticket);

            // 交换OAuth2令牌
            await this.exchange(oauth1);

            return this;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    /**
     * 获取登录票据
     * @param username 用户名
     * @param password 密码
     * @param mfaCallback MFA验证回调函数
     * @param sessionId 会话ID，用于分步登录
     * @returns 登录票据
     */
    private async getLoginTicket(
        username: string,
        password: string,
        sessionId?: string
    ): Promise<string> {
        // 准备登录参数
        const loginParams = this.prepareLoginParams();

        // 步骤1: 设置cookie
        await this.performLoginStep1(loginParams.step1Params);

        // 步骤2: 获取CSRF令牌
        const csrfToken = await this.performLoginStep2(loginParams.step2Params);

        // 步骤3: 提交凭据
        let signinResult = await this.performLoginStep3(
            username,
            password,
            csrfToken,
            loginParams.step3Params
        );

        // 检查账户锁定状态
        this.handleAccountLocked(signinResult);

        // 检查页面标题，判断是否需要MFA
        const pageTitle = this.handlePageTitle(signinResult);

        // 如果需要MFA，执行MFA验证
        if (this.isMFARequired(pageTitle)) {
            // 如果提供了sessionId，则使用分步登录模式
            if (sessionId) {
                // 等待外部提供验证码
                const mfaCode = await this.mfaManager.waitForMFACode(sessionId);

                // 使用获取到的验证码完成MFA验证
                signinResult = await this.handleMFAWithCode(
                    signinResult,
                    loginParams.step3Params,
                    mfaCode
                );
            } else {
                throw new Error('需要MFA验证，但未提供验证码获取方式');
            }
        }

        // 提取票据
        const ticket = this.extractTicket(signinResult);
        if (!ticket) {
            throw new Error(
                '登录失败（未找到票据或MFA验证失败），请检查用户名和密码'
            );
        }

        return ticket;
    }

    /**
     * 准备登录参数
     */
    private prepareLoginParams(): LoginStepParams {
        return {
            step1Params: {
                clientId: 'GarminConnect',
                locale: 'en',
                service: this.url.GC_MODERN
            },
            step2Params: {
                id: 'gauth-widget',
                embedWidget: true,
                locale: 'en',
                gauthHost: this.url.GARMIN_SSO_EMBED
            },
            step3Params: {
                id: 'gauth-widget',
                embedWidget: true,
                clientId: 'GarminConnect',
                locale: 'en',
                gauthHost: this.url.GARMIN_SSO_EMBED,
                service: this.url.GARMIN_SSO_EMBED,
                source: this.url.GARMIN_SSO_EMBED,
                redirectAfterAccountLoginUrl: this.url.GARMIN_SSO_EMBED,
                redirectAfterAccountCreationUrl: this.url.GARMIN_SSO_EMBED
            }
        };
    }

    /**
     * 执行登录步骤1：设置cookie
     */
    private async performLoginStep1(
        step1Params: Record<string, string>
    ): Promise<void> {
        const step1Url = `${this.url.GARMIN_SSO_EMBED}?${qs.stringify(
            step1Params
        )}`;
        await this.client.get(step1Url);
    }

    /**
     * 执行登录步骤2：获取CSRF令牌
     */
    private async performLoginStep2(
        step2Params: Record<string, string>
    ): Promise<string> {
        const step2Url = `${this.url.SIGNIN_URL}?${qs.stringify(step2Params)}`;
        const step2Result = await this.get<string>(step2Url);

        const csrfToken = this.extractCsrfToken(step2Result);
        if (!csrfToken) {
            throw new Error('登录 - 未找到CSRF令牌');
        }
        return csrfToken;
    }

    /**
     * 执行登录步骤3：提交凭据
     */
    private async performLoginStep3(
        username: string,
        password: string,
        csrfToken: string,
        step3Params: Record<string, string>
    ): Promise<string> {
        const step3Url = `${this.url.SIGNIN_URL}?${qs.stringify(step3Params)}`;
        // console.log('🚀 - getLoginTicket - step3Url:', step3Url);

        const step3Form = new FormData();
        step3Form.append('username', username);
        step3Form.append('password', password);
        step3Form.append('embed', 'true');
        step3Form.append('_csrf', csrfToken);

        return this.post<string>(step3Url, step3Form, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Dnt: 1,
                Origin: this.url.GARMIN_SSO_ORIGIN,
                Referer: this.url.SIGNIN_URL,
                'User-Agent': USER_AGENT_CONNECTMOBILE
            }
        });
    }

    /**
     * 判断是否需要MFA验证
     */
    private isMFARequired(pageTitle: string): boolean {
        return pageTitle.toLowerCase().includes('mfa');
    }

    /**
     * 从响应中提取票据
     */
    private extractTicket(signinResult: string): string | null {
        const ticketRegResult = TICKET_RE.exec(signinResult);
        return ticketRegResult ? ticketRegResult[1] : null;
    }

    /**
     * 处理MFA验证（使用直接提供的验证码）
     * @param htmlStr HTML响应字符串
     * @param signinParams 登录参数
     * @param mfaCode MFA验证码
     * @returns MFA验证后的响应字符串
     */
    async handleMFAWithCode(
        htmlStr: string,
        signinParams: Record<string, any>,
        mfaCode: string
    ): Promise<string> {
        try {
            // 提取CSRF令牌
            const csrfToken = this.extractCsrfToken(htmlStr);
            if (!csrfToken) {
                throw new Error('MFA验证 - 未找到CSRF令牌');
            }

            // 提交MFA验证码
            const mfaResult = await this.submitMFACode(
                csrfToken,
                mfaCode,
                signinParams
            );

            // 验证MFA结果
            return this.validateMFAResult(mfaResult);
        } catch (error) {
            console.error('MFA验证失败:', error);
            throw new Error(`MFA验证失败: ${error}`);
        }
    }

    /**
     * 处理MFA验证
     * @param htmlStr HTML响应字符串
     * @param signinParams 登录参数
     * @param mfaCallback MFA验证回调函数
     * @returns MFA验证后的响应字符串
     */
    async handleMFA(
        htmlStr: string,
        signinParams: Record<string, any>,
        mfaCallback?: () => Promise<string>
    ): Promise<string> {
        // 验证MFA回调函数
        if (!mfaCallback) {
            throw new Error('登录失败（需要MFA验证），请提供MFA回调函数');
        }

        // 提取CSRF令牌
        const csrfToken = this.extractCsrfToken(htmlStr);
        // console.log('🚀 - handleMFA - csrfToken:', csrfToken);
        if (!csrfToken) {
            throw new Error('无法从MFA页面提取CSRF令牌');
        }

        // 获取MFA验证码
        const mfaCode = await mfaCallback();
        console.log('🚀 - handleMFA - mfaCode:', mfaCode);

        // 提交MFA验证
        const mfaResult = await this.submitMFACode(
            csrfToken,
            mfaCode,
            signinParams
        );

        // 验证MFA结果
        return this.validateMFAResult(mfaResult);
    }

    /**
     * 提交MFA验证码
     */
    private async submitMFACode(
        csrfToken: string,
        mfaCode: string,
        signinParams: Record<string, any>
    ): Promise<string> {
        const SSO = this.url.GARMIN_SSO;
        const mfaForm = new FormData();
        mfaForm.append('mfa-code', mfaCode);
        mfaForm.append('embed', 'true');
        mfaForm.append('_csrf', csrfToken);

        return this.post<string>(
            `${SSO}/verifyMFA/loginEnterMfaCode`,
            mfaForm,
            {
                params: signinParams,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Dnt: 1,
                    Origin: this.url.GARMIN_SSO_ORIGIN,
                    Referer: `${SSO}/signin`,
                    'User-Agent': USER_AGENT_BROWSER
                },
                maxRedirects: 10,
                transformResponse: [
                    function (data, headers) {
                        if (
                            headers.location &&
                            headers.location.includes('logintoken')
                        ) {
                            console.log(
                                '检测到重定向到包含logintoken的URL:',
                                headers.location
                            );
                        }
                        return data;
                    }
                ]
            }
        );
    }

    /**
     * 验证MFA结果
     */
    private validateMFAResult(mfaResult: string): string {
        // console.log('MFA验证完成:', mfaResult);
        const pageTitle = this.handlePageTitle(mfaResult);
        console.log('MFA验证后的页面标题:', pageTitle);
        return mfaResult;
    }

    /**
     * 从HTML中提取CSRF令牌
     * @param html HTML字符串
     * @returns CSRF令牌或null
     */
    extractCsrfToken(html: string): string | null {
        const match = CSRF_RE.exec(html);
        return match ? match[1] : null;
    }

    /**
     * 处理页面标题
     * @param htmlStr HTML字符串
     * @returns 页面标题
     */
    handlePageTitle(htmlStr: string): string {
        const pageTitleRegResult = PAGE_TITLE_RE.exec(htmlStr);
        if (pageTitleRegResult) {
            const title = pageTitleRegResult[1];
            console.log('登录页面标题:', title);
            if (_.includes(title, 'Update Phone Number')) {
                throw new Error(
                    '登录失败（需要更新电话号码），请更新您的电话号码，参考: https://github.com/matin/garth/issues/19'
                );
            }
            return title;
        } else {
            throw new Error('登录失败（未找到页面标题）');
        }
    }

    /**
     * 处理账户锁定状态
     * @param htmlStr HTML字符串
     */
    handleAccountLocked(htmlStr: string): void {
        const accountLockedRegResult = ACCOUNT_LOCKED_RE.exec(htmlStr);
        if (accountLockedRegResult) {
            const msg = accountLockedRegResult[1];
            console.error(msg);
            throw new Error(
                '登录失败（账户已锁定），请打开Connect网页解锁您的账户'
            );
        }
    }

    /**
     * 刷新OAuth2令牌
     */
    async refreshOauth2Token(): Promise<void> {
        try {
            if (!this.OAUTH_CONSUMER) {
                await this.fetchOauthConsumer();
            }

            if (!this.oauth2Token || !this.oauth1Token) {
                throw new Error('缺少刷新令牌所需的必要令牌');
            }

            const oauth1 = {
                oauth: this.getOauthClient(this.OAUTH_CONSUMER!),
                token: this.oauth1Token
            };

            await this.exchange(oauth1);
            console.log(
                `「${this.config.username}」在「${this.url.domain}」的OAuth2令牌刷新成功`
            );
        } catch (error) {
            console.error('刷新OAuth2令牌失败:', error);
            throw error;
        }
    }

    /**
     * 获取OAuth1令牌
     * @param ticket 登录票据
     * @returns OAuth1令牌和客户端
     */
    async getOauth1Token(ticket: string): Promise<IOauth1> {
        if (!this.OAUTH_CONSUMER) {
            throw new Error('未找到OAuth消费者信息');
        }

        const params = {
            ticket,
            'login-url': this.url.GARMIN_SSO_EMBED,
            'accepts-mfa-tokens': true
        };
        const url = `${this.url.OAUTH_URL}/preauthorized?${qs.stringify(
            params
        )}`;

        const oauth = this.getOauthClient(this.OAUTH_CONSUMER);

        const requestData = {
            url: url,
            method: 'GET'
        };
        const headers = oauth.toHeader(oauth.authorize(requestData));

        const response = await this.get<string>(url, {
            headers: {
                ...headers,
                'User-Agent': USER_AGENT_CONNECTMOBILE
            }
        });

        const token = qs.parse(response) as unknown as IOauth1Token;
        this.oauth1Token = token;
        return { token, oauth };
    }

    /**
     * 获取OAuth客户端
     * @param consumer OAuth消费者信息
     * @returns OAuth客户端
     */
    getOauthClient(consumer: IOauth1Consumer): OAuth {
        return new OAuth({
            consumer: consumer,
            signature_method: 'HMAC-SHA1',
            hash_function(base_string: string, key: string) {
                return crypto
                    .createHmac('sha1', key)
                    .update(base_string)
                    .digest('base64');
            }
        });
    }

    /**
     * 交换OAuth2令牌
     * @param oauth1 OAuth1令牌和客户端
     */
    async exchange(oauth1: IOauth1): Promise<void> {
        const token = {
            key: oauth1.token.oauth_token,
            secret: oauth1.token.oauth_token_secret
        };

        const baseUrl = `${this.url.OAUTH_URL}/exchange/user/2.0`;
        const requestData = {
            url: baseUrl,
            method: 'POST',
            data: null
        };

        const authData = oauth1.oauth.authorize(requestData, token);
        const url = `${baseUrl}?${qs.stringify(authData)}`;

        this.oauth2Token = undefined;
        const response = await this.post<IOauth2Token>(url, null, {
            headers: {
                'User-Agent': USER_AGENT_CONNECTMOBILE,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        this.oauth2Token = this.setOauth2TokenExpiresAt(response);
    }

    /**
     * 设置OAuth2令牌过期时间
     * @param token OAuth2令牌
     * @returns 设置了过期时间的OAuth2令牌
     */
    setOauth2TokenExpiresAt(token: IOauth2Token): IOauth2Token {
        const now = DateTime.now();
        const expiresAt = now.plus({ seconds: token.expires_in });
        const refreshTokenExpiresAt = now.plus({
            seconds: token.refresh_token_expires_in
        });

        return {
            ...token,
            last_update_date: now.toLocal().toString(),
            expires_date: expiresAt.toLocal().toString(),
            expires_at: expiresAt.toSeconds(),
            refresh_token_expires_at: refreshTokenExpiresAt.toSeconds()
        };
    }
}
