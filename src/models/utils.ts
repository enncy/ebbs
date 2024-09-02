import { randomUUID } from "crypto";

export function uuid(){
    return randomUUID().replace(/-/g, '')
}