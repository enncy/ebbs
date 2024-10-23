import { RequestHandler } from "express";
import { Page } from "../core/interfaces";
import { logger } from "src/app";

export default (pages: Page[]): RequestHandler => {
    return async (req, res, next) => {
        const page = pages.find((page) => {
            if (req.path === page.path) {
                return true
            }
            return false
        })
        if (!page) {
            next()
            return
        }
        try {
            const html = await page.render(req, res)
            if (res.headersSent) {
                return
            }
            if (!html) {
                next()
                return
            }
            res.send(html)
        } catch (e) {
            logger.error(e)
            if (res.headersSent) {
                return
            }
            res.statusCode = 500
            res.send(e.message)
        }
    }
}