import { RequestHandler } from "express";
import EJS from 'ejs';
import { resolve } from "path";
import { ViewRenderEvent } from "src/events/page";
import { PluginContext } from "src/core/plugins";


export function errorPages(context: PluginContext): RequestHandler {
    return async (req, res, next) => {
        if (res.headersSent) {
            return
        }
        if (['.png', '.jpg', '.map'].some(s => req.path.endsWith(s))) {
            res.statusCode = 404
            return res.sendStatus(res.statusCode)
        }
        if (req.path === '/error') {
            res.statusCode = parseInt(req.query.code as string) || 404
        }
        else if (res.statusCode === 200) {
            res.statusCode = 404
        }
        const data = {}
        const e = new ViewRenderEvent(req, req.path, data)
        await context.emit(null, e)
        const render = (code: number) => EJS.renderFile(resolve('views', code + '.ejs'), data, { root: process.cwd() })
        res.send(await render(res.statusCode))
    }
}
