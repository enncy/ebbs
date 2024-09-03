import { definePlugin } from "src/core/plugins";
import settings from "../../../ejs.settings.json";
import { ViewRenderEvent } from "src/events/page";
import { i18n } from "../i18n";

definePlugin({
    id: 'ejs-locals-export',
    name: 'ejs-locals-export-plugin',
}, (plugin) => {
    plugin.on(ViewRenderEvent, (e) => {
        e.data = e.data || {}
        Reflect.set(e.data, 'i18n', i18n)
        Reflect.set(e.data, 'settings', settings)
        Reflect.set(e.data, 'body', e.req.body)
        Reflect.set(e.data, 'params', e.req.params)
        Reflect.set(e.data, 'query', e.req.query)
    })
})