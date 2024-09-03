import { definePlugin } from "src/core/plugins";
import nodemailer from 'nodemailer';
import { CancellableEvent, Event } from "src/core/interfaces";
import { i18n } from "../i18n";

export class EmailSendEvent extends CancellableEvent {
    constructor(public email: string, public opts: { subject: string; text?: string; html?: string }) {
        super()
    }
}

const EmailPlugin = definePlugin({
    id: 'email',
    name: 'email-plugin',
    settings: {
        from: '',
        config: {
            host: 'localhost',
            port: 465,
            secure: true,
            auth: {
                user: '',
                pass: ''
            }
        },
    }
}, (plugin) => {

})

/**
 * 发送邮箱
 */
export async function sendEmail(email: string, opts: { subject: string; text?: string; html?: string }) {
    const config = EmailPlugin.settings.get('config')
    if (!config || !config.host || !config.auth?.user || !config.auth?.pass) {
        throw new Error(i18n('email.config.invalid'))
    }
    if (config.host === 'localhost') {
        throw new Error(i18n('email.config.smtp_host_unset'))
    }
    const e = EmailPlugin.emit(new EmailSendEvent(email, opts))
    if (e.isCancelled()) {
        throw new Error(e.reason || i18n('email.send.is_cancelled'))
    }
    const transporter = nodemailer.createTransport(config);
    return await transporter.sendMail({
        from: EmailPlugin.settings.get('from', ''),
        to: email,
        ...opts
    });
}
