import { definePlugin } from "src/core/plugins";
import settings from "../../../ejs.settings.json";
import { ViewRenderEvent } from "src/events/page";

definePlugin({
    id: '_internal-ejs-locals-export',
    name: '_internal-ejs-locals-export-plugin',
}, (plugin) => {
    plugin.on(ViewRenderEvent, (e) => {
        e.data = e.data || {}
        Reflect.set(e.data, 'settings', settings)
        Reflect.set(e.data, 'body', e.req.body)
        Reflect.set(e.data, 'params', e.req.params)
        Reflect.set(e.data, 'query', e.req.query)
    })
})