import { Request } from "express";
import { Event } from "src/core/interfaces";

export class ViewRenderEvent extends Event {
    constructor(public req: Request, public path: string, public data?: Record<string, any>) {
        super()
    }
}
