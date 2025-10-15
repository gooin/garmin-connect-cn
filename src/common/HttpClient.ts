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

const CSRF_RE = new RegExp('name="_csrf"\\s+value="(.+?)"');
const TICKET_RE = new RegExp('ticket=([^"]+)"');
const ACCOUNT_LOCKED_RE = new RegExp('var statuss*=s*"([^"]*)"');
const PAGE_TITLE_RE = new RegExp('<title>([^<]*)</title>');

const USER_AGENT_CONNECTMOBILE = 'com.garmin.android.apps.connectmobile';
const USER_AGENT_BROWSER =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36';
const USER_AGENT_BROWSER_MAC =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const OAUTH_CONSUMER_URL =
    'https://thegarth.s3.amazonaws.com/oauth_consumer.json';

interface RefreshSubscriber {
    resolve: (token: string) => void;
    reject: (error: any) => void;
}

const HTTP_STATUS = {
    UNAUTHORIZED: 401
} as const;

let tokenRefreshPromise: Promise<void> | null = null;
let refreshSubscribers: RefreshSubscriber[] = [];

export class HttpClient {
    client: AxiosInstance;
    url: UrlClass;
    config: GCConfig;
    oauth1Token: IOauth1Token | undefined;
    oauth2Token: IOauth2Token | undefined;
    OAUTH_CONSUMER: IOauth1Consumer | undefined;

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
        this.client.interceptors.response.use(
            (response) => {
                // 跟踪重定向过程
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

                    // 检查是否有Location头
                    if (response.headers.location) {
                        console.log(
                            '响应跟踪 - Location头:',
                            response.headers.location
                        );
                    }

                    // 检查响应头中可能的重定向信息
                    if (response.status >= 300 && response.status < 400) {
                        console.log(
                            '响应跟踪 - 检测到重定向状态码:',
                            response.status
                        );
                    }
                }
                return response;
            },
            async (error) => {
                if (
                    axios.isAxiosError(error) &&
                    error.code === 'ECONNABORTED'
                ) {
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
                            tokenRefreshPromise =
                                this.refreshOauth2Token().finally(() => {
                                    tokenRefreshPromise = null;
                                });
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
                    // 处理没有response的情况
                    throw new Error('Network error or unknown error occurred');
                }
                throw error;
            }
        );
        this.client.interceptors.request.use(async (config) => {
            if (this.oauth2Token) {
                config.headers.Authorization =
                    'Bearer ' + this.oauth2Token.access_token;
            }
            return config;
        });
    }

    async fetchOauthConsumer() {
        const response = await axios.get(OAUTH_CONSUMER_URL);
        this.OAUTH_CONSUMER = {
            key: response.data.consumer_key,
            secret: response.data.consumer_secret
        };
    }

    async checkTokenVaild() {
        if (this.oauth2Token) {
            if (this.oauth2Token.expires_at < DateTime.now().toSeconds()) {
                console.error('Token expired!');
                await this.refreshOauth2Token();
            }
        }
    }

    async get<T>(url: string, config?: AxiosRequestConfig<any>): Promise<T> {
        const response = await this.client.get<T>(url, config);
        return response?.data;
    }

    async post<T>(
        url: string,
        data: any,
        config?: AxiosRequestConfig<any>
    ): Promise<T> {
        const response = await this.client.post<T>(url, data, config);
        return response?.data;
    }

    async put<T>(
        url: string,
        data: any,
        config?: AxiosRequestConfig<any>
    ): Promise<T> {
        const response = await this.client.put<T>(url, data, config);
        return response?.data;
    }

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

    setCommonHeader(headers: RawAxiosRequestHeaders): void {
        _.each(headers, (headerValue, key) => {
            this.client.defaults.headers.common[key] = headerValue;
        });
    }

    handleError(response: AxiosResponse): void {
        this.handleHttpError(response);
    }

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
     * Login to Garmin Connect
     * @param username
     * @param password
     * @returns {Promise<HttpClient>}
     */
    async login(
        username: string,
        password: string,
        mfaCallback?: () => Promise<string>
    ): Promise<HttpClient> {
        await this.fetchOauthConsumer();
        // Step1-3: Get ticket from page.
        const ticket = await this.getLoginTicket(
            username,
            password,
            mfaCallback
        );
        // Step4: Oauth1
        const oauth1 = await this.getOauth1Token(ticket);
        // TODO: Handle MFA

        // Step 5: Oauth2
        await this.exchange(oauth1);
        return this;
    }

    private async getLoginTicket(
        username: string,
        password: string,
        mfaCallback?: () => Promise<string>
    ): Promise<string> {
        // Step1: Set cookie
        const step1Params = {
            clientId: 'GarminConnect',
            locale: 'en',
            service: this.url.GC_MODERN
        };
        const step1Url = `${this.url.GARMIN_SSO_EMBED}?${qs.stringify(
            step1Params
        )}`;
        // console.log('login - step1Url:', step1Url);
        await this.client.get(step1Url);

        // Step2 Get _csrf
        const step2Params = {
            id: 'gauth-widget',
            embedWidget: true,
            locale: 'en',
            gauthHost: this.url.GARMIN_SSO_EMBED
        };
        const step2Url = `${this.url.SIGNIN_URL}?${qs.stringify(step2Params)}`;
        // console.log('login - step2Url:', step2Url);
        const step2Result = await this.get<string>(step2Url);
        // console.log('login - step2Result:', step2Result)
        const csrfRegResult = CSRF_RE.exec(step2Result);
        if (!csrfRegResult) {
            throw new Error('login - csrf not found');
        }
        const csrf_token = csrfRegResult[1];
        console.log('🚀 - getLoginTicket - csrf:', csrf_token);

        // Step3 Get ticket
        const signinParams = {
            id: 'gauth-widget',
            embedWidget: true,
            clientId: 'GarminConnect',
            locale: 'en',
            gauthHost: this.url.GARMIN_SSO_EMBED,
            service: this.url.GARMIN_SSO_EMBED,
            source: this.url.GARMIN_SSO_EMBED,
            redirectAfterAccountLoginUrl: this.url.GARMIN_SSO_EMBED,
            redirectAfterAccountCreationUrl: this.url.GARMIN_SSO_EMBED
        };
        const step3Url = `${this.url.SIGNIN_URL}?${qs.stringify(signinParams)}`;
        console.log('🚀 - getLoginTicket - step3Url:', step3Url);
        const step3Form = new FormData();
        step3Form.append('username', username);
        step3Form.append('password', password);
        step3Form.append('embed', 'true');
        step3Form.append('_csrf', csrf_token);
        let signinResult = '';
        signinResult = await this.post<string>(step3Url, step3Form, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Dnt: 1,
                Origin: this.url.GARMIN_SSO_ORIGIN,
                Referer: this.url.SIGNIN_URL,
                'User-Agent': USER_AGENT_CONNECTMOBILE
            }
        });
        this.handleAccountLocked(signinResult);
        const title = this.handlePageTitle(signinResult);
        if (title.toLowerCase().includes('mfa')) {
            console.log('🚀 - getLoginTicket - MFA required:', title);
            signinResult = await this.handleMFA(
                signinResult,
                signinParams,
                mfaCallback
            );
        }

        const ticketRegResult = TICKET_RE.exec(signinResult);
        if (!ticketRegResult) {
            throw new Error(
                'login failed (Ticket not found or MFA), please check username and password'
            );
        }
        const ticket = ticketRegResult[1];
        return ticket;
    }

    async handleMFA(
        htmlStr: string,
        signinParams: Record<string, any>,
        mfaCallback?: () => Promise<string>
    ): Promise<string> {
        if (!mfaCallback) {
            throw new Error(
                'login failed (MFA required), please provide MFA callback'
            );
        }
        // 提取CSRF令牌
        const csrfToken = this.extractCsrfToken(htmlStr);
        console.log('🚀 - handleMFA - csrfToken:', csrfToken);
        if (!csrfToken) {
            throw new Error('无法从MFA页面提取CSRF令牌');
        }
        const mfaCode = await mfaCallback();
        console.log('🚀 - handleMFA - mfaCode:', mfaCode);

        // 处理MFA验证 - 使用FormData方式，与旧版本一致
        const SSO = this.url.GARMIN_SSO;
        const mfaForm = new FormData();
        mfaForm.append('mfa-code', mfaCode);
        mfaForm.append('embed', 'true');
        mfaForm.append('_csrf', csrfToken);

        const mfaResult = await this.post<string>(
            `${SSO}/verifyMFA/loginEnterMfaCode`,
            mfaForm,
            {
                params: signinParams, // 将signinParams作为查询参数
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Dnt: 1,
                    Origin: this.url.GARMIN_SSO_ORIGIN,
                    Referer: `${SSO}/signin`, // 设置正确的Referer
                    'User-Agent': USER_AGENT_BROWSER
                },
                maxRedirects: 10, // 确保跟随重定向
                // 添加响应拦截器，确保获取重定向后的最终响应
                transformResponse: [
                    function (data, headers) {
                        // 检查是否有重定向
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

        console.log('MFA验证完成:', mfaResult);
        const pageTitle = this.handlePageTitle(mfaResult);
        console.log('MFA验证后的页面标题:', pageTitle);
        // 保存MFA验证响应用于调试
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

    // TODO: Handle Phone number
    handlePageTitle(htmlStr: string): string {
        const pageTitileRegResult = PAGE_TITLE_RE.exec(htmlStr);
        if (pageTitileRegResult) {
            const title = pageTitileRegResult[1];
            console.log('login page title:', title);

            if (_.includes(title, 'Update Phone Number')) {
                // current I don't know where to update it
                // See:  https://github.com/matin/garth/issues/19
                throw new Error(
                    'login failed (Update Phone number), please update your phone number, See:  https://github.com/matin/garth/issues/19'
                );
            }
            return title;
        } else {
            throw new Error('login failed (Page title not found)');
        }
    }

    handleAccountLocked(htmlStr: string): void {
        const accountLockedRegResult = ACCOUNT_LOCKED_RE.exec(htmlStr);
        if (accountLockedRegResult) {
            const msg = accountLockedRegResult[1];
            console.error(msg);
            throw new Error(
                'login failed (AccountLocked), please open connect web page to unlock your account'
            );
        }
    }

    async refreshOauth2Token() {
        try {
            if (!this.OAUTH_CONSUMER) {
                await this.fetchOauthConsumer();
            }

            if (!this.oauth2Token || !this.oauth1Token) {
                throw new Error('Missing required tokens for refresh');
            }

            const oauth1 = {
                oauth: this.getOauthClient(this.OAUTH_CONSUMER!),
                token: this.oauth1Token
            };

            await this.exchange(oauth1);
            console.log(
                `「${this.config.username}」in「${this.url.domain}」 OAuth2 token refreshed successfully`
            );
        } catch (error) {
            console.error('Failed to refresh OAuth2 token:', error);
            throw error;
        }
    }

    async getOauth1Token(ticket: string): Promise<IOauth1> {
        if (!this.OAUTH_CONSUMER) {
            throw new Error('No OAUTH_CONSUMER');
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

        const step4RequestData = {
            url: url,
            method: 'GET'
        };
        const headers = oauth.toHeader(oauth.authorize(step4RequestData));
        // console.log('getOauth1Token - headers:', headers);

        const response = await this.get<string>(url, {
            headers: {
                ...headers,
                'User-Agent': USER_AGENT_CONNECTMOBILE
            }
        });
        // console.log('getOauth1Token - response:', response);
        const token = qs.parse(response) as unknown as IOauth1Token;
        // console.log('getOauth1Token - token:', token);
        this.oauth1Token = token;
        return { token, oauth };
    }

    getOauthClient(consumer: IOauth1Consumer): OAuth {
        const oauth = new OAuth({
            consumer: consumer,
            signature_method: 'HMAC-SHA1',
            hash_function(base_string: string, key: string) {
                return crypto
                    .createHmac('sha1', key)
                    .update(base_string)
                    .digest('base64');
            }
        });
        return oauth;
    }
    //
    async exchange(oauth1: IOauth1) {
        const token = {
            key: oauth1.token.oauth_token,
            secret: oauth1.token.oauth_token_secret
        };
        // console.log('exchange - token:', token);

        const baseUrl = `${this.url.OAUTH_URL}/exchange/user/2.0`;
        const requestData = {
            url: baseUrl,
            method: 'POST',
            data: null
        };

        const step5AuthData = oauth1.oauth.authorize(requestData, token);
        // console.log('login - step5AuthData:', step5AuthData);
        const url = `${baseUrl}?${qs.stringify(step5AuthData)}`;
        // console.log('exchange - url:', url);
        this.oauth2Token = undefined;
        const response = await this.post<IOauth2Token>(url, null, {
            headers: {
                'User-Agent': USER_AGENT_CONNECTMOBILE,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        // console.log('exchange - response:', response);
        this.oauth2Token = this.setOauth2TokenExpiresAt(response);
        // console.log('exchange - oauth2Token:', this.oauth2Token);
    }

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
