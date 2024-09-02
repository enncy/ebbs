
import forge from 'node-forge';
import config from '../../ebbs.config.json';

export function html(strings: TemplateStringsArray, ...values: any[]) {
    return strings.reduce((acc, str, i) => {
        const value = values[i] || ''
        return acc + str + value
    }, '')
}


export function baseUrl(path: string) {
    return (config.url + path).split('/').filter(Boolean).join('/')
}


export const SignUtils = {
    sign(data: Record<string, any>) {
        const md = forge.md.md5.create();
        md.update(JSON.stringify(sortObjectByAscii(data)) + process.env.SIGN_SECRET_KEY);
        return md.digest().toHex();
    },
    verify(data: Record<string, any>, sign: string) {
        return this.sign(data) === sign
    }
}

function sortObjectByAscii(obj: Record<string, any>) {
    return Object.keys(obj).sort().reduce((acc, key) => {
        acc[key] = obj[key]
        return acc
    }, {} as Record<string, any>)
}