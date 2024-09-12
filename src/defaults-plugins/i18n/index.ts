import path from "path"; 
import default_lang from "./default";
import fs from 'fs';
import { global_config } from "ebbs.config";

const i18n_caches = new Map<string, Record<string, string>>()

type LangKeys = typeof default_lang

export function i18n(key: keyof LangKeys, placeholders: Record<string, any> = {}) {
    const lang = global_config.language
    const lang_path = path.resolve('languages', lang + '.json')
    if (!fs.existsSync(lang_path)) {
        throw new Error('Language file not found :' + lang_path)
    }
    if (!i18n_caches.has(lang)) {
        i18n_caches.set(lang, JSON.parse(fs.readFileSync(lang_path, 'utf-8')))
    }
    const lang_data = i18n_caches.get(lang)
    const text = lang_data?.[key] || key
    return text.replace(/\{\{(\w+)\}\}/g, (_, p1) => placeholders[p1] || 'undefined')
}

export function i18ns(...keys: (keyof LangKeys)[]) {
    return keys.map((key) => i18n(key)).join('')
}