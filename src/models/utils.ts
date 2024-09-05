import { randomUUID } from "crypto";

export function uuid() {
    return randomUUID().replace(/-/g, '')
}

export async function randomShortId(has: (id: string) => boolean | Promise<boolean>, max_try = 10) {
    let id = ''
    for (let i = 0; i < max_try; i++) {
        id = Math.random().toString(36).slice(2)
        if (await has(id)) {
            return id
        }
    }
    return uuid()
}