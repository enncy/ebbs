import { Application, Request, RequestHandler, Response } from "express";
import path, { resolve } from "path";
import mongoose, { Model, Schema, SchemaOptions, SchemaTypeOptions } from "mongoose";
import { DefaultsConstructorValue, Event, EventConstructor, Page, PluginConfig, PluginView } from './interfaces';
import chalk from 'chalk';
import { globSync } from "glob";
import fs from 'fs';
import EJS from 'ejs';
import { ViewRenderEvent } from "../events/page";
import { i18n } from "../defaults-plugins/i18n";
import defaultsDeep from 'lodash/defaultsDeep';
import winston, { Logger } from 'winston';



export type PluginExport<Sessions extends Record<string, any> = any, Settings extends Record<string, any> = any, Apis extends Record<string, any> = any> = {
    id: string;
    name: string;
    version?: string;
    description?: string;
    priority?: number;
    on: Plugin<Sessions, Settings, Apis>['on']
    emit: Plugin<Sessions, Settings, Apis>['emit']
    sessions: Plugin<Sessions, Settings, Apis>['sessions']
    settings: Plugin<Sessions, Settings, Apis>['settings']
}

export class PluginContext {
    private readonly listeners: Map<Plugin, { event: EventConstructor, executor: (e: Event) => void }[]> = new Map()
    private readonly pages: Map<Plugin, Page[]> = new Map()
    on<T extends EventConstructor>(plugin: Plugin, event: T, executor: (e: T extends { new(...args: any[]): infer E; } ? E : unknown) => void): void {
        if (!this.listeners.has(plugin)) {
            this.listeners.set(plugin, [])
        }
        const reg = this.listeners.get(plugin)
        if (reg) {
            reg.push({ event: event, executor })
        }
    }
    emit(plugin: Plugin, event: Event) {
        const listeners = Array.from(this.listeners.values()).flat().filter((listener) => listener.event === event.constructor)
        if (listeners.length) {
            for (const listener of listeners) {
                listener.executor(event)
            }
        }
        return event
    }
    definePage(plugin: Plugin, page: Page) {
        if (!this.pages.has(plugin)) {
            this.pages.set(plugin, [])
        }
        const reg = this.pages.get(plugin)
        if (reg) {
            reg.push(page)
        }
    }
    getPages(plugin: Plugin) {
        return this.pages.get(plugin)
    }
    getAllPages() {
        return Array.from(this.pages.values()).flat()
    }
}



export type ValidatorErrorHandler = (req: Request, res: Response) => any

export interface Validator {
    type: 'string' | 'number' | 'boolean'
    /**
     * 参数名
     */
    name?: string
    /**
     * 是否必须
     * type 为 string 时有效
     */
    required?: boolean
    /**
     * 最小长度
     * type 为 string 时有效
     */
    min_length?: number
    /**
     * 最大长度
     * type 为 string 时有效
     */
    max_length?: number
    /**
     * 匹配正则表达式
     * type 为 string 时有效
     */
    match?: RegExp
    /**
     * 最小值
     * type 为 number 时有效
     */
    min?: number
    /**
     * 最小值
     * type 为 number 时有效
     */
    max?: number
    custom?: (v: any) => boolean
    /**
     * 无效错误时的错误信息，当 onInvalid 未提供时使用
     */
    error_of_invalid?: string
    /**
     * 无效错误时的错误信息，当 onInvalid 未提供时使用
     */
    error_of_invalid_match?: string
    /**
     * 无效错误时的错误信息，当 onInvalid 未提供时使用
     */
    error_of_invalid_length?: string
    /**
     * 无效错误时的错误信息，当 onInvalid 未提供时使用
     */
    error_of_invalid_number?: string
    /**
     * 类型错误时的错误信息，当 onTypeError 未提供时使用
     */
    error_of_invalid_type?: string
    /**
     * 自定义错误处理，当参数不符合自定义规则时调用
     */
    onInvalid?: ValidatorErrorHandler
    /**
     * 类型错误处理，当参数为空或者类型不匹配时调用
     */
    onTypeError?: ValidatorErrorHandler
}


export abstract class Plugin<
    Sessions extends Record<string, any> = any,
    Settings extends Record<string, any> = any,
    Apis extends Record<string, 'post' | 'get'> = any> {
    app?: Application
    /**
     * 插件ID
     */
    public id: string;
    /**
     * 插件名
     */
    public name: string;
    /**
     * 插件版本
     */
    public version?: string;
    /**
     * 插件描述
     */
    public description?: string;
    /**
     * 插件优先级，值越小越优先，默认为0
     */
    public priority?: number;
    /**
      * 插件日志
      * 懒加载日志，只有在调用时才会创建
      */
    get logger() {
        this._logger_instance = this._logger_instance || winston.createLogger({
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.json()),
            transports: [
                new winston.transports.File({ filename: resolve('logs', this.config.id, 'error.log'), level: 'error', lazy: true }),
                new winston.transports.File({ filename: resolve('logs', this.config.id, 'console.log'), lazy: true }),
            ]
        });
        return this._logger_instance
    }

    /**
     * 记录在日志的事件
     */
    public logging_events: EventConstructor[] = []

    private _setting_cache: Record<string, any> | undefined
    private _logger_instance: Logger

    constructor(private context: PluginContext, public config: PluginConfig<Sessions, Settings, Apis>) { }

    /**
     * 插件加载时执行
     */
    onload: (instance: Plugin<Sessions, Settings>, app: Application) => void

    /**
     * 监听事件
     * @param event  插件事件 
     * @param executor   事件执行器  
     */
    on<T extends { new(...args: any[]): Event; }>(event: T, executor: (e: T extends { new(...args: any[]): infer E; } ? E : unknown) => void): void {
        this.context.on(this, event, executor)
    }
    /**
     * 调用事件
     * @param event  事件实例 
     */
    emit<T extends Event>(event: T) {
        this.context.emit(this, event)
        // 记录事件
        if (this.logging_events.find((e) => event instanceof e)) {
            this.logger.info(event.toString())
        }
        return event
    }
    /**
     * 定义插件独立的页面
     * 访问路径为 /插件ID/路径
     * @param page 页面配置
     */
    definePage(page: Page): void {
        page.path = page.path instanceof RegExp ? page.path : this.baseUrl(page.path)
        this.context.definePage(this, page)
    }
    /**
     * 渲染插件独立的ejs模板
     * 模板路径为 views/插件ID/路径
     * @param path 路径
     * @param data 渲染数据
     * @returns {PluginView} 返回渲染后的html字符串
     */
    definedView(path: string, data_provider?: (req: Request) => Record<string, any> | void): PluginView {
        const _this = this
        return {
            async render(req, extra_data) {
                fs.mkdirSync(resolve('views', _this.id), { recursive: true })
                const view_path = resolve('views', _this.id, path.toString())
                const data = Object.assign(data_provider ? data_provider(req) ?? {} : {}, extra_data)
                const e = new ViewRenderEvent(req, view_path, data)
                _this.emit(e)
                return EJS.renderFile(view_path, e.data, {
                    root: process.cwd(),
                })
            },
        }
    }
    /**
     * 获取插件独立的api路径
     * @param path 
     * @returns 
     */
    api<K extends keyof Apis>(path: K): string
    /**
     * 定义并处理插件独立的api
     * @param path 
     * @param handler 
     */
    api<K extends keyof Apis>(path: K, ...handlers: Array<RequestHandler>): void
    api<K extends keyof Apis>(path: K, ...handlers: Array<RequestHandler>): string | void {
        if (!handlers || handlers.length === 0) {
            return this.baseUrl(path as string)
        }
        if (!this.config.apis) {
            throw new Error(`[plugin] : ${this.id} views not defined`)
        }

        const func = (this.app)?.[this.config.apis[path]]
        if (func) {
            func.call(this.app, this.baseUrl(path as string), ...handlers)
        }
    }
    /**
     * 获取插件的独立api路径
     * 格式为 /插件ID/路径
     * @param path 
     * @returns 
     */
    private baseUrl(path: string) {
        return '/' + [this.id, path].map((p) => (p).toString().split('/').filter(Boolean)).join('/')
    }

    /**
     * 验证请求参数的中间件             
     * 如果验证失败，会调用onInvalid或onTypeError           
     * 如果未提供onInvalid或onTypeError，有error_view则渲染error_view，否则返回错误信息         
     * 使用error_view渲染的页面自带 `locals.validator_error` 变量，用于显示错误信息         
     * @param data_provider 需要验证的参数的提供器
     * @param validators 验证规则  
     */
    validator(data_provider: (req: Request) => any, validators: Record<string, Validator>, error_view?: PluginView): RequestHandler {
        return (req, res, next) => {
            const data = data_provider(req)
            for (const key in validators) {
                const value = data[key]
                const validator = validators[key]
                let custom_error_msg = ''
                const onInvalid = validator.onInvalid || (async (req, res) => {
                    const err = custom_error_msg || validator.error_of_invalid || i18n('_internal.plugin.validator.invalid', { param_name: validator.name || key })
                    if (error_view) {
                        res.send(await error_view.render(req, { validator_error: err }))
                    } else {
                        res.send(err)
                    }
                })

                const onTypeError = validator.onInvalid || (async (req, res) => {
                    const err = validator.error_of_invalid_type || i18n('_internal.plugin.validator.type_error', { param_name: validator.name || key })
                    if (error_view) {
                        res.send(await error_view.render(req, { validator_error: err }))
                    } else {
                        res.send(err)
                    }
                })

                if (validator.custom && !validator.custom(value)) {
                    return onInvalid(req, res)
                }

                if (validator.type === 'string' && typeof value !== 'string') {
                    return onTypeError(req, res)
                } else {
                    if (validator.required && !value) {
                        return onInvalid(req, res)
                    }
                    if ((validator.min_length && value.length < validator.min_length) || (validator.max_length && value.length > validator.max_length)) {
                        custom_error_msg = i18n('_internal.plugin.validator.invalid_length', { param_name: validator.name || key, min_length: validator.min_length, max_length: validator.max_length })
                        return onInvalid(req, res)
                    }
                    if (validator.match && !validator.match.test(value)) {
                        custom_error_msg = i18n('_internal.plugin.validator.invalid_match', { param_name: validator.name || key })
                        return onInvalid(req, res)
                    }
                }
                if (validator.type === 'number' && typeof value !== 'number') {
                    return onTypeError(req, res)
                } else {
                    if (validator.required && value === undefined) {
                        return onInvalid(req, res)
                    }
                    if ((validator.min && value < validator.min) || (validator.max && value > validator.max)) {
                        custom_error_msg = i18n('_internal.plugin.validator.invalid_number', { param_name: validator.name || key, min: validator.min, max: validator.max })
                        return onInvalid(req, res)
                    }
                }
                if (validator.type === 'boolean' && typeof value !== 'boolean') {
                    return onTypeError(req, res)
                }
            }
            next()
        }
    }

    /**
     * 操作插件的独立session数据
     * 存储地方为 req.session[插件ID_键名]
     */
    sessions = ((_this) => {
        return {
            get<K extends keyof Sessions>(req: Request, key: K): DefaultsConstructorValue<Sessions[K]> | undefined {
                return Reflect.get(req.session, _this.id + "_" + String(key))
            },
            set<K extends keyof Sessions>(req: Request, key: K, value: DefaultsConstructorValue<Sessions[K]>) {
                Reflect.set(req.session, _this.id + "_" + String(key), value)
            },
            remove<K extends keyof Sessions>(req: Request, key: K) {
                Reflect.deleteProperty(req.session, _this.id + "_" + String(key))
            },
        }
    })(this)


    /**
     * 操作插件的独立设置数据
     * 存储路径为 settings/插件名.json
     */
    settings = ((_this) => {
        const init = () => {
            if (!_this._setting_cache) {
                _this._setting_cache = JSON.parse(fs.readFileSync(resolve('settings', _this.id + '.json'), { encoding: 'utf8' }))
            }
        }
        return {
            get<K extends keyof Settings, Default extends Settings[K] = any>(key: K, default_value?: Default): Default extends Settings[K] ? Settings[K] : (Settings[K] | undefined) {
                init()
                return Reflect.get(_this._setting_cache || {}, key) ?? default_value as any
            },
            set<K extends keyof Settings>(key: K, value: Settings[K]): void {
                init()
                Reflect.set(_this._setting_cache || {}, key, value)
                fs.writeFileSync(resolve('settings', _this.id + '.json'), JSON.stringify(_this._setting_cache, null, 4))
            },
            all() {
                init()
                return _this._setting_cache
            }
        }
    })(this)
}


export function definePlugin<Sessions extends Record<string, any> = any, Settings extends Record<string, any> = any, Apis extends Record<string, 'post' | 'get'> = any>
    (config: PluginConfig<Sessions, Settings, Apis>, onload: (instance: Plugin<Sessions, Settings, Apis>) => void): Plugin<Sessions, Settings, Apis> {

    const plugin = class extends Plugin {
        constructor() {
            super(context, config)
            this.id = config.id
            this.name = config.name
            this.version = config.version
            this.description = config.description
            this.logging_events = config.logging_events || []
            this.onload = onload
        }
    }


    // 初始化配置文件
    if (Object.keys(config.settings || {}).length > 0) {
        // 初始化设置
        fs.mkdirSync(resolve('settings'), { recursive: true })
        const json = resolve('settings', config.id + '.json')
        if (!fs.existsSync(json)) {
            fs.writeFileSync(json, JSON.stringify(config.settings, null, 4))
        } else {
            // 合并
            const settings = JSON.parse(fs.readFileSync(json, { encoding: 'utf8' }))
            const merged = defaultsDeep(settings, config.settings)
            fs.writeFileSync(json, JSON.stringify(merged, null, 4))
        }
    }

    const instance = new plugin() as Plugin<Sessions, Settings, Apis>
    plugins.push(instance)
    console.log(`[plugin] loaded: ${chalk.blueBright(instance.name)}${instance.version ? '-' + instance.version : ''}`);
    return instance
}


export function defineModel<T>(name: string, definition: { [K in keyof T]: SchemaTypeOptions<T[K], any> }, options?: SchemaOptions<any>): Model<T> {
    return mongoose.models[name] || mongoose.model(name, new Schema(definition, options))
}

export async function loadPlugins() {
    // 内置脚本
    const defaults_plugins = globSync(path.join(__dirname, '../defaults-plugins', '*/index.js').replace(/\\/g, '/'))

    // // 外置脚本
    const other_plugins = globSync(path.join(__dirname, '../../plugins', '*/index.js').replace(/\\/g, '/'))


    await Promise.all(([...defaults_plugins, ...other_plugins]).map(async (file) => {
        if (file.endsWith('.js')) {
            try {
                await import(file)
            } catch (e) {
                console.error(`[plugin] error when import: ${file}`)
                console.error(e)
            }
        }
    }))

    // 排序  
    return {
        context, plugins: plugins.sort((a, b) => {
            return (b.priority ?? 0) - (a.priority ?? 0)
        })
    }
}


const context = new PluginContext()
const plugins = [] as Plugin<any, any, any>[]