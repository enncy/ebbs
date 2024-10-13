import { CancellableEvent, PluginView } from "src/core/interfaces"
import { definePlugin, Validator } from "../../core/plugins"
import { UserDocument, UserModel } from "src/models/user"
import captcha from 'svg-captcha';
import { Request, RequestHandler, Response } from "express";
import { sendEmail } from "../email";
import { i18n } from "../i18n";
import { baseUrl, SignUtils } from "src/utils";
import { ViewRenderEvent } from "src/events/page";

 
export class UserPreEmailLoginEvent extends CancellableEvent {
    constructor(public email: string, public ip: string) {
        super()
    }
}


export class UserEmailLoginSuccessEvent extends CancellableEvent {
    constructor(public email: string, public ip: string) {
        super()
    }
}

export class UserRegisterEvent extends CancellableEvent {
    constructor(public account: string, public email: string, public ip: string) {
        super()
    }
}

export class UserCreateEvent extends CancellableEvent {
    constructor(public account: string, public email: string, public ip: string) {
        super()
    }
}

export const PassportPlugin = definePlugin({
    id: 'passport',
    name: 'passport-plugin',
    sessions: { captcha: { text: String, create_at: Number }, user: UserDocument },
    settings: {
        enable_captcha: true,
        captcha_code_time_out: 60 * 5,
        captcha_config: {
            size: 4, noise: 3, color: true, background: '#cdcdcd', ignoreChars: '0OoLlIi1'
        },
        account_min_length: 4,
        account_max_length: 32,
        password_min_length: 6,
        password_max_length: 32
    },
    apis: {
        '/login': 'post',
        '/logout': 'get',
        '/register': 'post',
        '/reset-password': 'post',
        '/reset-password-feedback': 'post',
        '/code.png': 'get',
        '/confirm-email': 'get'
    },
    logging_events: [UserPreEmailLoginEvent, UserEmailLoginSuccessEvent, UserRegisterEvent, UserCreateEvent]
}, (plugin) => {

    const loginView = plugin.definedView('login.ejs', (req) => {
        bindCaptcha(req)
    })

    const registerView = plugin.definedView('register.ejs', (req) => {
        bindCaptcha(req)
    })
    const emailTemplateView = plugin.definedView('email.template.ejs')
    const confirmEmailFeedbackView = plugin.definedView('confirm.email.feedback.ejs')
    const resetPasswordView = plugin.definedView('reset.password.ejs')
    const resetPasswordFeedbackView = plugin.definedView('reset.password.feedback.ejs')

    plugin.definePage({
        path: '/login',
        render: (req) => {
            return loginView.render(req)
        }
    })
    plugin.definePage({
        path: '/register',
        render: (req) => {
            return registerView.render(req)
        }
    })
    plugin.definePage({
        path: '/confirm-email',
        render: (req, res) => {
            if (!req.query.sign) {
                res.status(400)
                return
            }
            return confirmEmailFeedbackView.render(req)
        }
    })
    plugin.definePage({
        path: '/reset-password',
        render: (req) => {
            return resetPasswordView.render(req)
        }
    })
    plugin.definePage({
        path: '/reset-password-feedback',
        render: (req) => {
            return resetPasswordFeedbackView.render(req)
        }
    })

    const bindCaptcha = (req: Request) => {
        if (plugin.settings.get("enable_captcha", true)) {
            const captchaObj = createCaptcha(plugin.settings.get('captcha_config'))
            plugin.sessions.set(req, 'captcha', {
                text: captchaObj.text,
                create_at: Date.now()
            })
            return captchaObj
        }
    }

    const commonValidator = {
        // 账号只能包含字母、数字、下划线
        account: {
            type: 'string', name: i18n('_dict_.account'), required: true,
            min_length: plugin.settings.get('account_min_length'),
            max_length: plugin.settings.get('account_max_length'),
            match: /^[a-zA-Z0-9_]+$/,
            error_of_invalid_length: i18n('passport.validator.invalid_account_length'), error_of_invalid_match: i18n('passport.validator.invalid_account')
        } as Validator,
        email: { type: 'string', name: i18n('_dict_.email'), required: true, match: /^\w+(-+.\w+)*@\w+(-.\w+)*.\w+(-.\w+)*$/, error_of_invalid_match: i18n('passport.validator.invalid_email') } as Validator,
        password: { type: 'string', name: i18n('_dict_.password'), required: true, min_length: plugin.settings.get('password_min_length'), max_length: plugin.settings.get('password_max_length'), error_of_invalid_length: i18n('passport.validator.invalid_passport') } as Validator,
    }

    /**
     *  检查验证码
     */
    const checkCaptchaCode = async (req: Request, res: Response, view: PluginView) => {
        if (plugin.settings.get("enable_captcha", true)) {
            const captcha_code = req.body.captcha_code?.trim().toLowerCase()
            const original_captcha = plugin.sessions.get(req, 'captcha')
            if (!original_captcha) {
                throw new Error('captcha code not found')
            }
            if (captcha_code !== original_captcha.text.toLowerCase()) {
                return res.send(await view.render(req, { error: i18n('passport.captcha.code_not_match') }))
            }
            if (Date.now() - original_captcha.create_at > 1000 * plugin.settings.get('captcha_code_time_out', 60 * 5)) {
                return res.send(await view.render(req, { error: i18n('passport.captcha.code_time_out') }))
            }
        }
    }


    plugin.api('/code.png', async (req, res, next) => {
        const captchaObj = bindCaptcha(req)
        if (captchaObj) {
            res.setHeader('Content-Type', 'image/svg+xml')
            res.send(captchaObj.data)
        } else {
            res.status(404)
            next()
        }
    })

    plugin.api('/logout', async (req, res) => {
        plugin.sessions.remove(req, 'user')
        res.redirect(plugin.api('/login'))
    })

    plugin.api('/login', plugin.validator((req) => req.body, { email: commonValidator.email, password: commonValidator.password }, loginView), async (req, res) => {
        await checkCaptchaCode(req, res, loginView)
        if (res.headersSent) {
            return
        }

        const email = req.body.email?.trim().toLowerCase()
        const password = req.body.password?.trim()
        const ip = clientIp(req) || ''

        const pre_e = await plugin.emit(new UserPreEmailLoginEvent(email, ip))
        if (pre_e.isCancelled()) {
            return res.send(await loginView.render(req, { error: pre_e.reason }))
        }

        const user = await UserDocument.login(email, password, ip)
        if (!user) {
            return res.send(await loginView.render(req, { error: i18n('passport.login.email_login_failed') }))
        }


        const e = await plugin.emit(new UserEmailLoginSuccessEvent(email, ip))
        if (e.notCancelled()) {
            plugin.sessions.set(req, 'user', user)
            return res.send(await loginView.render(req, { success: i18n('passport.login.email_login_success'), redirect: { url: '/', timeout: 1 } }))
        }
    })

    plugin.api('/reset-password', async (req, res) => {
        await checkCaptchaCode(req, res, resetPasswordView)
        if (res.headersSent) {
            return
        }

        const email = req.body.email?.trim().toLowerCase()
        try {
            await sendEmail(email, {
                subject: i18n('passport.reset.password.email.subject'),
                html: await emailTemplateView.render(req, { subject: i18n('passport.reset.password.email.message'), link: createResetPasswordUrl(email) })
            })
        } catch (e) {
            plugin.logger.error(e)
            return res.send(await resetPasswordView.render(req, { error: i18n('passport.reset.password.email_send_error', { error_message: e.message }) }))
        }
        return res.send(await resetPasswordView.render(req, { success: i18n('passport.reset.password.email_sended') }))
    })

    plugin.api('/reset-password-feedback', plugin.validator((req) => req.body, { password: commonValidator.password }, resetPasswordFeedbackView), async (req, res) => {
        await checkCaptchaCode(req, res, resetPasswordView)
        if (res.headersSent) {
            return
        }
        const password = req.body.password?.trim().toLowerCase()
        const repeat_password = req.body.repeat_password?.trim().toLowerCase()

        if (password !== repeat_password) {
            return res.send(await resetPasswordFeedbackView.render(req, { error: i18n('passport.reset.repeat_password_not_match') }))
        }

        const email = req.query.email?.toString().trim()
        if (!email) {
            return res.send(await resetPasswordFeedbackView.render(req, { error: i18n('passport.reset.invalid_email') }))
        }

        const result = await UserDocument.resetPassword(email, password)
        if (!result.acknowledged) {
            return res.send(await resetPasswordFeedbackView.render(req, { error: i18n('passport.reset.reset_failed') }))
        } else {
            plugin.sessions.remove(req, 'user')
            return res.send(await resetPasswordFeedbackView.render(req, { success: i18n('passport.reset.reset_success'), redirect: { url: plugin.api('/login'), timeout: 2 } }))
        }
    })

    plugin.api('/register', plugin.validator((req) => req.body, commonValidator, registerView), async (req, res) => {
        await checkCaptchaCode(req, res, registerView)
        if (res.headersSent) {
            return
        }

        const account = req.body.account?.trim().toLowerCase()
        const email = req.body.email?.trim().toLowerCase()
        const password = req.body.password?.trim()
        const repeat_password = req.body.repeat_password?.trim()
        const ip = clientIp(req) || ''
        if (password !== repeat_password) {
            return res.send(await registerView.render(req, { error: i18n('passport.register.repeat_password_not_match') }))
        }

        if (await UserDocument.findOne({ email })) {
            return res.send(await registerView.render(req, { error: i18n('passport.register.email_exists') }))
        }

        if (await UserDocument.findOne({ account })) {
            return res.send(await registerView.render(req, { error: i18n('passport.register.account_exists') }))
        }


        const e = await plugin.emit(new UserRegisterEvent(account, email, ip))
        if (e.isCancelled()) {
            return res.send(await registerView.render(req, { error: e.reason }))
        }

        try {
            await sendEmail(email, {
                subject: i18n('passport.register.confirm_email.subject'),
                html: await emailTemplateView.render(req, { subject: i18n('passport.register.confirm_email.message'), link: createEmailConfirmUrl(account, email, password) })
            })
        } catch (e) {
            plugin.logger.error(e)
            return res.send(await registerView.render(req, { error: i18n('passport.register.confirm_email_send_error', { error_message: e.message }) }))
        }
        return res.send(await registerView.render(req, { success: i18n('passport.register.confirm_email_sended') }))
    })



    plugin.api('/confirm-email', async (req, res, next) => {
        const sign = req.query.sign?.toString().trim()
        if (!sign) {
            res.status(404)
            return next()
        }
        const account = req.query.account?.toString().trim()
        const email = req.query.email?.toString().trim()
        const password = req.query.password?.toString().trim()
        const ip = clientIp(req) || ''
        if (!account || !email || !password) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.confirm_email_params_invalid') }))
        }
        if (SignUtils.verify({ account, email, password }, sign) === false) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.confirm_email_params_invalid') }))
        }

        const e = await plugin.emit(new UserCreateEvent(account, email, ip))
        if (e.isCancelled()) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: e.reason }))
        }

        const original = await UserDocument.findByEmailAndPassword(email, password)
        if (original) {
            if (original.password === UserDocument.signPassword(password, original.password_salt)) {
                return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'success', title: i18n('passport.register.confirm_email_success'), subtitle: i18n('passport.register.success_message') }))
            }
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.email_exists') }))
        }
        try {
            await UserDocument.create(account, email, password, ip)
        } catch (e) {
            plugin.logger.error(e);
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: e.message }))
        }
        res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'success', title: i18n('passport.register.confirm_email_success'), subtitle: i18n('passport.register.success_message') }))
    })

})

PassportPlugin.on(ViewRenderEvent, async e => {
    e.data = e.data || {}
    const user = PassportPlugin.sessions.get(e.req, 'user')
    if (user) {
        // 刷新数据  
        const res = await UserDocument.findOne({ uid: user.uid })
        if (res) {
            PassportPlugin.sessions.set(e.req, 'user', res)
            e.data.user = res.toJSON()
        }
    }
    e.data.passport_settings = PassportPlugin.settings.all()
})

/**
 * 创建验证码
 */
function createCaptcha(config?: captcha.ConfigObject) {
    return captcha.create(config);
}

/**
 * 创建邮箱验证链接 
 */
function createEmailConfirmUrl(account: string, email: string, password: string) {
    return baseUrl(`/${PassportPlugin.id}/confirm-email?account=${account}&email=${email}&password=${password}&sign=` + SignUtils.sign({ account, email, password }))
}

/**
 * 创建邮箱验证链接 
 */
function createResetPasswordUrl(email: string) {
    return baseUrl(`/${PassportPlugin.id}/reset-password-feedback?email=${email}&sign=` + SignUtils.sign({ email }))
}

/**
 * 获取客户端IP
 */
export function clientIp(req: Request) {
    return req.headers?.['x-forwarded-for']?.toString() || req.socket.remoteAddress;
}


export function permission(...permissions: string[]): RequestHandler {
    return (req, res, next) => {
        const user = PassportPlugin.sessions.get(req, 'user')
        if (!user) {
            return res.redirect(PassportPlugin.api('/login'))
        }
        if (permissions.length === 0) {
            return next()
        }
        if (permissions.some(p => user.permissions.includes(p))) {
            return next()
        }
        res.status(403)
    }
}