import { ErrorRequestHandler, RequestHandler } from "express";
import EJS from 'ejs';
import { resolve } from "path";
import { bindEJSBaseVariables } from "src/defaults-plugins/ejs";
import { logger } from "src/app"; 


export function errorPages(): ErrorRequestHandler {
    return async (err, req, res, next) => { 
        if (err) {
            logger.error(err.message)
            logger.error(err.stack)
        }
        if (res.headersSent) {
            return
        }
        if (['.png', '.jpg', '.map'].some(s => req.path.endsWith(s))) {
            return res.sendStatus(res.statusCode)
        }
        if (req.path === '/error') {
            res.statusCode = parseInt(req.query.code as string) || 404
        }
        else if (err) {
            res.statusCode = 500
        }
        else if (res.statusCode === 200) {
            res.statusCode = 404
        }
        const data = {}
        bindEJSBaseVariables(req, data)
        const render = (code: number) => EJS.renderFile(resolve('views', code + '.ejs'), data, { root: process.cwd() })
        res.send(await render(res.statusCode))
    }
}
