import { definePlugin } from "src/core/plugins";
import settings from "../../../ejs.settings.json";
import { ViewRenderEvent } from "src/events/page";
import { i18n, i18ns } from "../i18n";
import { Request } from "express";
import { html } from "src/utils";
import dayjs from "dayjs"; 

definePlugin({
    id: 'ejs-locals-export',
    name: 'ejs-locals-export-plugin',
}, (plugin) => {
    plugin.on(ViewRenderEvent, (e) => {
        e.data = e.data || {}
        bindEJSBaseVariables(e.req, e.data)
    })
})

export function bindEJSBaseVariables(req: Request, data: any) {
    Reflect.set(data, 'dayjs', (time: number) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'))
    Reflect.set(data, 'html', html)
    Reflect.set(data, 'i18n', i18n)
    Reflect.set(data, 'i18ns', i18ns)
    Reflect.set(data, 'settings', settings)
    Reflect.set(data, 'body', req.body)
    Reflect.set(data, 'params', req.params)
    Reflect.set(data, 'query', req.query)
}

