import { Request } from "express";
import { Model } from "mongoose";

export interface PluginConfig<Sessions extends Record<string, any> = any, Settings extends Record<string, any> = any, Apis extends Record<string, any> = any> {
    id: string;
    name: string;
    version?: string;
    description?: string;
    priority?: number;
    sessions?: Sessions;
    settings?: Settings;
    apis?: Apis
    logging_events?: EventConstructor[]
}
export interface Page<R = {}> {
    path: string | RegExp;
    render: (req: Request & R) => string | Promise<string>
}

export interface PluginView {
    render(req: Request, extra_data?: Record<string, any>): string | Promise<string>
}

export type EventConstructor = { new(...args: any[]): Event; }
export class Event {
    toString() {
        const keys = Object.keys(this)
        const values = keys.map((key) => {
            return `${key}=${(this as any)[key]}`
        })
        return `[${this.constructor.name}]: ` + + values.join(' ')
    }
}

export class CancellableEvent extends Event {
    reason: string = ''
    private cancelled = false
    cancel(reason?: string) {
        this.cancelled = true
        this.reason = reason || ''
    }
    isCancelled() {
        return this.cancelled
    }
    notCancelled() {
        return !this.cancelled
    }
    toString() {
        const keys = Object.keys(this).filter((key) => key !== 'cancelled' && key !== 'reason')
        const values = keys.map((key) => {
            return `${key}=${(this as any)[key]}`
        })
        return `[${this.constructor.name}]: ${this.isCancelled() ? '[cancelled] reason=' + this.reason : ''} ` + values.join(' ')
    }
}

export type DefaultsConstructorValue<C> = C extends StringConstructor ? string
    : C extends NumberConstructor ? number
    : C extends BooleanConstructor ? boolean
    : C extends ObjectConstructor ? object
    : C extends FunctionConstructor ? Function
    : C extends ArrayConstructor ? Array<any>
    : C extends DateConstructor ? Date
    : C extends { new(...args: any[]): infer T } ? T
    : C extends Record<string, any> ? {
        [K in keyof C]: DefaultsConstructorValue<C[K]>
    } : never


export interface PluginContext {
    on<T extends { new(): Event }>(plugin: Plugin, event: T, executor: (e: T extends { new(): infer E } ? E : unknown) => void): void
    emit<T extends Event>(plugin: Plugin, event: T): T
    definePage(plugin: Plugin, page: Page): void
    getPages(plugin: Plugin): Page[]
    getAllPages(): Page[]
}


export type ModelType<T> = T extends Model<infer U> ? {
    [K in keyof U]: U[K] extends StringConstructor ? string
    : U[K] extends NumberConstructor ? number
    : U[K] extends BooleanConstructor ? boolean
    : U[K] extends DateConstructor ? Date
    : U[K] extends ArrayConstructor ? Array<any>
    : U[K] extends ObjectConstructor ? object : U[K]
} : never