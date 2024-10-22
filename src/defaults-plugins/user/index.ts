import { global_config } from "ebbs.config";
import { definePlugin } from "src/core/plugins";
import { PostDocument, PostModel } from "src/models/post";
import { UserFollowUserDocument } from "src/models/state/user.follow.user";
import { UserDocument, UserModel } from "src/models/user";
import { hasBlankParams } from "src/utils";
import { PassportPlugin, permission } from "../passport";
import { NotifyDocument, NotifyModel, NotifyType } from "src/models/notify";
import { CommentDocument } from "src/models/comment";
import { sendCommentRedirect } from "../render";
import { UserCollectPostDocument } from "src/models/state/user.collect.post";
import { UserAttachment } from "src/utils/file";
import { ViewRenderEvent } from "src/events/page";




definePlugin({
    id: 'user',
    name: 'user-plugin',
    apis: {
        '/read-notify': 'get',
        '/delete-image': 'get',
        '/settings': 'post',
        '/toggle-follow': 'get',
        '/report': 'get',
    },
}, (plugin, app) => {

    const userView = plugin.definedView('index.ejs')

    app.get('/u/:account', async (req, res) => {
        const account = req.params.account?.trim() || ''
        const page = req.query.p?.toString().trim() || '1'
        const show = req.query.show?.toString().trim() || ''
        const user = PassportPlugin.sessions.get(req, 'user')
        if (hasBlankParams(account, page)) {
            return plugin.sendError(req, res, 400)
        }
        const find_account = await UserDocument.findOne({ account })
        if (!find_account) {
            return plugin.sendError(req, res, 404)
        }

        const size = global_config.user.pagination.size
        let page_value = parseInt(page!)
        if (isNaN(page_value)) {
            return
        }
        let total_page = 0
        let posts: PostDocument[] = []
        let fans: UserDocument[] = []
        let follows: UserDocument[] = []

        if (show === 'posts') {
            const post_docs = await PostDocument.list({ user_uid: find_account.uid }, { page: page_value, size: size })
            posts = post_docs.map(p => {
                return { ...p, user: find_account }
            })
            total_page = Math.ceil(await PostDocument.countByUser(find_account.uid) / size)
        }
        else if (show === 'fans') {
            fans = await UserFollowUserDocument.list({ target_uid: find_account.uid }, page_value, size)
            total_page = Math.ceil(await UserFollowUserDocument.count({ target_uid: find_account.uid }) / size)
        }
        else if (show === 'follows') {
            follows = await UserFollowUserDocument.list({ user_uid: find_account.uid }, page_value, size)
            total_page = Math.ceil(await UserFollowUserDocument.count({ user_uid: find_account.uid }) / size)
        }
        let followed = false;
        if (user) {
            followed = await UserFollowUserDocument.isFollowing(user, find_account)
        }

        return res.send(await userView.render(req, { account: find_account, total_page, posts, fans, follows, followed }))
    })


    const draftsView = plugin.definedView('drafts.ejs')
    const collectsView = plugin.definedView('collects.ejs')
    const notifiesView = plugin.definedView('notifies.ejs')
    const settingsView = plugin.definedView('settings.ejs')

    plugin.definePage({
        path: '/drafts',
        render: async (req, res) => {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (!user) {
                return res.redirect(PassportPlugin.api('/login'))
            }
            const page = req.query.p?.toString().trim() || '1'
            const size = global_config.user.pagination.size
            const total_count = await PostDocument.count({ user_uid: user.uid, draft: true })
            if (hasBlankParams(page)) {
                return plugin.sendError(req, res, 400)
            }

            const draft_docs = await PostDocument.list({ user_uid: user.uid, draft: true }, { page: parseInt(page), size })

            return draftsView.render(req, {
                drafts: draft_docs.map(d => {
                    return { ...d, user }
                }),
                total_page: Math.ceil(total_count / size)
            })
        }
    })


    plugin.definePage({
        path: '/collects',
        render: async (req, res) => {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (!user) {
                return res.redirect(PassportPlugin.api('/login'))
            }
            const page = req.query.p?.toString().trim() || '1'
            const size = global_config.user.pagination.size
            const total_count = await UserCollectPostDocument.count(user.uid)
            if (hasBlankParams(page)) {
                return plugin.sendError(req, res, 400)
            }

            const docs = await UserCollectPostDocument.list(user.uid, parseInt(page), size)

            return collectsView.render(req, {
                collects: await Promise.all(docs.map(async d => {
                    const user = await UserDocument.findOne({ uid: d.user_uid })
                    return { ...d.toJSON(), user }
                })),
                total_page: Math.ceil(total_count / size)
            })
        }
    })

    plugin.definePage({
        path: '/notifies',
        render: async (req, res) => {
            const user = PassportPlugin.sessions.get(req, 'user')
            if (!user) {
                return res.redirect(PassportPlugin.api('/login'))
            }
            const page = req.query.p?.toString().trim() || '1'
            const type = req.query.type?.toString().trim() || 'all'
            const size = global_config.user.pagination.size
            const total_count = await NotifyModel.countDocuments({ receiver_uid: user.uid })
            if (hasBlankParams(page)) {
                return plugin.sendError(req, res, 400)
            }
            let notify_type: NotifyType | undefined = undefined
            let unread: string | undefined = undefined;
            if (type === 'reply-comment') {
                notify_type = 'reply-comment'
            } else if (type === 'reply-post') {
                notify_type = 'reply-post'
            } else if (type === 'system') {
                notify_type = 'system'
            } else if (type === 'followed') {
                notify_type = 'followed'
            } else if (type === 'unread') {
                unread = '1'
            }

            const filter = { receiver_uid: user.uid }

            if (notify_type) {
                Reflect.set(filter, 'type', notify_type)
            }
            if (unread) {
                Reflect.set(filter, 'read', false)
            }

            const docs = await NotifyModel.find(filter)
                .sort({ create_at: -1 })
                .skip((parseInt(page) - 1) * size)
                .limit(size)

            return notifiesView.render(req, {
                notifies: docs,
                total_page: Math.ceil(total_count / size)
            })
        }
    })

    plugin.definePage({
        path: '/settings',
        render: settingsView.render
    })

    plugin.api('/read-notify', permission(), async (req, res) => {
        const user = PassportPlugin.sessions.get(req, 'user')
        if (!user) {
            return plugin.sendError(req, res, 403)
        }
        const notify_uid = req.query.uid?.toString().trim()
        if (hasBlankParams(notify_uid)) {
            return plugin.sendError(req, res, 400)
        }
        const notify = await NotifyModel.findOne({ uid: notify_uid, receiver_uid: user.uid })
        if (!notify) {
            return plugin.sendError(req, res, 404)
        }
        if (notify.receiver_uid !== user.uid) {
            return plugin.sendError(req, res, 403)
        }
        notify.read = true
        await notify.save()

        const comment_uid = notify.data.reply_comment?.comment_uid || notify.data.reply_post?.comment_uid

        // 重定向
        if (notify.type === 'reply-comment' || notify.type === 'reply-post') {
            if (!comment_uid) {
                return plugin.sendError(req, res, 403)
            }
            return sendCommentRedirect(req, res, { uid: comment_uid })
        }
        else if (notify.type === 'followed' && notify.data.followed) {
            return res.redirect(`/p/${notify.data.followed.post_short_id}`)
        }
        else {
            return plugin.sendError(req, res, 500)
        }
    })


    plugin.api('/settings', permission(), plugin.validator((req) => req.body, {
        nickname: { max_length: 20, min_length: 2, type: 'string', required: false },
        profile: { max_length: 100, min_length: 2, type: 'string', required: false }
    }, settingsView), async (req, res) => {
        const user = PassportPlugin.sessions.get(req, 'user')

        const { bg, avatar } = req.files || {}
        const { nickname, profile } = req.body
        if (!user) {
            return plugin.sendError(req, res, 403)
        }
        if (user.nickname !== nickname) {
            user.nickname = nickname
        }
        if (user.profile !== profile) {
            user.profile = profile
        }

        try {
            const ua = UserAttachment.of(user, 'images')
            if (bg && Array.isArray(bg) === false) {
                bg.name = 'bg.png'
                const { url } = await ua.addImage(bg, { overwrite: true })
                user.profile_background = url
            }
            if (avatar && Array.isArray(avatar) === false) {
                avatar.name = 'avatar.png'
                const { url } = await ua.addImage(avatar, { overwrite: true })
                user.avatar = url
            }
        } catch (e) {
            return plugin.sendError(req, res, 500, e.message)
        }

        PassportPlugin.sessions.set(req, 'user', user)

        const { acknowledged } = await UserModel.updateOne({ uid: user.uid }, { nickname: user.nickname, profile: user.profile, avatar: user.avatar, profile_background: user.profile_background })
        if (acknowledged) {
            return res.redirect('/user/settings')
        } else {
            return plugin.sendError(req, res, 500)
        }
    })


    plugin.api('/delete-image', permission(), async (req, res) => {
        const type = req.query.type?.toString().trim()
        const user = PassportPlugin.sessions.get(req, 'user')
        if (!user) {
            return plugin.sendError(req, res, 403)
        }
        const ua = UserAttachment.of(user, 'images')
        if (type === 'avatar') {
            user.avatar = ''
            ua.delete('avatar.png')
        } else if (type === 'profile_background') {
            user.profile_background = ''
            ua.delete('bg.png')
        } else {
            return plugin.sendError(req, res, 400)
        }
        const { acknowledged } = await UserModel.updateOne({ uid: user.uid }, { avatar: user.avatar, profile_background: user.profile_background })
        if (acknowledged) {
            return res.redirect('/user/settings')
        } else {
            return plugin.sendError(req, res, 500)
        }
    })


    plugin.api('/toggle-follow', permission(), async (req, res) => {
        const user = PassportPlugin.sessions.get(req, 'user')
        if (!user) {
            return plugin.sendError(req, res, 403)
        }
        const target_account = req.query.account?.toString().trim()
        if (hasBlankParams(target_account)) {
            return plugin.sendError(req, res, 400)
        }
        // 自己无法关注自己
        if (user.account === target_account) {
            return plugin.sendError(req, res, 400, '不能关注自己')
        }
        const target = await UserDocument.findOne({ account: target_account })
        if (!target) {
            return plugin.sendError(req, res, 404)
        }
        await UserFollowUserDocument.toggle(user, target)
        return res.redirect(`/u/${target_account}`)
    })

    plugin.on(ViewRenderEvent, async e => {
        e.data = e.data || {}
        const user = PassportPlugin.sessions.get(e.req, 'user')
        if (user) {
            e.data.notify_count = await NotifyDocument.countUnread(user.uid)
        }
    })

})


