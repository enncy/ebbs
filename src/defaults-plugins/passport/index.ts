import { CancellableEvent, PluginView } from "src/core/interfaces"
import { definePlugin, Validator } from "../../core/plugins"
import { UserDocument, UserModel } from "src/models/user"
import captcha from 'svg-captcha';
import { Request, Response } from "express";
import { sendEmail } from "../email";
import { i18n } from "../i18n";
import { baseUrl, SignUtils } from "src/utils";
import { ViewRenderEvent } from "src/events/page";

export class UserEmailLoginEvent extends CancellableEvent {
    constructor(public user: UserDocument) {
        super()
    }
}

export class UserRegisterEvent extends CancellableEvent {
    cancel_reason: string = ''
    constructor(public nickname: string, public email: string, public password: string) {
        super()
    }
}

export class UserCreateEvent extends CancellableEvent {
    cancel_reason: string = ''
    constructor(public nickname: string, public email: string, public password: string) {
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
        password_min_length: 6,
        password_max_length: 32
    },
    apis: {
        '/login': 'post',
        '/register': 'post',
        '/reset-password': 'post',
        '/reset-password-feedback': 'post',
        '/code.png': 'get',
        '/confirm-email': 'get'
    }
}, (plugin) => {

    plugin.on(ViewRenderEvent, e => {
        e.data = e.data || {}
        Object.assign(e.data, {
            user: plugin.sessions.get(e.req, 'user'),
            passport_settings: plugin.settings.all(),
        })
    })

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
        render: (req) => {
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

    const commonValidator: Record<string, Validator> = {
        email: { type: 'string', required: true, match: /^\w+(-+.\w+)*@\w+(-.\w+)*.\w+(-.\w+)*$/, error_of_invalid_match: i18n('passport.validator.invalid_email') },
        password: { type: 'string', required: true, min_length: plugin.settings.get('password_min_length'), max_length: plugin.settings.get('password_max_length'), error_of_invalid_length: i18n('passport.validator.invalid_passport') },
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


    plugin.api('/code.png', async (req, res) => {
        const captchaObj = bindCaptcha(req)
        if (captchaObj) {
            res.setHeader('Content-Type', 'image/svg+xml')
            res.send(captchaObj.data)
        } else {
            res.status(404).end()
        }
    })

    plugin.api('/confirm-email', async (req, res) => {
        const sign = req.query.sign?.toString().trim()
        if (!sign) {
            return res.status(404).end()
        }
        const email = req.query.email?.toString().trim()
        const password = req.query.password?.toString().trim()
        if (!email || !password) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.confirm_email_params_invalid') }))
        }
        if (SignUtils.verify({ email, password }, sign) === false) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.confirm_email_params_invalid') }))
        }
        const nickname = email
        const e = plugin.emit(new UserCreateEvent(nickname, email, password))
        if (e.isCancelled()) {
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: e.cancel_reason }))
        }
        const original = await UserDocument.findByEmail(email)
        if (original) {
            if (original.password === password) {
                return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'success', title: i18n('passport.register.confirm_email_success'), subtitle: i18n('passport.register.success_message') }))
            }
            return res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'danger', title: i18n('passport.register.confirm_email_failed'), subtitle: i18n('passport.register.email_exists') }))
        }
        const user = await UserDocument.create(nickname, email, password)
        plugin.sessions.set(req, 'user', user)
        res.send(await confirmEmailFeedbackView.render(req, { alert_type: 'success', title: i18n('passport.register.confirm_email_success'), subtitle: i18n('passport.register.success_message') }))
    })


    plugin.api('/login', plugin.validator((req) => req.body, commonValidator, loginView), async (req, res) => {
        await checkCaptchaCode(req, res, loginView)
        if (res.headersSent) {
            return
        }

        const email = req.body.email?.trim().toLowerCase()
        const password = req.body.password?.trim()
        const user = await UserModel.findOne({ email, password })
        if (!user) {
            return res.send(await loginView.render(req, { error: i18n('passport.login.email_login_failed') }))
        }

        const e = plugin.emit(new UserEmailLoginEvent(user))
        if (e.notCancelled()) {
            plugin.sessions.set(req, 'user', user)
            return res.send(await loginView.render(req, { success: i18n('passport.login.email_login_success'), redirect: { url: '/', timeout: 2 } }))
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
            console.error(e)
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
        const confirm_password = req.body.confirm_password?.trim().toLowerCase()

        if (password !== confirm_password) {
            return res.send(await resetPasswordFeedbackView.render(req, { error: i18n('passport.reset.confirm_password_not_match') }))
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

        const email = req.body.email?.trim().toLowerCase()
        const nickname = req.body.nickname?.trim()
        const password = req.body.password?.trim()
        const confirm_password = req.body.confirm_password?.trim()
        if (password !== confirm_password) {
            return res.send(await registerView.render(req, { error: i18n('passport.register.confirm_password_not_match') }))
        }
        const e = plugin.emit(new UserRegisterEvent(nickname, email, password))
        if (e.isCancelled()) {
            return res.send(await registerView.render(req, { error: e.cancel_reason }))
        }

        try {
            await sendEmail(email, {
                subject: i18n('passport.register.confirm_email.subject'),
                html: await emailTemplateView.render(req, { subject: i18n('passport.register.confirm_email.message'), link: createEmailConfirmUrl(email, password) })
            })
        } catch (e) {
            console.error(e)
            return res.send(await registerView.render(req, { error: i18n('passport.register.confirm_email_send_error', { error_message: e.message }) }))
        }
        return res.send(await registerView.render(req, { success: i18n('passport.register.confirm_email_sended') }))
    })
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
function createEmailConfirmUrl(email: string, password: string) {
    return baseUrl(`/${PassportPlugin.id}/confirm-email?&email=${email}&password=${password}&sign=` + SignUtils.sign({ email, password }))
}

/**
 * 创建邮箱验证链接 
 */
function createResetPasswordUrl(email: string) {
    return baseUrl(`/${PassportPlugin.id}/reset-password-feedback?email=${email}&sign=` + SignUtils.sign({ email }))
}
