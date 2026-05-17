import { HttpClient } from '../../common/HttpClient';
import { UrlClass } from '../UrlClass';
import { GarminDomain, ISocialProfile } from '../types';

// 所有 mixin 所依赖的基础接口
export interface IModuleBase {
    client: HttpClient;
    url: UrlClass;
    domain: GarminDomain;
    getUserProfile(): Promise<ISocialProfile>;
}

// mixin 的构造函数类型
export type ModuleConstructor = new (...args: any[]) => IModuleBase;
