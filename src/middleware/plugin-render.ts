import { RequestHandler } from "express";
import { Page } from "../core/interfaces";

export default (pages: Page[]): RequestHandler => {
    return async (req, res, next) => {
        const page = pages.find((page) => {
            if(page.path instanceof RegExp){
                return page.path.test(req.path)
            }
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
            const html = await page.render(req)
            res.send(html)
        } catch (e) {
            console.error(e)
        } finally {
            res.status(404).end()
        }
    }
}