import { RequestHandler } from "express";
import EJS from 'ejs';
import { resolve } from "path";
import { bindEJSBaseVariables } from "src/defaults-plugins/ejs";



export function errorPages(): RequestHandler {
    return async (req, res, next) => {
        if (res.headersSent) {
            return
        }
        if (res.statusCode === 200) {
            res.statusCode = 404
        }
        const data = {}
        bindEJSBaseVariables(req, data)
        const render = (code: number) => EJS.renderFile(resolve('views', code + '.ejs'), data, { root: process.cwd() })
        res.send(await render(res.statusCode))
    }
}
