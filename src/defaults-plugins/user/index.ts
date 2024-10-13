import { global_config } from "ebbs.config";
import { definePlugin } from "src/core/plugins";
import { PostDocument, PostModel } from "src/models/post";
import { UserFollowUserDocument } from "src/models/state/user.follow.user";
import { UserDocument, UserModel } from "src/models/user";
import { hasBlankParams } from "src/utils";
import { PassportPlugin } from "../passport";
import { NotifyDocument, NotifyModel, NotifyType } from "src/models/notify";
import { CommentDocument } from "src/models/comment";
import { sendCommentRedirect } from "../render";
import { UserCollectPostDocument } from "src/models/state/user.collect.post";




definePlugin({
    id: 'user',
    name: 'user-plugin',
    apis: {
        '/read-notify': 'get',
        '/settings': 'post'
    },
}, (plugin, app) => {

    const userView = plugin.definedView('index.ejs')

    app.get('/u/:account', async (req, res) => {
        const account = req.params.account?.trim() || ''
        const page = req.query.p?.toString().trim() || '1'
        const show = req.query.show?.toString().trim() || ''
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
                return { ...p.toJSON(), user: find_account }
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

        return res.send(await userView.render(req, { account: find_account, total_page, posts, fans, follows }))
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
                return res.redirect('/passport/login')
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
                    return { ...d.toJSON(), user }
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
                return res.redirect('/passport/login')
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
                return res.redirect('/passport/login')
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
                notifies: await Promise.all(docs.map(async n => {
                    const data = n.toJSON()
                    Reflect.set(data, 'sender', await UserDocument.findOne({ uid: n.sender_uid }))
                    if (n.type === 'reply-comment' && n.data.reply_comment) {
                        Reflect.set(data, 'comment', await CommentDocument.findByUid(n.data.reply_comment.comment_uid))
                        Reflect.set(data, 'parent', await CommentDocument.findByUid(n.data.reply_comment.parent_uid))
                    }
                    if (n.type === 'reply-post' && n.data.reply_post) {
                        Reflect.set(data, 'post', await PostDocument.findByUid(n.data.reply_post.post_uid))
                        Reflect.set(data, 'comment', await CommentDocument.findByUid(n.data.reply_post.comment_uid))
                    }
                    return data
                })),
                total_page: Math.ceil(total_count / size)
            })
        }
    })

    plugin.api('/read-notify', async (req, res) => {
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
        } else {
            return plugin.sendError(req, res, 500)
        }
    })

    plugin.definePage({
        path: '/settings',
        render: settingsView.render
    })


    plugin.api('/settings', plugin.validator((req) => req.body, {
        nickname: { max_length: 20, min_length: 2, type: 'string' },
        profile: { max_length: 100, min_length: 2, type: 'string' }
    }, settingsView), async (req, res) => {

        const user = PassportPlugin.sessions.get(req, 'user')
        const { nickname, profile } = req.body 
        if (!user) {
            return plugin.sendError(req, res, 403)
        }
        user.nickname = nickname
        user.profile = profile

        PassportPlugin.sessions.set(req, 'user', user) 

        const { acknowledged } = await UserModel.updateOne({ uid: user.uid }, { nickname: user.nickname, profile: user.profile })
        if (acknowledged) {
            return res.redirect('/user/settings')
        } else {
            return plugin.sendError(req, res, 500)
        }
    })

})